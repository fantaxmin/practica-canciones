import { writable } from "svelte/store";
import type { Instrument } from "./types";

export interface PracticeSession {
  stage: "deal" | "warmup" | "playing" | "complete";
  instrument: Instrument;
  minutes: number;
  /** Opcional: las sesiones anteriores siguen cargando sin este campo. */
  priorityArtist?: string;
  /** Opcional: artistas retirados al generar este setlist. */
  excludedArtists?: string[];
  songIds: string[];
  currentIndex: number;
  practicedIds: string[];
  /** Opcional: calentamiento antes de la primera canción. */
  warmup?: "pending" | "done" | "skipped";
}

/** Normaliza tanto sesiones persistidas como sesiones de respaldos antiguos. */
export function migratePracticeSession(value: unknown): PracticeSession | null {
  if (!value || typeof value !== "object") return null;
  const data = value as PracticeSession;
  if (!Array.isArray(data.songIds) || !data.songIds.every((id) => typeof id === "string")) return null;
  if (data.instrument !== "bajo" && data.instrument !== "guitarra") return null;
  const currentIndex = Number.isInteger(data.currentIndex) ? Math.max(0, Math.min(data.currentIndex, data.songIds.length)) : 0;
  const stage = ["deal", "warmup", "playing", "complete"].includes(data.stage) ? data.stage
    : data.warmup === "pending" ? "warmup" : currentIndex >= data.songIds.length ? "complete" : "playing";
  return { ...data, currentIndex, stage,
    practicedIds: Array.isArray(data.practicedIds) ? [...new Set(data.practicedIds.filter((id) => data.songIds.includes(id)))] : [] };
}

const STORAGE_KEY = "practica-canciones:practice-session";

function loadSession(): PracticeSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return migratePracticeSession(parsed);
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
