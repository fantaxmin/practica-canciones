import { loadYoutubeApi } from "./youtubeApi";

const DEFAULT_TIMEOUT_MS = 15_000;

function validDuration(value: number): number | null {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

/** Lee la duración de un audio cargando solo sus metadatos. Devuelve null si no se puede. */
export function durationFromAudioSrc(src: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = "metadata";
    const finish = (value: number | null) => {
      clearTimeout(timer);
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.removeAttribute("src");
      audio.load();
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    audio.onloadedmetadata = () => finish(validDuration(audio.duration));
    audio.onerror = () => finish(null);
    audio.src = src;
  });
}

export async function durationFromFile(file: Blob): Promise<number | null> {
  const url = URL.createObjectURL(file);
  try {
    return await durationFromAudioSrc(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Solo funciona con archivos públicos y lo bastante pequeños para que Drive no pida confirmar el antivirus. */
export function durationFromDrive(id: string, resourcekey: string | null = null): Promise<number | null> {
  const url = new URL("https://drive.usercontent.google.com/download");
  url.searchParams.set("id", id);
  url.searchParams.set("export", "download");
  if (resourcekey) url.searchParams.set("resourcekey", resourcekey);
  return durationFromAudioSrc(url.href);
}

/** Crea un reproductor de YouTube oculto y silenciado solo para preguntar la duración. */
export async function durationFromYoutube(videoId: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<number | null> {
  await loadYoutubeApi();
  const YT = (window as any).YT;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;pointer-events:none;";
  const target = document.createElement("div");
  host.appendChild(target);
  document.body.appendChild(host);

  return new Promise((resolve) => {
    let player: any = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let nudged = false;
    const started = Date.now();
    const finish = (value: number | null) => {
      clearTimeout(timer);
      if (poll) clearInterval(poll);
      try { player?.destroy?.(); } catch { /* ya destruido */ }
      host.remove();
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);

    player = new YT.Player(target, {
      videoId,
      width: 1,
      height: 1,
      playerVars: { controls: 0, rel: 0 },
      events: {
        onReady: () => {
          poll = setInterval(() => {
            const value = validDuration(player?.getDuration?.() ?? 0);
            if (value) return finish(value);
            // Algunos videos no informan la duración hasta empezar a cargar: lo arrancamos en silencio.
            if (!nudged && Date.now() - started > 2_000) {
              nudged = true;
              player?.mute?.();
              player?.playVideo?.();
            }
          }, 250);
        },
        onError: () => finish(null),
      },
    });
  });
}
