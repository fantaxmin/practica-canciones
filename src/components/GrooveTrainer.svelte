<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { GROOVES, barCells, stepMidi } from "../lib/groove";
  import { audioContext, playNote, stopAll } from "../lib/audio/synth";
  import { clampBpm, startMetronome, tapTempo, type Metronome } from "../lib/audio/metronome";
  import { logWarmup, notation } from "../lib/warmupLog";
  import { audioPosition, pulseAppearance } from "../lib/audioVisual";
  import { reducedMotion } from "../lib/motion";

  let { onFinish }: { onFinish?: () => void } = $props();
  let exerciseId = $state(GROOVES[0].id);
  const exercise = $derived(GROOVES.find((item) => item.id === exerciseId)!);
  const grids = $derived(exercise.bars.map((bar) => barCells(bar, exercise.subdivision)));
  let bpm = $state<number | undefined>(GROOVES[0].bpm);
  let backbeat = $state(false);
  let silentBars = $state(false);
  let mode = $state<"listen" | "practice" | null>(null);
  let pending = $state(false);
  let current = $state(-1);
  let complete = $state(false);
  let clean = $state(false);
  let notice = $state("");
  let error = $state("");
  let transport: Metronome | undefined;
  let frame = 0;
  let generation = 0;
  let taps: number[] = [];
  let pulseEl = $state<HTMLSpanElement>();
  let resumeVisual: (() => void) | undefined;
  function neutralPulse() {
    if (pulseEl) { pulseEl.style.transform = "scale(1)"; pulseEl.style.opacity = ".25"; }
  }
  const bar = $derived(current < 0 ? -1 : Math.floor(current / (exercise.subdivision * 4)));
  const column = $derived(current < 0 ? -1 : current % (exercise.subdivision * 4));
  const beat = $derived(current < 0 ? 0 : Math.floor(column / exercise.subdivision) + 1);
  const stringNames = $derived($notation === "latin" ? ["Mi", "La", "Re", "Sol"] : ["E", "A", "D", "G"]);

  function stop() {
    generation++;
    transport?.stop();
    transport = undefined;
    cancelAnimationFrame(frame);
    resumeVisual = undefined;
    neutralPulse();
    stopAll();
    mode = null;
    pending = false;
    current = -1;
  }

  function reset() {
    stop();
    complete = false;
    clean = false;
    notice = "";
    error = "";
    taps = [];
  }

  function choose(id: string) {
    reset();
    exerciseId = id;
    bpm = exercise.bpm;
  }

  function setTempo(value: number) {
    reset();
    bpm = clampBpm(value);
  }

  function tap() {
    const previous = taps;
    const now = performance.now();
    stop();
    complete = false;
    clean = false;
    error = "";
    taps = [...previous.slice(-8), now];
    const tempo = tapTempo(taps);
    if (tempo !== null) bpm = tempo;
    notice = tempo === null ? "Pulsa otra vez siguiendo el pulso." : `Tempo por pulsaciones: ${tempo} bpm.`;
  }

  async function start(nextMode: "listen" | "practice") {
    reset();
    bpm = clampBpm(bpm ?? exercise.bpm);
    const sessionBpm = bpm;
    pending = true;
    const token = generation;
    try {
      const ctx = audioContext();
      await ctx.resume();
      if (token !== generation || document.hidden) return;
      const sessionExercise = exercise;
      const sessionGrids = grids;
      const roundBars = nextMode === "practice" ? 8 : exercise.bars.length;
      transport = startMetronome({
        bpm: sessionBpm, bars: roundBars, subdivision: exercise.subdivision,
        backbeat, silentBars: nextMode === "practice" && silentBars,
        onStep(index, time) {
          if (nextMode !== "listen") return;
          const cells = sessionGrids[Math.floor(index / (sessionExercise.subdivision * 4)) % sessionGrids.length];
          const cell = cells[index % cells.length];
          if (!cell.onset || !cell.step.note) return;
          const midi = stepMidi(cell.step)!;
          const duration = cell.step.ghost ? .04 : cell.step.duration * 60 / sessionBpm * .85;
          playNote(midi, duration, Math.max(0, time - ctx.currentTime), cell.step.ghost ? .16 : cell.step.accent ? .65 : .4);
        },
      });
      pending = false;
      mode = nextMode;
      const active = transport;
      function animate() {
        if (token !== generation) return;
        if (document.hidden) return;
        const now = active.context.currentTime;
        if (now >= active.endTime) {
          stop();
          if (nextMode === "practice") {
            complete = true;
            logWarmup({ kind: "groove", detail: `${sessionExercise.name} · ${sessionBpm} bpm` });
            notice = "Ronda de ocho compases guardada.";
          } else notice = "Patrón terminado. Ahora puedes practicar con el clic.";
          return;
        }
        const position = audioPosition(now, active.startTime, sessionBpm, sessionExercise.subdivision, roundBars * 4 * sessionExercise.subdivision);
        current = position.absoluteStep;
        if (pulseEl) {
          const pulse = pulseAppearance(position, $reducedMotion, active.context.state === "running");
          pulseEl.style.transform = `scale(${pulse.scale})`;
          pulseEl.style.opacity = String(pulse.opacity);
        }
        frame = requestAnimationFrame(animate);
      }
      resumeVisual = () => { cancelAnimationFrame(frame); animate(); };
      resumeVisual();
    } catch {
      if (token !== generation) return;
      stop();
      error = "No se pudo iniciar el audio. Pulsa Escuchar o Practicar para intentarlo de nuevo.";
    } finally {
      if (token === generation) pending = false;
    }
  }

  onMount(() => {
    const visibility = () => {
      cancelAnimationFrame(frame);
      if (document.hidden && (mode || pending)) {
        stop();
        notice = "Ronda pausada al ocultar la pestaña. Pulsa Practicar para reiniciarla desde el primer compás.";
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  });
  onDestroy(stop);
</script>

<section class="groove card" aria-label="Entrenador de groove y tiempo">
  <header>
    <h2>Groove y tiempo</h2>
    <p class="hint">Bajo de 4 cuerdas · afinación EADG · patrones en Mi · 4/4</p>
  </header>

  <label class="exercise-select">
    <span>Ejercicio</span>
    <select value={exerciseId} onchange={(event) => choose(event.currentTarget.value)}>
      {#each GROOVES as item (item.id)}
        <option value={item.id}>Nivel {item.level} · {item.name}</option>
      {/each}
    </select>
  </label>
  <div>
    <h3>{exercise.name}</h3>
    <p class="hint">{exercise.description} Sugerido: {exercise.bpm} bpm.</p>
  </div>

  <div class="tempo">
    <label><span>Tempo (40–200 bpm)</span>
      <input type="number" min="40" max="200" step="1" bind:value={bpm} onchange={() => setTempo(bpm ?? exercise.bpm)} />
    </label>
    <button type="button" class="press-btn ghost" onclick={tap}>Marcar pulso (tap)</button>
  </div>
  <fieldset>
    <legend>Clic</legend>
    <div class="segmented" role="group" aria-label="Tiempos con clic">
      <button type="button" class:active={!backbeat} aria-pressed={!backbeat} onclick={() => { reset(); backbeat = false; }}>Todos · acento en 1</button>
      <button type="button" class:active={backbeat} aria-pressed={backbeat} onclick={() => { reset(); backbeat = true; }}>Solo 2 y 4</button>
    </div>
    <label class="mute-option"><input type="checkbox" checked={silentBars} onchange={(event) => { reset(); silentBars = event.currentTarget.checked; }} />Practicar: 2 compases con clic, 2 mudos</label>
  </fieldset>

  <div class="transport">
    <span class="pulse-marker" bind:this={pulseEl} aria-hidden="true"></span>
    <div class="actions">
      <button type="button" class="press-btn" disabled={pending} onclick={() => start("listen")}>Escuchar el patrón</button>
      <button type="button" class="press-btn" disabled={pending} onclick={() => start("practice")}>Practicar</button>
      {#if mode || pending}<button type="button" class="press-btn ghost" onclick={() => { stop(); notice = "Ronda detenida. Puedes empezar de nuevo."; }}>Detener</button>{/if}
    </div>
    <p class="hint">Escuchar: bajo y clic. Practicar: solo clic, ocho compases. Las x se preescuchan como golpes cortos y suaves.</p>
    <div class="counter" role="timer" aria-live="off">
      {#if pending}Preparando audio…
      {:else if mode && current < 0}Prepárate…
      {:else if mode}
        <strong>Compás {bar + 1}/{mode === "practice" ? 8 : exercise.bars.length} · tiempo {beat}</strong>
        <span>{mode === "practice" && silentBars && bar % 4 >= 2 ? "Compás mudo: mantén el pulso" : backbeat ? "Clic en 2 y 4" : "Clic en cada tiempo"}</span>
      {:else}Cuenta {exercise.subdivision === 4 ? "1 e + a · 2 e + a · 3 e + a · 4 e + a" : "1 + · 2 + · 3 + · 4 +"}{/if}
    </div>
  </div>

  <div class="pattern" aria-label="Tablatura del patrón">
    {#each grids as cells, barIndex (barIndex)}
      <table>
        <caption>Compás {barIndex + 1}{mode && bar % grids.length === barIndex && current >= 0 ? " · en curso" : ""}</caption>
        <colgroup><col class="string-col" />{#each cells as _, i (i)}<col />{/each}</colgroup>
        <thead><tr><th scope="col">Cuerda</th>{#each cells as _, i (i)}<th scope="col" class:playing={bar % grids.length === barIndex && column === i}>{i % exercise.subdivision === 0 ? Math.floor(i / exercise.subdivision) + 1 : exercise.subdivision === 2 ? "+" : ["", "e", "+", "a"][i % 4]}</th>{/each}</tr></thead>
        <tbody>
          {#each [3, 2, 1, 0] as string (string)}
            <tr><th scope="row">{stringNames[string]}</th>
              {#each cells as cell, i (i)}
                <td class:playing={bar % grids.length === barIndex && column === i} class:accent={cell.onset && cell.step.accent && cell.step.note?.string === string} class:beat-start={i % exercise.subdivision === 0}>
                  {cell.step.note?.string === string ? cell.onset ? cell.step.ghost ? "x" : cell.step.note.fret : "·" : "—"}
                </td>
              {/each}
            </tr>
          {/each}
          <tr class="rhythm"><th scope="row">Ritmo</th>{#each cells as cell, i (i)}<td class:playing={bar % grids.length === barIndex && column === i}>{cell.onset ? cell.step.note === null ? "s" : cell.step.accent ? ">" : "●" : "·"}</td>{/each}</tr>
        </tbody>
      </table>
    {/each}
    <p class="hint">Número = traste · punto = sostener · x = nota muerta · s = silencio · &gt; = acento. Lee de izquierda a derecha; cuerda aguda arriba.</p>
  </div>

  <div aria-live="polite" aria-atomic="true" class="feedback">
    {#if notice}<p>{notice}</p>{/if}
    {#if error}<p class="error">{error}</p>{/if}
  </div>
  {#if complete}
    <fieldset class="evaluation">
      <legend>¿Lo tocaste limpio?</legend>
      <p class="hint">Valora el pulso, los silencios y el apagado de cuerdas. La evaluación es tuya.</p>
      <div class="actions">
        <button type="button" class="pill-btn" class:active={clean} aria-pressed={clean} onclick={() => { clean = true; }}>Sí, limpio</button>
        <button type="button" class="pill-btn" onclick={() => start("practice")}>Necesito repetir</button>
        {#if clean}<button type="button" class="press-btn" disabled={(bpm ?? 200) >= 200} onclick={() => setTempo((bpm ?? exercise.bpm) + 5)}>Subir +5 BPM</button>{/if}
      </div>
      {#if clean && bpm === 200}<p class="hint">Llegaste al máximo de 200 bpm.</p>{/if}
    </fieldset>
  {/if}
  <footer><button type="button" class="press-btn ghost" onclick={() => { stop(); onFinish?.(); }}>Terminar</button></footer>
</section>

<style>
  .groove { display:grid; gap:20px; padding:24px; min-width:0; color:var(--text); }
  h2, h3 { font-family:"Bricolage Grotesque", sans-serif; margin:0; }
  h2 { font-size:1.25rem; } h3 { font-size:1.125rem; }
  p { margin:0; } .hint { color:var(--muted); font-size:.8125rem; line-height:1.6; }
  header p, h3 + p { margin-top:6px; }
  label:not(.mute-option) { display:grid; gap:6px; font-size:.8125rem; font-weight:700; min-width:0; }
  select, input[type="number"] { width:100%; min-width:0; min-height:44px; box-sizing:border-box; }
  .tempo { display:flex; align-items:end; flex-wrap:wrap; gap:12px; }
  .tempo label { flex:1 1 140px; max-width:200px; }
  fieldset { padding:0; border:0; margin:0; min-width:0; }
  legend { font-size:.875rem; font-weight:700; margin-bottom:8px; }
  .segmented { flex-wrap:wrap; justify-content:start; }
  .segmented button, button { min-height:44px; }
  .mute-option { display:flex; align-items:center; gap:10px; min-height:44px; margin-top:8px; font-size:.8125rem; cursor:pointer; }
  .mute-option input { flex-shrink:0; }
  .actions { display:flex; gap:10px; flex-wrap:wrap; }
  .transport { display:grid; gap:12px; border-block:1px solid var(--line); padding-block:16px; }
  .pulse-marker { display:block; width:12px; height:12px; border-radius:50%; background:var(--coral); opacity:.25; transform:scale(1); transform-origin:center; }
  .counter { display:flex; flex-direction:column; justify-content:center; gap:4px; min-height:64px; font:600 .875rem/1.6 "JetBrains Mono", monospace; }
  .counter span { font:500 .8125rem/1.5 "Manrope", sans-serif; color:var(--muted); }
  .pattern { min-width:0; display:grid; gap:16px; }
  table { width:100%; table-layout:fixed; border-collapse:collapse; font:600 .8125rem/1.5 "JetBrains Mono", monospace; text-align:center; }
  caption { text-align:left; font:700 .8125rem "Manrope", sans-serif; margin-bottom:10px; }
  .string-col { width:50px; }
  th, td { height:30px; padding:0; overflow-wrap:anywhere; }
  thead th { color:var(--muted); font-weight:500; }
  tbody th { font-size:.75rem; text-align:left; }
  tbody td { border-block:1px solid var(--line); background:var(--surface-muted); }
  td.beat-start { border-left:1px solid var(--line); }
  td.accent { text-decoration:underline; text-underline-offset:4px; font-weight:800; }
  .rhythm td { background:var(--surface); font-size:.6875rem; color:var(--muted); }
  table .playing { background:var(--coral); color:var(--ink); }
  .evaluation { display:grid; gap:12px; }
  .feedback:empty { display:none; }
  .feedback { font-size:.875rem; line-height:1.6; }
  .error { background:var(--error-soft); padding:12px; border-radius:var(--radius-sm); }
  footer { border-top:1px solid var(--line); padding-top:16px; }
  button:disabled { opacity:.5; cursor:default; }
  button:focus-visible, select:focus-visible, input:focus-visible { outline:3px solid var(--focus-ring); outline-offset:3px; }
  @media (max-width:480px) {
    .groove { padding:16px; gap:16px; }
    .string-col { width:40px; }
    table { font-size:.6875rem; }
    thead th:first-child { font-size:.5625rem; }
    tbody th { font-size:.625rem; }
    .actions > button { flex:1 1 120px; }
  }
</style>
