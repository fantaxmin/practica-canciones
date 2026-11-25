import type { Instrument, Song } from "./types";

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
 * pondera canciones no practicadas recientemente, pero el orden es aleatorio
 * para variar entre generaciones. Las canciones de excludedArtists nunca entran.
 */
export function generateSetlist(
  songs: Song[],
  instrument: Instrument,
  targetSeconds: number,
  priorityArtist?: string,
  excludedArtists: readonly string[] = [],
  options: { previousIds?: readonly string[] } = {}
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

  // Carrera exponencial: mayor antigüedad aumenta la probabilidad, sin buckets.
  const now = Date.now();
  const weighted = (group: Song[]) => group.map((song) => {
    const weeks = song.lastPracticedAt == null ? 12 : Math.max(0, (now - song.lastPracticedAt) / (7 * 86400000));
    const weight = 1 + Math.min(12, weeks);
    return { song, rank: -Math.log(Math.max(Number.EPSILON, Math.random())) / weight };
  }).sort((a, b) => a.rank - b.rank).map(({ song }) => song);
  const previous = new Set(options.previousIds ?? []);
  const sameOrder = (hand: Song[]) => hand.length === options.previousIds?.length
    && hand.every((song, index) => song.id === options.previousIds?.[index]);
  let best: Song[] = [];
  let bestOverlap = Infinity;
  let bestPriority = -1;
  const attempts = previous.size ? 64 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const rotate = (group: Song[]) => {
      const ordered = weighted(group);
      const offset = attempt % Math.max(1, ordered.length);
      return [...ordered.slice(offset), ...ordered.slice(0, offset)];
    };
    const hand: Song[] = [];
    let total = 0;
    for (const song of [...rotate(priority), ...rotate(rest)]) {
      if (total + song.durationSeconds <= targetSeconds) {
        hand.push(song);
        total += song.durationSeconds;
      }
    }
    const priorityCount = hand.filter((song) => normalizeArtist(song.artist) === normalizedArtist).length;
    const overlap = hand.filter((song) => previous.has(song.id)).length;
    if (priorityCount > bestPriority || (priorityCount === bestPriority && (
      overlap < bestOverlap || (overlap === bestOverlap && (
        hand.length > best.length || (hand.length === best.length && sameOrder(best) && !sameOrder(hand))
      ))
    ))) {
      best = hand;
      bestOverlap = overlap;
      bestPriority = priorityCount;
    }
  }
  // Incluso con un RNG constante, variar el orden cuando no cambia el conjunto.
  if (sameOrder(best) && best.length > 1) {
    const index = best.findIndex((song, i) => i > 0
      && (normalizeArtist(song.artist) === normalizedArtist) === (normalizeArtist(best[i - 1].artist) === normalizedArtist));
    if (index > 0) [best[index - 1], best[index]] = [best[index], best[index - 1]];
  }
  return best;
}
