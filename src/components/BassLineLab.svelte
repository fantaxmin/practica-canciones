<script lang="ts">
  import { onDestroy } from "svelte";
  import { BASS_PROGRESSIONS, BASS_STYLES, chordIntervals, generateBassLine, type BassStyle, type BassDegree } from "../lib/bassLines";
  import { playChord, playNote, stopAll } from "../lib/audio/synth";
  import { BASS_EADG } from "../lib/theory/fretboard";
  import { noteName, pitchClass, rootKey, mod } from "../lib/theory/notes";
  import { triadName } from "../lib/theory/relatives";
  import { ROUTINE_KEYS } from "../lib/theory/routine";
  import { logWarmup, notation } from "../lib/warmupLog";

  let keyId = $state(rootKey(ROUTINE_KEYS[0]));
  let progressionId = $state("one-five");
  let styleId = $state<BassStyle>("roots");
  let tempo = $state(90);
  let loop = $state(false);
  let playing = $state<"line" | "chords" | null>(null);
  let activeBeat = $state(-1);
  let notice = $state("");
  let audioError = $state("");
  let timer: ReturnType<typeof setInterval> | undefined;
  const key = $derived(ROUTINE_KEYS.find((item) => rootKey(item) === keyId) ?? ROUTINE_KEYS[0]);
  const line = $derived(generateBassLine(key, progressionId, styleId));
  const style = $derived(BASS_STYLES.find((item) => item.id === styleId)!);
  const keyLabel = $derived(`${noteName(key, $notation)} ${line.progression.mode === "eolico" ? "menor" : "mayor"}`);
  const barIndex = $derived(activeBeat < 0 ? 0 : Math.floor(activeBeat / 4));
  const current = $derived(line.bars[barIndex]);
  const chordPcs = $derived(chordIntervals(current.chord).map((interval) => mod(pitchClass(current.chord.root) + interval, 12)));
  const openNames = $derived($notation === "latin" ? ["Mi", "La", "Re", "Sol"] : ["E", "A", "D", "G"]);
  const degrees: BassDegree[] = ["R", "3", "5", "8", "aprox"];
  const degreeClass = (degree: BassDegree) => `degree-${degree === "3" ? "third" : degree === "5" ? "fifth" : degree === "8" ? "octave" : degree}`;
  const degreeLabel = (degree: BassDegree) => ({ R: "Fundamental", "3": "Tercera", "5": "Quinta", "8": "Octava", aprox: "Aproximación" }[degree]);

  function stop() {
    clearInterval(timer);
    timer = undefined;
    stopAll();
    playing = null;
    activeBeat = -1;
  }
  function changed() { stop(); notice = ""; audioError = ""; }
  onDestroy(stop);

  function listen(mode: "line" | "chords") {
    stop();
    audioError = "";
    const exercise = line;
    const step = 60 / tempo;
    const total = exercise.bars.length * 4;
    // Un pequeño margen permite programar bajo y acordes en el mismo instante.
    const start = performance.now() / 1000 + 0.06;
    let scheduled = 0;
    let endAt = Infinity;
    playing = mode;
    function pump() {
      try {
        const now = performance.now() / 1000;
        const elapsed = now - start;
        if (!loop && endAt === Infinity) endAt = (Math.floor(Math.max(0, elapsed) / (total * step)) + 1) * total;
        if (loop) endAt = Infinity;
        if (elapsed >= endAt * step) { stop(); return; }
        activeBeat = elapsed < 0 ? -1 : Math.floor(elapsed / step) % total;
        // Si el hilo se retrasa, omite pulsos vencidos en vez de tocarlos juntos.
        scheduled = Math.max(scheduled, Math.floor(Math.max(0, elapsed) / step));
        while (start + scheduled * step < now + 0.12 && scheduled < endAt) {
          const beat = scheduled % total;
          const bar = exercise.bars[Math.floor(beat / 4)];
          const offset = Math.max(0, start + scheduled * step - now);
          if (beat % 4 === 0) {
            const root = 60 + pitchClass(bar.chord.root);
            playChord(chordIntervals(bar.chord).map((interval) => root + interval), step * 3.8, 0.18, offset);
          }
          if (mode === "line") playNote(bar.notes[beat % 4].midi, step * 0.9, offset, 0.75);
          scheduled++;
        }
      } catch {
        stop();
        audioError = "No se pudo reproducir el audio. Pulsa Escuchar para intentarlo de nuevo.";
      }
    }
    pump();
    if (playing) timer = setInterval(pump, 25);
  }
  function save() {
    logWarmup({ kind: "lineas", detail: `${line.progression.label} · ${style.label} · ${keyLabel}` });
    notice = "Práctica de líneas de bajo guardada.";
  }
</script>

<section class="bass-lab card" aria-label="Laboratorio de líneas de bajo">
  <header>
    <h2>Laboratorio de líneas de bajo</h2>
    <p class="hint">Del pulso a la melodía: construye tu línea y luego toca sobre los acordes. Bajo de 4 cuerdas · EADG · 4/4.</p>
  </header>

  <div class="settings">
    <label>Tonalidad
      <select bind:value={keyId} onchange={changed}>
        {#each ROUTINE_KEYS as option (rootKey(option))}
          <option value={rootKey(option)}>{noteName(option, $notation)} {line.progression.mode === "eolico" ? "menor" : "mayor"}</option>
        {/each}
      </select>
    </label>
    <label>Progresión
      <select bind:value={progressionId} onchange={changed}>
        {#each BASS_PROGRESSIONS as option (option.id)}<option value={option.id}>{option.label}{option.mode === "eolico" ? " (menor)" : ""}</option>{/each}
      </select>
    </label>
    <label class="style-select">Estilo
      <select bind:value={styleId} onchange={changed}>
        {#each BASS_STYLES as option, i (option.id)}<option value={option.id}>{i + 1}. {option.label}</option>{/each}
      </select>
    </label>
    <label>Tempo · {tempo} BPM
      <input type="range" min="50" max="160" step="5" bind:value={tempo} oninput={changed} />
    </label>
  </div>
  <p class="explanation">{style.explanation}</p>

  <div class="transport">
    <button type="button" class="press-btn" aria-pressed={playing === "line"} onclick={() => listen("line")}>Escuchar</button>
    <button type="button" class="press-btn ghost" aria-pressed={playing === "chords"} onclick={() => listen("chords")}>Solo acordes</button>
    <button type="button" class="press-btn ghost" disabled={!playing} onclick={stop}>Detener</button>
    <label class="loop"><input type="checkbox" bind:checked={loop} /> Repetir en loop</label>
  </div>
  <p class="hint" role="status">{playing ? `${playing === "line" ? "Bajo + acordes" : "Solo acordes"} · ${keyLabel}${loop ? " · en loop" : " · una vuelta"}` : "Listo. Pulsa Escuchar o Solo acordes para empezar."}</p>

  <div class="legend" aria-label="Grados respecto al acorde">
    {#each degrees as degree (degree)}<span class={degreeClass(degree)}><b>{degree}</b> {degreeLabel(degree)}</span>{/each}
  </div>
  <div class="bars">
    {#each line.bars as bar, i (i)}
      <div class="bar" class:current={activeBeat >= 0 && barIndex === i}>
        <h3><span>{i + 1}. {triadName(bar.chord, $notation)}</span><small>{bar.chord.roman}</small></h3>
        <table aria-label={`Tablatura del compás ${i + 1}, ${triadName(bar.chord, $notation)}`}>
          <thead><tr><th scope="col">Pulso</th>{#each bar.notes as note (note.tiempo)}<th scope="col" class:beat-active={activeBeat === i * 4 + note.tiempo}>{note.tiempo + 1}<span class={degreeClass(note.grado)} title={degreeLabel(note.grado)}>{note.grado}</span></th>{/each}</tr></thead>
          <tbody>
            {#each [3, 2, 1, 0] as string (string)}
              <tr><th scope="row">{openNames[string]}</th>
                {#each bar.notes as note (note.tiempo)}
                  <td class:beat-active={activeBeat === i * 4 + note.tiempo}>
                    {#if note.cuerda === string}<strong class={degreeClass(note.grado)} aria-label={`Traste ${note.traste}, ${degreeLabel(note.grado)}`}>{note.traste}</strong>{:else}<span aria-hidden="true">—</span>{/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/each}
  </div>
  <p class="hint">Lee de izquierda a derecha. Cada número es un traste y dura una negra; 0 indica cuerda al aire. La cuerda Sol está arriba.</p>

  <div class="chord-view">
    <h3>{playing ? "Acorde actual" : "Primer acorde"}: {triadName(current.chord, $notation)}</h3>
    <p class="hint">R, 3 y 5 marcan las notas del acorde; el círculo señala la nota de la línea durante la reproducción.</p>
    <!-- El contenedor desplazable necesita foco para recorrer el diapasón con el teclado. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="fret-scroll" role="region" aria-label="Diapasón del acorde, desliza para ver los 12 trastes" tabindex="0">
      <svg viewBox="0 0 650 166" width="650" height="166" role="img" aria-label={`Notas de ${triadName(current.chord, $notation)} en bajo EADG, trastes 0 a 12`}>
        {#each Array.from({ length: 13 }, (_, fret) => fret) as fret (fret)}
          <text x={42 + fret * 48} y="20" class="fret-label">{fret}</text>
          <line x1={64 + fret * 48} x2={64 + fret * 48} y1="32" y2="148" class="fret-line" />
        {/each}
        {#each [3, 2, 1, 0] as string, row (string)}
          <line x1="30" x2="640" y1={46 + row * 30} y2={46 + row * 30} class="string-line" />
          <text x="2" y={50 + row * 30} class="open-label">{openNames[string]}</text>
          {#each Array.from({ length: 13 }, (_, fret) => fret) as fret (fret)}
            {@const degreeIndex = chordPcs.indexOf(mod(BASS_EADG.strings[string] + fret, 12))}
            {@const active = activeBeat >= 0 && current.notes[activeBeat % 4].cuerda === string && current.notes[activeBeat % 4].traste === fret}
            {#if degreeIndex >= 0 || active}
              <g class={degreeClass(degreeIndex < 0 ? "aprox" : (["R", "3", "5"] as const)[degreeIndex])}>
                <circle cx={42 + fret * 48} cy={46 + row * 30} r="12" class:active-note={active} />
                <text x={42 + fret * 48} y={50 + row * 30} class="dot-label">{degreeIndex < 0 ? "a" : ["R", "3", "5"][degreeIndex]}</text>
              </g>
            {/if}
          {/each}
        {/each}
      </svg>
    </div>
  </div>
  <footer>
    <button type="button" class="press-btn" onclick={save}>Lo practiqué</button>
    <div aria-live="polite" aria-atomic="true">{#if notice}<p class="hint">{notice}</p>{/if}{#if audioError}<p class="audio-error">{audioError}</p>{/if}</div>
  </footer>
</section>

<style>
  .bass-lab { display:grid; gap:18px; padding:24px; min-width:0; max-width:100%; }
  h2, h3 { margin:0; font-family:"Bricolage Grotesque", sans-serif; line-height:1.3; }
  h2 { font-size:1.25rem; } h3 { font-size:1rem; }
  p { margin:0; } .hint { font-size:.8125rem; color:var(--muted); }
  header p, .chord-view > p { margin-top:8px; }
  .settings { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
  label { display:grid; gap:6px; font-size:.8125rem; font-weight:700; min-width:0; }
  select { width:100%; min-width:0; min-height:44px; color:var(--text); background:var(--surface-muted); }
  input[type="range"] { width:100%; min-width:0; min-height:44px; margin:0; accent-color:var(--coral); }
  .explanation { font-size:.875rem; max-width:70ch; }
  .transport, .legend, footer { display:flex; flex-wrap:wrap; align-items:center; gap:10px; }
  .loop { display:flex; align-items:center; min-height:44px; cursor:pointer; }
  .loop input { accent-color:var(--coral); width:18px; height:18px; }
  button { min-height:44px; } button:disabled { opacity:.5; cursor:default; }
  button:focus-visible, select:focus-visible, input:focus-visible, .fret-scroll:focus-visible { outline:3px solid var(--focus-ring); outline-offset:3px; }
  .legend { font-size:.75rem; gap:8px 16px; }
  .legend span { display:flex; align-items:center; gap:5px; color:var(--text); }
  .legend b, thead span, td strong { background:var(--degree-bg); color:var(--degree-ink); border-radius:4px; padding:2px 5px; }
  .degree-R { --degree-bg:var(--coral); --degree-ink:var(--ink); }
  .degree-third { --degree-bg:var(--lime); --degree-ink:var(--ink); }
  .degree-fifth { --degree-bg:var(--surface-muted); --degree-ink:var(--text); }
  .degree-octave { --degree-bg:var(--warning-soft); --degree-ink:var(--text); }
  .degree-aprox { --degree-bg:var(--error-soft); --degree-ink:var(--text); }
  .bars { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr)); gap:16px; min-width:0; }
  .bar { min-width:0; border-block:1px solid var(--line); padding-block:12px; }
  .bar.current { border-color:var(--coral); }
  .bar h3 { display:flex; align-items:baseline; justify-content:space-between; gap:8px; margin-bottom:10px; }
  small { font:600 .75rem "Manrope",sans-serif; color:var(--muted); }
  table { width:100%; table-layout:fixed; border-collapse:collapse; font:500 .875rem "JetBrains Mono",monospace; }
  th, td { text-align:center; height:30px; padding:3px 0; }
  th:first-child { width:44px; color:var(--muted); font-size:.6875rem; }
  thead th { font-size:.75rem; font-weight:500; padding-bottom:8px; }
  thead span { display:block; width:fit-content; margin:4px auto 0; font-size:.6875rem; }
  td { background:linear-gradient(var(--line),var(--line)) center / 100% 1px no-repeat; }
  td > span { color:var(--muted); } td strong { font-weight:700; }
  .beat-active { background-color:var(--surface-muted); }
  .chord-view { padding-top:6px; min-width:0; }
  .fret-scroll { max-width:100%; overflow-x:auto; overscroll-behavior-x:contain; margin-top:12px; background:var(--surface-muted); border-radius:var(--radius-sm); }
  svg { display:block; }
  .fret-label, .open-label { fill:var(--muted); font:600 11px "JetBrains Mono",monospace; }
  .fret-label { text-anchor:middle; } .open-label { font-size:10px; }
  .fret-line { stroke:var(--line); } .string-line { stroke:var(--muted); }
  circle { fill:var(--degree-bg); stroke:var(--muted); stroke-width:1px; }
  circle.active-note { stroke:var(--text); stroke-width:3px; }
  .dot-label { fill:var(--degree-ink); text-anchor:middle; font:700 11px "Manrope",sans-serif; }
  footer { padding-top:16px; border-top:1px solid var(--line); }
  .audio-error { padding:10px; background:var(--error-soft); font-size:.875rem; }
  @media (max-width:420px) { .bass-lab { padding:16px; gap:16px; } .settings { grid-template-columns:minmax(0,1fr); } }
</style>
