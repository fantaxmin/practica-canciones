<script lang="ts">
  import { noteName, type SpelledNote } from "../../lib/theory/notes";
  import { MODE_ORDER, getScale, formatDegree, type ScaleId } from "../../lib/theory/scales";
  import { CHORD_SCALE_GUIDE, circleOfFifths, signatureLabel } from "../../lib/theory/relatives";
  import { notation } from "../../lib/warmupLog";

  let { onExplore }: { onExplore: (root: SpelledNote, scale: ScaleId) => void } = $props();

  const n = $derived($notation);
  const circle = circleOfFifths();
  const C: SpelledNote = { letter: 0, accidental: 0 };
  const point = (i: number, r: number) => {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    return { x: 150 + Math.cos(angle) * r, y: 150 + Math.sin(angle) * r };
  };
  const MODE_EXAMPLES: SpelledNote[] = [0, 1, 2, 3, 4, 5, 6].map((letter) => ({ letter, accidental: 0 }));
</script>

<div class="theory">
  <article class="card">
    <h3>Relativas mayor y menor</h3>
    <p>Cada tonalidad mayor tiene una <strong>relativa menor</strong> con <em>exactamente las mismas notas</em>. Lo que cambia es la nota que se siente como "casa".</p>
    <ul>
      <li>De mayor a menor: baja <strong>3 semitonos</strong> (o ve al 6º grado). {noteName(C, n)} mayor → {noteName({ letter: 5, accidental: 0 }, n)} menor.</li>
      <li>De menor a mayor: sube <strong>3 semitonos</strong> (el 3er grado). {noteName({ letter: 2, accidental: 0 }, n)} menor → {noteName({ letter: 4, accidental: 0 }, n)} mayor.</li>
      <li>Truco: la <strong>pentatónica menor</strong> de La y la <strong>pentatónica mayor</strong> de Do son las mismas cinco notas. Si te sabes una caja, te sabes las dos.</li>
      <li>No confundas con la <strong>paralela</strong>: Do mayor y Do menor comparten tónica pero no notas.</li>
    </ul>
    <button type="button" class="pill-btn" onclick={() => onExplore({ letter: 5, accidental: 0 }, "eolico")}>Ver La menor en el diapasón</button>
  </article>

  <article class="card">
    <h3>Círculo de quintas</h3>
    <p>Cada paso en sentido horario sube una quinta y agrega un sostenido; en sentido antihorario, un bemol. Las tonalidades vecinas comparten seis de siete notas, por eso los cambios entre vecinas suenan naturales. Por dentro está la relativa menor. Toca una para explorarla.</p>
    <svg viewBox="0 0 300 300" class="circle" role="group" aria-label="Círculo de quintas">
      <circle cx="150" cy="150" r="138" class="ring" />
      <circle cx="150" cy="150" r="86" class="ring inner" />
      {#each circle as entry, i (i)}
        {@const outer = point(i, 112)}
        {@const inner = point(i, 64)}
        <g>
          <a href="#explorar" role="button" aria-label={`${noteName(entry.major, n)} mayor, ${signatureLabel(entry.signature)}`} onclick={(e) => { e.preventDefault(); onExplore(entry.major, "jonico"); }}>
            <circle cx={outer.x} cy={outer.y} r="21" class="key" class:home={i === 0} />
            <text x={outer.x} y={outer.y + 4} class="major">{noteName(entry.major, n)}</text>
          </a>
          <a href="#explorar" role="button" aria-label={`${noteName(entry.minor, n)} menor`} onclick={(e) => { e.preventDefault(); onExplore(entry.minor, "eolico"); }}>
            <text x={inner.x} y={inner.y + 4} class="minor">{noteName(entry.minor, n)}m</text>
          </a>
        </g>
      {/each}
      <text x="150" y="146" class="center">mayores fuera</text>
      <text x="150" y="162" class="center">menores dentro</text>
    </svg>
  </article>

  <article class="card wide">
    <h3>Modos griegos</h3>
    <p>Son la escala mayor empezando en cada uno de sus grados. Con las notas blancas del piano (de {noteName(C, n)} a {noteName(C, n)}) salen los siete:</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th scope="col">Grado</th><th scope="col">Modo</th><th scope="col">Ejemplo</th><th scope="col">Diferencia clave</th><th scope="col">Carácter</th></tr></thead>
        <tbody>
          {#each MODE_ORDER as id, i (id)}
            {@const scale = getScale(id)}
            {@const diff = scale.formula.filter((d) => /[b#]/.test(d)).map(formatDegree).join(" ") || "—"}
            <tr>
              <td class="mono">{i + 1}º</td>
              <th scope="row"><button type="button" class="link-btn" onclick={() => onExplore(MODE_EXAMPLES[i], id)}>{scale.name}</button></th>
              <td>{noteName(MODE_EXAMPLES[i], n)}–{noteName(MODE_EXAMPLES[i], n)}</td>
              <td class="mono">{diff}</td>
              <td>{scale.mood}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="tip">Para memorizarlos, compáralos con la mayor o la menor: <strong>lidio</strong> = mayor con ♯4, <strong>mixolidio</strong> = mayor con ♭7, <strong>dórico</strong> = menor con 6 natural, <strong>frigio</strong> = menor con ♭2.</p>
  </article>

  <article class="card wide">
    <h3>¿Qué escala toco sobre qué acorde?</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th scope="col">Acorde</th><th scope="col">Escalas</th><th scope="col">Consejo</th></tr></thead>
        <tbody>
          {#each CHORD_SCALE_GUIDE as row (row.chord)}
            <tr>
              <th scope="row" class="mono">{row.chord}</th>
              <td>{row.scales.map((id) => getScale(id).name).join(", ")}</td>
              <td>{row.tip}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="tip">Regla práctica: si la canción está en una tonalidad mayor, su escala mayor (o la pentatónica de su relativa menor) funciona sobre casi todos sus acordes. Los modos ayudan a que cada acorde suene "con intención", porque centran la línea en sus notas.</p>
  </article>
</div>

<style>
  .theory { display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap:16px; }
  .card { padding:20px; min-width:0; }
  .wide { grid-column:1 / -1; }
  h3 { margin:0 0 8px; font:700 1.125rem "Bricolage Grotesque", sans-serif; }
  p { margin:0 0 12px; }
  ul { margin:0 0 12px; padding-left:20px; display:grid; gap:6px; }
  .tip { margin:12px 0 0; padding:10px 12px; background:var(--surface-muted); border-radius:var(--radius-sm); font-size:.875rem; }
  .circle { width:100%; max-width:320px; display:block; margin:0 auto; }
  .ring { fill:none; stroke:var(--line); }
  .ring.inner { fill:var(--surface-muted); }
  .key { fill:var(--surface); stroke:var(--border); stroke-width:1.5; }
  .key.home { fill:var(--coral); }
  a:hover .key, a:focus-visible .key { fill:var(--lime); }
  a:focus-visible { outline:none; }
  .major { font:700 12px "Manrope", sans-serif; fill:var(--text); text-anchor:middle; pointer-events:none; }
  .key.home + .major { fill:var(--ink); }
  a:hover .major { fill:var(--ink); }
  .minor { font:600 10.5px "Manrope", sans-serif; fill:var(--muted); text-anchor:middle; }
  a:hover .minor, a:focus-visible .minor { fill:var(--coral); }
  .center { font:500 10px "Manrope", sans-serif; fill:var(--muted); text-anchor:middle; }
  .table-wrap { overflow-x:auto; }
  table { width:100%; border-collapse:collapse; font-size:.875rem; }
  th, td { text-align:left; padding:8px; border-bottom:1px solid var(--line); vertical-align:top; }
  thead th { font-size:.75rem; color:var(--muted); }
  .mono { font-family:"JetBrains Mono", monospace; font-size:.8rem; }
  .link-btn { border:0; background:none; color:var(--coral); font:700 .875rem "Manrope", sans-serif; cursor:pointer; padding:0; text-decoration:underline; min-height:24px; }
</style>
