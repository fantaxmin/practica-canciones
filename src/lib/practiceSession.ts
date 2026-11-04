import { writable } from "svelte/store";
import type { Instrument } from "./types";

export interface PracticeSession {
  instrument: Instrument;
  minutes: number;
  /** Opcional: las sesiones anteriores siguen cargando sin este campo. */
  priorityArtist?: string;
  songIds: string[];
  currentIndex: number;
  practicedIds: string[];
}

const STORAGE_KEY = "practica-canciones:practice-session";

function loadSession(): PracticeSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.songIds)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const practiceSession = writable<PracticeSession | null>(loadSession());

practiceSession.subscribe((session) => {
  try {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage no disponible, no persistimos
  }
});
