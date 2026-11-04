export function isFirefox(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent): boolean {
  return /firefox/i.test(userAgent) && !/seamonkey/i.test(userAgent);
}

/** Solo enlaces HTTPS de archivos de Drive, nunca carpetas ni rutas de navegación. */
export function extractDriveLink(value: string): { id: string; resourcekey: string | null } | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.hostname !== "drive.google.com" || url.port || url.username || url.password) return null;
    const pathId = url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/(?:view|preview|edit))?\/?$/)?.[1];
    const id = pathId ?? (/^\/(?:open|uc)\/?$/.test(url.pathname) ? url.searchParams.get("id") : null);
    return id && /^[A-Za-z0-9_-]+$/.test(id)
      ? { id, resourcekey: url.searchParams.get("resourcekey") || null } : null;
  } catch {
    return null;
  }
}

export function extractDriveId(value: string): string | null {
  return extractDriveLink(value)?.id ?? null;
}

export function driveViewUrl(id: string, resourcekey: string | null = null): string {
  return driveEmbedUrl(id, resourcekey).replace("/preview", "/view");
}

export function driveEmbedUrl(id: string, resourcekey: string | null = null): string {
  const url = new URL(`https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`);
  if (resourcekey) url.searchParams.set("resourcekey", resourcekey);
  return url.href;
}
