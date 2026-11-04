<script lang="ts">
  import type { Notation } from "../../lib/theory/notes";
  import type { Tuning } from "../../lib/theory/fretboard";
  import { noteName } from "../../lib/theory/notes";
  import { spelledFor, spotKey, stringName, type FretSpot, type SpotState } from "../../lib/noteFinder";

  let { tuning, maxFret = 12, marks = {}, showNames = false, highlightString, notation = "latin", disabled = false, onPick }: {
    tuning: Tuning;
    maxFret?: number;
    /** Estado visual por posición (`spotKey`). */
    marks?: Record<string, SpotState>;
    /** Muestra el nombre de todas las notas (modo ayuda). */
    showNames?: boolean;
    highlightString?: number;
    notation?: Notation;
    disabled?: boolean;
    onPick?: (spot: FretSpot) => void;
  } = $props();

  const NUT_X = 68;
  const FRET_W = 50;
  const GAP = 34;
  const TOP = 24;
  const INLAYS = [3, 5, 7, 9];

  const strings = $derived(tuning.strings.length);
  const width = $derived(NUT_X + maxFret * FRET_W + 16);
  const height = $derived(TOP + (strings - 1) * GAP + 40);
  const stringY = (string: number) => TOP + (strings - 1 - string) * GAP;
  const fretX = (fret: number) => fret === 0 ? NUT_X - 22 : NUT_X + (fret - 0.5) * FRET_W;
  const spots = $derived(tuning.strings.flatMap((_, string) => Array.from({ length: maxFret + 1 }, (_, fret) => ({ string, fret }))));
  const label = (spot: FretSpot) => noteName(spelledFor(tuning.strings[spot.string] + spot.fret), notation);
  const stateLabel: Record<SpotState, string> = { selected: "marcada", correct: "correcta", wrong: "incorrecta", missed: "faltó", target: "esta" };

  function keydown(event: KeyboardEvent, spot: FretSpot) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!disabled) onPick?.(spot);
    }
  }
</script>

<div class="picker">
  <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="group" aria-label={`Diapasón interactivo: ${tuning.name}`}>
    <rect x={NUT_X} y={TOP - 10} width={maxFret * FRET_W} height={(strings - 1) * GAP + 20} rx="4" class="wood" />
    {#if highlightString !== undefined}
      <rect x="0" y={stringY(highlightString) - GAP / 2} width={width} height={GAP} class="string-highlight" />
    {/if}
    {#each INLAYS.filter((f) => f <= maxFret) as fret (fret)}
      <circle cx={NUT_X + (fret - 0.5) * FRET_W} cy={TOP + ((strings - 1) * GAP) / 2} r="5" class="inlay" />
    {/each}
    {#if maxFret >= 12}
      <circle cx={NUT_X + 11.5 * FRET_W} cy={TOP + GAP * 0.5} r="5" class="inlay" />
      <circle cx={NUT_X + 11.5 * FRET_W} cy={TOP + (strings - 1.5) * GAP} r="5" class="inlay" />
    {/if}
    <line x1={NUT_X} x2={NUT_X} y1={TOP - 10} y2={TOP + (strings - 1) * GAP + 10} class="nut" />
    {#each Array.from({ length: maxFret }, (_, i) => i + 1) as fret (fret)}
      <line x1={NUT_X + fret * FRET_W} x2={NUT_X + fret * FRET_W} y1={TOP - 10} y2={TOP + (strings - 1) * GAP + 10} class="fret" />
      <text x={NUT_X + (fret - 0.5) * FRET_W} y={height - 6} class="fret-number">{fret}</text>
    {/each}
    {#each tuning.strings as _, string (string)}
      <line x1={NUT_X} x2={width - 16} y1={stringY(string)} y2={stringY(string)} class="string" style:stroke-width={1.2 + (strings - 1 - string) * (strings === 4 ? 0.7 : 0.35)} />
      <text x="4" y={stringY(string) + 4} class="open-name" class:active={highlightString === string}>{stringName(tuning, string, notation)}</text>
    {/each}
    {#each spots as spot (spotKey(spot))}
      {@const state = marks[spotKey(spot)]}
      <g class="spot {state ?? ''}" class:named={showNames} role="button" tabindex={disabled ? -1 : 0}
        aria-label={`Cuerda ${stringName(tuning, spot.string, notation)}, traste ${spot.fret}${showNames ? `: ${label(spot)}` : ""}${state ? `, ${stateLabel[state]}` : ""}`}
        aria-disabled={disabled}
        onclick={() => !disabled && onPick?.(spot)} onkeydown={(e) => keydown(e, spot)}>
        <rect x={fretX(spot.fret) - 22} y={stringY(spot.string) - GAP / 2} width="44" height={GAP} class="hit" />
        <circle cx={fretX(spot.fret)} cy={stringY(spot.string)} r="12.5" />
        {#if showNames || state === "missed" || state === "correct" || state === "wrong"}
          <text x={fretX(spot.fret)} y={stringY(spot.string) + 4}>{label(spot)}</text>
        {/if}
      </g>
    {/each}
  </svg>
</div>

<style>
  .picker { overflow-x:auto; overscroll-behavior-x:contain; border:1px solid var(--line); border-radius:var(--radius-md); background:var(--surface-muted); padding:8px 4px; }
  svg { display:block; }
  .wood { fill:color-mix(in srgb, var(--surface) 70%, var(--warning) 8%); }
  .string-highlight { fill:color-mix(in srgb, var(--coral) 14%, transparent); }
  .inlay { fill:var(--line); }
  .nut { stroke:var(--border); stroke-width:4; }
  .fret { stroke:var(--line); stroke-width:2; }
  .string { stroke:var(--muted); }
  .fret-number, .open-name { font:600 10px "JetBrains Mono", monospace; fill:var(--muted); text-anchor:middle; }
  .open-name { text-anchor:start; font-size:11px; }
  .open-name.active { fill:var(--coral); font-weight:700; }
  .spot { cursor:pointer; outline:none; }
  .spot[aria-disabled="true"] { cursor:default; }
  .hit { fill:transparent; }
  .spot circle { fill:transparent; stroke:transparent; stroke-width:2; transition:fill .12s ease; }
  .spot:not([aria-disabled="true"]):hover circle, .spot:focus-visible circle { fill:color-mix(in srgb, var(--coral) 22%, transparent); stroke:var(--coral); }
  .spot:focus-visible circle { stroke-width:3; }
  .spot.named circle { fill:var(--surface); stroke:var(--line); }
  .spot.selected circle { fill:var(--coral); stroke:var(--border); }
  .spot.target circle { fill:var(--coral); stroke:var(--border); stroke-width:3; }
  .spot.correct circle { fill:var(--success); stroke:var(--border); }
  .spot.wrong circle { fill:var(--error); stroke:var(--border); }
  .spot.missed circle { fill:var(--surface); stroke:var(--success); stroke-width:3; stroke-dasharray:4 3; }
  .spot text { font:700 9.5px "Manrope", sans-serif; fill:var(--text); text-anchor:middle; pointer-events:none; }
  .spot.correct text, .spot.wrong text { fill:#fff; }
  .spot.selected text, .spot.target text { fill:var(--ink); }
</style>
