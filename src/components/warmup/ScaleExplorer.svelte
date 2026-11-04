<script lang="ts">
  import type { Instrument } from "../../lib/types";
  import { ROOTS, noteName, parseRootKey, rootKey, type SpelledNote } from "../../lib/theory/notes";
  import { SCALES, buildScale, formatDegree, getScale, scaleLabel, stepPattern, type ScaleFamily, type ScaleId } from "../../lib/theory/scales";
  import { diatonicChords, parentMajor, relativeMajor, relativeMinor, seventhName, triadName } from "../../lib/theory/relatives";
  import { scaleMidi, tuningFor } from "../../lib/theory/fretboard";
  import { playChord, playSequence, stopAll } from "../../lib/audio/synth";
  import { notation } from "../../lib/warmupLog";
  import Fretboard from "./Fretboard.svelte";

  let { root = $bindable({ letter: 0, accidental: 0 }), scaleId = $bindable("jonico"), instrument = $bindable("guitarra"), compact = false }: {
    root?: SpelledNote;
    scaleId?: ScaleId;
    instrument?: Instrument;
    /** Sin selectores: solo la escala elegida desde fuera (rutina). */
    compact?: boolean;
  } = $props();

  let labels = $state<"nota" | "grado">("nota");

  const FAMILIES: { id: ScaleFamily; label: string }[] = [
    { id: "modo", label: "Modos griegos" },
    { id: "menor", label: "Menores" },
    { id: "pentatonica", label: "Pentatónicas y blues" },
  ];

  const scale = $derived(getScale(scaleId));
  const notes = $derived(buildScale(root, scaleId));
  const n = $derived($notation);
  const name = (note: SpelledNote) => noteName(note, n);
  const chords = $derived(diatonicChords(root, scaleId));
  const parent = $derived(scaleId !== "jonico" ? parentMajor(root, scaleId) : null);
  const relation = $derived.by(() => {
    if (scaleId === "jonico") return { text: `Relativa menor: ${name(relativeMinor(root))} menor (eólico)`, root: relativeMinor(root), scale: "eolico" as ScaleId };
    if (scaleId === "eolico") return { text: `Relativa mayor: ${name(relativeMajor(root))} mayor`, root: relativeMajor(root), scale: "jonico" as ScaleId };
    if (scaleId === "pentaMenor") return { text: `Mismas notas que ${name(relativeMajor(root))} pentatónica mayor`, root: relativeMajor(root), scale: "pentaMayor" as ScaleId };
    if (scaleId === "pentaMayor") return { text: `Mismas notas que ${name(relativeMinor(root))} pentatónica menor`, root: relativeMinor(root), scale: "pentaMenor" as ScaleId };
    if (parent) return { text: `Mismas notas que ${name(parent)} mayor (empieza en su ${scale.majorDegree}º grado)`, root: parent, scale: "jonico" as ScaleId };
    return null;
  });

  function play() {
    stopAll();
    const up = scaleMidi(instrument, root, scaleId);
    playSequence([...up, ...up.slice(0, -1).reverse()], 160);
  }

  function playDiatonic(index: number) {
    stopAll();
    const up = scaleMidi(instrument, root, scaleId).slice(0, -1);
    const tone = (step: number) => up[(index + step) % 7] + 12 * Math.floor((index + step) / 7);
    playChord([tone(0), tone(2), tone(4), tone(6)].map((m) => m + (instrument === "bajo" ? 12 : 0)));
  }

  function goTo(nextRoot: SpelledNote, nextScale: ScaleId) {
    // Si la tónica relativa no está en el selector (p. ej. Re♯), la mostramos igual.
    root = nextRoot;
    scaleId = nextScale;
  }
</script>

<div class="explorer">
  {#if !compact}
    <div class="controls">
      <label>
        <span>Tónica</span>
        <select value={rootKey(root)} onchange={(e) => (root = parseRootKey(e.currentTarget.value))}>
          {#if !ROOTS.some((r) => rootKey(r) === rootKey(root))}<option value={rootKey(root)}>{name(root)}</option>{/if}
          {#each ROOTS as option (rootKey(option))}<option value={rootKey(option)}>{name(option)}</option>{/each}
        </select>
      </label>
      <label class="grow">
        <span>Escala</span>
        <select bind:value={scaleId}>
          {#each FAMILIES as family (family.id)}
            <optgroup label={family.label}>
              {#each SCALES.filter((s) => s.family === family.id) as option (option.id)}<option value={option.id}>{scaleLabel(option)}</option>{/each}
            </optgroup>
          {/each}
        </select>
      </label>
      <div class="segmented" role="group" aria-label="Instrumento">
        <button type="button" class:active={instrument === "bajo"} aria-pressed={instrument === "bajo"} onclick={() => (instrument = "bajo")}>Bajo</button>
        <button type="button" class:active={instrument === "guitarra"} aria-pressed={instrument === "guitarra"} onclick={() => (instrument = "guitarra")}>Guitarra</button>
      </div>
    </div>
  {/if}

  <div class="summary">
    <div class="title-row">
      <h3>{name(root)} {scaleLabel(scale).toLowerCase()}</h3>
      <button type="button" class="press-btn" onclick={play}>▶ Escuchar</button>
    </div>
    <p class="mood">{scale.mood}</p>
    <ol class="notes" aria-label="Notas de la escala">
      {#each notes as note, i (i)}
        <li class:root={i === 0}><span class="note">{name(note)}</span><span class="degree">{formatDegree(scale.formula[i])}</span></li>
      {/each}
    </ol>
    <p class="pattern"><strong>Patrón:</strong> <span class="mono">{stepPattern(scale)}</span> <span class="muted">(T = tono, S = semitono)</span></p>
    <p>{scale.description}</p>
    {#if relation}
      <p class="relation">
        {relation.text}
        {#if !compact}<button type="button" class="link-btn" onclick={() => goTo(relation.root, relation.scale)}>Ver</button>{/if}
      </p>
    {/if}
    <div class="use">
      <strong>Úsala sobre:</strong>
      <ul>{#each scale.useOver as item (item)}<li>{item}</li>{/each}</ul>
    </div>
  </div>

  <div class="fret-head">
    <h4>En el diapasón</h4>
    <div class="segmented small" role="group" aria-label="Etiquetas">
      <button type="button" class:active={labels === "nota"} aria-pressed={labels === "nota"} onclick={() => (labels = "nota")}>Notas</button>
      <button type="button" class:active={labels === "grado"} aria-pressed={labels === "grado"} onclick={() => (labels = "grado")}>Grados</button>
    </div>
  </div>
  <Fretboard tuning={tuningFor(instrument)} {root} {scaleId} {labels} notation={n} />

  {#if chords.length && !compact}
    <h4>Acordes de la escala</h4>
    <p class="muted small-text">Cada grado forma un acorde con notas de la misma escala. {scale.majorDegree ? "La columna “modo” indica qué modo suena natural sobre cada uno." : ""}</p>
    <div class="chords">
      {#each chords as chord, i (chord.degree)}
        <button type="button" class="chord" onclick={() => playDiatonic(i)} aria-label={`${chord.roman}: ${seventhName(chord, n)}, escuchar`}>
          <span class="roman">{chord.roman}</span>
          <span class="chord-name">{triadName(chord, n)}</span>
          <span class="seventh">{seventhName(chord, n)}</span>
          {#if chord.mode}<span class="mode">{getScale(chord.mode).name}</span>{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .explorer { display:grid; gap:16px; min-width:0; }
  .controls { display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; }
  .controls label { display:grid; gap:4px; font-size:.75rem; font-weight:700; color:var(--muted); }
  .controls .grow { flex:1; min-width:180px; }
  .controls select { width:100%; }
  .segmented.small button { min-height:32px; padding:4px 12px; }
  .summary { display:grid; gap:8px; }
  .summary p { margin:0; }
  .title-row { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
  h3 { margin:0; font:700 1.25rem "Bricolage Grotesque", sans-serif; }
  h4 { margin:0; font:700 1rem "Bricolage Grotesque", sans-serif; }
  .mood { color:var(--muted); font-style:italic; }
  .notes { list-style:none; display:flex; flex-wrap:wrap; gap:8px; margin:4px 0; padding:0; }
  .notes li { display:grid; justify-items:center; min-width:48px; padding:6px 8px; border:1.5px solid var(--border); border-radius:10px; background:var(--surface); }
  .notes li.root { background:var(--coral); color:var(--ink); }
  .note { font:700 1rem "Manrope", sans-serif; }
  .degree { font:600 .7rem "JetBrains Mono", monospace; opacity:.75; }
  .mono { font-family:"JetBrains Mono", monospace; }
  .muted { color:var(--muted); }
  .small-text { margin:-8px 0 0; font-size:.8rem; }
  .relation { padding:10px 12px; border-radius:var(--radius-sm); background:var(--surface-muted); display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .link-btn { border:0; background:none; color:var(--coral); font-weight:700; cursor:pointer; text-decoration:underline; padding:4px; min-height:32px; }
  .use ul { margin:4px 0 0; padding-left:20px; }
  .fret-head { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:-8px; }
  .chords { display:grid; grid-template-columns:repeat(auto-fill, minmax(112px, 1fr)); gap:8px; }
  .chord { display:grid; gap:2px; text-align:left; padding:10px 12px; border:1px solid var(--line); border-radius:var(--radius-md); background:var(--surface); color:var(--text); cursor:pointer; font-family:"Manrope", sans-serif; min-height:44px; }
  .chord:hover { border-color:var(--coral); }
  .roman { font:700 .75rem "JetBrains Mono", monospace; color:var(--coral); }
  .chord-name { font-weight:700; }
  .seventh, .mode { font-size:.75rem; color:var(--muted); }
</style>
