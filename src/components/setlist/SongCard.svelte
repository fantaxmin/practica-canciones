<script lang="ts">
  import type { Instrument, Song } from "../../lib/types";
  import { formatMmSs } from "../../lib/duration";
  import { extractYoutubeId, youtubeThumbnailUrl } from "../../lib/youtube";

  interface Props {
    song?: Song;
    order?: number;
    instrument: Instrument;
    face?: "front" | "back";
    status?: "pending" | "current" | "practiced" | "skipped";
    compact?: boolean;
  }

  let {
    song,
    order,
    instrument,
    face = "front",
    status = "pending",
    compact = false,
  }: Props = $props();

  let imgError = $state(false);
  const videoId = $derived(song ? extractYoutubeId(song.youtubeUrl) : null);
  const thumbUrl = $derived(videoId ? youtubeThumbnailUrl(videoId) : null);
  const hasAudio = $derived(Boolean(song?.audioFileId || song?.driveUrl));

  $effect(() => {
    void videoId;
    imgError = false;
  });
</script>

{#if face === "back" || !song}
  <div
    class="song-card back"
    class:compact
    class:guitarra={instrument === "guitarra"}
    aria-hidden="true"
  >
    <div class="back-frame">
      <div class="back-pattern"></div>
      <svg class="back-emblem" viewBox="0 0 44 44" width="44" height="44" fill="none">
        <rect x="2" y="2" width="40" height="40" rx="10" stroke="currentColor" stroke-width="2" />
        <rect x="11" y="22" width="4.5" height="11" rx="1.5" fill="var(--primary)" />
        <rect x="19.75" y="12" width="4.5" height="21" rx="1.5" fill="var(--accent)" />
        <rect x="28.5" y="17" width="4.5" height="16" rx="1.5" fill="var(--primary)" />
      </svg>
      <span class="back-tag">{instrument === "bajo" ? "BAJO" : "GUITARRA"}</span>
    </div>
  </div>
{:else}
  <div
    class="song-card front"
    class:compact
    class:practiced={status === "practiced"}
    class:skipped={status === "skipped"}
    class:current={status === "current"}
  >
    <div class="card-corners">
      <span class="corner-order">{order !== undefined ? `#${order}` : ""}</span>
      <span class="corner-duration">{formatMmSs(song.durationSeconds)}</span>
    </div>

    <div class="card-art" class:guitarra={instrument === "guitarra"}>
      {#if thumbUrl && !imgError}
        <img
          src={thumbUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
          onerror={() => (imgError = true)}
        />
      {:else if instrument === "bajo"}
        <svg class="art-svg" viewBox="0 0 160 90" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
          <rect width="160" height="90" fill="var(--art-bg)" />
          <circle cx="128" cy="20" r="34" fill="var(--primary)" opacity="0.2" />
          <circle cx="32" cy="76" r="28" fill="var(--accent)" opacity="0.16" />
          <g stroke="var(--art-stroke)" stroke-linecap="round">
            <line x1="16" y1="24" x2="144" y2="24" stroke-width="3.2" opacity="0.85" />
            <line x1="16" y1="40" x2="144" y2="40" stroke-width="2.6" opacity="0.7" />
            <line x1="16" y1="56" x2="144" y2="56" stroke-width="2" opacity="0.55" />
            <line x1="16" y1="70" x2="144" y2="70" stroke-width="1.5" opacity="0.45" />
          </g>
          <circle cx="56" cy="40" r="6" fill="var(--primary)" />
          <circle cx="104" cy="24" r="5" fill="var(--accent)" />
        </svg>
      {:else}
        <svg class="art-svg" viewBox="0 0 160 90" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
          <rect width="160" height="90" fill="var(--art-bg)" />
          <circle cx="126" cy="72" r="34" fill="var(--accent)" opacity="0.22" />
          <circle cx="30" cy="22" r="26" fill="var(--primary)" opacity="0.16" />
          <g stroke="var(--art-stroke)" stroke-linecap="round">
            <line x1="16" y1="18" x2="144" y2="18" stroke-width="2.2" opacity="0.8" />
            <line x1="16" y1="29" x2="144" y2="29" stroke-width="1.9" opacity="0.7" />
            <line x1="16" y1="40" x2="144" y2="40" stroke-width="1.6" opacity="0.6" />
            <line x1="16" y1="51" x2="144" y2="51" stroke-width="1.4" opacity="0.55" />
            <line x1="16" y1="62" x2="144" y2="62" stroke-width="1.2" opacity="0.48" />
            <line x1="16" y1="73" x2="144" y2="73" stroke-width="1" opacity="0.4" />
          </g>
          <circle cx="64" cy="29" r="5" fill="var(--accent)" />
          <circle cx="96" cy="51" r="5" fill="var(--primary)" />
          <circle cx="116" cy="40" r="4" fill="var(--accent)" />
        </svg>
      {/if}
    </div>

    <div class="card-body">
      <p class="card-title" title={song.title}>{song.title}</p>
      {#if song.artist}
        <p class="card-artist" title={song.artist}>{song.artist}</p>
      {/if}
    </div>

    <div class="card-foot">
      {#if status === "practiced"}
        <span class="status-pill practiced">Practicada</span>
      {:else if status === "skipped"}
        <span class="status-pill skipped">Saltada</span>
      {:else}
        <span class="media-hints" aria-hidden="true">
          {#if videoId}<span class="hint-dot yt" title="Con video">▶</span>{/if}
          {#if hasAudio}<span class="hint-dot audio" title="Con audio">♪</span>{/if}
        </span>
      {/if}
      <span class="corner-order mirror" aria-hidden="true">
        {order !== undefined ? `#${order}` : ""}
      </span>
    </div>
  </div>
{/if}

<style>
  .song-card {
    --art-bg: var(--surface-muted);
    --art-stroke: var(--text);
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-width: 0;
    border-radius: var(--radius-md);
    border: 1.5px solid var(--border);
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-card);
    overflow: hidden;
    user-select: none;
  }

  .song-card.front {
    padding: 8px;
    gap: 6px;
  }

  .song-card.compact.front {
    padding: 6px;
    gap: 4px;
  }

  .song-card.practiced {
    border-color: color-mix(in srgb, var(--accent) 70%, var(--border));
  }

  .song-card.skipped {
    border-style: dashed;
    border-color: var(--line);
  }

  .card-corners {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    line-height: 1;
  }

  .corner-order {
    font-family: "Bricolage Grotesque", sans-serif;
    font-weight: 800;
    font-size: 0.75rem;
    color: var(--primary);
    letter-spacing: -0.02em;
  }

  .corner-order.mirror {
    opacity: 0.5;
    font-size: 0.6875rem;
  }

  .corner-duration {
    font-family: "JetBrains Mono", monospace;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--muted);
  }

  .card-art {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1px solid var(--line);
    background: var(--surface-muted);
    flex-shrink: 0;
  }

  .card-art img,
  .art-svg {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .card-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .card-title {
    margin: 0;
    font-family: "Bricolage Grotesque", sans-serif;
    font-weight: 700;
    font-size: 0.875rem;
    line-height: 1.2;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
  }

  .compact .card-title {
    font-size: 0.75rem;
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }

  .card-artist {
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.25;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .compact .card-artist {
    font-size: 0.6875rem;
  }

  .card-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    margin-top: auto;
    min-height: 18px;
  }

  .media-hints {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .hint-dot {
    display: inline-grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    font-size: 0.625rem;
    font-weight: 700;
    background: var(--surface-muted);
    color: var(--muted);
    border: 1px solid var(--line);
  }

  .status-pill {
    font-size: 0.625rem;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 999px;
    line-height: 1.2;
  }

  .status-pill.practiced {
    background: color-mix(in srgb, var(--accent) 28%, var(--surface));
    color: var(--text);
  }

  .status-pill.skipped {
    background: var(--surface-muted);
    color: var(--muted);
  }

  /* Dorso decorativo */
  .song-card.back {
    padding: 7px;
    background: color-mix(in srgb, var(--primary) 12%, var(--surface));
  }

  .song-card.back.guitarra {
    background: color-mix(in srgb, var(--accent) 14%, var(--surface));
  }

  .back-frame {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: calc(var(--radius-md) - 4px);
    border: 1.5px dashed color-mix(in srgb, var(--border) 55%, transparent);
    background: var(--surface);
    overflow: hidden;
  }

  .back-pattern {
    position: absolute;
    inset: 0;
    opacity: 0.08;
    background-image: repeating-linear-gradient(
      45deg,
      var(--border) 0,
      var(--border) 1px,
      transparent 1px,
      transparent 10px
    );
    pointer-events: none;
  }

  .back-emblem {
    position: relative;
    color: var(--border);
  }

  .back-tag {
    position: relative;
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: 0.625rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
</style>
