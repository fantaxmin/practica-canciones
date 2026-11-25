<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { Song } from "../lib/types";
  import { parseMmSs, formatMmSs } from "../lib/duration";
  import { extractYoutubeId, looksLikeUrl } from "../lib/youtube";
  import { songs } from "../lib/stores";
  import { deleteAudio, getAudioBlob, getAudioHandle, saveAudioBlob, MAX_AUDIO_BYTES, formatAudioSize } from "../lib/audioStore";
  import { extractDriveId, extractDriveLink } from "../lib/drive";
  import { durationFromDrive, durationFromFile, durationFromYoutube } from "../lib/detectDuration";

  let {
    song = null,
    onSave,
    onCancel,
  }: {
    song?: Song | null;
    onSave: (data: Omit<Song, "id" | "lastPracticedAt">) => void;
    onCancel?: () => void;
  } = $props();

  const uid = $props.id();

  // Captura inicial: el borrador solo se guarda al enviar el formulario.
  const initialSong = untrack(() => song);
  let title = $state(initialSong?.title ?? "");
  let artist = $state(initialSong?.artist ?? "");
  let youtubeUrl = $state(initialSong?.youtubeUrl ?? "");
  let durationInput = $state(initialSong ? formatMmSs(initialSong.durationSeconds) : "");
  let bajo = $state(initialSong?.instruments.bajo ?? false);
  let guitarra = $state(initialSong?.instruments.guitarra ?? false);
  let error = $state("");
  let titleError = $state("");
  let artistError = $state("");
  let durationError = $state("");
  let instrumentsError = $state("");

  const existingAudioFileId = initialSong?.audioFileId ?? null;
  type AudioSource = "none" | "file" | "drive";
  let audioSource = $state<AudioSource>(initialSong?.driveUrl ? "drive" : existingAudioFileId ? "file" : "none");
  let driveUrl = $state(initialSong?.driveUrl ?? "");
  let driveError = $state("");
  let audioFile = $state<File | null>(null);
  let audioFileName = $state<string | null>(null);
  let audioFileSize = $state<number | null>(null);
  let legacyAudio = $state(false);
  let audioRemoved = $state(false);
  let audioError = $state("");
  let saving = $state(false);
  let dragging = $state(false);
  let fileInput = $state<HTMLInputElement>();
  const validDriveLink = $derived(extractDriveId(driveUrl) !== null);

  // Duración automática: se rellena sola salvo que el usuario haya escrito la suya.
  type DurationOrigin = "audio" | "youtube";
  const originLabel: Record<DurationOrigin, string> = { audio: "audio", youtube: "video de YouTube" };
  let autoDuration = $state<{ value: string; origin: DurationOrigin } | null>(null);
  let durationStatus = $state("");
  let suggestedDuration = $state<string | null>(null);
  const detectTokens: Record<DurationOrigin, number> = { audio: 0, youtube: 0 };
  const youtubeId = $derived(extractYoutubeId(youtubeUrl.trim()));
  const driveLink = $derived(audioSource === "drive" ? extractDriveLink(driveUrl) : null);
  const initialYoutubeId = extractYoutubeId(initialSong?.youtubeUrl ?? "");
  const initialDriveId = extractDriveId(initialSong?.driveUrl ?? "");

  function durationIsOurs() {
    return !durationInput.trim() || durationInput === autoDuration?.value;
  }

  async function detectDuration(origin: DurationOrigin, task: Promise<number | null>) {
    const token = ++detectTokens[origin];
    durationStatus = "Detectando duración…";
    suggestedDuration = null;
    const seconds = await task.catch(() => null);
    if (token !== detectTokens[origin]) return;
    durationStatus = "";
    if (seconds === null) {
      if (!durationInput.trim()) durationStatus = `No se pudo leer la duración del ${originLabel[origin]}; escríbela a mano.`;
      return;
    }
    const value = formatMmSs(seconds);
    if (value === durationInput) return;
    // El audio es la canción en sí; el video puede traer intro, así que no lo pisa.
    const audioWins = origin === "youtube" && autoDuration?.origin === "audio" && durationInput === autoDuration.value;
    if (durationIsOurs() && !audioWins) {
      durationInput = value;
      autoDuration = { value, origin };
      durationError = "";
      durationStatus = `Tomada del ${originLabel[origin]}. Puedes ajustarla.`;
    } else {
      suggestedDuration = value;
      durationStatus = `El ${originLabel[origin]} dura ${value}.`;
    }
  }

  function useSuggestedDuration() {
    if (!suggestedDuration) return;
    durationInput = suggestedDuration;
    durationError = "";
    suggestedDuration = null;
    durationStatus = "";
  }

  $effect(() => {
    const id = youtubeId;
    if (!id || id === initialYoutubeId) return;
    untrack(() => detectDuration("youtube", durationFromYoutube(id)));
  });

  $effect(() => {
    const link = driveLink;
    if (!link || link.id === initialDriveId) return;
    untrack(() => detectDuration("audio", durationFromDrive(link.id, link.resourcekey)));
  });

  onMount(() => {
    let active = true;
    async function loadAttachment() {
      if (!existingAudioFileId) return;
      try {
        const blob = await getAudioBlob(existingAudioFileId);
        const handle = blob ? null : await getAudioHandle(existingAudioFileId);
        if (!active || audioRemoved || audioFile || audioSource !== "file") return;
        audioFileName = blob?.name ?? handle?.name ?? null;
        audioFileSize = blob?.size ?? null;
        legacyAudio = !!handle;
        if (!blob && !handle) audioError = "No se encontró el audio guardado. Adjúntalo de nuevo desde Editar.";
      } catch {
        if (active) audioError = "No se pudo leer el audio guardado. Inténtalo de nuevo.";
      }
    }
    void loadAttachment();
    return () => { active = false; };
  });

  function removeAudioFile() {
    audioFile = null;
    audioFileName = null;
    audioFileSize = null;
    legacyAudio = false;
    audioRemoved = true;
    audioError = "";
    if (fileInput) fileInput.value = "";
  }

  function changeAudioSource(source: AudioSource) {
    if (source === audioSource || saving) return;
    removeAudioFile();
    driveUrl = "";
    driveError = "";
    audioSource = source;
  }

  function selectAudioFile(file: File | undefined) {
    if (!file || saving) return;
    audioError = "";
    if (file.size > MAX_AUDIO_BYTES) {
      audioError = `El archivo pesa ${formatAudioSize(file.size)}; el máximo es 50 MB.`;
    } else if (!file.type.startsWith("audio/") && !/\.(mp3|wav|m4a|ogg|flac|aac|opus|aiff?|weba)$/i.test(file.name)) {
      audioError = "Elige un archivo de audio, por ejemplo MP3 o WAV.";
    } else {
      audioFile = file;
      audioFileName = file.name;
      audioFileSize = file.size;
      legacyAudio = false;
      audioRemoved = false;
      void detectDuration("audio", durationFromFile(file));
    }
    if (fileInput) fileInput.value = "";
  }

  function dropAudio(event: DragEvent) {
    event.preventDefault();
    dragging = false;
    selectAudioFile(event.dataTransfer?.files[0]);
  }

  function validateDrive() {
    driveError = audioSource === "drive" && driveUrl.trim() && !validDriveLink
      ? "Pega el enlace de un archivo de Drive (no de una carpeta)." : "";
    return !driveError;
  }

  let existingArtists = $derived(
    [...new Set($songs.map((s) => s.artist).filter((a) => a && a.trim()))].sort((a, b) =>
      a.localeCompare(b)
    )
  );

  function validateTitle() {
    titleError = !title.trim()
      ? "Escribe el título de la canción."
      : looksLikeUrl(title)
        ? "Usa este campo para el título; pega el enlace en YouTube."
        : "";
    return !titleError;
  }

  function validateArtist() {
    artistError = looksLikeUrl(artist) ? "Escribe el nombre del artista, no un enlace." : "";
    return !artistError;
  }

  function validateDuration() {
    const value = parseMmSs(durationInput);
    durationError = value === null || value <= 0 ? "Usa minutos y segundos, por ejemplo 3:45." : "";
    return !durationError;
  }

  function validateInstruments() {
    instrumentsError = !bajo && !guitarra ? "Selecciona al menos un instrumento." : "";
    return !instrumentsError;
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (saving) return;
    error = "";

    const fieldsAreValid = [validateTitle(), validateArtist(), validateDuration(), validateInstruments(), validateDrive()].every(Boolean);
    if (!fieldsAreValid) {
      error = "Revisa los campos señalados antes de guardar.";
      return;
    }
    const durationSeconds = parseMmSs(durationInput);
    if (durationSeconds === null) return;

    // Si ya existe el mismo artista con otra capitalización/espacios, reusamos la versión guardada.
    const trimmedArtist = artist.trim();
    const matchingArtist = existingArtists.find(
      (a) => a.toLowerCase() === trimmedArtist.toLowerCase()
    );

    saving = true;
    let newAudioId: string | null = null;
    try {
      let audioFileId = audioSource === "file" && !audioRemoved ? existingAudioFileId : null;
      if (audioSource === "file" && audioFile) {
        newAudioId = crypto.randomUUID();
        await saveAudioBlob(newAudioId, audioFile);
        audioFileId = newAudioId;
      }
      if (existingAudioFileId && existingAudioFileId !== audioFileId) {
        await deleteAudio(existingAudioFileId);
      }
      onSave({
        title: title.trim(),
        artist: matchingArtist ?? trimmedArtist,
        youtubeUrl: youtubeUrl.trim(),
        driveUrl: audioSource === "drive" ? driveUrl.trim() : "",
        audioFileId,
        durationSeconds,
        instruments: { bajo, guitarra },
      });
    } catch (cause) {
      if (newAudioId) await deleteAudio(newAudioId).catch(() => {});
      audioError = cause instanceof DOMException && cause.name === "QuotaExceededError"
        ? "No hay espacio en el navegador para guardar este audio."
        : "No se pudo guardar el audio. Inténtalo de nuevo.";
      return;
    } finally {
      saving = false;
    }

    if (!song) {
      title = "";
      artist = "";
      youtubeUrl = "";
      durationInput = "";
      bajo = false;
      guitarra = false;
      audioFile = null;
      audioFileSize = null;
      legacyAudio = false;
      audioSource = "none";
      driveUrl = "";
      audioFileName = null;
      audioRemoved = false;
      autoDuration = null;
      suggestedDuration = null;
      durationStatus = "";
      detectTokens.audio++;
      detectTokens.youtube++;
    }
  }
</script>

<form class="song-form" onsubmit={handleSubmit} novalidate>
  <div class="field">
    <label for="title-{uid}">Título <span aria-hidden="true">*</span></label>
    <input id="title-{uid}" type="text" bind:value={title} placeholder="Ej. Chamber of Reflection" onblur={validateTitle} aria-invalid={!!titleError} aria-describedby={titleError ? `title-error-${uid}` : undefined} />
    {#if titleError}<p id="title-error-{uid}" class="field-error">⚠ {titleError}</p>{/if}
  </div>
  <div class="field">
    <label for="artist-{uid}">Artista</label>
    <input id="artist-{uid}" type="text" bind:value={artist} placeholder="Ej. Mac DeMarco" list="artist-options-{uid}" onblur={validateArtist} aria-invalid={!!artistError} />
    {#if artistError}<p class="field-error">⚠ {artistError}</p>{/if}
  </div>
  <datalist id="artist-options-{uid}">
    {#each existingArtists as a (a)}
      <option value={a}></option>
    {/each}
  </datalist>
  <div class="field">
    <label for="youtube-{uid}">Enlace de YouTube <span class="optional">Opcional</span></label>
    <input id="youtube-{uid}" type="url" bind:value={youtubeUrl} placeholder="https://youtube.com/watch?v=…" />
  </div>

  <fieldset class="audio-group" disabled={saving}>
    <legend>Audio <span class="optional">Opcional</span></legend>
    <div class="audio-sources" role="group" aria-label="Origen del audio">
      <button type="button" class:active={audioSource === "none"} aria-pressed={audioSource === "none"} onclick={() => changeAudioSource("none")}>Ninguno</button>
      <button type="button" class:active={audioSource === "file"} aria-pressed={audioSource === "file"} onclick={() => changeAudioSource("file")}>Subir archivo</button>
      <button type="button" class:active={audioSource === "drive"} aria-pressed={audioSource === "drive"} onclick={() => changeAudioSource("drive")}>Enlace de Drive</button>
    </div>
    {#if audioSource === "file"}
      <div class="dropzone" class:dragging role="group" aria-label="Adjuntar audio" ondragover={(event) => { event.preventDefault(); dragging = true; }} ondragleave={() => (dragging = false)} ondrop={dropAudio}>
        <input class="sr-only" bind:this={fileInput} id="audio-file-{uid}" type="file" accept="audio/*" aria-label="Elegir archivo de audio" aria-describedby={`audio-help-${uid}`} onchange={(event) => selectAudioFile(event.currentTarget.files?.[0])} />
        <button type="button" class="pill-btn" onclick={() => fileInput?.click()}>{legacyAudio ? "Reemplazar" : "Elegir archivo de audio"}</button>
        <p id="audio-help-{uid}" class="hint">Arrastra y suelta un audio aquí. Máximo 50 MB.</p>
        {#if audioFileName}
          <div class="audio-field">
            <span class="audio-name">{legacyAudio ? "Archivo local (heredado): " : ""}{audioFileName}{audioFileSize !== null ? ` · ${formatAudioSize(audioFileSize)}` : ""}</span>
            <button type="button" class="pill-btn" onclick={removeAudioFile}>Quitar</button>
          </div>
        {/if}
      </div>
    {:else if audioSource === "drive"}
      <div class="field drive-field">
        <label for="drive-{uid}">Enlace del archivo de Drive</label>
        <input id="drive-{uid}" type="url" bind:value={driveUrl} placeholder="https://drive.google.com/file/d/…" oninput={(event) => { if (driveError) { driveUrl = event.currentTarget.value; validateDrive(); } }} onblur={validateDrive} aria-invalid={!!driveError} aria-describedby={`drive-help-${uid}${driveError ? ` drive-error-${uid}` : ""}`} />
        <p id="drive-help-{uid}" class="hint">El archivo debe estar compartido como «Cualquier persona con el enlace».</p>
        <p class="hint">Funciona mejor en Chrome, Edge y Brave. Si en tu navegador no carga, descarga el archivo y súbelo en «Subir archivo».</p>
        {#if validDriveLink}<a class="drive-link" href={driveUrl.trim()} target="_blank" rel="noopener noreferrer">Abrir en Drive</a>{/if}
        {#if driveError}<p id="drive-error-{uid}" class="field-error" role="alert">{driveError}</p>{/if}
      </div>
    {/if}
  </fieldset>
  {#if audioError}<p class="field-error" role="alert">{audioError}</p>{/if}

  <div class="field duration-input">
    <label for="duration-{uid}">Duración <span aria-hidden="true">*</span></label>
    <input id="duration-{uid}" type="text" bind:value={durationInput} placeholder="3:45" onblur={validateDuration} aria-invalid={!!durationError} aria-describedby={durationStatus ? `duration-status-${uid}` : undefined} />
    {#if durationStatus}
      <p id="duration-status-{uid}" class="hint" aria-live="polite">
        {durationStatus}
        {#if suggestedDuration}<button type="button" class="link-btn" onclick={useSuggestedDuration}>Usar</button>{/if}
      </p>
    {/if}
    {#if durationError}<p class="field-error">⚠ {durationError}</p>{/if}
  </div>

  <fieldset onfocusout={validateInstruments}>
    <legend>Instrumentos <span aria-hidden="true">*</span></legend>
    <div class="checkboxes">
    <label class="checkbox">
      <input type="checkbox" bind:checked={bajo} />
      Bajo
    </label>
    <label class="checkbox">
      <input type="checkbox" bind:checked={guitarra} />
      Guitarra
    </label>
    </div>
    {#if instrumentsError}<p class="field-error">⚠ {instrumentsError}</p>{/if}
  </fieldset>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <div class="actions">
    <button type="submit" class="press-btn" disabled={saving}>{saving ? "Guardando…" : song ? "Guardar" : "Agregar canción"}</button>
    {#if onCancel}
      <button type="button" class="press-btn ghost" disabled={saving} onclick={onCancel}>Cancelar</button>
    {/if}
  </div>
</form>

<style>
  .audio-sources { display:flex; flex-wrap:wrap; gap:4px; margin-top:8px; padding:4px; border:1px solid var(--line); border-radius:var(--radius-sm); }
  .audio-sources button { flex:1; min-height:44px; min-width:44px; padding:8px; color:var(--text); background:transparent; border:0; border-radius:6px; font-weight:700; cursor:pointer; }
  .audio-sources button:hover { background:var(--surface-muted); }
  .audio-sources button.active { background:color-mix(in srgb, var(--primary) 18%, var(--surface)); }
  .dropzone { margin-top:12px; padding:16px; border:1px dashed var(--muted); border-radius:var(--radius-sm); display:flex; flex-direction:column; align-items:flex-start; gap:12px; }
  .dropzone:focus-within { outline:3px solid var(--focus-ring); outline-offset:3px; }
  .dropzone.dragging { background:var(--surface-muted); border-color:var(--primary); }
  .drive-field { margin-top:12px; }
  .drive-link { display:inline-flex; align-items:center; min-height:44px; width:fit-content; color:var(--text); text-underline-offset:3px; }
  button:disabled { opacity:.6; cursor:wait; }
  .song-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .field { display:flex; flex-direction:column; gap:8px; }
  label, legend { color:var(--text); font-size:.8125rem; font-weight:700; }
  label > span[aria-hidden="true"], legend span[aria-hidden="true"] { color:var(--error); }
  .optional { margin-left:4px; color:var(--muted); font-size:.75rem; font-weight:500; }
  input[aria-invalid="true"] { border-color:var(--error); }
  .duration-input {
    width: 160px;
  }
  .duration-input .hint { width: max-content; max-width: min(320px, 80vw); }
  .link-btn { padding:0 4px; color:var(--text); background:none; border:0; font:inherit; font-weight:700; text-decoration:underline; text-underline-offset:3px; cursor:pointer; }
  .duration-input input { width:100%; }
  .audio-field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .audio-name {
    color: var(--muted);
    font-size: 0.78rem;
    overflow-wrap: anywhere;
    min-width: 0;
  }
  .hint {
    color: var(--muted);
    font-size: 0.78rem;
    margin: 0;
  }
  .checkboxes {
    display: flex;
    align-items: center;
    gap: 24px;
  }
  .checkbox {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-height:44px;
    font-size: 0.875rem;
    cursor: pointer;
  }
  .error {
    color: color-mix(in srgb, var(--error) 45%, var(--text));
    font-size: 0.8rem;
    margin: 0;
  }
  .field-error { margin:0; color:color-mix(in srgb, var(--error) 45%, var(--text)); font-size:.75rem; }
  fieldset { margin:0; padding:0; border:0; }
  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.25rem;
  }
  .actions .press-btn {
    font-size: .875rem;
  }
</style>
