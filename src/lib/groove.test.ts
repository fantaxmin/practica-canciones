import { describe, expect, it } from "vitest";
import { GROOVES, barCells, stepMidi } from "./groove";

describe("biblioteca de grooves para bajo", () => {
  it("contiene identificadores únicos y compases completos de 4 tiempos", () => {
    expect(new Set(GROOVES.map((g) => g.id)).size).toBe(GROOVES.length);
    for (const groove of GROOVES) {
      expect(groove.bars.length).toBeGreaterThanOrEqual(1);
      expect(groove.bars.length).toBeLessThanOrEqual(2);
      expect(groove.bpm).toBeGreaterThanOrEqual(40);
      expect(groove.bpm).toBeLessThanOrEqual(200);
      for (const bar of groove.bars) {
        expect(bar.reduce((sum, step) => sum + step.duration, 0), groove.id).toBe(4);
        for (const step of bar) {
          expect(step.duration).toBeGreaterThan(0);
          expect(Number.isInteger(step.duration * groove.subdivision)).toBe(true);
          if (step.note) {
            expect(step.note.string).toBeGreaterThanOrEqual(0);
            expect(step.note.string).toBeLessThanOrEqual(3);
            expect(Number.isInteger(step.note.fret)).toBe(true);
            expect(step.note.fret).toBeGreaterThanOrEqual(0);
            expect(stepMidi(step)).toBeGreaterThanOrEqual(28);
            expect(stepMidi(step)).toBeLessThanOrEqual(55);
          } else expect(stepMidi(step)).toBeNull();
          if (step.ghost) expect(step.note).not.toBeNull();
        }
      }
    }
  });

  it("introduce progresivamente negras, silencios, saltos, síncopas y notas muertas", () => {
    expect([...new Set(GROOVES.map((g) => g.level))]).toEqual([1, 2, 3, 4, 5]);
    const steps = (level: number) => GROOVES.filter((g) => g.level === level).flatMap((g) => g.bars.flat());
    expect(steps(1).every((s) => s.duration === 1 && s.note?.string === 0 && s.note.fret === 0)).toBe(true);
    expect(steps(2).some((s) => s.note === null)).toBe(true);
    expect(steps(2).some((s) => s.duration === .5)).toBe(true);
    expect(new Set(steps(3).map(stepMidi))).toEqual(new Set([28, 35, 40, null]));
    expect(steps(4).some((s) => s.duration === .25)).toBe(true);
    expect(GROOVES.filter((g) => g.level === 4).every((g) => g.bars.some((bar) => {
      let offset = 0;
      return bar.some((s) => { const start = offset; offset += s.duration; return s.note && start % 1 !== 0 && start % 1 + s.duration > 1; });
    }))).toBe(true);
    expect(steps(5).some((s) => s.ghost)).toBe(true);
    expect(GROOVES.filter((g) => g.level < 5).every((g) => g.bars.flat().every((s) => !s.ghost))).toBe(true);
  });

  it("expande la tablatura sin duplicar los ataques de notas sostenidas", () => {
    for (const groove of GROOVES) for (const bar of groove.bars) {
      const cells = barCells(bar, groove.subdivision);
      expect(cells).toHaveLength(4 * groove.subdivision);
      expect(cells.filter((c) => c.onset).map((c) => c.step)).toEqual(bar);
    }
  });
});
