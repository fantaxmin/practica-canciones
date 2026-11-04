<script lang="ts">
  import { tick, untrack } from "svelte";
  import { generateQuiz, type QuizQuestion } from "../../lib/theory/quiz";
  import { logWarmup, notation } from "../../lib/warmupLog";

  let { count = 5, onDone }: { count?: number; onDone?: (score: number, total: number) => void } = $props();

  let questions = $state<QuizQuestion[]>(untrack(() => generateQuiz(count, Math.random, $notation)));
  let index = $state(0);
  let chosen = $state<number | null>(null);
  let score = $state(0);
  let finished = $state(false);
  let heading = $state<HTMLElement>();

  const question = $derived(questions[index]);

  function choose(option: number) {
    if (chosen !== null) return;
    chosen = option;
    if (option === question.answer) score++;
  }

  async function next() {
    if (index + 1 >= questions.length) {
      finished = true;
      logWarmup({ kind: "quiz", score, total: questions.length });
      onDone?.(score, questions.length);
    } else {
      index++;
      chosen = null;
    }
    await tick();
    heading?.focus();
  }

  async function restart() {
    questions = generateQuiz(count, Math.random, $notation);
    index = 0;
    chosen = null;
    score = 0;
    finished = false;
    await tick();
    heading?.focus();
  }

  const verdict = $derived(score === questions.length ? "¡Perfecto!" : score >= questions.length * 0.6 ? "¡Bien!" : "A repasar un poco");
</script>

<div class="quiz card">
  {#if finished}
    <h3 bind:this={heading} tabindex="-1">{verdict}</h3>
    <p class="score"><strong>{score}</strong> de {questions.length} correctas</p>
    <div class="actions">
      <button type="button" class="press-btn" onclick={restart}>Otro quiz</button>
    </div>
  {:else}
    <div class="progress">
      <span>Pregunta {index + 1} de {questions.length}</span>
      <span>{score} {score === 1 ? "acierto" : "aciertos"}</span>
    </div>
    <h3 bind:this={heading} tabindex="-1">{question.prompt}</h3>
    <div class="options" role="group" aria-label="Opciones">
      {#each question.options as option, i (option)}
        <button type="button" class="option"
          class:correct={chosen !== null && i === question.answer}
          class:wrong={chosen === i && i !== question.answer}
          disabled={chosen !== null && i !== chosen && i !== question.answer}
          aria-pressed={chosen === i}
          onclick={() => choose(i)}>{option}</button>
      {/each}
    </div>
    <div aria-live="polite">
      {#if chosen !== null}
        <div class="feedback" class:ok={chosen === question.answer}>
          <strong>{chosen === question.answer ? "Correcto." : `No: era ${question.options[question.answer]}.`}</strong>
          <p>{question.explanation}</p>
        </div>
      {/if}
    </div>
    {#if chosen !== null}
      <div class="actions">
        <button type="button" class="press-btn" onclick={next}>{index + 1 >= questions.length ? "Ver resultado" : "Siguiente"}</button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .quiz { padding:20px; display:grid; gap:14px; max-width:720px; }
  h3 { margin:0; font:700 1.125rem "Bricolage Grotesque", sans-serif; }
  h3:focus { outline:none; }
  .progress { display:flex; justify-content:space-between; font-size:.75rem; color:var(--muted); font-weight:700; }
  .options { display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap:8px; }
  .option { min-height:48px; padding:10px 14px; text-align:left; border:1.5px solid var(--line); border-radius:var(--radius-md); background:var(--surface); color:var(--text); font:600 .9rem "Manrope", sans-serif; cursor:pointer; }
  .option:hover:not(:disabled) { border-color:var(--coral); }
  .option:disabled { opacity:.5; cursor:default; }
  .option.correct { border-color:var(--success); background:var(--success-soft); opacity:1; }
  .option.wrong { border-color:var(--error); background:var(--error-soft); }
  .feedback { padding:12px 14px; border-radius:var(--radius-sm); background:var(--error-soft); border-left:4px solid var(--error); }
  .feedback.ok { background:var(--success-soft); border-left-color:var(--success); }
  .feedback p { margin:4px 0 0; font-size:.875rem; }
  .actions { display:flex; gap:8px; flex-wrap:wrap; }
  .score { margin:0; font-size:1.125rem; }
  .score strong { font:800 2rem "Bricolage Grotesque", sans-serif; color:var(--coral); }
</style>
