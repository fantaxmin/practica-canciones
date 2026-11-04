import { describe, expect, it } from "vitest";
import { BASS_PROGRESSIONS, BASS_STYLES, bassMovement, generateBassLine } from "./bassLines";
import { BASS_EADG } from "./theory/fretboard";
import { ROOTS, mod, pitchClass } from "./theory/notes";
import { diatonicChords } from "./theory/relatives";

const intervals = { mayor: [0, 4, 7], menor: [0, 3, 7], disminuido: [0, 3, 6], aumentado: [0, 4, 8] };

describe("laboratorio de líneas de bajo", () => {
  for (const progression of BASS_PROGRESSIONS) for (const style of BASS_STYLES) {
    it(`${progression.label} / ${style.label}: armonía, pulso, registro y digitación en todas las tónicas`, () => {
      for (const root of ROOTS) {
        const line = generateBassLine(root, progression.id, style.id);
        const harmony = diatonicChords(root, progression.mode);
        expect(line.bars.map((bar) => bar.chord)).toEqual(progression.degrees.map((degree) => harmony[degree - 1]));
        line.bars.forEach((bar, i) => {
          expect(bar.notes.map((note) => note.grado)).toEqual(style.pattern);
          expect(bar.notes.map((note) => note.tiempo)).toEqual([0, 1, 2, 3]);
          expect(bar.notes.reduce((sum, note) => sum + note.duracion, 0)).toBe(4);
          const base = bar.notes[0].midi;
          bar.notes.forEach((note) => {
            expect(Number.isInteger(note.midi)).toBe(true);
            expect(note.midi).toBeGreaterThanOrEqual(28);
            expect(note.midi).toBeLessThanOrEqual(55);
            expect(Number.isInteger(note.cuerda)).toBe(true);
            expect(note.cuerda).toBeGreaterThanOrEqual(0);
            expect(note.cuerda).toBeLessThan(4);
            expect(Number.isInteger(note.traste)).toBe(true);
            expect(note.traste).toBeGreaterThanOrEqual(0);
            expect(note.traste).toBeLessThanOrEqual(12);
            expect(note.midi).toBe(BASS_EADG.strings[note.cuerda] + note.traste);
            expect(note.duracion).toBe(1);
            if (note.grado === "aprox") {
              const next = line.bars[(i + 1) % line.bars.length].notes[0];
              expect(Math.abs(note.midi - next.midi)).toBe(1);
              expect(note.tiempo).toBe(3);
            } else {
              expect(intervals[bar.chord.triad]).toContain(mod(note.midi - pitchClass(bar.chord.root), 12));
              const expected = { R: 0, "3": intervals[bar.chord.triad][1], "5": intervals[bar.chord.triad][2], "8": 12 }[note.grado];
              expect(note.midi - base).toBe(expected);
            }
          });
        });
      }
    });
  }

  it("produce la misma digitación y no modifica sus entradas ni resultados anteriores", () => {
    const root = Object.freeze({ letter: 0, accidental: 0 });
    const original = generateBassLine(root, "pop", "approach");
    const snapshot = structuredClone(original);
    expect(generateBassLine(root, "pop", "approach")).toEqual(original);
    original.bars[0].notes[0].midi = 0;
    expect(generateBassLine(root, "pop", "approach")).toEqual(snapshot);
  });

  it("minimiza el coste de digitación de I–V frente a todas las posiciones posibles", () => {
    // Oráculo independiente y exhaustivo para dos compases de fundamentales.
    const line = generateBassLine(ROOTS[0]);
    const candidates = line.bars.map((bar) => BASS_EADG.strings.flatMap((open, cuerda) =>
      Array.from({ length: 13 }, (_, traste) => ({ midi: open + traste, cuerda, traste, grado: "R" as const, tiempo: 0, duracion: 1 }))
        .filter((note) => note.midi <= 43 && mod(note.midi, 12) === pitchClass(bar.chord.root))));
    const costs = candidates[0].flatMap((a) => candidates[1].map((b) => 2 * bassMovement(a, b) + (a.traste + b.traste) * 4 * 0.05));
    const notes = line.bars.flatMap((bar) => bar.notes);
    const actual = notes.reduce((sum, note, i) => sum + bassMovement(note, notes[(i + 1) % notes.length]) + note.traste * 0.05, 0);
    expect(actual).toBeCloseTo(Math.min(...costs));
  });

  it("rechaza progresiones desconocidas", () => {
    expect(() => generateBassLine(ROOTS[0], "inexistente")).toThrow(RangeError);
  });
});
