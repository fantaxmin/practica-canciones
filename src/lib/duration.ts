/** Acepta "mm:ss" o solo "ss"/"m" (segundos sueltos). Devuelve null si el formato es inválido. */
export function parseMmSs(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(":");
  if (parts.length > 2 || parts.some((p) => !/^\d+$/.test(p))) return null;

  if (parts.length === 1) {
    return Number(parts[0]);
  }

  const [minutes, seconds] = parts.map(Number);
  if (seconds >= 60) return null;
  return minutes * 60 + seconds;
}

export function formatMmSs(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
