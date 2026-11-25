export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      return u.pathname.slice(1) || null;
    }
    if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname === "/watch") {
        return u.searchParams.get("v");
      }
      if (u.pathname.startsWith("/embed/")) {
        return u.pathname.replace("/embed/", "") || null;
      }
      if (u.pathname.startsWith("/shorts/")) {
        return u.pathname.replace("/shorts/", "") || null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function youtubeEmbedUrl(url: string): string | null {
  const id = extractYoutubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

export function looksLikeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || /\byoutube\.com\b|\byoutu\.be\b/i.test(trimmed);
}

export function youtubeThumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(id)}/mqdefault.jpg`;
}
