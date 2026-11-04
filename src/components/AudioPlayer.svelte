<script lang="ts">
  import { isTauri, openExternal } from "../lib/platform";
  import { getAudioBlob, getAudioHandle } from "../lib/audioStore";
  import { driveEmbedUrl, driveViewUrl, extractDriveLink, isFirefox } from "../lib/drive";

  let { audioFileId = null, driveUrl = "", title, onRequestEdit }: {
    audioFileId?: string | null;
    driveUrl?: string;
    title: string;
    onRequestEdit?: () => void;
  } = $props();

  type Status = "checking" | "unsupported" | "missing" | "needs-permission" | "denied" | "ready" | "playback-error";
  let status = $state<Status>("checking");
  let audioUrl = $state<string | null>(null);
  let fileName = $state("");
  let authorize = $state<(() => Promise<void>) | null>(null);
  const driveLink = $derived(extractDriveLink(driveUrl));
  const driveId = $derived(driveLink?.id ?? null);
  const previewUrl = $derived(driveLink ? driveEmbedUrl(driveLink.id, driveLink.resourcekey) : "");
  const viewUrl = $derived(driveLink ? driveViewUrl(driveLink.id, driveLink.resourcekey) : "");
  const uid = $props.id();
  let driveHelp = $state(false);
  let popupFallback = $state(false);

  $effect(() => {
    const url = previewUrl;
    driveHelp = false;
    popupFallback = false;
    if (!url || !isFirefox()) return;
    // Drive no ofrece una señal de reproducción; load no confirma que suene.
    const timer = setTimeout(() => { driveHelp = true; }, 12_000);
    return () => clearTimeout(timer);
  });

  async function openDriveWindow() {
    if (isTauri()) {
      await openExternal(previewUrl);
      return;
    }
    const popup = window.open(previewUrl, "drive-player", "popup,width=520,height=260,noopener");
    // noopener también puede devolver null cuando la ventana sí se abrió.
    // El respaldo explícito evita abrir dos ventanas en ese caso.
    popupFallback = !popup;
  }

  $effect(() => {
    const id = audioFileId;
    const hasDrive = !!driveId;
    let disposed = false;
    let objectUrl: string | null = null;
    status = "checking";
    audioUrl = null;
    authorize = null;

    function ready(blob: Blob) {
      if (disposed) return;
      objectUrl = URL.createObjectURL(blob);
      audioUrl = objectUrl;
      status = "ready";
    }

    async function init() {
      if (hasDrive || !id) return;
      try {
        const stored = await getAudioBlob(id);
        if (disposed) return;
        if (stored) {
          fileName = stored.name;
          ready(stored.blob);
          return;
        }
        const handle = await getAudioHandle(id);
        if (disposed) return;
        if (!handle) { status = "missing"; return; }
        fileName = handle.name;
        if (typeof handle.queryPermission !== "function" || typeof handle.requestPermission !== "function") {
          status = "unsupported";
          return;
        }
        async function loadLegacy() {
          const file = await handle!.getFile();
          ready(file);
        }
        authorize = async () => {
          try {
            const permission = await handle.requestPermission({ mode: "read" });
            if (disposed) return;
            if (permission === "granted") await loadLegacy();
            else status = "denied";
          } catch {
            if (!disposed) status = "denied";
          }
        };
        const permission = await handle.queryPermission({ mode: "read" });
        if (disposed) return;
        if (permission === "granted") await loadLegacy();
        else status = "needs-permission";
      } catch {
        if (!disposed) status = "missing";
      }
    }
    void init();
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  });
</script>

{#if driveId || audioFileId}
  <div class="audio-player">
    {#if driveId}
      <iframe src={previewUrl} allow="autoplay" loading="lazy" referrerpolicy="no-referrer" title="Audio de {title}"></iframe>
      <div class="drive-links">
        <a href={viewUrl} target="_blank" rel="noopener noreferrer">Abrir en Drive</a>
        <button type="button" class="help-link" aria-expanded={driveHelp} aria-controls="drive-help-{uid}" onclick={() => (driveHelp = !driveHelp)}>¿No suena?</button>
      </div>
      <div id="drive-help-{uid}" class="drive-help" hidden={!driveHelp}>
        <p class="hint" role="status">{driveHelp ? "Drive está tardando en cargar. En algunos navegadores, como Firefox, la privacidad bloquea este reproductor." : ""}</p>
        <div class="drive-actions">
          <button type="button" class="pill-btn" onclick={openDriveWindow}>Abrir en ventana</button>
          {#if onRequestEdit}<button type="button" class="pill-btn" onclick={onRequestEdit}>Subir el archivo en su lugar</button>{/if}
        </div>
        {#if popupFallback}<a href={previewUrl} target="_blank" rel="noopener noreferrer">Si no se abrió la ventana, abre una pestaña nueva</a>{/if}
      </div>
    {:else if status === "checking"}
      <p class="hint" role="status">Cargando audio…</p>
    {:else if status === "unsupported"}
      <p class="hint" role="alert">Este navegador no puede abrir el archivo heredado. Reemplázalo por un audio subido desde Editar.</p>
    {:else if status === "missing"}
      <p class="hint" role="alert">No se encontró el audio guardado. Adjúntalo de nuevo desde Editar.</p>
    {:else if status === "needs-permission"}
      <button type="button" class="pill-btn" onclick={() => authorize?.()}>Autorizar acceso a «{fileName}»</button>
    {:else if status === "denied"}
      <p class="hint" role="alert">Permiso denegado para acceder al archivo heredado.</p>
      <button type="button" class="pill-btn" onclick={() => authorize?.()}>Reintentar</button>
    {:else}
      <audio src={audioUrl ?? undefined} controls preload="metadata" aria-label="Audio de {title}" onerror={() => (status = "playback-error")}></audio>
      {#if status === "playback-error"}<p class="hint" role="alert">No se pudo reproducir este formato de audio. Adjunta otro archivo desde Editar.</p>{/if}
    {/if}
  </div>
{/if}

<style>
  .audio-player { display:flex; flex-direction:column; align-items:flex-start; gap:8px; min-width:0; }
  audio, iframe { width:100%; min-width:0; }
  iframe { height:100px; border:0; border-radius:var(--radius-sm); background:var(--surface-muted); }
  .hint { color:var(--muted); font-size:.8125rem; margin:0; overflow-wrap:anywhere; }
  a { display:inline-flex; align-items:center; min-height:44px; color:var(--text); font-size:.8125rem; text-underline-offset:3px; }
  button { max-width:100%; overflow-wrap:anywhere; }
  .drive-links, .drive-actions { display:flex; flex-wrap:wrap; align-items:center; gap:8px 16px; }
  .drive-help { width:100%; min-width:0; }
  .drive-help .hint { margin-bottom:12px; }
  .drive-actions button { min-height:44px; min-width:44px; white-space:normal; }
  .help-link { min-height:44px; min-width:44px; padding:0; border:0; background:transparent; color:var(--text); font-size:.8125rem; text-decoration:underline; text-underline-offset:3px; cursor:pointer; }
</style>
