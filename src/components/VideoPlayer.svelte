<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { openExternal } from "../lib/platform";
  import { parseMmSs } from "../lib/duration";
  import { loadYoutubeApi } from "../lib/youtubeApi";

  let { videoId, title }: { videoId: string; title: string } = $props();

  const uid = $props.id();
  const elementId = `yt-player-${uid}`;

  let loopStartInput = $state("");
  let loopEndInput = $state("");
  let loopEnabled = $state(false);
  let loopError = $state("");

  let player: any = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  onMount(async () => {
    await loadYoutubeApi();
    const w = window as any;
    player = new w.YT.Player(elementId, {
      videoId,
      playerVars: { rel: 0 },
    });
  });

  onDestroy(() => {
    if (pollTimer) clearInterval(pollTimer);
    player?.destroy?.();
  });

  function toggleLoop() {
    loopError = "";

    if (loopEnabled) {
      loopEnabled = false;
      if (pollTimer) clearInterval(pollTimer);
      return;
    }

    const start = parseMmSs(loopStartInput);
    const end = parseMmSs(loopEndInput);
    if (start === null || end === null) {
      loopError = "Ingresa inicio y fin en formato mm:ss.";
      return;
    }
    if (end <= start) {
      loopError = "El fin debe ser mayor al inicio.";
      return;
    }

    player?.seekTo?.(start, true);
    player?.playVideo?.();
    loopEnabled = true;

    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (!player?.getCurrentTime) return;
      if (player.getCurrentTime() >= end) {
        player.seekTo(start, true);
      }
    }, 300);
  }
</script>

<div class="video-player">
  <div class="frame" aria-label={title}>
    <div id={elementId}></div>
  </div>
  <div>
    <button type="button" class="pill-btn" onclick={() => openExternal(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`)}>Abrir en YouTube</button>
  </div>
  <div class="loop-row">
    <input
      type="text"
      placeholder="Inicio (mm:ss)"
      bind:value={loopStartInput}
      class="loop-input"
      disabled={loopEnabled}
    />
    <input
      type="text"
      placeholder="Fin (mm:ss)"
      bind:value={loopEndInput}
      class="loop-input"
      disabled={loopEnabled}
    />
    <button class="pill-btn" class:active={loopEnabled} onclick={toggleLoop}>
      {loopEnabled ? "Detener loop" : "Loop"}
    </button>
  </div>
  {#if loopError}
    <p class="loop-error">{loopError}</p>
  {/if}
</div>

<style>
  .video-player {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .frame {
    border: 2px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    aspect-ratio: 16 / 9;
  }
  .frame :global(iframe) {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
  }
  .loop-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .loop-input {
    width: 6.5rem;
    padding: 6px 8px;
    font-size: 0.75rem;
  }
  .loop-error {
    color: var(--error);
    font-size: 0.75rem;
    margin: 0;
  }
</style>
