<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { generateExercise, type ExerciseType, type Level } from "../lib/earTraining";
  import { playExercise } from "../lib/earTrainingPlayback";
  import { playNote, stopAll } from "../lib/audio/synth";
  import { logWarmup } from "../lib/warmupLog";

  const types: { id: ExerciseType; label: string }[] = [
    { id: "intervalo", label: "Intervalos" }, { id: "acorde", label: "Acordes" }, { id: "escala", label: "Escalas" },
  ];
  const levels: Level[] = [1, 2, 3];
  let type = $state<ExerciseType>("intervalo");
  let level = $state<Level>(1);
  let exercise = $state(generateExercise("intervalo", 1, Math.random));
  let selected = $state<string | null>(null);
  let heard = $state(false);
  let score = $state(0);
  let total = $state(0);
  let streak = $state(0);
  let notice = $state("");
  let audioError = $state("");
  let listenButton: HTMLButtonElement;
  const correct = $derived(selected === exercise.answerId);

  onDestroy(stopAll);

  function resetExercise() {
    stopAll();
    exercise = generateExercise(type, level, Math.random);
    selected = null;
    heard = false;
    audioError = "";
  }

  function saveSession() {
    if (!total) return;
    logWarmup({ kind: "oido", score, total, detail: `${types.find((item) => item.id === type)!.label} · nivel ${level}` });
    notice = `Sesión guardada: ${score} de ${total} aciertos.`;
    score = 0;
    total = 0;
    streak = 0;
  }

  function configure(nextType: ExerciseType, nextLevel: Level) {
    if (nextType === type && nextLevel === level) return;
    saveSession();
    type = nextType;
    level = nextLevel;
    resetExercise();
  }

  function listen(tonicOnly = false) {
    audioError = "";
    try {
      if (tonicOnly) { stopAll(); playNote(exercise.midis[0], 0.8); }
      else { playExercise(exercise); heard = true; }
    } catch {
      stopAll();
      audioError = "No se pudo reproducir el audio. Pulsa de nuevo para intentarlo.";
    }
  }

  function answer(id: string) {
    if (!heard || selected !== null) return;
    selected = id;
    total += 1;
    if (id === exercise.answerId) { score += 1; streak += 1; }
    else streak = 0;
    notice = "";
  }

  async function next() {
    resetExercise();
    await tick();
    listenButton?.focus();
  }

  async function finish() {
    saveSession();
    await next();
  }
</script>

<section class="ear-training card" aria-label="Entrenador de oído">
  <header>
    <h2>Entrenador de oído</h2>
    <p class="hint">Escucha, compara y elige lo que reconoces. Puedes repetir tantas veces como quieras.</p>
  </header>

  <div class="settings">
    <fieldset>
      <legend>Tipo de ejercicio</legend>
      <div class="pills">
        {#each types as item (item.id)}
          <button type="button" class="pill-btn" class:active={type === item.id} aria-pressed={type === item.id} onclick={() => configure(item.id, level)}>{item.label}</button>
        {/each}
      </div>
    </fieldset>
    <fieldset>
      <legend>Nivel</legend>
      <div class="pills">
        {#each levels as item}
          <button type="button" class="pill-btn" class:active={level === item} aria-pressed={level === item} onclick={() => configure(type, item)}>Nivel {item}</button>
        {/each}
      </div>
    </fieldset>
  </div>
  <p class="hint">Al cambiar de tipo o nivel se guarda la sesión actual.</p>

  <dl class="counters" aria-label="Resultados de esta sesión">
    <div><dt>Aciertos / intentos</dt><dd>{score} / {total}</dd></div>
    <div><dt>Racha actual</dt><dd>{streak}</dd></div>
  </dl>

  <div class="question">
    <h3>{exercise.label}</h3>
    <p class="hint">{type === "acorde" ? "Las notas suenan juntas, en estado fundamental." : type === "escala" ? "La escala sube desde la tónica hasta la octava." : level === 3 ? "Puede subir, bajar o sonar con ambas notas a la vez." : "Las dos notas suenan de forma ascendente."}</p>
    <div class="playback">
      <button bind:this={listenButton} type="button" class="press-btn" onclick={() => listen()}>{heard ? "Repetir" : "Escuchar"}</button>
      {#if type === "escala"}
        <button type="button" class="press-btn ghost" onclick={() => listen(true)}>Oír tónica</button>
      {/if}
    </div>
    <p class="hint instruction">{selected !== null ? "Puedes repetir el audio o pasar al siguiente ejercicio." : heard ? "Elige una respuesta." : "Pulsa Escuchar antes de responder."}</p>
    <div class="options" aria-label="Opciones de respuesta">
      {#each exercise.options as option (option.id)}
        <button type="button" class="answer" class:right={selected !== null && option.id === exercise.answerId} class:wrong={selected === option.id && !correct} disabled={!heard} aria-disabled={selected !== null} onclick={() => answer(option.id)}>
          <span>{option.label}</span>
          {#if selected !== null && option.id === exercise.answerId}<small>Respuesta correcta</small>
          {:else if selected === option.id}<small>Tu respuesta</small>{/if}
        </button>
      {/each}
    </div>
  </div>

  <div class="feedback" aria-live="polite" aria-atomic="true">
    {#if selected !== null}
      <div class="result" class:success={correct} class:error={!correct}>
        <strong>{correct ? "¡Correcto!" : "Esta vez no."}</strong>
        <p>{exercise.explanation}</p>
      </div>
    {/if}
    {#if audioError}<p class="audio-error">{audioError}</p>{/if}
    {#if notice}<p class="hint">{notice}</p>{/if}
  </div>
  <footer>
    {#if selected !== null}<button type="button" class="press-btn" onclick={next}>Siguiente</button>{/if}
    <button type="button" class="press-btn ghost" disabled={total === 0} onclick={finish}>Terminar</button>
  </footer>
</section>

<style>
  .ear-training { display:flex; flex-direction:column; gap:20px; padding:24px; min-width:0; }
  h2, h3 { font-family:"Bricolage Grotesque", sans-serif; margin:0; }
  h2 { font-size:1.25rem; line-height:1.3; }
  h3 { font-size:1.125rem; line-height:1.4; }
  .hint { color:var(--muted); font-size:.8125rem; margin:0; }
  header .hint, .question > .hint { margin-top:8px; }
  .settings { display:flex; flex-wrap:wrap; gap:20px 32px; }
  fieldset { border:0; padding:0; margin:0; min-width:0; }
  legend { font-size:.8125rem; font-weight:700; margin-bottom:8px; }
  .pills, .playback, footer { display:flex; flex-wrap:wrap; gap:8px; }
  .counters { display:flex; flex-wrap:wrap; gap:20px 40px; margin:0; padding:16px 0; border-block:1px solid var(--line); }
  .counters > div { display:flex; align-items:baseline; gap:12px; }
  dt { color:var(--muted); font-size:.8125rem; }
  dd { font:700 1.25rem/1.3 "Bricolage Grotesque", sans-serif; font-variant-numeric:tabular-nums; margin:0; }
  .playback { margin:16px 0 12px; }
  .options { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr)); gap:10px; margin-top:12px; }
  .answer { display:flex; flex-direction:column; justify-content:center; gap:4px; min-height:56px; min-width:0; padding:12px 16px; text-align:left; font-size:.875rem; font-weight:700; color:var(--text); background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-sm); cursor:pointer; overflow-wrap:anywhere; }
  .answer:hover:not(:disabled):not([aria-disabled="true"]) { background:var(--surface-muted); border-color:var(--coral); }
  .answer:disabled { opacity:.55; cursor:default; }
  .answer[aria-disabled="true"] { cursor:default; }
  .answer.right { border-color:var(--success); background:var(--success-soft); }
  .answer.wrong { border-color:var(--error); background:var(--error-soft); }
  small { font-size:.75rem; font-weight:500; }
  .feedback:empty { display:none; }
  .result { padding:16px; border-radius:var(--radius-sm); }
  .result.success { background:var(--success-soft); }
  .result.error { background:var(--error-soft); }
  .result p { margin:8px 0 0; font-size:.875rem; }
  .audio-error { color:var(--text); background:var(--error-soft); padding:12px; font-size:.875rem; }
  button:focus-visible { outline:3px solid var(--focus-ring); outline-offset:3px; }
  footer { border-top:1px solid var(--line); padding-top:16px; }
  footer .ghost { margin-left:auto; }
  .press-btn:disabled { opacity:.5; cursor:default; }
  @media (max-width:420px) { .ear-training { padding:16px; gap:16px; } .pills { gap:6px; } .pill-btn { padding-inline:12px; } }
</style>
