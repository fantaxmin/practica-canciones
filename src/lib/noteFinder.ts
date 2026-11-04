import { ROOTS, mod, noteName, pitchClass, type Notation, type PitchClass, type SpelledNote } from "./theory/notes";
import type { Tuning } from "./theory/fretboard";
import type { Rng } from "./theory/quiz";

export type FinderMode = "todas" | "cuerda" | "nombrar";
export type FinderLevel = 1 | 2 | 3;

export type SpotState = "selected" | "correct" | "wrong" | "missed" | "target";

export interface FretSpot {
  string: number;
  fret: number;
}

export interface FinderChallenge {
  mode: FinderMode;
  /** Nota buscada (o la que hay que nombrar). */
  note: SpelledNote;
  /** Solo en "cuerda". */
  string?: number;
  /** Solo en "nombrar": la posición marcada. */
  spot?: FretSpot;
  /** Posiciones correctas dentro del rango de trastes del nivel. */
  targets: FretSpot[];
  maxFret: number;
  /** Solo en "nombrar": nombres posibles. */
  options?: string[];
}

export const LEVELS: Record<FinderLevel, { label: string; maxFret: number; naturalsOnly: boolean }> = {
  1: { label: "Naturales · trastes 0–5", maxFret: 5, naturalsOnly: true },
  2: { label: "Naturales · trastes 0–12", maxFret: 12, naturalsOnly: true },
  3: { label: "Todas · trastes 0–12", maxFret: 12, naturalsOnly: false },
};

/** Una escritura por clase de altura: sostenidos en Do♯ y Fa♯, bemoles en el resto (lo usual en bajo). */
const CHROMATIC: SpelledNote[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((pc) =>
  ROOTS.find((r) => pitchClass(r) === pc && (r.accidental === 0 || [1, 6].includes(pc) === (r.accidental === 1)))!);

export function spelledFor(pc: PitchClass): SpelledNote {
  return CHROMATIC[mod(pc, 12)];
}

export function spotKey(spot: FretSpot): string {
  return `${spot.string}-${spot.fret}`;
}

export function spotMidi(tuning: Tuning, spot: FretSpot): number {
  return tuning.strings[spot.string] + spot.fret;
}

export function positionsOf(tuning: Tuning, pc: PitchClass, maxFret: number, onlyString?: number): FretSpot[] {
  const spots: FretSpot[] = [];
  tuning.strings.forEach((open, string) => {
    if (onlyString !== undefined && string !== onlyString) return;
    for (let fret = 0; fret <= maxFret; fret++) if (mod(open + fret - pc, 12) === 0) spots.push({ string, fret });
  });
  return spots;
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/**
 * Elige una nota del nivel. Con `review` (notas falladas antes) hay 50 % de
 * probabilidad de repasar una de ellas, si es válida en este nivel.
 */
function chooseNote(rng: Rng, level: FinderLevel, review: PitchClass[]): SpelledNote {
  const pool = CHROMATIC.filter((note) => !LEVELS[level].naturalsOnly || note.accidental === 0);
  const reviewable = pool.filter((note) => review.includes(pitchClass(note)));
  return reviewable.length && rng() < 0.5 ? pick(rng, reviewable) : pick(rng, pool);
}

export function generateChallenge(mode: FinderMode, level: FinderLevel, tuning: Tuning, rng: Rng = Math.random, review: PitchClass[] = [], notation: Notation = "latin"): FinderChallenge {
  const { maxFret, naturalsOnly } = LEVELS[level];
  const note = chooseNote(rng, level, review);
  const pc = pitchClass(note);
  if (mode === "todas") return { mode, note, targets: positionsOf(tuning, pc, maxFret), maxFret };
  if (mode === "cuerda") {
    // Solo cuerdas donde la nota aparece dentro del rango (siempre hay al menos una en 0–11).
    const strings = tuning.strings.map((_, i) => i).filter((s) => positionsOf(tuning, pc, maxFret, s).length);
    const string = pick(rng, strings);
    return { mode, note, string, targets: positionsOf(tuning, pc, maxFret, string), maxFret };
  }
  const spot = pick(rng, positionsOf(tuning, pc, maxFret));
  const options = CHROMATIC.filter((n) => !naturalsOnly || n.accidental === 0).map((n) => noteName(n, notation));
  return { mode, note, spot, targets: [spot], maxFret, options };
}

export interface SelectionResult {
  hits: FretSpot[];
  wrong: FretSpot[];
  missed: FretSpot[];
  perfect: boolean;
}

export function checkSelection(challenge: FinderChallenge, selected: FretSpot[]): SelectionResult {
  const targetKeys = new Set(challenge.targets.map(spotKey));
  const selectedKeys = new Set(selected.map(spotKey));
  const hits = selected.filter((s) => targetKeys.has(spotKey(s)));
  const wrong = selected.filter((s) => !targetKeys.has(spotKey(s)));
  const missed = challenge.targets.filter((t) => !selectedKeys.has(spotKey(t)));
  return { hits, wrong, missed, perfect: wrong.length === 0 && missed.length === 0 };
}

export function stringName(tuning: Tuning, string: number, notation: Notation = "latin"): string {
  return noteName(spelledFor(tuning.strings[string]), notation);
}
