<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import type { Instrument } from "../../lib/types";
  import { noteName, rootKey, type SpelledNote } from "../../lib/theory/notes";
  import { ROUTINE_KEYS, buildRoutine, type RoutineStep } from "../../lib/theory/routine";
  import { logWarmup, notation } from "../../lib/warmupLog";
  import { MOTION, createAnimationGroup, gsap, reducedMotion } from "../../lib/motion";
  import { stepReveal } from "../../lib/feedbackMotion";
  import ScaleExplorer from "./ScaleExplorer.svelte";
  import MiniQuiz from "./MiniQuiz.svelte";

  let { instrument = $bindable("guitarra"), embedded = false, onFinish, onSkip }: {
    instrument?: Instrument;
    /** Dentro de una sesión de setlist: muestra "Saltar" y avisa al terminar. */
    embedded?: boolean;
    onFinish?: () => void;
    onSkip?: () => void;
  } = $props();

  const randomKey = () => ROUTINE_KEYS[Math.floor(Math.random() * ROUTINE_KEYS.length)];
  let key = $state<SpelledNote>(randomKey());
  let stepSeconds = $state(90);
  let steps = $state<RoutineStep[]>([]);
  let phase = $state<"intro" | "steps" | "quiz" | "done">("intro");
  let index = $state(0);
  let remaining = $state(0);
  let running = $state(false);
  let timer: ReturnType<typeof setInterval> | undefined;
  let heading = $state<HTMLElement>();
  let stepBodyEl = $state<HTMLDivElement>();
  let dotsEl = $state<HTMLOListElement>();
  let phaseEl = $state<HTMLDivElement>();

  const transitionGroup = createAnimationGroup();
  let lastPhase: typeof phase = "intro";
  let lastStepIndex = -1;

  const step = $derived(steps[index]);
  const n = $derived($notation);

  $effect(() => {
    const currentPhase = phase;
    const currentIndex = index;

    if (currentPhase === "steps" && lastPhase === "steps" && currentIndex !== lastStepIndex) {
      lastStepIndex = currentIndex;
      transitionGroup.finishAll();
      if ($reducedMotion) return;

      let cancelled = false;
      void tick().then(() => {
        if (cancelled || $reducedMotion) return;
        transitionGroup.add(stepReveal(stepBodyEl, { x: 12, y: 0 }));
        const activeDot = dotsEl?.querySelector<HTMLElement>(`li[data-step="${currentIndex}"] .dot-fill`);
        if (activeDot) {
          transitionGroup.add(
            gsap.fromTo(
              activeDot,
              { scaleX: 0 },
              {
                scaleX: 1,
                duration: MOTION.duration.indicator,
                ease: MOTION.ease.out,
                clearProps: "transform",
              }
            )
          );
        }
      });
      return () => {
        cancelled = true;
      };
    }

    if (currentPhase !== lastPhase) {
      lastPhase = currentPhase;
      lastStepIndex = currentPhase === "steps" ? currentIndex : -1;
      transitionGroup.finishAll();
      if ($reducedMotion) return;

      let cancelled = false;
      void tick().then(() => {
        if (cancelled || $reducedMotion) return;
        transitionGroup.add(stepReveal(phaseEl, { y: 8 }));
      });
      return () => {
        cancelled = true;
      };
    }
  });

  async function focusHeading() {
    await tick();
    heading?.focus();
  }

  function stopTimer() {
    clearInterval(timer);
    timer = undefined;
    running = false;
  }

  function startTimer() {
    if (remaining <= 0) remaining = stepSeconds;
    running = true;
    clearInterval(timer);
    timer = setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      if (remaining === 0) stopTimer();
    }, 1000);
  }

  function start() {
    steps = buildRoutine(key, Math.random, n);
    index = 0;
    remaining = stepSeconds;
    phase = "steps";
    startTimer();
    void focusHeading();
  }

  function next() {
    stopTimer();
    if (index + 1 < steps.length) {
      index++;
      remaining = stepSeconds;
      startTimer();
    } else {
      logWarmup({ kind: "rutina", detail: steps.map((s) => s.title).join(" → ") });
      phase = "quiz";
    }
    void focusHeading();
  }

  function finishQuiz() {
    phase = "done";
    void focusHeading();
  }

  function restart() {
    stopTimer();
    key = randomKey();
    phase = "intro";
    void focusHeading();
  }

  onDestroy(() => {
    stopTimer();
    transitionGroup.killAll();
  });

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
</script>

<div class="routine">
  {#if phase === "intro"}
    <div class="card intro" bind:this={phaseEl}>
      <h3 bind:this={heading} tabindex="-1">{embedded ? "Antes de empezar: calentamiento" : "Rutina de calentamiento"}</h3>
      <p>4 escalas alrededor de una tonalidad (mayor, su relativa menor, un modo y la pentatónica) y al final un mini quiz de 5 preguntas. Unos {Math.round((stepSeconds * 4) / 60 + 2)} minutos.</p>
      <div class="options">
        <label>
          <span>Tonalidad</span>
          <select value={rootKey(key)} onchange={(e) => (key = ROUTINE_KEYS.find((k) => rootKey(k) === e.currentTarget.value) ?? key)}>
            {#each ROUTINE_KEYS as option (rootKey(option))}<option value={rootKey(option)}>{noteName(option, n)} mayor</option>{/each}
          </select>
        </label>
        <button type="button" class="pill-btn" onclick={() => (key = randomKey())} aria-label="Tonalidad al azar">🎲 Al azar</button>
        <label>
          <span>Tiempo por escala</span>
          <select bind:value={stepSeconds}>
            <option value={60}>1 min</option>
            <option value={90}>1 min 30 s</option>
            <option value={120}>2 min</option>
            <option value={180}>3 min</option>
          </select>
        </label>
        {#if !embedded}
          <div class="segmented" role="group" aria-label="Instrumento">
            <button type="button" class:active={instrument === "bajo"} aria-pressed={instrument === "bajo"} onclick={() => (instrument = "bajo")}>Bajo</button>
            <button type="button" class:active={instrument === "guitarra"} aria-pressed={instrument === "guitarra"} onclick={() => (instrument = "guitarra")}>Guitarra</button>
          </div>
        {/if}
      </div>
      <div class="actions">
        <button type="button" class="press-btn" onclick={start}>Empezar calentamiento</button>
        {#if embedded}<button type="button" class="pill-btn" onclick={() => onSkip?.()}>Saltar e ir a las canciones</button>{/if}
      </div>
    </div>
  {:else if phase === "steps" && step}
    <div class="card step-card" bind:this={phaseEl}>
      <div class="step-head">
        <div>
          <p class="eyebrow">Escala {index + 1} de {steps.length}</p>
          <h3 bind:this={heading} tabindex="-1">{step.title}</h3>
        </div>
        <div class="timer" class:over={remaining === 0} role="timer" aria-live={remaining === 0 ? "polite" : "off"}>
          <span>{remaining === 0 ? "¡Tiempo!" : mmss(remaining)}</span>
          <button type="button" class="pill-btn" onclick={() => (running ? stopTimer() : startTimer())}>{running ? "Pausa" : remaining === 0 ? "Otra vez" : "Seguir"}</button>
        </div>
      </div>
      <ol class="dots" bind:this={dotsEl} aria-hidden="true">
        {#each steps as _, i (i)}
          <li data-step={i} class:done={i < index} class:current={i === index}>
            <span class="dot-fill"></span>
          </li>
        {/each}
      </ol>
      <div class="step-body" bind:this={stepBodyEl}>
        <p class="instruction">{step.instruction}</p>
        <ScaleExplorer root={step.root} scaleId={step.scaleId} {instrument} compact />
      </div>
      <div class="actions">
        <button type="button" class="press-btn" onclick={next}>{index + 1 < steps.length ? "Siguiente escala" : "Ir al quiz"}</button>
        {#if embedded}<button type="button" class="pill-btn" onclick={() => { stopTimer(); onSkip?.(); }}>Saltar calentamiento</button>{/if}
      </div>
    </div>
  {:else if phase === "quiz"}
    <div class="phase-wrap" bind:this={phaseEl}>
      <h3 bind:this={heading} tabindex="-1" class="quiz-title">Mini quiz</h3>
      <MiniQuiz onDone={finishQuiz} />
      {#if embedded}<button type="button" class="pill-btn skip-quiz" onclick={() => onFinish?.()}>Saltar quiz e ir a las canciones</button>{/if}
    </div>
  {:else}
    <div class="card intro" bind:this={phaseEl}>
      <h3 bind:this={heading} tabindex="-1">Calentamiento terminado</h3>
      <p>Buen trabajo. {embedded ? "Ahora sí, a las canciones." : "Puedes repetir con otra tonalidad o explorar las escalas a tu ritmo."}</p>
      <div class="actions">
        {#if embedded}
          <button type="button" class="press-btn" onclick={() => onFinish?.()}>Empezar las canciones</button>
        {:else}
          <button type="button" class="press-btn" onclick={restart}>Otra rutina</button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .routine { display:grid; gap:16px; }
  .phase-wrap { display:grid; gap:16px; min-width:0; }
  .card { padding:20px; display:grid; gap:14px; min-width:0; }
  .step-body { display:grid; gap:14px; min-width:0; }
  h3 { margin:0; font:700 1.25rem "Bricolage Grotesque", sans-serif; }
  h3:focus { outline:none; }
  p { margin:0; }
  .options { display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; }
  .options label { display:grid; gap:4px; font-size:.75rem; font-weight:700; color:var(--muted); }
  .actions { display:flex; flex-wrap:wrap; gap:8px; }
  .step-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; }
  .eyebrow { font-size:.75rem; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; }
  .timer { display:flex; align-items:center; gap:10px; }
  .timer span { font:600 1.5rem "JetBrains Mono", monospace; min-width:5ch; text-align:right; }
  .timer.over span { color:var(--coral); font-size:1.1rem; }
  .dots { display:flex; gap:6px; list-style:none; padding:0; margin:0; }
  .dots li { flex:1; height:6px; border-radius:3px; background:var(--line); overflow:hidden; }
  .dot-fill { display:block; width:100%; height:100%; transform-origin:left center; transform:scaleX(0); }
  .dots li.done .dot-fill { background:var(--lime); transform:scaleX(1); }
  .dots li.current .dot-fill { background:var(--coral); transform:scaleX(1); }
  .instruction { padding:12px 14px; background:var(--surface-muted); border-radius:var(--radius-sm); }
  .quiz-title { margin-bottom:-4px; }
  .skip-quiz { justify-self:start; }
</style>
