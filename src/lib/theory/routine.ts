import { noteName, type Notation, type SpelledNote } from "./notes";
import { buildScale, getScale, type ScaleId } from "./scales";
import { relativeMinor } from "./relatives";
import type { Rng } from "./quiz";

export interface RoutineStep {
  title: string;
  root: SpelledNote;
  scaleId: ScaleId;
  instruction: string;
}

/** Tonalidades mayores cómodas para calentar en bajo y guitarra. */
export const ROUTINE_KEYS: SpelledNote[] = [
  { letter: 0, accidental: 0 }, { letter: 4, accidental: 0 }, { letter: 1, accidental: 0 }, { letter: 5, accidental: 0 },
  { letter: 2, accidental: 0 }, { letter: 3, accidental: 0 }, { letter: 6, accidental: -1 }, { letter: 2, accidental: -1 },
];

const COLOR_MODES: { id: ScaleId; degree: number }[] = [
  { id: "dorico", degree: 2 }, { id: "frigio", degree: 3 }, { id: "lidio", degree: 4 }, { id: "mixolidio", degree: 5 },
];

/** Rutina de 4 pasos alrededor de una tonalidad: mayor → relativa menor → un modo → pentatónica. */
export function buildRoutine(key: SpelledNote, rng: Rng = Math.random, n: Notation = "latin"): RoutineStep[] {
  const name = (note: SpelledNote) => noteName(note, n);
  const minor = relativeMinor(key);
  const major = buildScale(key, "jonico");
  const mode = COLOR_MODES[Math.floor(rng() * COLOR_MODES.length)];
  const modeRoot = major[mode.degree - 1];
  const modeName = getScale(mode.id).name.toLowerCase();
  return [
    {
      title: `${name(key)} mayor`, root: key, scaleId: "jonico",
      instruction: `Sube y baja la escala despacio, nota por nota, diciendo el nombre de cada una. Empieza en la tónica más grave que encuentres (${name(key)}).`,
    },
    {
      title: `${name(minor)} menor, la relativa`, root: minor, scaleId: "eolico",
      instruction: `Son las mismas notas que ${name(key)} mayor, pero ahora la "casa" es ${name(minor)}. Toca la escala y termina siempre en ${name(minor)}: escucha cómo cambia el carácter.`,
    },
    {
      title: `${name(modeRoot)} ${modeName}`, root: modeRoot, scaleId: mode.id,
      instruction: `Otra vez las notas de ${name(key)} mayor, empezando en su ${mode.degree}º grado. Toca la escala y luego improvisa 30 segundos apoyándote en ${name(modeRoot)}. ${getScale(mode.id).mood}`,
    },
    {
      title: `${name(minor)} pentatónica menor`, root: minor, scaleId: "pentaMenor",
      instruction: `La caja más usada para improvisar. Toca la posición que empieza en ${name(minor)} y haz frases cortas de 3–4 notas, terminando en la tónica.`,
    },
  ];
}
