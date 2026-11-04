import { writable } from "svelte/store";
import type { Notation } from "./theory/notes";

export type WarmupKind = "quiz" | "rutina" | "oido" | "groove" | "notas" | "lineas";

export interface WarmupEvent {
  id: string;
  kind: WarmupKind;
  at: number;
  /** Aciertos (quiz y oído). */
  score?: number;
  total?: number;
  /** Resumen legible, p. ej. "Sol mayor → Mi menor → …". */
  detail?: string;
}

const LOG_KEY = "practica-canciones:warmup-log";
const NOTATION_KEY = "practica-canciones:notation";

function loadLog(): WarmupEvent[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((e) => e && typeof e.at === "number" && typeof e.kind === "string") : [];
  } catch {
    return [];
  }
}

export const warmupLog = writable<WarmupEvent[]>(loadLog());

warmupLog.subscribe((events) => {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(events));
  } catch {
    // localStorage no disponible, no persistimos
  }
});

export function logWarmup(event: Omit<WarmupEvent, "id" | "at">): void {
  warmupLog.update((events) => [...events, { ...event, id: crypto.randomUUID(), at: Date.now() }]);
}

function loadNotation(): Notation {
  try {
    return localStorage.getItem(NOTATION_KEY) === "english" ? "english" : "latin";
  } catch {
    return "latin";
  }
}

/** Do-Re-Mi o C-D-E, compartido por todo el calentamiento. */
export const notation = writable<Notation>(loadNotation());

notation.subscribe((value) => {
  try {
    localStorage.setItem(NOTATION_KEY, value);
  } catch {
    // localStorage no disponible, no persistimos
  }
});
