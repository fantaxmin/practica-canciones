<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { Instrument, Song, Tab } from "../lib/types";
  import { formatMmSs } from "../lib/duration";
  import { daysSince } from "../lib/freshness";
  import { generateSetlist } from "../lib/setlist";
  import { songs } from "../lib/stores";
  import { extractYoutubeId } from "../lib/youtube";
  import { logPractice } from "../lib/practiceLog";
  import { practiceSession } from "../lib/practiceSession";
  import VideoPlayer from "./VideoPlayer.svelte";
  import AudioPlayer from "./AudioPlayer.svelte";
  import WarmupRoutine from "./warmup/WarmupRoutine.svelte";

  let { onNavigate }: { onNavigate: (tab: Tab) => void } = $props();
  let instrument = $state<Instrument>($practiceSession?.instrument ?? "bajo");
  let minutes = $state<number | undefined>($practiceSession?.minutes ?? 15);
  let priorityArtist = $state($practiceSession?.priorityArtist ?? "");
  let controlsOpen = $state(false);
  let media = $state<"video" | "audio" | null>(null);
  let currentHeading = $state<HTMLHeadingElement>();
  let minutesInput = $state<HTMLInputElement>();
  let now = $state(Date.now());

  const candidates = $derived($songs.filter((song) => song.instruments[instrument]));
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
  const currentVideoId = $derived(currentSong ? extractYoutubeId(currentSong.youtubeUrl) : null);
  const hasAudio = $derived(!!(currentSong?.audioFileId || currentSong?.driveUrl));
  const freshness = $derived(daysSince(currentSong?.lastPracticedAt ?? null, now));
  const practicedSeconds = $derived(sessionSongs.filter((song) => $practiceSession?.practicedIds.includes(song.id)).reduce((sum, song) => sum + song.durationSeconds, 0));
  const sessionSeconds = $derived(sessionSongs.reduce((sum, song) => sum + song.durationSeconds, 0));
  const targetSeconds = $derived(($practiceSession?.minutes ?? 0) * 60);
  const fillPercent = $derived(targetSeconds > 0 ? Math.min(100, (practicedSeconds / targetSeconds) * 100) : 0);
  const minimumMinutes = $derived.by(() => {
    const eligible = $songs.filter((song) => song.instruments[$practiceSession?.instrument ?? instrument] && song.durationSeconds > 0);
    return eligible.length ? Math.ceil(Math.min(...eligible.map((song) => song.durationSeconds)) / 60) : null;
  });

  onMount(() => {
    const clock = setInterval(() => { now = Date.now(); }, 60_000);
    if (currentSong || sessionDone) void focusCurrent();
    return () => clearInterval(clock);
  });

  $effect(() => {
    if (priorityArtist && !availableArtists.includes(priorityArtist)) priorityArtist = "";
  });
  $effect(() => {
    // Al cambiar de canción, no dejar abierto el reproductor anterior.
    const id = currentSong?.id;
    if (id) media = null;
  });

  async function focusCurrent() {
    await tick();
    currentHeading?.focus();
  }

  function generate() {
    if (!validMinutes || !candidates.length || minutes === undefined) return;
    const result = generateSetlist($songs, instrument, minutes * 60, priorityArtist || undefined);
    practiceSession.set({ instrument, minutes, priorityArtist, songIds: result.map((song) => song.id), currentIndex: 0, practicedIds: [], warmup: result.length ? "pending" : undefined });
    controlsOpen = false;
    media = null;
    void focusCurrent();
  }

  function increaseTime() {
    if (minimumMinutes === null || minimumMinutes > 240) return;
    instrument = $practiceSession?.instrument ?? instrument;
    minutes = minimumMinutes;
    generate();
  }

  function markAndNext() {
    const song = currentSong;
    if (!song) return;
    if (!$practiceSession?.practicedIds.includes(song.id)) {
      now = Date.now();
      songs.update((all) => all.map((item) => item.id === song.id ? { ...item, lastPracticedAt: now } : item));
      logPractice(song.id, song.title, song.durationSeconds);
    }
    practiceSession.update((session) => session ? {
      ...session,
      currentIndex: session.currentIndex + 1,
      practicedIds: [...new Set([...session.practicedIds, song.id])],
    } : session);
    void focusCurrent();
  }

  function setWarmup(state: "done" | "skipped") {
    practiceSession.update((session) => session ? { ...session, warmup: state } : session);
    window.scrollTo({ top: 0 });
    void focusCurrent();
  }

  function skip() {
    practiceSession.update((session) => session ? { ...session, currentIndex: session.currentIndex + 1 } : session);
    void focusCurrent();
  }

  function goBack() {
    practiceSession.update((session) => session && session.currentIndex > 0 ? { ...session, currentIndex: session.currentIndex - 1 } : session);
    void focusCurrent();
  }

  function repeatSession() {
    practiceSession.update((session) => session ? { ...session, currentIndex: 0, practicedIds: [] } : session);
    controlsOpen = false;
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
      <p>{$practiceSession.instrument === "bajo" ? "Bajo" : "Guitarra"} · {$practiceSession.minutes} min · {$practiceSession.priorityArtist || "Sin artista prioritario"}</p>
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
        <div class="generate-actions">
          <button type="submit" class="press-btn" disabled={!validMinutes || !candidates.length}>Generar setlist</button>
          {#if $practiceSession}<button type="button" class="pill-btn" onclick={() => (controlsOpen = false)}>Volver a la sesión</button>{/if}
        </div>
        {#if !candidates.length}
          <div class="no-songs" role="status">
            <p>Aún no tienes canciones de {instrument}.</p>
            <button type="button" class="pill-btn" onclick={() => onNavigate("repertorio")}>Agregar canciones</button>
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
    {:else if $practiceSession.warmup === "pending"}
      <WarmupRoutine instrument={$practiceSession.instrument} embedded onFinish={() => setWarmup("done")} onSkip={() => setWarmup("skipped")} />
    {:else}
      <div class="session-progress">
        <p class="announcement" aria-live="polite" aria-atomic="true">{sessionDone ? "Sesión completa" : `Canción ${currentIndex + 1} de ${sessionSongs.length}: ${currentSong?.title}`}</p>
        <div class="bar-track" role="progressbar" aria-label="Tiempo practicado" aria-valuemin="0" aria-valuemax={targetSeconds} aria-valuenow={Math.min(practicedSeconds, targetSeconds)} aria-valuetext={`${formatMmSs(practicedSeconds)} de ${formatMmSs(targetSeconds)}`}>
          <div class="bar-fill" style:transform={`scaleX(${fillPercent / 100})`}></div>
        </div>
        <p class="bar-total">{formatMmSs(practicedSeconds)} de {formatMmSs(targetSeconds)}</p>
      </div>
      {#if sessionDone}
        <div class="card done-card">
          <h3 bind:this={currentHeading} tabindex="-1">Sesión completa</h3>
          <p>{practicedCount} {practicedCount === 1 ? "canción practicada" : "canciones practicadas"} · {sessionSongs.length - practicedCount} {sessionSongs.length - practicedCount === 1 ? "saltada" : "saltadas"} · {formatMmSs(practicedSeconds)} de práctica</p>
          <div class="done-actions">
            <button class="press-btn" onclick={repeatSession}>Repetir setlist</button>
            <button class="pill-btn" onclick={newSetlist}>Nuevo setlist</button>
            <button class="pill-btn" onclick={() => practiceSession.set(null)}>Cerrar</button>
          </div>
        </div>
      {:else if currentSong}
        <div class="card current-card">
          <div class="row">
            <div class="info">
              <h3 bind:this={currentHeading} tabindex="-1">{currentSong.title}</h3>
              {#if currentSong.artist}<p class="artist">{currentSong.artist}</p>{/if}
              <div class="badges">
                {#if currentSong.instruments.bajo}<span class="badge bajo"><span aria-hidden="true">B · </span>Bajo</span>{/if}
                {#if currentSong.instruments.guitarra}<span class="badge guitarra"><span aria-hidden="true">G · </span>Guitarra</span>{/if}
              </div>
              <p class="freshness"><span class="freshness-dot {freshness.level}" aria-hidden="true"></span>{freshness.text}</p>
            </div>
            <span class="duration">{formatMmSs(currentSong.durationSeconds)}</span>
          </div>
          <div class="media-controls">
            {#if currentVideoId}
              <button class="pill-btn" aria-expanded={media === "video"} aria-controls="current-video" onclick={() => (media = media === "video" ? null : "video")}>{media === "video" ? "Ocultar video" : "Ver video"}</button>
            {:else if currentSong.youtubeUrl}
              <a class="ink-btn" href={currentSong.youtubeUrl} target="_blank" rel="noopener noreferrer">Abrir enlace</a>
            {/if}
            {#if hasAudio}
              <button class="pill-btn audio-toggle" aria-expanded={media === "audio"} aria-controls="current-audio" onclick={() => (media = media === "audio" ? null : "audio")}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l11-2v13M9 8l11-2" stroke="currentColor" stroke-width="2"/><ellipse cx="6" cy="18" rx="3" ry="2" stroke="currentColor" stroke-width="2"/><ellipse cx="17" cy="16" rx="3" ry="2" stroke="currentColor" stroke-width="2"/></svg>
                {media === "audio" ? "Ocultar audio" : "Ver audio"}
              </button>
            {/if}
          </div>
          <div id="current-video">
            {#if media === "video" && currentVideoId}
              {#key currentSong.id}<div class="media-wrap"><VideoPlayer videoId={currentVideoId} title={currentSong.title} /></div>{/key}
            {/if}
          </div>
          <div id="current-audio">
            {#if media === "audio" && hasAudio}
              {#key currentSong.id}<div class="media-wrap"><AudioPlayer audioFileId={currentSong.audioFileId} driveUrl={currentSong.driveUrl} title={currentSong.title} /></div>{/key}
            {/if}
          </div>
        </div>
        <p class="next-song">{sessionSongs[currentIndex + 1] ? `Siguiente: ${sessionSongs[currentIndex + 1].title}` : "Última canción de la sesión"}</p>
        <div class="session-actions">
          <button class="pill-btn" onclick={goBack} disabled={currentIndex === 0}>Anterior</button>
          <button class="pill-btn" onclick={skip}>Saltar</button>
          <button class="press-btn next-primary" onclick={markAndNext}>Practicada y seguir</button>
        </div>
      {/if}
      <details class="session-list">
        <summary>Ver lista completa <span>· {sessionSongs.length} {sessionSongs.length === 1 ? "canción" : "canciones"} · {formatMmSs(sessionSeconds)}</span></summary>
        <ol>
          {#each sessionSongs as song, index (song.id)}
            <li aria-current={!sessionDone && index === currentIndex ? "step" : undefined}>
              <span class="list-title">{song.title}<small>{$practiceSession.practicedIds.includes(song.id) ? "Practicada" : !sessionDone && index === currentIndex ? "En curso" : sessionDone || index < currentIndex ? "Saltada" : "Pendiente"}</small></span>
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
  .current-card h3[tabindex="-1"]:focus:not(:focus-visible) { outline:none; }
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
  .current-card { padding:24px; }
  .row { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
  .info { min-width:0; }
  .duration { white-space:nowrap; }
  .artist { color:var(--muted); margin:6px 0 12px; font-size:.875rem; overflow-wrap:anywhere; }
  .badges { display:flex; gap:6px; flex-wrap:wrap; margin-top:12px; }
  .badge { font-size:12px; color:var(--text); border:0; letter-spacing:0; }
  .badge.bajo { background:color-mix(in srgb, var(--primary) 16%, var(--surface)); }
  .badge.guitarra { background:color-mix(in srgb, var(--accent) 16%, var(--surface)); }
  .freshness { display:flex; align-items:center; gap:8px; color:var(--muted); font-size:.8125rem; margin:12px 0 0; }
  .freshness-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .fresh { background:var(--accent); } .warm { background:var(--warning); } .stale { background:color-mix(in srgb, var(--primary) 65%, var(--surface)); }
  .media-controls { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:16px; }
  .media-controls:empty { display:none; }
  .audio-toggle { display:inline-flex; align-items:center; gap:6px; }
  .ink-btn { min-height:44px; }
  .media-wrap { margin-top:16px; min-width:0; }
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
    .current-card { padding:20px 16px; }
    .controls-summary { align-items:flex-start; }
    .session-actions { display:grid; grid-template-columns:1fr 1fr; position:sticky; bottom:0; z-index:2; background:var(--surface); padding:12px 12px calc(12px + env(safe-area-inset-bottom)); border-radius:var(--radius-sm); border-top:1px solid var(--line); }
    .next-primary { grid-column:1 / -1; width:100%; margin-left:0; }
    .done-actions > button { flex:1; }
  }
</style>
