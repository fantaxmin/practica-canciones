<script lang="ts">
  import type { Instrument } from "../../lib/types";
  import type { SpelledNote } from "../../lib/theory/notes";
  import type { ScaleId } from "../../lib/theory/scales";
  import { practiceSession } from "../../lib/practiceSession";
  import { notation, warmupLog } from "../../lib/warmupLog";
  import ScaleExplorer from "./ScaleExplorer.svelte";
  import TheoryCards from "./TheoryCards.svelte";
  import WarmupRoutine from "./WarmupRoutine.svelte";
  import MiniQuiz from "./MiniQuiz.svelte";
  import EarTraining from "../EarTraining.svelte";
  import NoteFinder from "./NoteFinder.svelte";

  type View = "rutina" | "explorar" | "teoria" | "quiz" | "oido" | "notas";
  const VIEWS: { id: View; label: string }[] = [
    { id: "rutina", label: "Rutina" },
    { id: "explorar", label: "Explorar escalas" },
    { id: "teoria", label: "Teoría" },
    { id: "quiz", label: "Quiz" },
    { id: "oido", label: "Oído" },
    { id: "notas", label: "Encontrar notas" },
  ];

  let view = $state<View>("rutina");
  let instrument = $state<Instrument>($practiceSession?.instrument ?? "bajo");
  let root = $state<SpelledNote>({ letter: 0, accidental: 0 });
  let scaleId = $state<ScaleId>("jonico");

  const quizzes = $derived($warmupLog.filter((e) => e.kind === "quiz" && e.total));
  const average = $derived(quizzes.length ? Math.round((quizzes.reduce((sum, e) => sum + (e.score ?? 0) / (e.total ?? 1), 0) / quizzes.length) * 100) : null);

  function explore(nextRoot: SpelledNote, nextScale: ScaleId) {
    root = nextRoot;
    scaleId = nextScale;
    view = "explorar";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
</script>

<div class="warmup">
  <div class="heading">
    <div>
      <h2 tabindex="-1">Calentamiento</h2>
      <p>Escalas, modos y teoría para soltar los dedos antes de tus canciones.{#if average !== null} <span class="stat">· {quizzes.length} {quizzes.length === 1 ? "quiz" : "quizzes"}, {average}% de aciertos</span>{/if}</p>
    </div>
    <div class="segmented" role="group" aria-label="Nombres de notas">
      <button type="button" class:active={$notation === "latin"} aria-pressed={$notation === "latin"} onclick={() => notation.set("latin")}>Do Re Mi</button>
      <button type="button" class:active={$notation === "english"} aria-pressed={$notation === "english"} onclick={() => notation.set("english")}>C D E</button>
    </div>
  </div>

  <nav class="subnav" aria-label="Secciones del calentamiento">
    {#each VIEWS as item (item.id)}
      <button type="button" class="pill-btn" class:active={view === item.id} aria-current={view === item.id ? "page" : undefined} onclick={() => (view = item.id)}>{item.label}</button>
    {/each}
  </nav>

  <div id="explorar">
    {#if view === "rutina"}
      <WarmupRoutine bind:instrument />
    {:else if view === "explorar"}
      <div class="card pad"><ScaleExplorer bind:root bind:scaleId bind:instrument /></div>
    {:else if view === "teoria"}
      <TheoryCards onExplore={explore} />
    {:else if view === "quiz"}
      <MiniQuiz />
    {:else if view === "oido"}
      <EarTraining />
    {:else}
      <NoteFinder bind:instrument />
    {/if}
  </div>
</div>

<style>
  .warmup { display:grid; gap:20px; }
  .heading { display:flex; justify-content:space-between; align-items:flex-end; gap:12px; flex-wrap:wrap; }
  h2 { margin:0; font:700 1.25rem "Bricolage Grotesque", sans-serif; }
  h2:focus { outline:none; }
  .heading p { margin:6px 0 0; color:var(--muted); font-size:.875rem; }
  .stat { font-weight:700; }
  .subnav { display:flex; gap:8px; flex-wrap:wrap; }
  .pad { padding:20px; min-width:0; }
  @media (max-width:640px) { .subnav { gap:4px; flex-wrap:nowrap; overflow-x:auto; margin:0 -16px; padding:0 16px 4px; scrollbar-width:none; } .subnav button { flex:0 0 auto; padding:8px 12px; } .pad { padding:14px; } }
</style>
