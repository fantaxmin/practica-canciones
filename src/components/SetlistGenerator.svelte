<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { Instrument, Song, Tab } from "../lib/types";
  import { formatMmSs } from "../lib/duration";
  import { generateSetlist, normalizeArtist, withoutExcludedArtists } from "../lib/setlist";
  import { excludedArtists } from "../lib/setlistPrefs";
  import { songs } from "../lib/stores";
  import { logPractice } from "../lib/practiceLog";
  import { practiceSession } from "../lib/practiceSession";
  import CardTable from "./setlist/CardTable.svelte";
  import { startPractice, finishWarmup, practiced, skip as skipCard, back, reshuffle } from "../lib/sessionDeck";
  import WarmupRoutine from "./warmup/WarmupRoutine.svelte";

  let { onNavigate }: { onNavigate: (tab: Tab) => void } = $props();
  let instrument = $state<Instrument>($practiceSession?.instrument ?? "bajo");
  let minutes = $state<number | undefined>($practiceSession?.minutes ?? 15);
  let priorityArtist = $state($practiceSession?.priorityArtist ?? "");
  let controlsOpen = $state(false);
  let cardTable = $state<CardTable>();
  let dealKey = $state(0);
  let currentHeading = $state<HTMLHeadingElement>();
  let minutesInput = $state<HTMLInputElement>();

  const instrumentSongs = $derived($songs.filter((song) => song.instruments[instrument]));
  const instrumentArtists = $derived([...new Set(instrumentSongs.map((song) => song.artist.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")));
  const isExcluded = (artist: string) => $excludedArtists.some((item) => normalizeArtist(item) === normalizeArtist(artist));
  const excludedHere = $derived(instrumentArtists.filter(isExcluded));
  const candidates = $derived(withoutExcludedArtists(instrumentSongs, $excludedArtists));
  const availableArtists = $derived([...new Set(candidates.map((song) => song.artist.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")));
  const validMinutes = $derived(minutes !== undefined && Number.isInteger(minutes) && minutes >= 1 && minutes <= 240);
  const minutesError = $derived(validMinutes ? "" : "Escribe entre 1 y 240 minutos enteros.");
  const sessionSongs = $derived($practiceSession
    ? $practiceSession.songIds.map((id) => $songs.find((song) => song.id === id)).filter((song): song is Song => !!song)
    : []);
  const currentIndex = $derived($practiceSession?.currentIndex ?? 0);
  const currentSong = $derived(sessionSongs[currentIndex] ?? null);
  const practicedCount = $derived(sessionSongs.filter((song) => $practiceSession?.practicedIds.includes(song.id)).length);
  const sessionDone = $derived($practiceSession !== null && currentIndex >= sessionSongs.length);
  const practicedSeconds = $derived(sessionSongs.filter((song) => $practiceSession?.practicedIds.includes(song.id)).reduce((sum, song) => sum + song.durationSeconds, 0));
  const sessionSeconds = $derived(sessionSongs.reduce((sum, song) => sum + song.durationSeconds, 0));
  const targetSeconds = $derived(($practiceSession?.minutes ?? 0) * 60);
  const fillPercent = $derived(targetSeconds > 0 ? Math.min(100, (practicedSeconds / targetSeconds) * 100) : 0);
  const minimumMinutes = $derived.by(() => {
    const eligible = withoutExcludedArtists($songs, $practiceSession?.excludedArtists ?? $excludedArtists)
      .filter((song) => song.instruments[$practiceSession?.instrument ?? instrument] && song.durationSeconds > 0);
    return eligible.length ? Math.ceil(Math.min(...eligible.map((song) => song.durationSeconds)) / 60) : null;
  });

  onMount(() => {
    if (currentSong || sessionDone) void focusCurrent();
  });

  $effect(() => {
    if (priorityArtist && !availableArtists.includes(priorityArtist)) priorityArtist = "";
  });
  async function focusCurrent() {
    await tick();
    if ($practiceSession?.stage === "playing") await cardTable?.focusCurrent();
    else currentHeading?.focus();
  }

  function generate() {
    if (!validMinutes || !candidates.length || minutes === undefined) return;
    const result = generateSetlist($songs, instrument, minutes * 60, priorityArtist || undefined, excludedHere);
    practiceSession.set({ instrument, minutes, priorityArtist, excludedArtists: excludedHere, songIds: result.map((song) => song.id), currentIndex: 0, practicedIds: [], stage: "deal" });
    dealKey += 1;
    controlsOpen = false;
    void focusCurrent();
  }

  function rebarajar() {
    const session = $practiceSession;
    if (!session || session.stage !== "deal") return;
    const result = generateSetlist($songs, session.instrument, session.minutes * 60, session.priorityArtist, session.excludedArtists, { previousIds: session.songIds });
    practiceSession.set(reshuffle(session, result.map((song) => song.id)));
    dealKey += 1;
    void focusCurrent();
  }

  function beginPractice() {
    practiceSession.update((session) => session ? startPractice(session) : session);
  }

  function toggleExcluded(artist: string) {
    excludedArtists.update((list) => isExcluded(artist)
      ? list.filter((item) => normalizeArtist(item) !== normalizeArtist(artist))
      : [...list, artist]);
  }

  function clearExcluded() {
    const here = new Set(instrumentArtists.map(normalizeArtist));
    excludedArtists.update((list) => list.filter((item) => !here.has(normalizeArtist(item))));
  }

  function increaseTime() {
    if (minimumMinutes === null || minimumMinutes > 240) return;
    instrument = $practiceSession?.instrument ?? instrument;
    minutes = minimumMinutes;
    generate();
  }

  function markAndNext() {
    const song = currentSong;
    if (!song || $practiceSession?.stage !== "playing") return;
    if (!$practiceSession?.practicedIds.includes(song.id)) {
      const now = Date.now();
      songs.update((all) => all.map((item) => item.id === song.id ? { ...item, lastPracticedAt: now } : item));
      logPractice(song.id, song.title, song.durationSeconds);
    }
    practiceSession.update((session) => session ? practiced(session) : session);
    void focusCurrent();
  }

  function setWarmup(state: "done" | "skipped") {
    practiceSession.update((session) => session ? finishWarmup(session, state) : session);
    window.scrollTo({ top: 0 });
    void focusCurrent();
  }

  function skip() {
    practiceSession.update((session) => session ? skipCard(session) : session);
    void focusCurrent();
  }

  function goBack() {
    practiceSession.update((session) => session ? back(session) : session);
    void focusCurrent();
  }

  function repeatSession() {
    practiceSession.update((session) => session ? reshuffle(session, session.songIds) : session);
    controlsOpen = false;
    dealKey += 1;
    void focusCurrent();
  }

  async function newSetlist() {
    practiceSession.set(null);
    controlsOpen = true;
    await tick();
    minutesInput?.focus();
  }

  async function changeControls() {
    instrument = $practiceSession?.instrument ?? instrument;
    minutes = $practiceSession?.minutes ?? minutes;
    priorityArtist = $practiceSession?.priorityArtist ?? "";
    controlsOpen = true;
    await tick();
    minutesInput?.focus();
  }
</script>

<div class="setlist-generator">
  <h2 tabindex="-1">Generar setlist</h2>
  {#if $practiceSession && !controlsOpen}
    <div class="controls-summary">
      <p>{$practiceSession.instrument === "bajo" ? "Bajo" : "Guitarra"} · {$practiceSession.minutes} min · {$practiceSession.priorityArtist || "Sin artista prioritario"}{#if $practiceSession.excludedArtists?.length}{" · "}{$practiceSession.excludedArtists.length} {$practiceSession.excludedArtists.length === 1 ? "artista excluido" : "artistas excluidos"}{/if}</p>
      <button class="pill-btn" onclick={changeControls} aria-expanded="false" aria-controls="setlist-controls">Cambiar</button>
    </div>
  {/if}
  <div id="setlist-controls">
    {#if !$practiceSession || controlsOpen}
      <form class="card controls" onsubmit={(event) => { event.preventDefault(); generate(); }} novalidate>
        <div class="segmented" role="group" aria-label="Instrumento del setlist">
          <button type="button" class:active={instrument === "bajo"} aria-pressed={instrument === "bajo"} onclick={() => (instrument = "bajo")}>Bajo</button>
          <button type="button" class:active={instrument === "guitarra"} aria-pressed={instrument === "guitarra"} onclick={() => (instrument = "guitarra")}>Guitarra</button>
        </div>
        <div class="time-controls">
          <label for="minutes">Minutos de práctica</label>
          <div class="time-row">
            <div class="presets" role="group" aria-label="Duraciones sugeridas">
              {#each [10, 15, 30, 45, 60] as preset}
                <button type="button" class:active={minutes === preset} aria-pressed={minutes === preset} aria-label={`${preset} minutos`} onclick={() => (minutes = preset)}>{preset}</button>
              {/each}
            </div>
            <input bind:this={minutesInput} id="minutes" type="number" min="1" max="240" step="1" bind:value={minutes} aria-invalid={!validMinutes} aria-describedby={!validMinutes ? "minutes-error" : undefined} />
          </div>
          {#if minutesError}<p id="minutes-error" class="field-error" role="alert">{minutesError}</p>{/if}
        </div>
        {#if availableArtists.length}
          <div class="artist-control">
            <label for="priority-artist">Priorizar artista</label>
            <select id="priority-artist" bind:value={priorityArtist}>
              <option value="">Ninguno</option>
              {#each availableArtists as artist}<option value={artist}>{artist}</option>{/each}
            </select>
          </div>
        {/if}
        {#if instrumentArtists.length}
          <details class="exclude-control" open={excludedHere.length > 0}>
            <summary>Excluir artistas{#if excludedHere.length}<span class="count">{excludedHere.length}</span>{/if}</summary>
            <p class="hint">Sus canciones no entrarán en el setlist. Se recuerda para la próxima vez.</p>
            <div class="artist-chips" role="group" aria-label="Artistas excluidos del setlist">
              {#each instrumentArtists as artist (artist)}
                {@const excluded = isExcluded(artist)}
                <button type="button" class="artist-chip" class:excluded aria-pressed={excluded} onclick={() => toggleExcluded(artist)}>
                  <span aria-hidden="true">{excluded ? "✕" : "✓"}</span> {artist}
                </button>
              {/each}
            </div>
            {#if excludedHere.length}<button type="button" class="link-btn" onclick={clearExcluded}>Volver a incluir a todos</button>{/if}
          </details>
        {/if}
        <div class="generate-actions">
          <button type="submit" class="press-btn" disabled={!validMinutes || !candidates.length}>Generar setlist</button>
          {#if $practiceSession}<button type="button" class="pill-btn" onclick={() => (controlsOpen = false)}>Volver a la sesión</button>{/if}
        </div>
        {#if !candidates.length}
          <div class="no-songs" role="status">
            {#if instrumentSongs.length}
              <p>Excluiste a todos los artistas con canciones de {instrument}.</p>
              <button type="button" class="pill-btn" onclick={clearExcluded}>Volver a incluir a todos</button>
            {:else}
              <p>Aún no tienes canciones de {instrument}.</p>
              <button type="button" class="pill-btn" onclick={() => onNavigate("repertorio")}>Agregar canciones</button>
            {/if}
          </div>
        {/if}
      </form>
    {/if}
  </div>

  {#if $practiceSession}
    {#if !sessionSongs.length}
      <div class="card empty-card">
        <h3 bind:this={currentHeading} tabindex="-1">No hay canciones de {$practiceSession.instrument} que entren en {$practiceSession.minutes} min.</h3>
        <p>Agrega canciones más cortas o aumenta el tiempo de práctica.</p>
        <div class="done-actions">
          {#if minimumMinutes !== null && minimumMinutes <= 240}
            <button class="press-btn" onclick={increaseTime}>Aumentar a {minimumMinutes} min</button>
          {/if}
          <button class="pill-btn" onclick={() => onNavigate("repertorio")}>Ir a Mi repertorio</button>
        </div>
      </div>
    {:else if $practiceSession.stage === "deal"}
      <h3 bind:this={currentHeading} tabindex="-1">Tu setlist · {sessionSongs.length} canciones · {formatMmSs(sessionSeconds)}</h3>
      <CardTable songs={sessionSongs} {currentIndex} practicedIds={$practiceSession.practicedIds} stage="deal" {dealKey} instrument={$practiceSession.instrument} />
      <div class="done-actions">
        <button class="press-btn" onclick={beginPractice}>Empezar práctica</button>
        <button class="pill-btn" onclick={rebarajar}>Rebarajar</button>
      </div>
    {:else if $practiceSession.stage === "warmup"}
      <WarmupRoutine instrument={$practiceSession.instrument} embedded onFinish={() => setWarmup("done")} onSkip={() => setWarmup("skipped")} />
    {:else}
      <div class="session-progress">
        <p class="announcement" aria-live="polite" aria-atomic="true">{sessionDone ? "Sesión completa" : `Canción ${currentIndex + 1} de ${sessionSongs.length}: ${currentSong?.title}`}</p>
        <div class="bar-track" role="progressbar" aria-label="Tiempo practicado" aria-valuemin="0" aria-valuemax={targetSeconds} aria-valuenow={Math.min(practicedSeconds, targetSeconds)} aria-valuetext={`${formatMmSs(practicedSeconds)} de ${formatMmSs(targetSeconds)}`}>
          <div class="bar-fill" style:transform={`scaleX(${fillPercent / 100})`}></div>
        </div>
        <p class="bar-total">{formatMmSs(practicedSeconds)} de {formatMmSs(targetSeconds)}</p>
      </div>
        <CardTable bind:this={cardTable} songs={sessionSongs} {currentIndex} practicedIds={$practiceSession.practicedIds} stage={sessionDone ? "complete" : "playing"} {dealKey} instrument={$practiceSession.instrument}>
          {#snippet actions()}
            <div class="session-actions">
              <button class="pill-btn" onclick={goBack} disabled={currentIndex === 0}>Anterior</button>
              <button class="pill-btn" onclick={skip}>Saltar</button>
              <button class="press-btn next-primary" onclick={markAndNext}>Practicada y seguir</button>
            </div>
          {/snippet}
        </CardTable>
      {#if sessionDone}
        <div class="card done-card">
          <h3 bind:this={currentHeading} tabindex="-1">Sesión completa</h3>
          <p>{practicedCount} {practicedCount === 1 ? "canción practicada" : "canciones practicadas"} · {sessionSongs.length - practicedCount} {sessionSongs.length - practicedCount === 1 ? "saltada" : "saltadas"} · {formatMmSs(practicedSeconds)} de práctica</p>
          <div class="done-actions">
            <button class="pill-btn" onclick={goBack}>Anterior</button>
            <button class="press-btn" onclick={repeatSession}>Repetir setlist</button>
            <button class="pill-btn" onclick={newSetlist}>Nuevo setlist</button>
            <button class="pill-btn" onclick={() => practiceSession.set(null)}>Cerrar</button>
          </div>
        </div>
      {:else if currentSong}
        <p class="next-song">{sessionSongs[currentIndex + 1] ? `Siguiente: ${sessionSongs[currentIndex + 1].title}` : "Última canción de la sesión"}</p>
      {/if}
    {/if}
    {#if sessionSongs.length}
      <details class="session-list">
        <summary>Ver lista completa <span>· {sessionSongs.length} {sessionSongs.length === 1 ? "canción" : "canciones"} · {formatMmSs(sessionSeconds)}</span></summary>
        <ol>
          {#each sessionSongs as song, index (song.id)}
            <li aria-current={$practiceSession.stage === "playing" && !sessionDone && index === currentIndex ? "step" : undefined}>
              <span class="list-title">{song.title}<small>{$practiceSession.practicedIds.includes(song.id) ? "Practicada" : $practiceSession.stage === "playing" && !sessionDone && index === currentIndex ? "En curso" : sessionDone || index < currentIndex ? "Saltada" : "Pendiente"}</small></span>
              <span class="duration">{formatMmSs(song.durationSeconds)}</span>
            </li>
          {/each}
        </ol>
      </details>
    {/if}
  {/if}
</div>

<style>
  h2 { font:700 1.25rem/1.3 "Bricolage Grotesque", sans-serif; margin:0 0 20px; }
  h3 { font:700 1.375rem/1.3 "Bricolage Grotesque", sans-serif; margin:0; overflow-wrap:anywhere; }
  h3:focus-visible, summary:focus-visible { outline:3px solid var(--focus-ring); outline-offset:4px; }
  .controls { display:flex; align-items:flex-end; flex-wrap:wrap; gap:16px; padding:20px; margin-bottom:24px; }
  .segmented { display:flex; gap:4px; padding:3px; border:1px solid var(--line); border-radius:var(--radius-sm); }
  .segmented button, .presets button { min-height:44px; min-width:44px; padding:8px 12px; border:0; border-radius:6px; background:transparent; color:var(--text); font-weight:700; cursor:pointer; }
  .segmented button:hover, .presets button:hover { background:var(--surface-muted); }
  .segmented button.active, .presets button.active { background:color-mix(in srgb, var(--primary) 18%, var(--surface)); }
  .time-controls { flex:1; min-width:0; }
  label { display:block; margin-bottom:8px; font-size:.8125rem; font-weight:700; }
  .time-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .presets { display:flex; gap:4px; flex-wrap:wrap; }
  .presets button { border:1px solid var(--line); padding:8px; }
  input { width:88px; max-width:100%; }
  .artist-control { flex:1; min-width:160px; }
  .exclude-control { flex-basis:100%; border-top:1px solid var(--line); padding-top:12px; }
  .exclude-control summary { cursor:pointer; font-size:.8125rem; font-weight:700; min-height:32px; display:flex; align-items:center; gap:8px; }
  .exclude-control summary { list-style:none; }
  .exclude-control summary::-webkit-details-marker { display:none; }
  .exclude-control summary::before { content:"▸"; color:var(--muted); }
  .exclude-control[open] summary::before { content:"▾"; }
  .exclude-control .count { min-width:20px; height:20px; padding:0 6px; border-radius:999px; background:var(--coral); color:var(--on-primary); font-size:.6875rem; display:inline-grid; place-items:center; }
  .exclude-control .hint { margin:4px 0 10px; color:var(--muted); font-size:.8125rem; }
  .artist-chips { display:flex; flex-wrap:wrap; gap:6px; }
  .artist-chip { min-height:40px; padding:6px 12px; border:1px solid var(--line); border-radius:999px; background:var(--surface); color:var(--text); font:600 .8125rem "Manrope", sans-serif; cursor:pointer; max-width:100%; overflow-wrap:anywhere; text-align:left; }
  .artist-chip:hover { border-color:var(--coral); }
  .artist-chip.excluded { background:var(--surface-muted); color:var(--muted); text-decoration:line-through; border-style:dashed; }
  .link-btn { margin-top:8px; border:0; background:none; color:var(--coral); font-weight:700; cursor:pointer; text-decoration:underline; padding:4px 0; min-height:32px; }
  select { width:100%; }
  .generate-actions, .done-actions { display:flex; flex-wrap:wrap; gap:8px; }
  .controls-summary { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:24px; padding-bottom:16px; border-bottom:1px solid var(--line); }
  .controls-summary p { color:var(--muted); font-size:.875rem; margin:0; overflow-wrap:anywhere; }
  .controls-summary button { flex-shrink:0; }
  .no-songs { flex-basis:100%; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
  .no-songs p { color:var(--muted); margin:0; font-size:.875rem; }
  .field-error { margin:8px 0 0; color:color-mix(in srgb, var(--error) 45%, var(--text)); font-size:.8125rem; }
  button:disabled { opacity:.55; cursor:not-allowed; }
  .empty-card, .done-card { padding:24px; }
  .empty-card p, .done-card p { color:var(--muted); margin:12px 0 20px; }
  .session-progress { margin-bottom:16px; }
  .announcement { margin:0 0 8px; font-size:.875rem; color:var(--muted); overflow-wrap:anywhere; }
  .bar-track { height:6px; border-radius:3px; overflow:hidden; background:var(--surface-muted); }
  .bar-fill { height:100%; width:100%; transform-origin:left; background:color-mix(in srgb, var(--accent) 70%, var(--text)); transition:transform .2s ease-out; }
  .bar-total, .duration { font-family:"JetBrains Mono", monospace; font-size:.8125rem; color:var(--muted); }
  .bar-total { margin:8px 0 0; }
  .duration { white-space:nowrap; }
  .next-song { color:var(--muted); font-size:.875rem; margin:16px 0 0; overflow-wrap:anywhere; }
  .session-actions { display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-top:16px; padding:16px 0; }
  .next-primary { min-height:48px; margin-left:auto; font-size:.9375rem; }
  .session-list { margin-top:20px; border-top:1px solid var(--line); }
  summary { padding:12px 0; min-height:44px; cursor:pointer; font-weight:700; font-size:.875rem; }
  summary span { font-weight:500; color:var(--muted); }
  ol { margin:0; padding:0 0 0 24px; }
  li { padding:12px 8px; }
  li[aria-current="step"] { background:var(--surface-muted); border-radius:var(--radius-sm); }
  .list-title { display:inline-block; width:calc(100% - 64px); vertical-align:top; overflow-wrap:anywhere; font-size:.875rem; }
  small { display:block; color:var(--muted); font-size:.75rem; margin-top:4px; }
  @media (max-width:640px) {
    .controls { padding:16px; gap:16px; }
    .time-controls, .artist-control { flex-basis:100%; min-width:0; }
    .controls-summary { align-items:flex-start; }
    .session-actions { display:grid; grid-template-columns:1fr 1fr; position:sticky; bottom:0; z-index:2; background:var(--surface); padding:12px 12px calc(12px + env(safe-area-inset-bottom)); border-radius:var(--radius-sm); border-top:1px solid var(--line); }
    .next-primary { grid-column:1 / -1; width:100%; margin-left:0; }
    .done-actions > button { flex:1; }
  }
</style>
