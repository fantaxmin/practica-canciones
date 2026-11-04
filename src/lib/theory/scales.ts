import { NATURAL_PCS, mod, pitchClass, spellWithLetter, type SpelledNote } from "./notes";

export type ScaleFamily = "modo" | "menor" | "pentatonica";

export type ScaleId =
  | "jonico" | "dorico" | "frigio" | "lidio" | "mixolidio" | "eolico" | "locrio"
  | "menorArmonica" | "menorMelodica"
  | "pentaMayor" | "pentaMenor" | "blues";

export interface ScaleDef {
  id: ScaleId;
  name: string;
  /** Otro nombre común, p. ej. "Mayor" para el jónico. */
  alias?: string;
  family: ScaleFamily;
  /** Grados respecto a la escala mayor: "1", "b3", "#4"… */
  formula: string[];
  /** Si es modo de la escala mayor, en qué grado de ella empieza (1–7). */
  majorDegree?: number;
  mood: string;
  description: string;
  useOver: string[];
}

export const SCALES: ScaleDef[] = [
  {
    id: "jonico", name: "Jónico", alias: "Mayor", family: "modo", majorDegree: 1,
    formula: ["1", "2", "3", "4", "5", "6", "7"],
    mood: "Brillante, estable, resuelto.",
    description: "La escala mayor. Todos los modos griegos son rotaciones de ella. Patrón de tonos y semitonos: T T S T T T S.",
    useOver: ["Acorde mayor o maj7 que es el I de la tonalidad", "Canciones pop/rock en tonalidad mayor"],
  },
  {
    id: "dorico", name: "Dórico", family: "modo", majorDegree: 2,
    formula: ["1", "2", "b3", "4", "5", "6", "b7"],
    mood: "Menor pero con luz; groovy, funk, jazz.",
    description: "Menor natural con la 6ª mayor. Empieza en el 2º grado de la escala mayor (Re dórico = notas de Do mayor).",
    useOver: ["Acorde m7 que es el ii en un ii–V–I", "Vamps menores de funk o rock (Oye como va, So What)"],
  },
  {
    id: "frigio", name: "Frigio", family: "modo", majorDegree: 3,
    formula: ["1", "b2", "b3", "4", "5", "b6", "b7"],
    mood: "Oscuro, español, metal.",
    description: "Menor con la 2ª menor, que le da el color flamenco. Empieza en el 3er grado de la mayor.",
    useOver: ["Acorde m7 que es el iii", "Riffs de metal y pasajes flamencos sobre un acorde menor"],
  },
  {
    id: "lidio", name: "Lidio", family: "modo", majorDegree: 4,
    formula: ["1", "2", "3", "#4", "5", "6", "7"],
    mood: "Soñador, flotante, de película.",
    description: "Mayor con la 4ª aumentada. Empieza en el 4º grado de la mayor.",
    useOver: ["Acorde maj7 que es el IV", "maj7♯11"],
  },
  {
    id: "mixolidio", name: "Mixolidio", family: "modo", majorDegree: 5,
    formula: ["1", "2", "3", "4", "5", "6", "b7"],
    mood: "Mayor relajado, bluesero, rockero.",
    description: "Mayor con la 7ª menor. Empieza en el 5º grado de la mayor y es la escala natural del acorde dominante.",
    useOver: ["Acorde dominante 7 (el V)", "Rock clásico y blues en mayor"],
  },
  {
    id: "eolico", name: "Eólico", alias: "Menor natural", family: "modo", majorDegree: 6,
    formula: ["1", "2", "b3", "4", "5", "b6", "b7"],
    mood: "Triste, épico, la menor por defecto.",
    description: "La menor natural. Empieza en el 6º grado de la mayor; por eso La menor es la relativa de Do mayor.",
    useOver: ["Acorde m7 que es el vi o el i de una tonalidad menor", "Baladas y rock en menor"],
  },
  {
    id: "locrio", name: "Locrio", family: "modo", majorDegree: 7,
    formula: ["1", "b2", "b3", "4", "b5", "b6", "b7"],
    mood: "Inestable, tenso.",
    description: "El único modo con la 5ª disminuida. Empieza en el 7º grado de la mayor.",
    useOver: ["Acorde semidisminuido m7♭5 (el vii°)", "El ii de un ii–V–i menor"],
  },
  {
    id: "menorArmonica", name: "Menor armónica", family: "menor",
    formula: ["1", "2", "b3", "4", "5", "b6", "7"],
    mood: "Exótico, neoclásico.",
    description: "Menor natural con la 7ª subida, para tener sensible y un V mayor. Tiene un salto de tono y medio entre ♭6 y 7.",
    useOver: ["El V7 de una tonalidad menor (desde su 5º grado)", "Acorde i en piezas neoclásicas"],
  },
  {
    id: "menorMelodica", name: "Menor melódica", family: "menor",
    formula: ["1", "2", "b3", "4", "5", "6", "7"],
    mood: "Menor sofisticado, jazz.",
    description: "Menor con 6ª y 7ª mayores (la versión 'jazz', igual al subir y al bajar).",
    useOver: ["Acorde m(maj7) o m6", "Sus modos dan el lidio dominante y el alterado"],
  },
  {
    id: "pentaMayor", name: "Pentatónica mayor", family: "pentatonica",
    formula: ["1", "2", "3", "5", "6"],
    mood: "Alegre, country, pop.",
    description: "La escala mayor sin 4ª ni 7ª: cinco notas sin semitonos, difícil que suene mal.",
    useOver: ["Acordes mayores y dominantes", "Solos de country y pop"],
  },
  {
    id: "pentaMenor", name: "Pentatónica menor", family: "pentatonica",
    formula: ["1", "b3", "4", "5", "b7"],
    mood: "Rock, blues, la más usada para improvisar.",
    description: "La menor natural sin 2ª ni ♭6. Tiene las mismas notas que la pentatónica mayor de su relativa (La menor penta = Do mayor penta).",
    useOver: ["Acordes menores", "Blues y rock, incluso sobre acordes dominantes"],
  },
  {
    id: "blues", name: "Blues", family: "pentatonica",
    formula: ["1", "b3", "4", "b5", "5", "b7"],
    mood: "Sucio, expresivo.",
    description: "Pentatónica menor más la 'blue note' (♭5) como nota de paso.",
    useOver: ["Blues de 12 compases", "Rock y funk sobre acordes 7"],
  },
];

export const MODE_ORDER: ScaleId[] = ["jonico", "dorico", "frigio", "lidio", "mixolidio", "eolico", "locrio"];

export function getScale(id: ScaleId): ScaleDef {
  const scale = SCALES.find((s) => s.id === id);
  if (!scale) throw new Error(`Escala desconocida: ${id}`);
  return scale;
}

export function parseDegree(degree: string): { number: number; accidental: number } {
  const match = /^([b#]*)(\d)$/.exec(degree);
  if (!match) throw new Error(`Grado inválido: ${degree}`);
  const accidental = [...match[1]].reduce((sum, ch) => sum + (ch === "#" ? 1 : -1), 0);
  return { number: Number(match[2]), accidental };
}

/** Semitonos desde la tónica para un grado como "b3" o "#4". */
export function degreeSemitones(degree: string): number {
  const { number, accidental } = parseDegree(degree);
  return NATURAL_PCS[number - 1] + accidental;
}

export function formatDegree(degree: string): string {
  return degree.replace(/b/g, "♭").replace(/#/g, "♯");
}

export function scaleSemitones(scale: ScaleDef): number[] {
  return scale.formula.map(degreeSemitones);
}

/** Notas de la escala con la letra correcta para cada grado (Fa mayor lleva Si♭, no La♯). */
export function buildScale(root: SpelledNote, id: ScaleId): SpelledNote[] {
  const rootPc = pitchClass(root);
  return getScale(id).formula.map((degree) => {
    const { number } = parseDegree(degree);
    return spellWithLetter(root.letter + number - 1, mod(rootPc + degreeSemitones(degree), 12));
  });
}

/** Patrón en tonos (T) y semitonos (S), incluyendo el regreso a la octava. */
export function stepPattern(scale: ScaleDef): string {
  const semis = [...scaleSemitones(scale), 12];
  return semis.slice(1).map((value, i) => {
    const step = value - semis[i];
    return step === 1 ? "S" : step === 2 ? "T" : step === 3 ? "T½" : `${step}`;
  }).join(" ");
}

export function scaleLabel(scale: ScaleDef): string {
  return scale.alias ? `${scale.name} (${scale.alias})` : scale.name;
}
