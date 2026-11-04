import { describe, expect, it } from "vitest";
import { BASS_EADG, GUITAR_EADGBE } from "./theory/fretboard";
import { noteName, pitchClass } from "./theory/notes";
import { seededRng } from "./theory/quiz";
import { LEVELS, checkSelection, generateChallenge, positionsOf, spelledFor, spotMidi, stringName, type FinderLevel, type FinderMode } from "./noteFinder";

describe("posiciones en el bajo", () => {
  it("todos los Do entre trastes 0 y 12", () => {
    expect(positionsOf(BASS_EADG, 0, 12)).toEqual([
      { string: 0, fret: 8 }, { string: 1, fret: 3 }, { string: 2, fret: 10 }, { string: 3, fret: 5 },
    ]);
  });
  it("cuerda al aire y traste 12 son la misma nota", () => {
    const mi = positionsOf(BASS_EADG, 4, 12, 0);
    expect(mi).toEqual([{ string: 0, fret: 0 }, { string: 0, fret: 12 }]);
  });
  it("nombres de cuerdas y escritura cromática", () => {
    expect([0, 1, 2, 3].map((s) => stringName(BASS_EADG, s, "english"))).toEqual(["E", "A", "D", "G"]);
    expect([1, 3, 6, 8, 10].map((pc) => noteName(spelledFor(pc), "english"))).toEqual(["C♯", "E♭", "F♯", "A♭", "B♭"]);
  });
});

describe("retos", () => {
  const modes: FinderMode[] = ["todas", "cuerda", "nombrar"];
  it("los objetivos siempre suenan como la nota y respetan el nivel", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seededRng(seed);
      for (const level of [1, 2, 3] as FinderLevel[]) for (const mode of modes) for (const tuning of [BASS_EADG, GUITAR_EADGBE]) {
        const c = generateChallenge(mode, level, tuning, rng);
        expect(c.targets.length).toBeGreaterThan(0);
        for (const t of c.targets) {
          expect(spotMidi(tuning, t) % 12).toBe(pitchClass(c.note));
          expect(t.fret).toBeLessThanOrEqual(LEVELS[level].maxFret);
        }
        if (LEVELS[level].naturalsOnly) expect(c.note.accidental).toBe(0);
        if (mode === "cuerda") expect(c.targets.every((t) => t.string === c.string)).toBe(true);
        if (mode === "nombrar") {
          expect(c.options).toContain(noteName(c.note));
          expect(new Set(c.options).size).toBe(c.options!.length);
        }
      }
    }
  });
  it("repasa notas falladas con frecuencia", () => {
    const rng = seededRng(9);
    const hits = Array.from({ length: 200 }, () => generateChallenge("todas", 2, BASS_EADG, rng, [5])).filter((c) => pitchClass(c.note) === 5).length;
    expect(hits).toBeGreaterThan(80);
  });
});

describe("comprobar selección", () => {
  const challenge = generateChallenge("todas", 2, BASS_EADG, () => 0); // primera natural: Do
  it("perfecta", () => {
    expect(checkSelection(challenge, challenge.targets).perfect).toBe(true);
  });
  it("detecta errores y faltantes", () => {
    const r = checkSelection(challenge, [challenge.targets[0], { string: 0, fret: 1 }]);
    expect(r.hits).toHaveLength(1);
    expect(r.wrong).toEqual([{ string: 0, fret: 1 }]);
    expect(r.missed).toHaveLength(challenge.targets.length - 1);
    expect(r.perfect).toBe(false);
  });
});
