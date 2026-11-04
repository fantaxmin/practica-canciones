import type { Instrument } from "../types";
import { mod, pitchClass, type SpelledNote } from "./notes";
import { buildScale, getScale, type ScaleId } from "./scales";

export interface Tuning {
  id: Instrument;
  name: string;
  /** MIDI de las cuerdas al aire, de la más grave a la más aguda. */
  strings: number[];
}

export const BASS_EADG: Tuning = { id: "bajo", name: "Bajo 4 cuerdas (Mi La Re Sol)", strings: [28, 33, 38, 43] };
export const GUITAR_EADGBE: Tuning = { id: "guitarra", name: "Guitarra (Mi La Re Sol Si Mi)", strings: [40, 45, 50, 55, 59, 64] };

export function tuningFor(instrument: Instrument): Tuning {
  return instrument === "bajo" ? BASS_EADG : GUITAR_EADGBE;
}

export interface FretPosition {
  string: number;
  fret: number;
  midi: number;
  note: SpelledNote;
  /** Grado de la escala ("1", "b3"…). */
  degree: string;
  isRoot: boolean;
}

export function scalePositions(tuning: Tuning, root: SpelledNote, id: ScaleId, maxFret = 12): FretPosition[] {
  const notes = buildScale(root, id);
  const formula = getScale(id).formula;
  const byPc = new Map(notes.map((note, i) => [pitchClass(note), i]));
  const positions: FretPosition[] = [];
  tuning.strings.forEach((open, string) => {
    for (let fret = 0; fret <= maxFret; fret++) {
      const index = byPc.get(mod(open + fret, 12));
      if (index === undefined) continue;
      positions.push({ string, fret, midi: open + fret, note: notes[index], degree: formula[index], isRoot: index === 0 });
    }
  });
  return positions;
}

/** MIDI de la escala ascendente más una octava, en el registro del instrumento. */
export function scaleMidi(instrument: Instrument, root: SpelledNote, id: ScaleId): number[] {
  const base = (instrument === "bajo" ? 36 : 48) + pitchClass(root);
  const notes = buildScale(root, id).map(pitchClass);
  const rootPc = pitchClass(root);
  return [...notes.map((pc) => base + mod(pc - rootPc, 12)), base + 12];
}
