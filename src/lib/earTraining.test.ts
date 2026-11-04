import { describe, expect, it } from "vitest";
import { generateExercise, type ExerciseType, type Level } from "./earTraining";
import { seededRng, type Rng } from "./theory/quiz";
import { getScale, scaleSemitones, type ScaleId } from "./theory/scales";

const types: ExerciseType[] = ["intervalo", "acorde", "escala"];
const levels: Level[] = [1, 2, 3];
const intervals: Record<string, number> = {
  "2m": 1, "2M": 2, "3m": 3, "3M": 4, "4J": 5, tritono: 6,
  "5J": 7, "6m": 8, "6M": 9, "7m": 10, "7M": 11, "8J": 12,
};
const chords: Record<string, number[]> = {
  mayor: [0, 4, 7], menor: [0, 3, 7], disminuido: [0, 3, 6], aumentado: [0, 4, 8],
  maj7: [0, 4, 7, 11], "7": [0, 4, 7, 10], m7: [0, 3, 7, 10], "m7♭5": [0, 3, 6, 10],
};
const scaleIds: ScaleId[] = ["jonico", "eolico", "pentaMayor", "pentaMenor", "blues", "dorico", "mixolidio", "lidio", "frigio", "menorArmonica"];

/** Fija tónica, índice de respuesta y dirección sin depender de cobertura aleatoria. */
function values(...numbers: number[]): Rng {
  let index = 0;
  return () => numbers[index++] ?? 0;
}

describe("entrenador de oído", () => {
  it("incluye una sola respuesta correcta y MIDI enteros con tónica entre 48 y 60", () => {
    for (let seed = 0; seed < 100; seed++) for (const type of types) for (const level of levels) {
      const ex = generateExercise(type, level, seededRng(seed));
      expect(ex.options.filter((option) => option.id === ex.answerId)).toHaveLength(1);
      expect(new Set(ex.options.map((option) => option.id)).size).toBe(ex.options.length);
      expect(ex.midis.every(Number.isInteger)).toBe(true);
      expect(ex.midis[0]).toBeGreaterThanOrEqual(48);
      expect(ex.midis[0]).toBeLessThanOrEqual(60);
      expect(ex.label).toContain("¿");
      expect(ex.explanation.length).toBeGreaterThan(20);
    }
    expect(generateExercise("acorde", 1, values(0)).midis[0]).toBe(48);
    expect(generateExercise("acorde", 1, values(0.9999)).midis[0]).toBe(60);
  });

  it("genera los doce intervalos con su distancia exacta en las tres direcciones", () => {
    const pool = generateExercise("intervalo", 3, values(0)).options;
    expect(pool.map((option) => option.id)).toEqual(Object.keys(intervals));
    for (let i = 0; i < pool.length; i++) for (let direction = 0; direction < 3; direction++) {
      const ex = generateExercise("intervalo", 3, values(0, (i + 0.5) / pool.length, (direction + 0.5) / 3));
      expect(ex.answerId).toBe(pool[i].id);
      expect(ex.midis.map((midi) => midi - ex.midis[0])).toEqual([0, intervals[ex.answerId] * (direction === 1 ? -1 : 1)]);
      expect(ex.playback).toBe(direction === 2 ? "armonico" : "secuencia");
      expect(ex.label).toContain(["ascendente", "descendente", "armónico"][direction]);
    }
  });

  it("limita los niveles 1 y 2 a intervalos ascendentes", () => {
    const rng = seededRng(123);
    for (const level of [1, 2] as const) for (let i = 0; i < 50; i++) {
      const ex = generateExercise("intervalo", level, rng);
      expect(ex.playback).toBe("secuencia");
      expect(ex.midis[1]).toBeGreaterThan(ex.midis[0]);
    }
  });

  it("genera todos los acordes en estado fundamental con sus semitonos exactos", () => {
    const pool = generateExercise("acorde", 3, values(0)).options;
    expect(new Set(pool.map((option) => option.id))).toEqual(new Set(Object.keys(chords)));
    pool.forEach((option, i) => {
      const ex = generateExercise("acorde", 3, values(0, (i + 0.5) / pool.length));
      expect(ex.answerId).toBe(option.id);
      expect(ex.midis.map((midi) => midi - ex.midis[0])).toEqual(chords[option.id]);
      expect(ex.playback).toBe("armonico");
    });
  });

  it("reutiliza cada fórmula de escala y añade la octava", () => {
    const pool = generateExercise("escala", 3, values(0)).options;
    expect(pool.map((option) => option.id)).toEqual(scaleIds);
    pool.forEach((option, i) => {
      const ex = generateExercise("escala", 3, values(0, (i + 0.5) / pool.length));
      const scale = getScale(option.id as ScaleId);
      expect(ex.answerId).toBe(option.id);
      expect(ex.midis).toHaveLength(scale.formula.length + 1);
      expect(ex.midis.map((midi) => midi - ex.midis[0])).toEqual([...scaleSemitones(scale), 12]);
      expect(ex.playback).toBe("secuencia");
    });
  });

  it("ofrece todas las opciones del nivel y conserva las de niveles anteriores", () => {
    const expected = {
      intervalo: [["3M", "4J", "5J", "8J"], ["2M", "3m", "3M", "4J", "5J", "6M", "7m", "8J"], Object.keys(intervals)],
      acorde: [["mayor", "menor"], ["mayor", "menor", "disminuido", "aumentado"], Object.keys(chords)],
      escala: [scaleIds.slice(0, 2), scaleIds.slice(0, 5), scaleIds],
    };
    for (const type of types) {
      let previous: string[] = [];
      for (const level of levels) {
        const ids = generateExercise(type, level, seededRng(1)).options.map((option) => option.id);
        expect(new Set(ids)).toEqual(new Set(expected[type][level - 1]));
        expect(ids.length).toBeGreaterThan(previous.length);
        expect(previous.every((id) => ids.includes(id))).toBe(true);
        previous = ids;
      }
    }
  });

  it("produce la misma serie de ejercicios con la misma semilla", () => {
    const series = (seed: number) => {
      const rng = seededRng(seed);
      return types.flatMap((type) => levels.flatMap((level) => Array.from({ length: 10 }, () => generateExercise(type, level, rng))));
    };
    expect(series(42)).toEqual(series(42));
    expect(series(42)).not.toEqual(series(43));
  });
});
