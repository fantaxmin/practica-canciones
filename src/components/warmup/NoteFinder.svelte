<script lang="ts">
  import { onDestroy, tick, untrack } from "svelte";
  import type { Instrument } from "../../lib/types";
  import { noteName, pitchClass, type PitchClass } from "../../lib/theory/notes";
  import { tuningFor } from "../../lib/theory/fretboard";
  import { playNote, stopAll } from "../../lib/audio/synth";
  import { logWarmup, notation } from "../../lib/warmupLog";
  import { LEVELS, checkSelection, generateChallenge, spelledFor, spotKey, spotMidi, stringName, type FinderLevel, type FinderMode, type FretSpot, type SelectionResult, type SpotState } from "../../lib/noteFinder";
  import FretboardPicker from "./FretboardPicker.svelte";

  let { instrument = $bindable("bajo") }: { instrument?: Instrument } = $props();

  const MODES: { id: FinderMode; label: string; hint: string }[] = [
    { id: "todas", label: "Todas las posiciones", hint: "Marca todos los lugares donde está la nota y comprueba." },
    { id: "cuerda", label: "En una cuerda", hint: "Toca la nota en la cuerda resaltada." },
    { id: "nombrar", label: "¿Qué nota es?", hint: "Nombra la nota marcada." },
  ];

  let mode = $state<FinderMode>("todas");
  let level = $state<FinderLevel>(1);
  let showNames = $state(false);
  let review = $state<PitchClass[]>([]);
  const tuning = $derived(tuningFor(instrument));
  const n = $derived($notation);
  let challenge = $state(untrack(() => generateChallenge("todas", 1, tuningFor(instrument))));
  let selected = $state<FretSpot[]>([]);
  let result = $state<SelectionResult | null>(null);
  let chosenName = $state<string | null>(null);
  let score = $state(0);
  let total = $state(0);
  let streak = $state(0);
  let heading = $state<HTMLElement>();

  onDestroy(stopAll);

  const answered = $derived(result !== null);
  const target = $derived(noteName(challenge.note, n));
  const prompt = $derived(challenge.mode === "todas"
    ? `Encuentra todos los ${target}`
    : challenge.mode === "cuerda"
      ? `Encuentra ${target} en la cuerda ${stringName(tuning, challenge.string!, n)}`
      : "¿Qué nota es la marcada?");

  const marks = $derived.by(() => {
    const out: Record<string, SpotState> = {};
    if (challenge.mode === "nombrar" && challenge.spot) out[spotKey(challenge.spot)] = result ? (result.perfect ? "correct" : "wrong") : "target";
    if (challenge.mode !== "nombrar") {
      if (!result) for (const s of selected) out[spotKey(s)] = "selected";
      else {
        for (const s of result.missed) out[spotKey(s)] = "missed";
        for (const s of result.hits) out[spotKey(s)] = "correct";
        for (const s of result.wrong) out[spotKey(s)] = "wrong";
      }
    }
    return out;
  });

  function next() {
    stopAll();
    challenge = generateChallenge(mode, level, tuning, Math.random, review, n);
    selected = [];
    result = null;
    chosenName = null;
    void tick().then(() => heading?.focus());
  }

  function setMode(next_: FinderMode) { mode = next_; next(); }
  function setLevel(next_: FinderLevel) { level = next_; next(); }
  function setInstrument(next_: Instrument) { instrument = next_; next(); }

  function finish(res: SelectionResult) {
    result = res;
    total++;
    const pc = pitchClass(challenge.note);
    if (res.perfect) {
      score++;
      streak++;
      review = review.filter((p) => p !== pc);
    } else {
      streak = 0;
      if (!review.includes(pc)) review = [...review, pc];
    }
  }

  function pick(spot: FretSpot) {
    if (answered || challenge.mode === "nombrar") return;
    playNote(spotMidi(tuning, spot) + (instrument === "bajo" ? 12 : 0), 0.6);
    if (challenge.mode === "cuerda") {
      // Basta con una posición correcta en la cuerda (traste 0 y 12 son la misma nota).
      const res = checkSelection(challenge, [spot]);
      finish(res.hits.length ? { ...res, missed: [], perfect: true } : res);
      return;
    }
    const key = spotKey(spot);
    selected = selected.some((s) => spotKey(s) === key) ? selected.filter((s) => spotKey(s) !== key) : [...selected, spot];
  }

  function nameAnswer(option: string) {
    if (answered) return;
    chosenName = option;
    playNote(spotMidi(tuning, challenge.spot!) + (instrument === "bajo" ? 12 : 0), 0.8);
    finish(option === target ? { hits: [challenge.spot!], wrong: [], missed: [], perfect: true } : { hits: [], wrong: [challenge.spot!], missed: [], perfect: false });
  }

  function playAll() {
    stopAll();
    challenge.targets.forEach((spot, i) => playNote(spotMidi(tuning, spot) + (instrument === "bajo" ? 12 : 0), 0.45, i * 0.35));
  }

  function end() {
    if (total) logWarmup({ kind: "notas", score, total, detail: `${MODES.find((m) => m.id === mode)?.label} · nivel ${level} · ${instrument}` });
    score = 0;
    total = 0;
    streak = 0;
    review = [];
    next();
  }

  const feedback = $derived.by(() => {
    if (!result) return "";
    if (challenge.mode === "nombrar") return result.perfect ? `Correcto: es ${target}.` : `No: es ${target}${chosenName ? ` (elegiste ${chosenName})` : ""}.`;
    if (challenge.mode === "cuerda") return result.perfect ? `Correcto: ${target} en el traste ${challenge.targets[0]?.fret}.` : `No: ${target} está en ${challenge.targets.map((t) => `el traste ${t.fret}`).join(" y ")}.`;
    if (result.perfect) return `¡Todas! ${target} aparece ${challenge.targets.length} veces hasta el traste ${challenge.maxFret}.`;
    const parts = [`Encontraste ${result.hits.length} de ${challenge.targets.length}`];
    if (result.wrong.length) parts.push(`${result.wrong.length} ${result.wrong.length === 1 ? "marca incorrecta" : "marcas incorrectas"}`);
    return `${parts.join(" · ")}. Las que faltaron están con borde punteado.`;
  });
</script>

<div class="finder card">
  <div class="intro">
    <h3>Encontrar notas en el diapasón</h3>
    <p>Para dejar de depender de las figuras: ubica cualquier nota rápido. <strong>Antes de responder, tócala en tu {instrument} y dila en voz alta.</strong></p>
  </div>

  <div class="settings">
    <div class="field">
      <span class="field-label" id="finder-mode">Ejercicio</span>
      <div class="pills" role="group" aria-labelledby="finder-mode">
        {#each MODES as item (item.id)}
          <button type="button" class="pill-btn" class:active={mode === item.id} aria-pressed={mode === item.id} onclick={() => setMode(item.id)}>{item.label}</button>
        {/each}
      </div>
    </div>
    <div class="row">
      <label class="field">
        <span class="field-label">Nivel</span>
        <select value={level} onchange={(e) => setLevel(Number(e.currentTarget.value) as FinderLevel)}>
          {#each [1, 2, 3] as value (value)}<option value={value}>{value} · {LEVELS[value as FinderLevel].label}</option>{/each}
        </select>
      </label>
      <div class="segmented" role="group" aria-label="Instrumento">
        <button type="button" class:active={instrument === "bajo"} aria-pressed={instrument === "bajo"} onclick={() => setInstrument("bajo")}>Bajo</button>
        <button type="button" class:active={instrument === "guitarra"} aria-pressed={instrument === "guitarra"} onclick={() => setInstrument("guitarra")}>Guitarra</button>
      </div>
      <label class="toggle"><input type="checkbox" bind:checked={showNames} /> Mostrar nombres (ayuda)</label>
    </div>
  </div>

  <div class="score-row">
    <span>Aciertos <strong>{score} / {total}</strong></span>
    <span>Racha <strong>{streak}</strong></span>
    {#if review.length}<span class="review">Repasando: {review.map((pc) => noteName(spelledFor(pc), n)).join(", ")}</span>{/if}
  </div>

  <h4 bind:this={heading} tabindex="-1" class="prompt">{prompt}</h4>
  <p class="hint">{MODES.find((m) => m.id === challenge.mode)?.hint}{challenge.mode !== "nombrar" ? ` Hasta el traste ${challenge.maxFret}.` : ""}</p>

  <FretboardPicker {tuning} maxFret={challenge.maxFret} {marks} {showNames} notation={n}
    highlightString={challenge.mode === "cuerda" ? challenge.string : undefined}
    disabled={answered || challenge.mode === "nombrar"} onPick={pick} />

  {#if challenge.mode === "nombrar" && challenge.options}
    <div class="options" role="group" aria-label="Nombre de la nota">
      {#each challenge.options as option (option)}
        <button type="button" class="option" class:correct={answered && option === target} class:wrong={answered && option === chosenName && option !== target}
          disabled={answered} onclick={() => nameAnswer(option)}>{option}</button>
      {/each}
    </div>
  {/if}

  <div aria-live="polite">
    {#if result}<p class="feedback" class:ok={result.perfect}>{feedback}</p>{/if}
  </div>

  <div class="actions">
    {#if challenge.mode === "todas" && !answered}
      <button type="button" class="press-btn" disabled={!selected.length} onclick={() => finish(checkSelection(challenge, selected))}>Comprobar ({selected.length})</button>
    {/if}
    {#if answered}
      <button type="button" class="press-btn" onclick={next}>Siguiente</button>
      <button type="button" class="pill-btn" onclick={playAll}>Oír las posiciones</button>
    {/if}
    <button type="button" class="pill-btn end" disabled={!total} onclick={end}>Terminar y guardar</button>
  </div>
</div>

<style>
  .finder { padding:20px; display:grid; gap:14px; min-width:0; }
  h3 { margin:0; font:700 1.125rem "Bricolage Grotesque", sans-serif; }
  .intro p { margin:6px 0 0; color:var(--muted); font-size:.875rem; }
  .intro strong { color:var(--text); }
  .settings { display:grid; gap:12px; }
  .field { display:grid; gap:6px; }
  .field-label { font-size:.75rem; font-weight:700; color:var(--muted); }
  .pills { display:flex; flex-wrap:wrap; gap:6px; }
  .row { display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; }
  .row .field { min-width:200px; }
  .toggle { display:flex; align-items:center; gap:8px; font-size:.8125rem; font-weight:600; min-height:44px; cursor:pointer; }
  .score-row { display:flex; flex-wrap:wrap; gap:8px 20px; font-size:.8125rem; color:var(--muted); padding:10px 0; border-block:1px solid var(--line); }
  .score-row strong { color:var(--text); font-size:1rem; margin-left:4px; }
  .review { color:var(--coral); font-weight:700; }
  .prompt { margin:0; font:700 1.25rem "Bricolage Grotesque", sans-serif; }
  .prompt:focus { outline:none; }
  .hint { margin:-8px 0 0; color:var(--muted); font-size:.8125rem; }
  .options { display:grid; grid-template-columns:repeat(auto-fill, minmax(64px, 1fr)); gap:6px; }
  .option { min-height:44px; border:1.5px solid var(--line); border-radius:var(--radius-sm); background:var(--surface); color:var(--text); font:700 .9rem "Manrope", sans-serif; cursor:pointer; }
  .option:hover:not(:disabled) { border-color:var(--coral); }
  .option:disabled { opacity:.55; cursor:default; }
  .option.correct { border-color:var(--success); background:var(--success-soft); opacity:1; }
  .option.wrong { border-color:var(--error); background:var(--error-soft); opacity:1; }
  .feedback { margin:0; padding:10px 14px; border-radius:var(--radius-sm); background:var(--error-soft); border-left:4px solid var(--error); font-size:.875rem; }
  .feedback.ok { background:var(--success-soft); border-left-color:var(--success); }
  .actions { display:flex; flex-wrap:wrap; gap:8px; }
  .end { margin-left:auto; }
  @media (max-width:640px) { .finder { padding:14px; } .end { margin-left:0; } }
</style>
