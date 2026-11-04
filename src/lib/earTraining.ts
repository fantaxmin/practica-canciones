import type { Rng } from "./theory/quiz";
import { formatDegree, getScale, scaleLabel, scaleSemitones, type ScaleId } from "./theory/scales";

export type ExerciseType = "intervalo" | "acorde" | "escala";
export type Level = 1 | 2 | 3;
export type Direction = "ascendente" | "descendente" | "armónico";

export interface Exercise {
  type: ExerciseType;
  label: string;
  options: { id: string; label: string }[];
  answerId: string;
  midis: number[];
  playback: "secuencia" | "armonico";
  explanation: string;
}

export const INTERVALS = [
  { id: "2m", label: "Segunda menor", semitones: 1, level: 3 },
  { id: "2M", label: "Segunda mayor", semitones: 2, level: 2 },
  { id: "3m", label: "Tercera menor", semitones: 3, level: 2 },
  { id: "3M", label: "Tercera mayor", semitones: 4, level: 1 },
  { id: "4J", label: "Cuarta justa", semitones: 5, level: 1 },
  { id: "tritono", label: "Tritono", semitones: 6, level: 3 },
  { id: "5J", label: "Quinta justa", semitones: 7, level: 1 },
  { id: "6m", label: "Sexta menor", semitones: 8, level: 3 },
  { id: "6M", label: "Sexta mayor", semitones: 9, level: 2 },
  { id: "7m", label: "Séptima menor", semitones: 10, level: 2 },
  { id: "7M", label: "Séptima mayor", semitones: 11, level: 3 },
  { id: "8J", label: "Octava justa", semitones: 12, level: 1 },
] as const;

export const CHORDS = [
  { id: "mayor", label: "Mayor", semitones: [0, 4, 7], level: 1 },
  { id: "menor", label: "Menor", semitones: [0, 3, 7], level: 1 },
  { id: "disminuido", label: "Disminuido", semitones: [0, 3, 6], level: 2 },
  { id: "aumentado", label: "Aumentado", semitones: [0, 4, 8], level: 2 },
  { id: "maj7", label: "Mayor séptima (maj7)", semitones: [0, 4, 7, 11], level: 3 },
  { id: "7", label: "Séptima dominante (7)", semitones: [0, 4, 7, 10], level: 3 },
  { id: "m7", label: "Menor séptima (m7)", semitones: [0, 3, 7, 10], level: 3 },
  { id: "m7♭5", label: "Semidisminuido (m7♭5)", semitones: [0, 3, 6, 10], level: 3 },
] as const;

const SCALE_LEVELS: { id: ScaleId; level: Level }[] = [
  { id: "jonico", level: 1 }, { id: "eolico", level: 1 },
  { id: "pentaMayor", level: 2 }, { id: "pentaMenor", level: 2 }, { id: "blues", level: 2 },
  { id: "dorico", level: 3 }, { id: "mixolidio", level: 3 }, { id: "lidio", level: 3 },
  { id: "frigio", level: 3 }, { id: "menorArmonica", level: 3 },
];

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

/** Generación pura: todo el azar procede del RNG recibido; no reproduce audio. */
export function generateExercise(type: ExerciseType, level: Level, rng: Rng): Exercise {
  const tonic = 48 + Math.floor(rng() * 13);
  if (type === "intervalo") {
    const pool = INTERVALS.filter((item) => item.level <= level);
    const answer = pick(pool, rng);
    const direction: Direction = level === 3
      ? pick(["ascendente", "descendente", "armónico"] as const, rng)
      : "ascendente";
    return {
      type, label: `¿Qué intervalo ${direction} escuchas?`,
      options: pool.map(({ id, label }) => ({ id, label })), answerId: answer.id,
      midis: [tonic, tonic + (direction === "descendente" ? -answer.semitones : answer.semitones)],
      playback: direction === "armónico" ? "armonico" : "secuencia",
      explanation: `${answer.label} (${answer.id}): ${answer.semitones} semitonos de distancia. ${direction === "armónico" ? "Las dos notas suenan a la vez." : `La segunda nota es más ${direction === "ascendente" ? "aguda" : "grave"} que la primera.`}`,
    };
  }
  if (type === "acorde") {
    const pool = CHORDS.filter((item) => item.level <= level);
    const answer = pick(pool, rng);
    return {
      type, label: "¿Qué acorde escuchas?",
      options: pool.map(({ id, label }) => ({ id, label })), answerId: answer.id,
      midis: answer.semitones.map((offset) => tonic + offset), playback: "armonico",
      explanation: `${answer.label}: ${answer.semitones.join(" · ")} semitonos desde la fundamental. Está en estado fundamental: la nota más grave es la raíz.`,
    };
  }
  const pool = SCALE_LEVELS.filter((item) => item.level <= level).map(({ id }) => getScale(id));
  const answer = pick(pool, rng);
  return {
    type, label: "¿Qué escala escuchas?",
    options: pool.map((scale) => ({ id: scale.id, label: scaleLabel(scale) })), answerId: answer.id,
    midis: [...scaleSemitones(answer), 12].map((offset) => tonic + offset), playback: "secuencia",
    explanation: `${scaleLabel(answer)}: ${answer.formula.map(formatDegree).join(" · ")} y la octava. ${answer.description}`,
  };
}
