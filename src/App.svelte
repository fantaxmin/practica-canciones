<script lang="ts">
  import { onMount, tick } from "svelte";
  import { slide } from "svelte/transition";
  import type { Song, Tab } from "./lib/types";
  import { songs } from "./lib/stores";
  import { darkMode } from "./lib/theme";
  import SongForm from "./components/SongForm.svelte";
  import SongList from "./components/SongList.svelte";
  import SetlistGenerator from "./components/SetlistGenerator.svelte";
  import Stats from "./components/Stats.svelte";
  import DataManager from "./components/DataManager.svelte";
  import Warmup from "./components/warmup/Warmup.svelte";

  let tab = $state<Tab>("repertorio");

  let formOpen = $state($songs.length === 0);
  let addButton = $state<HTMLButtonElement>();
  let reducedMotion = $state(false);
  const formDuration = $derived(reducedMotion ? 0 : 220);
  const totalSeconds = $derived($songs.reduce((total, song) => total + song.durationSeconds, 0));
  const totalDuration = $derived(totalSeconds >= 3600
    ? `${Math.floor(totalSeconds / 3600)} h ${Math.floor((totalSeconds % 3600) / 60)} min`
    : totalSeconds >= 60 ? `${Math.floor(totalSeconds / 60)} min` : `${totalSeconds} s`);

  onMount(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { reducedMotion = media.matches; };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  });

  function navigate(nextTab: Tab) {
    tab = nextTab;
    void tick().then(() => document.querySelector<HTMLElement>("main h2")?.focus());
  }

  async function closeForm() {
    formOpen = false;
    await tick();
    addButton?.focus();
  }

  async function openForm() {
    formOpen = true;
    await tick();
    document.querySelector<HTMLInputElement>("#add-song-form input")?.focus();
  }

  function addSong(data: Omit<Song, "id" | "lastPracticedAt">) {
    songs.update((all) => [
      { ...data, id: crypto.randomUUID(), lastPracticedAt: null },
      ...all,
    ]);
    void closeForm();
  }

  function toggleDarkMode() {
    darkMode.update((v) => !v);
  }
</script>

<header class="app-header">
  <div class="header-row">
    <div class="brand">
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
        <rect x="1" y="1" width="28" height="28" rx="8" stroke="var(--border)" stroke-width="2" />
        <rect x="7" y="16" width="3.5" height="7" rx="1" fill="var(--coral)" />
        <rect x="13.2" y="9" width="3.5" height="14" rx="1" fill="var(--lime)" />
        <rect x="19.4" y="13" width="3.5" height="10" rx="1" fill="var(--coral)" />
      </svg>
      <div>
        <h1>Práctica de canciones</h1>
        <p>Organiza tu repertorio y practica con intención.</p>
      </div>
    </div>
    <button class="icon-btn" onclick={toggleDarkMode} aria-label="Cambiar tema">
      {#if $darkMode}
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <path d="M21 12.5A8.5 8.5 0 1111.5 3 7 7 0 0021 12.5z" fill="var(--text)" />
        </svg>
      {:else}
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="5" fill="var(--text)" />
          <g stroke="var(--text)" stroke-width="2" stroke-linecap="round">
            <line x1="12" y1="1.5" x2="12" y2="4.5" />
            <line x1="12" y1="19.5" x2="12" y2="22.5" />
            <line x1="1.5" y1="12" x2="4.5" y2="12" />
            <line x1="19.5" y1="12" x2="22.5" y2="12" />
            <line x1="4.4" y1="4.4" x2="6.5" y2="6.5" />
            <line x1="17.5" y1="17.5" x2="19.6" y2="19.6" />
            <line x1="4.4" y1="19.6" x2="6.5" y2="17.5" />
            <line x1="17.5" y1="6.5" x2="19.6" y2="4.4" />
          </g>
        </svg>
      {/if}
    </button>
  </div>

  <nav class="tabs" aria-label="Secciones principales">
    <button class="pill-btn" class:active={tab === "repertorio"} onclick={() => (tab = "repertorio")}>
      <span class="wide-tab">Mi repertorio</span><span class="short-tab">Repertorio</span>
    </button>
    <button class="pill-btn" class:active={tab === "setlist"} onclick={() => (tab = "setlist")}>
      <span class="wide-tab">Generar setlist</span><span class="short-tab">Setlist</span>
    </button>
    <button class="pill-btn" class:active={tab === "calentamiento"} onclick={() => (tab = "calentamiento")}>
      <span class="wide-tab">Calentamiento</span><span class="short-tab">Calentar</span>
    </button>
    <button class="pill-btn" class:active={tab === "stats"} onclick={() => (tab = "stats")}>
      Estadísticas
    </button>
  </nav>
</header>

<main>

  {#if tab === "repertorio"}
    <section class="repertoire-section" aria-labelledby="repertoire-title">
      <div class="repertoire-heading">
        <h2 tabindex="-1" id="repertoire-title" aria-live="polite" aria-atomic="true">Mi repertorio <span>· {$songs.length} {$songs.length === 1 ? "canción" : "canciones"} · {totalDuration}</span></h2>
        <button bind:this={addButton} class="press-btn" aria-expanded={formOpen} aria-controls="add-song-form" onclick={() => formOpen ? closeForm() : openForm()}>＋ Agregar canción</button>
      </div>
      <div id="add-song-form">
        {#if formOpen}
          <div class="card form-card" transition:slide={{ duration: formDuration }}>
            <div class="section-heading">
              <h2>Agregar canción</h2>
              <p>Guarda la información esencial para tenerla lista al practicar.</p>
            </div>
            <SongForm onSave={addSong} onCancel={closeForm} />
          </div>
        {/if}
      </div>
      <SongList onAdd={openForm} />
    </section>
  {:else if tab === "setlist"}
    <section>
      <SetlistGenerator onNavigate={navigate} />
    </section>
  {:else if tab === "calentamiento"}
    <section>
      <Warmup />
    </section>
  {:else}
    <section>
      <Stats onNavigate={navigate} />
    </section>
  {/if}

  <DataManager />
</main>

<style>
  .app-header, main {
    width: min(100% - 32px, 1120px);
    margin: 0 auto;
  }
  .app-header { padding-top:32px; }
  main {
    padding: 32px 0 64px;
  }
  .header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  h1 {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: clamp(1.25rem, 3vw, 1.75rem);
    font-weight: 800;
    margin: 0;
  }
  .brand p { margin:4px 0 0; color:var(--muted); font-size:.875rem; }
  h2 {
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
  }
  h2 span { color:var(--muted); font-weight:500; }
  .short-tab { display:none; }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding-bottom:24px;
    border-bottom:1px solid var(--line);
  }
  section {
    margin-bottom: 32px;
  }
  .form-card { padding:24px; max-width:720px; margin-bottom:24px; }
  .repertoire-heading { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:20px; }
  .repertoire-heading h2 { min-width:0; }
  .repertoire-heading h2 span { font-family:"Manrope", sans-serif; font-size:.875rem; }
  .repertoire-heading button { flex-shrink:0; }
  .section-heading { margin-bottom:24px; }
  .section-heading p { margin:8px 0 0; color:var(--muted); font-size:.875rem; }
  @media (max-width:640px) { .tabs { flex-wrap:nowrap; gap:4px; } .tabs button { flex:1; min-width:44px; padding:8px 6px; font-size:11px; } .wide-tab { display:none; } .short-tab { display:inline; } .brand p { display:none; } .app-header { padding-top:24px; } main { padding-top:24px; } .form-card { padding:16px; } }
</style>
