import type { Song } from "./types";
import type { PracticeEvent } from "./practiceLog";

const ONE_DAY_MS = 86400000;

function startOfDay(timestamp: number): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Días consecutivos con al menos una práctica, terminando hoy o ayer (si no, la racha está rota). */
export function computeStreak(events: PracticeEvent[]): number {
  if (events.length === 0) return 0;

  const days = [...new Set(events.map((e) => startOfDay(e.at)))].sort((a, b) => b - a);
  const today = startOfDay(Date.now());
  const diffFromToday = Math.round((today - days[0]) / ONE_DAY_MS);
  if (diffFromToday > 1) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = Math.round((days[i - 1] - days[i]) / ONE_DAY_MS);
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function totalPracticeSeconds(events: PracticeEvent[]): number {
  return events.reduce((sum, e) => sum + e.durationSeconds, 0);
}

export interface TopSong {
  songId: string;
  title: string;
  count: number;
}

export function topSongs(events: PracticeEvent[], limit: number): TopSong[] {
  const counts = new Map<string, TopSong>();
  for (const e of events) {
    const existing = counts.get(e.songId);
    if (existing) {
      existing.count++;
    } else {
      counts.set(e.songId, { songId: e.songId, title: e.songTitle, count: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}


export interface DailyMinutes {
  /** Fecha local ISO, sin convertirla a UTC. */
  date: string;
  at: number;
  minutes: number;
}

/** Incluye hoy y los días anteriores, con ceros donde no hay prácticas. */
export function dailyMinutes(events: PracticeEvent[], days: number, now = Date.now()): DailyMinutes[] {
  if (!Number.isFinite(days) || days < 1) return [];
  const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const result: DailyMinutes[] = [];
  for (let offset = Math.floor(days) - 1; offset >= 0; offset--) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - offset);
    result.push({ date: dateKey(day), at: day.getTime(), minutes: 0 });
  }
  const byDate = new Map(result.map((day) => [day.date, day]));
  for (const event of events) {
    if (!Number.isFinite(event.at) || event.at > now || !Number.isFinite(event.durationSeconds) || event.durationSeconds < 0) continue;
    const day = byDate.get(dateKey(new Date(event.at)));
    if (day) day.minutes += event.durationSeconds / 60;
  }
  return result;
}

/** Nunca practicadas primero; después, las fechas de práctica más antiguas. No muta el repertorio. */
export function staleSongs(songs: Song[], limit: number): Song[] {
  return [...songs].sort((a, b) => {
    if (a.lastPracticedAt === b.lastPracticedAt) return a.title.localeCompare(b.title, "es");
    if (a.lastPracticedAt === null) return -1;
    if (b.lastPracticedAt === null) return 1;
    return a.lastPracticedAt - b.lastPracticedAt;
  }).slice(0, Math.max(0, Math.floor(limit)));
}
