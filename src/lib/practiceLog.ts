import { writable } from "svelte/store";

export interface PracticeEvent {
  id: string;
  songId: string;
  songTitle: string;
  durationSeconds: number;
  at: number;
}

const STORAGE_KEY = "practica-canciones:practice-log";

function loadLog(): PracticeEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const practiceLog = writable<PracticeEvent[]>(loadLog());

practiceLog.subscribe((events) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // localStorage no disponible, no persistimos
  }
});

export function logPractice(songId: string, songTitle: string, durationSeconds: number): void {
  practiceLog.update((events) => [
    ...events,
    { id: crypto.randomUUID(), songId, songTitle, durationSeconds, at: Date.now() },
  ]);
}
