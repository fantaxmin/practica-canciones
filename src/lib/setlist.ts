import type { Instrument, Song } from "./types";

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function normalizeArtist(artist: string | undefined): string {
  return (artist ?? "").trim().toLowerCase();
}

/** Quita las canciones de los artistas excluidos (sin distinguir mayúsculas ni espacios). */
export function withoutExcludedArtists(songs: Song[], excludedArtists: readonly string[] = []): Song[] {
  if (!excludedArtists.length) return songs;
  const excluded = new Set(excludedArtists.map(normalizeArtist));
  return songs.filter((song) => !excluded.has(normalizeArtist(song.artist)));
}

/**
 * Arma un setlist aleatorio para un instrumento que no supere targetSeconds.
 * Si se indica priorityArtist, sus canciones van primero. Dentro de cada grupo
 * prioriza canciones no practicadas recientemente, pero el orden es aleatorio
 * para variar entre generaciones. Las canciones de excludedArtists nunca entran.
 */
export function generateSetlist(
  songs: Song[],
  instrument: Instrument,
  targetSeconds: number,
  priorityArtist?: string,
  excludedArtists: readonly string[] = []
): Song[] {
  if (!Number.isFinite(targetSeconds) || targetSeconds <= 0) return [];
  const candidates = withoutExcludedArtists(songs, excludedArtists).filter((s) => s.instruments[instrument] && Number.isFinite(s.durationSeconds) && s.durationSeconds > 0);

  const normalizedArtist = priorityArtist?.trim().toLowerCase();
  const priority = normalizedArtist
    ? candidates.filter((s) => s.artist?.trim().toLowerCase() === normalizedArtist)
    : [];
  const rest = normalizedArtist
    ? candidates.filter((s) => s.artist?.trim().toLowerCase() !== normalizedArtist)
    : candidates;

  // Barajar antes de ordenar conserva variación entre canciones de la misma antigüedad.
  // Nunca practicadas primero; después, bloques semanales desde la última práctica.
  const now = Date.now();
  const bucket = (song: Song) => song.lastPracticedAt === null
    ? Infinity : Math.max(0, Math.floor((now - song.lastPracticedAt) / (7 * 86400000)));
  const byFreshness = (group: Song[]) => shuffle(group).sort((a, b) => {
    const left = bucket(a);
    const right = bucket(b);
    return left === right ? 0 : left > right ? -1 : 1;
  });
  const prioritized = [...byFreshness(priority), ...byFreshness(rest)];

  const setlist: Song[] = [];
  let total = 0;
  for (const song of prioritized) {
    if (total + song.durationSeconds <= targetSeconds) {
      setlist.push(song);
      total += song.durationSeconds;
    }
  }

  return setlist;
}
