<script module lang="ts">
  import type { Song as RepertoireSong } from "../lib/types";

  /** Mantener la secuencia keyed impide mover el iframe al ordenar/filtrar. */
  export function renderedSongOrder(all: RepertoireSong[], visible: RepertoireSong[], pinnedIds?: readonly string[]): RepertoireSong[] {
    if (!pinnedIds) {
      const ids = new Set(visible.map((song) => song.id));
      return [...visible, ...all.filter((song) => !ids.has(song.id))];
    }
    const pinned = new Map(pinnedIds.map((id, index) => [id, index]));
    return [...all].sort((a, b) => (pinned.get(a.id) ?? Infinity) - (pinned.get(b.id) ?? Infinity));
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import { daysSince } from "../lib/freshness";
  import { reducedMotion, flipLayout, loadFlip, gsap, MOTION, createAnimationGroup, type MotionHandle } from "../lib/motion";
  import { slide } from "svelte/transition";
  import type { Instrument, Song } from "../lib/types";
  import { formatMmSs } from "../lib/duration";
  import { songs } from "../lib/stores";
  import { extractYoutubeId } from "../lib/youtube";
  import { logPractice } from "../lib/practiceLog";
  import PracticedPulse from "./ui/PracticedPulse.svelte";
  import SongForm from "./SongForm.svelte";
  import VideoPlayer from "./VideoPlayer.svelte";
  import AudioPlayer from "./AudioPlayer.svelte";
  import { deleteAudio } from "../lib/audioStore";

  let { onAdd }: { onAdd: () => void } = $props();
  let sortOrder = $state<"recent" | "unpracticed" | "duration">("recent");
  let deletingId = $state<string | null>(null);
  let deleteTimer: ReturnType<typeof setTimeout> | undefined;
  let pulseTimer: ReturnType<typeof setTimeout> | undefined;
  let listEl = $state<HTMLUListElement>();
  const animations = createAnimationGroup();
  let layoutQueue = Promise.resolve();
  let layoutVersion = 0;
  let destroyed = false;
  const rowIds = new Map<string, string>();
  const listId = $props.id();
  function rowId(id: string): string {
    if (!rowIds.has(id)) rowIds.set(id, `${listId}-song-${rowIds.size}`);
    return rowIds.get(id)!;
  }

  function finishLayout() {
    layoutVersion += 1;
    animations.finishAll();
  }

  // Serializar captura/mutación evita que dos Flip asíncronos compitan.
  function changeLayout(mutate: () => void, nextSongs: Song[] = filtered, persistAfterUnmount = false) {
    let applied = false;
    const apply = () => {
      if (applied || (destroyed && !persistAfterUnmount)) return;
      applied = true;
      mutate();
    };
    finishLayout();
    const version = layoutVersion;
    layoutQueue = layoutQueue.then(async () => {
      if (destroyed) { apply(); return; }
      animations.finishAll();
      if (version !== layoutVersion || $reducedMotion || !listEl) {
        apply();
        return;
      }
      // Cargar antes de medir: mientras llega el chunk pueden abrirse reproductores.
      await loadFlip();
      if (destroyed || version !== layoutVersion || $reducedMotion || !listEl) {
        apply();
        return;
      }
      const rows = Array.from(listEl.querySelectorAll<HTMLElement>("li[data-song-id]"));
      const visible = rows.filter((row) => {
        const rect = row.getBoundingClientRect();
        return !row.hidden && rect.bottom > 0 && rect.top < window.innerHeight;
      });
      const byId = new Map(rows.map((row) => [row.dataset.songId, row]));
      const upcoming = nextSongs.slice(0, 12).map((song) => byId.get(song.id)).filter((row): row is HTMLElement => !!row);
      const targets: HTMLElement[] = [];
      // Un solo presupuesto de doce, compartido entre entradas, salidas y reacomodos.
      for (let i = 0; i < Math.max(visible.length, upcoming.length) && targets.length < 12; i++) {
        for (const row of [visible[i], upcoming[i]]) {
          if (row && targets.length < 12 && !targets.includes(row)
            && row.dataset.songId !== expandedId && !row.querySelector("iframe, audio, video")) targets.push(row);
        }
      }
      const snapshots = new Map(targets.filter((row) => !row.hidden).map((row) => [row, {
        rect: row.getBoundingClientRect(), clone: row.cloneNode(true) as HTMLElement,
      }]));
      const handle = await flipLayout(targets, apply, {
        duration: MOTION.duration.indicator,
        onEnter(elements) {
          if (destroyed || version !== layoutVersion || $reducedMotion) return;
          return gsap.fromTo(elements, { opacity: 0 }, {
            opacity: 1, duration: MOTION.duration.view, clearProps: "opacity",
          });
        },
        onLeave(elements) {
          if (destroyed || version !== layoutVersion || $reducedMotion) return;
          // Solo clones inertes sin reproductor: nunca mover un nodo vivo de la lista.
          for (const element of elements) {
            const snapshot = snapshots.get(element as HTMLElement);
            if (!snapshot) continue;
            const { clone, rect } = snapshot;
            clone.removeAttribute("id");
            clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
            clone.setAttribute("aria-hidden", "true");
            clone.inert = true;
            Object.assign(clone.style, {
              position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`,
              width: `${rect.width}px`, height: `${rect.height}px`, margin: "0",
              pointerEvents: "none", zIndex: "20", listStyle: "none",
            });
            clone.hidden = false;
            document.body.appendChild(clone);
            const tween = gsap.to(clone, {
              opacity: 0, y: -6, duration: MOTION.duration.view,
              onComplete: () => clone.remove(),
            });
            let done = false;
            const clean = () => { if (!done) { done = true; tween.kill(); clone.remove(); } };
            animations.add<MotionHandle>({ kill: clean, finish: clean });
          }
        },
      });
      if (destroyed) handle.kill();
      else if (version !== layoutVersion) handle.finish();
      else animations.add(handle);
    }).catch(() => {
      // Una importación fallida de Flip no debe impedir el cambio solicitado.
      apply();
    });
  }

  function searchInstant(value: string) {
    finishLayout();
    search = value;
  }

  // La preferencia se comparte con el resto de animaciones.
  let now = $state(Date.now());
  const motionDuration = $derived($reducedMotion ? 0 : 220);
  onMount(() => {
    const clock = setInterval(() => { now = Date.now(); }, 60_000);
    return () => {
      destroyed = true;
      layoutVersion += 1;
      animations.killAll();
      clearInterval(clock);
      clearTimeout(deleteTimer);
      clearTimeout(pulseTimer);
    };
  });

  function cancelDelete() {
    clearTimeout(deleteTimer);
    deletingId = null;
  }

  function requestDelete(id: string) {
    cancelDelete();
    deletingId = id;
    deleteTimer = setTimeout(cancelDelete, 5000);
  }

  function clearFilters() {
    changeLayout(() => { search = ""; instrumentFilter = "todas"; }, selectSongs("", "todas", sortOrder));
  }

  let search = $state("");
  let instrumentFilter = $state<"todas" | Instrument>("todas");
  let editingId = $state<string | null>(null);
  let pulseId = $state<string | null>(null);
  let expandedId = $state<string | null>(null);
  let pinnedOrder: string[] = [];
  let expandedMedia = $state<"video" | "audio">("video");
  let deletionError = $state("");
  let viewMode = $state<"list" | "grid">("list");

  function selectSongs(queryText = search, filter = instrumentFilter, order = sortOrder): Song[] {
    const query = queryText.trim().toLocaleLowerCase("es");
    return $songs.filter((song) => `${song.title} ${song.artist}`.toLocaleLowerCase("es").includes(query)
      && (filter === "todas" || song.instruments[filter]))
      .sort((a, b) => order === "unpracticed"
        ? (a.lastPracticedAt ?? -Infinity) - (b.lastPracticedAt ?? -Infinity) || $songs.indexOf(a) - $songs.indexOf(b)
        : order === "duration" ? a.durationSeconds - b.durationSeconds : $songs.indexOf(a) - $songs.indexOf(b));
  }
  const filtered = $derived(selectSongs());
  const positions = $derived(new Map(filtered.map((song, index) => [song.id, index])));
  const accessibleOrder = $derived(filtered.map((song) => rowId(song.id)).join(" "));
  // Con media abierta, solo cambia el orden visual; sus nodos y ancestros permanecen.
  const renderedSongs = $derived(renderedSongOrder($songs, filtered, expandedId ? pinnedOrder : undefined));

  $effect(() => {
    if ($reducedMotion) finishLayout();
  });

  $effect(() => {
    // Filtrar una canción cierra su media, igual que al retirarla del DOM antes.
    if (expandedId && !positions.has(expandedId)) expandedId = null;
  });

  async function deleteSong(id: string) {
    cancelDelete();
    deletionError = "";
    const song = $songs.find((s) => s.id === id);
    try {
      if (song?.audioFileId) await deleteAudio(song.audioFileId);
      changeLayout(() => {
        songs.update((all) => all.filter((s) => s.id !== id));
        if (expandedId === id) expandedId = null;
      }, filtered.filter((s) => s.id !== id), true);
    } catch {
      deletionError = "No se pudo eliminar el audio guardado. Inténtalo de nuevo.";
    }
  }

  function markPracticed(song: Song) {
    songs.update((all) =>
      all.map((s) => (s.id === song.id ? { ...s, lastPracticedAt: Date.now() } : s))
    );
    logPractice(song.id, song.title, song.durationSeconds);
    now = Date.now();
    clearTimeout(pulseTimer);
    pulseId = song.id;
    pulseTimer = setTimeout(() => {
      if (pulseId === song.id) pulseId = null;
    }, 850);
  }

  function saveEdit(id: string, data: Omit<Song, "id" | "lastPracticedAt">) {
    songs.update((all) => all.map((s) => (s.id === id ? { ...s, ...data } : s)));
    editingId = null;
    if (expandedId === id) expandedId = null;
  }

  function toggleMedia(id: string, media: "video" | "audio") {
    finishLayout();
    if (!expandedId) pinnedOrder = renderedSongs.map((song) => song.id);
    expandedId = expandedId === id && expandedMedia === media ? null : id;
    expandedMedia = media;
  }
</script>

<div class="song-list">
  <div class="toolbar">
    <div class="search-field">
      <label class="sr-only" for="song-search">Buscar por título o artista</label>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="10" cy="10" r="6" stroke="currentColor" stroke-width="2"/><path d="m15 15 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <input id="song-search" type="text" placeholder="Buscar por título o artista" value={search} oninput={(event) => searchInstant(event.currentTarget.value)} />
    </div>
    <div class="filters" role="group" aria-label="Filtrar por instrumento">
      {#each ["todas", "bajo", "guitarra"] as instrument}
        <button class:active={instrumentFilter === instrument} aria-pressed={instrumentFilter === instrument} onclick={() => { const next = instrument as "todas" | Instrument; changeLayout(() => { instrumentFilter = next; }, selectSongs(search, next)); }}>{instrument === "todas" ? "Todas" : instrument === "bajo" ? "Bajo" : "Guitarra"}</button>
      {/each}
    </div>
    <label class="sr-only" for="song-sort">Ordenar canciones</label>
    <select id="song-sort" value={sortOrder} onchange={(event) => { const next = event.currentTarget.value as typeof sortOrder; changeLayout(() => { sortOrder = next; }, selectSongs(search, instrumentFilter, next)); }}>
      <option value="recent">Recientes añadidas</option>
      <option value="unpracticed">Sin practicar primero</option>
      <option value="duration">Duración</option>
    </select>
    <button
      class="icon-btn"
      aria-label={viewMode === "list" ? "Ver en cuadrícula" : "Ver en lista"}
      onclick={() => changeLayout(() => { viewMode = viewMode === "list" ? "grid" : "list"; })}
    >
      {#if viewMode === "list"}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="8" height="8" rx="1.5" fill="var(--text)" />
          <rect x="13" y="3" width="8" height="8" rx="1.5" fill="var(--text)" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" fill="var(--text)" />
          <rect x="13" y="13" width="8" height="8" rx="1.5" fill="var(--text)" />
        </svg>
      {:else}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="3" rx="1.2" fill="var(--text)" />
          <rect x="3" y="10.5" width="18" height="3" rx="1.2" fill="var(--text)" />
          <rect x="3" y="17" width="18" height="3" rx="1.2" fill="var(--text)" />
        </svg>
      {/if}
    </button>
  </div>

  {#if deletionError}<p role="alert">{deletionError}</p>{/if}
  {#if $songs.length === 0}
    <div class="empty">
      <svg aria-hidden="true" width="64" height="64" viewBox="0 0 64 64"><rect x="10" y="34" width="10" height="20" rx="3" fill="var(--primary)"/><rect x="27" y="10" width="10" height="44" rx="3" fill="var(--accent)"/><rect x="44" y="24" width="10" height="30" rx="3" fill="var(--primary)"/></svg>
      <h3>Aún no hay canciones</h3>
      <button class="press-btn" onclick={onAdd}>Agregar la primera</button>
    </div>
  {:else}
    {#if filtered.length === 0}
    <div class="empty" aria-live="polite">
      <h3>Nada coincide con «{search.trim() || (instrumentFilter === "bajo" ? "Bajo" : "Guitarra")}»</h3>
      <button class="pill-btn" onclick={clearFilters}>Limpiar filtros</button>
    </div>
    {/if}
    <ul bind:this={listEl} class:grid={viewMode === "grid"} aria-owns={accessibleOrder || undefined} hidden={filtered.length === 0}>
      {#each renderedSongs as s (s.id)}
        {@const videoId = extractYoutubeId(s.youtubeUrl)}
        {@const freshness = daysSince(s.lastPracticedAt, now)}
        <li id={rowId(s.id)} data-song-id={s.id} class="card song-card" hidden={!positions.has(s.id)} style:order={positions.get(s.id) ?? 0}>
          {#if editingId === s.id}
            <SongForm
              song={s}
              onSave={(data) => saveEdit(s.id, data)}
              onCancel={() => (editingId = null)}
            />
          {:else}
            <span class="freshness-dot {freshness.level}" aria-hidden="true"></span>
            <div class="row">
              <div class="info">
                <div class="title-row">
                  <span class="title">{s.title}</span>
                  <PracticedPulse active={pulseId === s.id} />
                </div>
                {#if s.artist}
                  <div class="artist">{s.artist}</div>
                {/if}
                <div class="badges">
                  {#if s.instruments.bajo}<span class="badge bajo"><span aria-hidden="true">B · </span>Bajo</span>{/if}
                  {#if s.instruments.guitarra}<span class="badge guitarra"><span aria-hidden="true">G · </span>Guitarra</span>{/if}
                </div>
              </div>
              <span class="duration">{formatMmSs(s.durationSeconds)}</span>
            </div>
            <div class="meta-row">
              {#if videoId}
                <button class="pill-btn small" aria-expanded={expandedId === s.id && expandedMedia === "video"} aria-controls={`video-${s.id}`} onclick={() => toggleMedia(s.id, "video")}>
                  {expandedId === s.id && expandedMedia === "video" ? "Ocultar video" : "Ver video"}
                </button>
              {:else if s.youtubeUrl}
                <a href={s.youtubeUrl} target="_blank" rel="noopener noreferrer" class="ink-btn">
                  <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M8 6l12 6-12 6V6z" fill="currentColor" /></svg>
                  ABRIR ENLACE
                </a>
              {/if}
              {#if s.audioFileId || s.driveUrl}
                <button class="pill-btn small audio-toggle" aria-expanded={expandedId === s.id && expandedMedia === "audio"} aria-controls={`audio-${s.id}`} onclick={() => toggleMedia(s.id, "audio")}>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l11-2v13M9 8l11-2" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><ellipse cx="6" cy="18" rx="3" ry="2" stroke="currentColor" stroke-width="2"/><ellipse cx="17" cy="16" rx="3" ry="2" stroke="currentColor" stroke-width="2"/></svg>
                  {expandedId === s.id && expandedMedia === "audio" ? "Ocultar audio" : "Ver audio"}
                </button>
              {/if}
              <span class="practiced" aria-live="polite">{freshness.text}</span>
            </div>
            {#if videoId}
              <div id="video-{s.id}">
                {#if expandedId === s.id && expandedMedia === "video"}
                  <div transition:slide={{ duration: motionDuration }} class="video-wrap">
                    <VideoPlayer videoId={videoId} title={s.title} />
                  </div>
                {/if}
              </div>
            {/if}
            {#if s.audioFileId || s.driveUrl}
              <div id="audio-{s.id}">
                {#if expandedId === s.id && expandedMedia === "audio"}
                  <div transition:slide={{ duration: motionDuration }} class="video-wrap">
                    <AudioPlayer audioFileId={s.audioFileId} driveUrl={s.driveUrl} title={s.title} onRequestEdit={() => { cancelDelete(); editingId = s.id; }} />
                  </div>
                {/if}
              </div>
            {/if}
            <div class="delete-confirmation" aria-live="polite" aria-atomic="true">
              {#if deletingId === s.id}
                <span>¿Eliminar?</span>
                <button class="pill-btn" aria-label={`Sí, eliminar ${s.title}`} onclick={() => deleteSong(s.id)}>Sí</button>
                <button class="pill-btn" onclick={cancelDelete}>No</button>
              {/if}
            </div>
            <div class="row-actions">
              <div class="secondary-actions">
                <button class="icon-btn" aria-label={`Editar ${s.title}`} title="Editar" onclick={() => { cancelDelete(); editingId = s.id; }}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></button>
                <button class="icon-btn" aria-label={`Eliminar ${s.title}`} title="Eliminar" onclick={() => requestDelete(s.id)}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></button>
              </div>
              <button class="press-btn" onclick={() => markPracticed(s)}>Practicada</button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .toolbar { display:flex; align-items:center; gap:8px; margin-bottom:20px; }
  .search-field { position:relative; flex:1; min-width:0; }
  .search-field svg { position:absolute; left:12px; top:13px; color:var(--muted); pointer-events:none; }
  .search-field input { width:100%; padding-left:38px; }
  .filters { display:flex; border:1px solid var(--line); border-radius:var(--radius-sm); padding:2px; flex-shrink:0; }
  .filters button { min-height:44px; padding:8px 12px; border:0; border-radius:6px; background:transparent; color:var(--text); font-weight:700; cursor:pointer; }
  .filters button:hover { background:var(--surface-muted); }
  .filters button.active { background:color-mix(in srgb, var(--primary) 18%, var(--surface)); }
  select { max-width:190px; min-width:0; }
  .toolbar > .icon-btn { flex-shrink:0; }
  ul { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:12px; }
  ul.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 280px), 1fr)); }
  .song-card { position:relative; padding:18px 18px 18px 32px; min-width:0; }
  ul[hidden], ul .song-card[hidden] { display:none; }
  ul.grid .song-card { display:flex; flex-direction:column; }
  ul.grid .row-actions { margin-top:auto; padding-top:16px; }
  .freshness-dot { position:absolute; left:12px; top:26px; width:8px; height:8px; border-radius:50%; }
  .fresh { background:var(--accent); }
  .warm { background:var(--warning); }
  .stale { background:color-mix(in srgb, var(--primary) 65%, var(--surface)); }
  .row { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
  .info { min-width:0; }
  .title-row { display:flex; align-items:center; gap:6px; margin-bottom:3px; }
  .title { font-family:"Bricolage Grotesque", sans-serif; font-weight:700; font-size:1.0625rem; overflow-wrap:anywhere; }
  .artist { color:var(--muted); font-size:.8125rem; margin-bottom:8px; overflow-wrap:anywhere; }
  .duration { font-family:"JetBrains Mono", monospace; font-size:.8125rem; white-space:nowrap; color:var(--muted); padding-top:3px; }
  .badges { display:flex; gap:6px; flex-wrap:wrap; }
  .badge { font-size:12px; color:var(--text); border:0; letter-spacing:0; }
  .badge.bajo { background:color-mix(in srgb, var(--primary) 16%, var(--surface)); }
  .badge.guitarra { background:color-mix(in srgb, var(--accent) 16%, var(--surface)); }
  .meta-row { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-top:12px; }
  .audio-toggle { display:inline-flex; align-items:center; gap:6px; }
  .practiced { color:var(--muted); font-size:.8125rem; }
  .video-wrap { margin-top:12px; min-width:0; }
  .row-actions { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:16px; flex-wrap:wrap; }
  .secondary-actions { display:flex; gap:8px; }
  .icon-btn { color:var(--muted); }
  .icon-btn:hover { color:var(--text); background:var(--surface-muted); }
  .pill-btn.small { min-height:44px; padding:8px 12px; }
  .ink-btn { min-height:44px; }
  .delete-confirmation { display:flex; align-items:center; gap:8px; flex-wrap:wrap; color:var(--text); font-size:.875rem; }
  .delete-confirmation:has(button) { margin-top:16px; }
  .empty { padding:40px 16px; text-align:center; color:var(--muted); overflow-wrap:anywhere; }
  .empty h3 { font-family:"Bricolage Grotesque", sans-serif; color:var(--text); font-size:1.125rem; margin:12px 0 20px; }
  @media (max-width:900px) { .toolbar { flex-wrap:wrap; } .search-field { flex-basis:100%; } select { flex:1; max-width:none; } }
  @media (max-width:640px) {
    .toolbar { display:grid; grid-template-columns:minmax(160px, 1fr) minmax(0, 1fr) 44px; }
    .search-field { grid-column:1 / 3; }
    .filters { grid-column:1; width:100%; min-width:0; }
    .filters button { flex:1; min-width:0; padding:8px 5px; font-size:11px; }
    select { grid-row:2; grid-column:2 / -1; width:100%; font-size:12px; padding-left:8px; }
    .toolbar > .icon-btn { grid-row:1; grid-column:3; }
    .song-card { padding-right:14px; }
  }
</style>
