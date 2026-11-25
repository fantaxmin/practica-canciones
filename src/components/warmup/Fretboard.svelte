<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { ROOTS, noteName, pitchClass, rootKey, type Notation, type SpelledNote } from "../../lib/theory/notes";
  import { formatDegree, type ScaleId } from "../../lib/theory/scales";
  import { scalePositions, type Tuning } from "../../lib/theory/fretboard";
  import { playNote } from "../../lib/audio/synth";
  import { MOTION, createAnimationGroup, gsap, reducedMotion } from "../../lib/motion";

  let { tuning, root, scaleId, labels = "nota", notation = "latin", maxFret = 12 }: {
    tuning: Tuning;
    root: SpelledNote;
    scaleId: ScaleId;
    labels?: "nota" | "grado";
    notation?: Notation;
    maxFret?: number;
  } = $props();

  const NUT_X = 68;
  const FRET_W = 52;
  const GAP = 28;
  const TOP = 22;
  const INLAYS = [3, 5, 7, 9, 15, 17];
  const MAX_WAVE_GROUPS = 12;

  let svgEl = $state<SVGSVGElement>();
  const waveGroup = createAnimationGroup();
  let lastScaleKey = "";

  const strings = $derived(tuning.strings.length);
  const width = $derived(NUT_X + maxFret * FRET_W + 16);
  const height = $derived(TOP + (strings - 1) * GAP + 40);
  const positions = $derived(scalePositions(tuning, root, scaleId, maxFret));
  const scaleKey = $derived(`${tuning.name}|${rootKey(root)}|${scaleId}|${maxFret}`);
  // La cuerda más aguda arriba, como en una tablatura.
  const stringY = (string: number) => TOP + (strings - 1 - string) * GAP;
  const fretX = (fret: number) => fret === 0 ? NUT_X - 20 : NUT_X + (fret - 0.5) * FRET_W;
  const openNames = $derived(tuning.strings.map((midi) => {
    const note = ROOTS.find((r) => pitchClass(r) === midi % 12);
    return note ? noteName(note, notation) : "";
  }));
  const summary = $derived(`${tuning.name}. Notas marcadas en ${positions.length} posiciones entre el traste 0 y el ${maxFret}.`);

  $effect(() => {
    const key = scaleKey;
    if (key === lastScaleKey) return;
    lastScaleKey = key;

    waveGroup.finishAll();
    if ($reducedMotion) return;

    let cancelled = false;
    void tick().then(() => {
      if (cancelled || !svgEl || $reducedMotion) return;
      const dots = Array.from(svgEl.querySelectorAll<SVGGElement>(".dot[data-fret]"));
      if (!dots.length) return;

      const byFret = new Map<number, SVGGElement[]>();
      for (const dot of dots) {
        const fret = Number(dot.dataset.fret ?? 0);
        const list = byFret.get(fret);
        if (list) list.push(dot);
        else byFret.set(fret, [dot]);
      }

      const fretOrder = [...byFret.keys()].sort((a, b) => a - b);
      const tl = gsap.timeline();
      fretOrder.forEach((fret, groupIndex) => {
        const groupDots = byFret.get(fret)!;
        const startAt = Math.min(groupIndex, MAX_WAVE_GROUPS - 1) * 0.025;
        for (const dot of groupDots) {
          const origin = `${dot.dataset.cx ?? 0} ${dot.dataset.cy ?? 0}`;
          tl.fromTo(
            dot,
            { scale: 0.55, opacity: 0, svgOrigin: origin },
            {
              scale: 1,
              opacity: 1,
              svgOrigin: origin,
              duration: MOTION.duration.fast,
              ease: MOTION.ease.back,
              clearProps: "transform,transformOrigin,opacity",
            },
            startAt
          );
        }
      });
      waveGroup.add(tl);
    });

    return () => {
      cancelled = true;
    };
  });

  onDestroy(() => {
    waveGroup.killAll();
  });
</script>

<div class="fretboard">
  <svg bind:this={svgEl} viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={summary}>
    <rect x={NUT_X} y={TOP - 8} width={maxFret * FRET_W} height={(strings - 1) * GAP + 16} rx="4" class="wood" />
    {#each INLAYS.filter((f) => f <= maxFret) as fret (fret)}
      <circle cx={NUT_X + (fret - 0.5) * FRET_W} cy={TOP + ((strings - 1) * GAP) / 2} r="5" class="inlay" />
    {/each}
    {#if maxFret >= 12}
      <circle cx={NUT_X + 11.5 * FRET_W} cy={TOP + GAP * 0.5} r="5" class="inlay" />
      <circle cx={NUT_X + 11.5 * FRET_W} cy={TOP + (strings - 1.5) * GAP} r="5" class="inlay" />
    {/if}
    <line x1={NUT_X} x2={NUT_X} y1={TOP - 8} y2={TOP + (strings - 1) * GAP + 8} class="nut" />
    {#each Array.from({ length: maxFret }, (_, i) => i + 1) as fret (fret)}
      <line x1={NUT_X + fret * FRET_W} x2={NUT_X + fret * FRET_W} y1={TOP - 8} y2={TOP + (strings - 1) * GAP + 8} class="fret" />
      <text x={NUT_X + (fret - 0.5) * FRET_W} y={height - 6} class="fret-number">{fret}</text>
    {/each}
    {#each tuning.strings as _, string (string)}
      <line x1={NUT_X} x2={width - 16} y1={stringY(string)} y2={stringY(string)} class="string" style:stroke-width={1 + (strings - 1 - string) * (strings === 4 ? 0.6 : 0.35)} />
      <text x="4" y={stringY(string) + 4} class="open-name">{openNames[string]}</text>
    {/each}
    {#each positions as pos (`${pos.string}-${pos.fret}`)}
      {@const label = labels === "nota" ? noteName(pos.note, notation) : formatDegree(pos.degree)}
      {@const cx = fretX(pos.fret)}
      {@const cy = stringY(pos.string)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <g class="dot" class:root={pos.isRoot} data-fret={pos.fret} data-cx={cx} data-cy={cy} onpointerdown={() => playNote(pos.midi, 0.7)}>
        <circle {cx} {cy} r="11.5" />
        <text x={cx} y={cy + 4}>{label}</text>
      </g>
    {/each}
  </svg>
</div>
<p class="hint">Toca un punto para oír la nota. <span class="legend root-swatch"></span> tónica</p>

<style>
  .fretboard { overflow-x:auto; overscroll-behavior-x:contain; border:1px solid var(--line); border-radius:var(--radius-md); background:var(--surface-muted); padding:8px 4px; }
  svg { display:block; }
  .wood { fill:color-mix(in srgb, var(--surface) 70%, var(--warning) 8%); }
  .inlay { fill:var(--line); }
  .nut { stroke:var(--border); stroke-width:4; }
  .fret { stroke:var(--line); stroke-width:2; }
  .string { stroke:var(--muted); }
  .fret-number, .open-name { font:600 10px "JetBrains Mono", monospace; fill:var(--muted); text-anchor:middle; }
  .open-name { text-anchor:start; }
  .dot { cursor:pointer; }
  .dot circle { fill:var(--lime); stroke:var(--border); stroke-width:1.5; transition:transform .1s ease; transform-box:fill-box; transform-origin:center; }
  .dot.root circle { fill:var(--coral); }
  .dot:active circle { transform:scale(1.15); }
  .dot text { font:700 9.5px "Manrope", sans-serif; fill:var(--ink); text-anchor:middle; pointer-events:none; }
  .hint { margin:8px 0 0; font-size:.75rem; color:var(--muted); display:flex; align-items:center; gap:6px; }
  .root-swatch { display:inline-block; width:12px; height:12px; border-radius:50%; background:var(--coral); border:1px solid var(--border); margin-left:6px; }
</style>
