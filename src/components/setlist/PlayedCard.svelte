<script lang="ts">
  import { tick } from "svelte";
  import type { Snippet } from "svelte";
  import type { Instrument, Song } from "../../lib/types";
  import { formatMmSs } from "../../lib/duration";
  import { daysSince } from "../../lib/freshness";
  import { extractYoutubeId, youtubeThumbnailUrl } from "../../lib/youtube";
  import VideoPlayer from "../VideoPlayer.svelte";
  import AudioPlayer from "../AudioPlayer.svelte";

  interface Props {
    song: Song;
    order: number;
    total: number;
    instrument: Instrument;
    now?: number;
    /** Reserva el espacio mientras la carta fantasma vuela al centro. */
    hidden?: boolean;
    /** Solo se montan VideoPlayer/AudioPlayer cuando la animación terminó. */
    mediaReady?: boolean;
    actions?: Snippet;
  }

  let {
    song,
    order,
    total,
    instrument,
    now = Date.now(),
    hidden = false,
    mediaReady = true,
    actions,
  }: Props = $props();

  let media = $state<"video" | "audio" | null>(null);
  let imgError = $state(false);
  let headingEl = $state<HTMLHeadingElement>();

  const videoId = $derived(extractYoutubeId(song.youtubeUrl));
  const thumbUrl = $derived(videoId ? youtubeThumbnailUrl(videoId) : null);
  const hasAudio = $derived(Boolean(song.audioFileId || song.driveUrl));
  const hasMediaControls = $derived(Boolean(videoId || song.youtubeUrl || hasAudio));
  const freshness = $derived(daysSince(song.lastPracticedAt, now));

  $effect(() => {
    void song.id;
    media = null;
    imgError = false;
  });

  export async function focusHeading(): Promise<void> {
    await tick();
    headingEl?.focus({ preventScroll: true });
  }
</script>

<article class="card played-card" class:is-hidden={hidden} aria-label={`Carta actual: ${song.title}`}>
  <div class="played-corners">
    <span class="played-order">Carta #{order} de {total}</span>
    <span class="duration">{formatMmSs(song.durationSeconds)}</span>
  </div>

  <div class="played-main" class:no-video={!videoId}>
    <div class="stage-slot" id="current-video">
      {#if media === "video" && mediaReady && videoId}
        {#key song.id}
          <VideoPlayer {videoId} title={song.title} />
        {/key}
      {:else}
        <div
          class="stage-backdrop"
          class:guitarra={instrument === "guitarra"}
          class:compact-art={!videoId}
        >
          {#if thumbUrl && !imgError}
            <img
              src={thumbUrl}
              alt=""
              decoding="async"
              referrerpolicy="no-referrer"
              onerror={() => (imgError = true)}
            />
          {:else if instrument === "bajo"}
            <svg class="stage-svg" viewBox="0 0 320 180" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
              <rect width="320" height="180" fill="var(--surface-muted)" />
              <circle cx="258" cy="40" r="68" fill="var(--primary)" opacity="0.2" />
              <circle cx="62" cy="148" r="56" fill="var(--accent)" opacity="0.16" />
              <g stroke="var(--text)" stroke-linecap="round">
                <line x1="28" y1="48" x2="292" y2="48" stroke-width="5" opacity="0.8" />
                <line x1="28" y1="78" x2="292" y2="78" stroke-width="4" opacity="0.65" />
                <line x1="28" y1="108" x2="292" y2="108" stroke-width="3" opacity="0.52" />
                <line x1="28" y1="136" x2="292" y2="136" stroke-width="2.2" opacity="0.4" />
              </g>
              <circle cx="114" cy="78" r="10" fill="var(--primary)" />
              <circle cx="206" cy="48" r="9" fill="var(--accent)" />
            </svg>
          {:else}
            <svg class="stage-svg" viewBox="0 0 320 180" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
              <rect width="320" height="180" fill="var(--surface-muted)" />
              <circle cx="254" cy="140" r="68" fill="var(--accent)" opacity="0.22" />
              <circle cx="60" cy="44" r="52" fill="var(--primary)" opacity="0.16" />
              <g stroke="var(--text)" stroke-linecap="round">
                <line x1="28" y1="36" x2="292" y2="36" stroke-width="3.6" opacity="0.78" />
                <line x1="28" y1="58" x2="292" y2="58" stroke-width="3.1" opacity="0.68" />
                <line x1="28" y1="80" x2="292" y2="80" stroke-width="2.6" opacity="0.58" />
                <line x1="28" y1="102" x2="292" y2="102" stroke-width="2.2" opacity="0.5" />
                <line x1="28" y1="124" x2="292" y2="124" stroke-width="1.8" opacity="0.44" />
                <line x1="28" y1="146" x2="292" y2="146" stroke-width="1.5" opacity="0.38" />
              </g>
              <circle cx="128" cy="58" r="8" fill="var(--accent)" />
              <circle cx="194" cy="102" r="8" fill="var(--primary)" />
              <circle cx="232" cy="80" r="7" fill="var(--accent)" />
            </svg>
          {/if}

          {#if videoId}
            <button
              type="button"
              class="stage-play"
              aria-label={`Abrir video de ${song.title}`}
              onclick={() => (media = "video")}
            >
              <span class="play-icon" aria-hidden="true">▶</span>
              <span>{media === "video" && !mediaReady ? "Preparando…" : "Reproducir"}</span>
            </button>
          {/if}
        </div>
      {/if}
    </div>

    <div class="played-details">
      <div class="played-info">
        <h3 bind:this={headingEl} tabindex="-1">{song.title}</h3>
        {#if song.artist}<p class="artist">{song.artist}</p>{/if}
        <div class="meta-row">
          <div class="badges">
            {#if song.instruments.bajo}<span class="badge bajo"><span aria-hidden="true">B · </span>Bajo</span>{/if}
            {#if song.instruments.guitarra}<span class="badge guitarra"><span aria-hidden="true">G · </span>Guitarra</span>{/if}
          </div>
          <p class="freshness"><span class="freshness-dot {freshness.level}" aria-hidden="true"></span>{freshness.text}</p>
        </div>
      </div>

      {#if hasMediaControls}
        <div class="media-controls">
          {#if videoId}
            <button
              type="button"
              class="pill-btn"
              aria-expanded={media === "video"}
              aria-controls="current-video"
              onclick={() => (media = media === "video" ? null : "video")}
            >
              {media === "video" ? "Ocultar video" : "Ver video"}
            </button>
          {:else if song.youtubeUrl}
            <a class="ink-btn" href={song.youtubeUrl} target="_blank" rel="noopener noreferrer">Abrir enlace</a>
          {/if}

          {#if hasAudio}
            <button
              type="button"
              class="pill-btn audio-toggle"
              aria-expanded={media === "audio"}
              aria-controls="current-audio"
              onclick={() => (media = media === "audio" ? null : "audio")}
            >
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 18V5l11-2v13M9 8l11-2" stroke="currentColor" stroke-width="2" />
                <ellipse cx="6" cy="18" rx="3" ry="2" stroke="currentColor" stroke-width="2" />
                <ellipse cx="17" cy="16" rx="3" ry="2" stroke="currentColor" stroke-width="2" />
              </svg>
              {media === "audio" ? "Ocultar audio" : "Ver audio"}
            </button>
          {/if}
        </div>
      {/if}

      {#if hasAudio}
        <div id="current-audio">
          {#if media === "audio" && mediaReady}
            {#key song.id}
              <div class="audio-wrap">
                <AudioPlayer audioFileId={song.audioFileId} driveUrl={song.driveUrl} title={song.title} />
              </div>
            {/key}
          {/if}
        </div>
      {/if}
    </div>
  </div>

  {#if actions}
    <div class="played-actions">
      {@render actions()}
    </div>
  {/if}
</article>

<style>
  .played-card {
    padding: 16px 18px;
    border-width: 1.5px;
    border-color: var(--border);
    box-shadow: var(--shadow-raised);
    min-width: 0;
  }

  .played-card.is-hidden {
    visibility: hidden;
  }

  .played-corners {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  .played-order {
    font-family: "Bricolage Grotesque", sans-serif;
    font-weight: 800;
    font-size: 0.8125rem;
    color: var(--primary);
    letter-spacing: 0.02em;
  }

  .duration {
    font-family: "JetBrains Mono", monospace;
    font-size: 0.8125rem;
    color: var(--muted);
    white-space: nowrap;
  }

  .played-main {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
  }

  .played-details {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .stage-slot {
    width: 100%;
    min-width: 0;
  }

  .stage-backdrop {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: var(--radius-md);
    border: 1.5px solid var(--line);
    overflow: hidden;
    background: var(--surface-muted);
  }

  .stage-backdrop.compact-art {
    aspect-ratio: auto;
    height: 92px;
  }

  .stage-backdrop img,
  .stage-svg {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .stage-play {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 8px 16px;
    border-radius: 999px;
    border: 1.5px solid var(--border);
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    color: var(--text);
    font-family: "Bricolage Grotesque", sans-serif;
    font-weight: 700;
    font-size: 0.875rem;
    cursor: pointer;
    box-shadow: var(--shadow-raised);
    transition: transform 0.12s ease, background 0.12s ease;
  }

  .stage-play:hover {
    background: var(--surface);
    transform: translate(-50%, -50%) scale(1.04);
  }

  .stage-play:active {
    transform: translate(-50%, -50%) scale(0.98);
  }

  .play-icon {
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: var(--primary);
    color: var(--on-primary);
    font-size: 0.75rem;
    padding-left: 2px;
  }

  .played-info {
    min-width: 0;
  }

  h3 {
    font: 700 1.375rem/1.25 "Bricolage Grotesque", sans-serif;
    margin: 0;
    overflow-wrap: anywhere;
  }

  h3:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 4px;
  }

  h3[tabindex="-1"]:focus:not(:focus-visible) {
    outline: none;
  }

  .artist {
    color: var(--muted);
    margin: 6px 0 0;
    font-size: 0.9375rem;
    overflow-wrap: anywhere;
  }

  .meta-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px 14px;
    margin-top: 12px;
  }

  .badges {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .badge {
    font-size: 12px;
    color: var(--text);
    border: 0;
    letter-spacing: 0;
  }

  .badge.bajo {
    background: color-mix(in srgb, var(--primary) 16%, var(--surface));
  }

  .badge.guitarra {
    background: color-mix(in srgb, var(--accent) 16%, var(--surface));
  }

  .freshness {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
    font-size: 0.8125rem;
    margin: 0;
  }

  .freshness-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .fresh {
    background: var(--accent);
  }

  .warm {
    background: var(--warning);
  }

  .stale {
    background: color-mix(in srgb, var(--primary) 65%, var(--surface));
  }

  .media-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 14px;
  }

  .audio-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .ink-btn {
    min-height: 44px;
  }

  .audio-wrap {
    margin-top: 12px;
    min-width: 0;
  }

  .played-actions {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }

  @media (min-width: 641px) {
    .played-actions :global(.session-actions) {
      margin-top: 0;
      padding: 0;
    }
  }

  @media (min-width: 768px) {
    .played-main {
      display: grid;
      grid-template-columns: minmax(260px, min(400px, 50svh)) minmax(0, 1fr);
      gap: 18px;
      align-items: start;
    }

    .played-main.no-video {
      grid-template-columns: 168px minmax(0, 1fr);
      align-items: center;
    }

    .stage-backdrop.compact-art {
      height: 104px;
    }
  }

  @media (max-width: 640px) {
    .played-card {
      padding: 16px;
    }

    h3 {
      font-size: 1.25rem;
    }
  }
</style>
