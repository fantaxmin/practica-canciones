import { ROOTS, noteName, pitchClass, type Notation, type SpelledNote } from "./notes";
import { MODE_ORDER, SCALES, buildScale, formatDegree, getScale, scaleLabel, type ScaleId } from "./scales";
import { diatonicChords, parentMajor, relativeMajor, relativeMinor, seventhName } from "./relatives";

export type Rng = () => number;

/** PRNG determinista (mulberry32), para poder repetir un quiz en los tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface QuizQuestion {
  kind: QuestionKind;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
}

export type QuestionKind = "relativaMenor" | "relativaMayor" | "notasEscala" | "formula" | "acordeModo" | "grado" | "escalaMadre";

const KINDS: QuestionKind[] = ["relativaMenor", "relativaMayor", "notasEscala", "formula", "acordeModo", "grado", "escalaMadre"];

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function shuffle<T>(rng: Rng, items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Arma 4 opciones distintas con la correcta una sola vez. */
function withOptions(rng: Rng, correct: string, pool: string[], count = 4): { options: string[]; answer: number } {
  const distractors = shuffle(rng, [...new Set(pool.filter((option) => option !== correct))]).slice(0, count - 1);
  const options = shuffle(rng, [correct, ...distractors]);
  return { options, answer: options.indexOf(correct) };
}

/** Tónicas "amigables": evitamos las que producen dobles alteraciones en modos menores. */
const QUIZ_ROOTS = ROOTS.filter((root) => Math.abs(root.accidental) <= 1);

function names(notes: SpelledNote[], notation: Notation): string {
  return notes.map((note) => noteName(note, notation)).join(" ");
}

/** Nombres de tónicas como distractores, sin enarmonías de la respuesta (Do♯ no compite con Re♭). */
function noteOptions(rng: Rng, correct: SpelledNote, notation: Notation, suffix = ""): { options: string[]; answer: number } {
  const pool = ROOTS.filter((root) => pitchClass(root) !== pitchClass(correct)).map((root) => noteName(root, notation) + suffix);
  return withOptions(rng, noteName(correct, notation) + suffix, pool);
}

function build(kind: QuestionKind, rng: Rng, n: Notation): QuizQuestion {
  switch (kind) {
    case "relativaMenor": {
      const root = pick(rng, QUIZ_ROOTS.filter((r) => r.accidental <= 0 || r.letter === 3));
      const minor = relativeMinor(root);
      const correct = noteName(minor, n);
      return {
        kind, prompt: `¿Cuál es la relativa menor de ${noteName(root, n)} mayor?`,
        ...noteOptions(rng, minor, n),
        explanation: `La relativa menor está en el 6º grado de la mayor (3 semitonos abajo de la tónica): ${noteName(root, n)} mayor → ${correct} menor. Comparten todas las notas.`,
      };
    }
    case "relativaMayor": {
      const root = pick(rng, QUIZ_ROOTS);
      const major = relativeMajor(root);
      const correct = noteName(major, n);
      return {
        kind, prompt: `¿Cuál es la relativa mayor de ${noteName(root, n)} menor?`,
        ...noteOptions(rng, major, n),
        explanation: `La relativa mayor está una 3ª menor arriba (3 semitonos): ${noteName(root, n)} menor → ${correct} mayor.`,
      };
    }
    case "notasEscala": {
      const root = pick(rng, QUIZ_ROOTS);
      const ids: ScaleId[] = ["jonico", "eolico", "dorico", "mixolidio", "pentaMenor", "pentaMayor"];
      const id = pick(rng, ids);
      const scale = getScale(id);
      const correct = names(buildScale(root, id), n);
      // Distractores con la misma cantidad de notas, para que no se adivine contando.
      const sameRoot = [...new Set(SCALES.filter((s) => s.formula.length === scale.formula.length).map((s) => names(buildScale(root, s.id), n)))]
        .filter((option) => option !== correct);
      // Si no alcanzan (pentatónicas), completamos con la misma escala desde otras tónicas.
      const others = shuffle(rng, QUIZ_ROOTS.filter((r) => pitchClass(r) !== pitchClass(root)).map((r) => names(buildScale(r, id), n)));
      const distractors = [...shuffle(rng, sameRoot), ...others].filter((option, i, all) => all.indexOf(option) === i).slice(0, 3);
      const options = shuffle(rng, [correct, ...distractors]);
      return {
        kind, prompt: `¿Qué notas tiene ${noteName(root, n)} ${scaleLabel(scale).toLowerCase()}?`,
        options, answer: options.indexOf(correct),
        explanation: `Fórmula ${scale.formula.map(formatDegree).join(" ")} desde ${noteName(root, n)}: ${correct}.`,
      };
    }
    case "formula": {
      const scale = pick(rng, SCALES.filter((s) => s.formula.length === 7));
      const correct = scaleLabel(scale);
      return {
        kind, prompt: `¿Qué escala tiene la fórmula ${scale.formula.map(formatDegree).join(" ")}?`,
        ...withOptions(rng, correct, SCALES.filter((s) => s.formula.length === 7).map(scaleLabel)),
        explanation: `${correct}: ${scale.description}`,
      };
    }
    case "acordeModo": {
      const key = pick(rng, QUIZ_ROOTS.filter((r) => r.accidental <= 0 || r.letter === 3));
      const chords = diatonicChords(key, "jonico");
      const chord = pick(rng, chords);
      const mode = getScale(chord.mode!);
      return {
        kind, prompt: `En ${noteName(key, n)} mayor suena ${seventhName(chord, n)} (${chord.roman}). ¿Qué modo encaja de forma natural sobre él?`,
        ...withOptions(rng, scaleLabel(mode), MODE_ORDER.map((id) => scaleLabel(getScale(id)))),
        explanation: `El modo de cada grado sale de empezar la escala mayor en ese grado: ${chord.roman} → ${mode.name}. Son las mismas notas de ${noteName(key, n)} mayor empezando en ${noteName(chord.root, n)}.`,
      };
    }
    case "grado": {
      const key = pick(rng, QUIZ_ROOTS);
      const notes = buildScale(key, "jonico");
      const index = 1 + Math.floor(rng() * 6);
      const correct = `${index + 1}º`;
      return {
        kind, prompt: `En ${noteName(key, n)} mayor, ¿qué grado es ${noteName(notes[index], n)}?`,
        ...withOptions(rng, correct, ["2º", "3º", "4º", "5º", "6º", "7º"]),
        explanation: `${names(notes, n)}: ${noteName(notes[index], n)} es el ${correct} grado.`,
      };
    }
    case "escalaMadre": {
      const modeId = pick(rng, MODE_ORDER.slice(1));
      const root = pick(rng, QUIZ_ROOTS);
      const parent = parentMajor(root, modeId)!;
      // Evitamos madres con dobles alteraciones o tónicas raras (p. ej. Sol♭ locrio).
      if (Math.abs(parent.accidental) > 1 || !ROOTS.some((r) => r.letter === parent.letter && r.accidental === parent.accidental)) {
        return build("relativaMenor", rng, n);
      }
      const correct = `${noteName(parent, n)} mayor`;
      return {
        kind, prompt: `${noteName(root, n)} ${getScale(modeId).name.toLowerCase()} usa las mismas notas que…`,
        ...noteOptions(rng, parent, n, " mayor"),
        explanation: `El ${getScale(modeId).name.toLowerCase()} empieza en el ${getScale(modeId).majorDegree}º grado de la mayor, así que ${noteName(root, n)} es el ${getScale(modeId).majorDegree}º grado de ${correct}.`,
      };
    }
  }
}

/** Quiz de `count` preguntas con tipos variados (sin repetir tipo mientras alcancen). */
export function generateQuiz(count = 5, rng: Rng = Math.random, notation: Notation = "latin"): QuizQuestion[] {
  const kinds = shuffle(rng, KINDS);
  const questions: QuizQuestion[] = [];
  for (let i = 0; i < count; i++) questions.push(build(kinds[i % kinds.length], rng, notation));
  return questions;
}

export function questionOfKind(kind: QuestionKind, rng: Rng = Math.random, notation: Notation = "latin"): QuizQuestion {
  return build(kind, rng, notation);
}
