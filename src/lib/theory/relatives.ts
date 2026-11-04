import { NATURAL_PCS, mod, noteName, pitchClass, spellWithLetter, type Notation, type SpelledNote } from "./notes";
import { MODE_ORDER, buildScale, getScale, type ScaleId } from "./scales";

export function relativeMinor(majorRoot: SpelledNote): SpelledNote {
  return buildScale(majorRoot, "jonico")[5];
}

export function relativeMajor(minorRoot: SpelledNote): SpelledNote {
  return buildScale(minorRoot, "eolico")[2];
}

/** Escala mayor que comparte notas con este modo (Re dórico → Do mayor). */
export function parentMajor(root: SpelledNote, modeId: ScaleId): SpelledNote | null {
  const degree = getScale(modeId).majorDegree;
  if (!degree) return null;
  return spellWithLetter(root.letter - (degree - 1), mod(pitchClass(root) - NATURAL_PCS[degree - 1], 12));
}

export type TriadQuality = "mayor" | "menor" | "disminuido" | "aumentado";

export interface DiatonicChord {
  degree: number;
  roman: string;
  root: SpelledNote;
  triad: TriadQuality;
  /** Sufijo del acorde con séptima: "maj7", "m7", "7", "m7♭5"… */
  seventh: string;
  /** Modo que suena "natural" sobre este acorde dentro de la tonalidad. */
  mode: ScaleId | null;
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

function triadQuality(third: number, fifth: number): TriadQuality {
  if (third === 4) return fifth === 8 ? "aumentado" : "mayor";
  return fifth === 6 ? "disminuido" : "menor";
}

function seventhSuffix(third: number, fifth: number, seventh: number): string {
  const key = `${third}-${fifth}-${seventh}`;
  const table: Record<string, string> = {
    "4-7-11": "maj7", "4-7-10": "7", "3-7-10": "m7", "3-6-10": "m7♭5",
    "3-6-9": "°7", "3-7-11": "m(maj7)", "4-8-11": "maj7♯5",
  };
  return table[key] ?? "";
}

/** Acordes diatónicos (tríadas y cuatriadas) de una tonalidad de siete notas. */
export function diatonicChords(root: SpelledNote, id: ScaleId): DiatonicChord[] {
  const notes = buildScale(root, id);
  if (notes.length !== 7) return [];
  const pcs = notes.map(pitchClass);
  const majorDegree = getScale(id).majorDegree;
  return notes.map((note, i) => {
    const third = mod(pcs[(i + 2) % 7] - pcs[i], 12);
    const fifth = mod(pcs[(i + 4) % 7] - pcs[i], 12);
    const seventh = mod(pcs[(i + 6) % 7] - pcs[i], 12);
    const triad = triadQuality(third, fifth);
    const numeral = triad === "mayor" || triad === "aumentado" ? ROMAN[i] : ROMAN[i].toLowerCase();
    const suffix = triad === "disminuido" ? "°" : triad === "aumentado" ? "+" : "";
    return {
      degree: i + 1,
      roman: numeral + suffix,
      root: note,
      triad,
      seventh: seventhSuffix(third, fifth, seventh),
      mode: majorDegree ? MODE_ORDER[(majorDegree - 1 + i) % 7] : null,
    };
  });
}

export function triadName(chord: DiatonicChord, notation: Notation = "latin"): string {
  const suffix = { mayor: "", menor: "m", disminuido: "°", aumentado: "+" }[chord.triad];
  return noteName(chord.root, notation) + suffix;
}

export function seventhName(chord: DiatonicChord, notation: Notation = "latin"): string {
  return noteName(chord.root, notation) + chord.seventh;
}

/** Número de alteraciones de la armadura de una tonalidad mayor: positivo = sostenidos, negativo = bemoles. */
export function keySignature(majorRoot: SpelledNote): number {
  return buildScale(majorRoot, "jonico").reduce((sum, note) => sum + note.accidental, 0);
}

export interface CircleEntry {
  major: SpelledNote;
  minor: SpelledNote;
  signature: number;
}

/** Círculo de quintas desde Do: sostenidos hacia la derecha, bemoles hacia la izquierda. */
export function circleOfFifths(): CircleEntry[] {
  // Do … Fa♯ subiendo quintas; Re♭ … Fa son las tonalidades con bemoles (subiendo cuartas desde Fa, al revés).
  const sharps: SpelledNote[] = [{ letter: 0, accidental: 0 }];
  while (sharps.length < 7) sharps.push(buildScale(sharps[sharps.length - 1], "jonico")[4]);
  const flats: SpelledNote[] = [{ letter: 3, accidental: 0 }];
  while (flats.length < 5) flats.push(buildScale(flats[flats.length - 1], "jonico")[3]);
  return [...sharps, ...flats.reverse()].map((major) => ({ major, minor: relativeMinor(major), signature: keySignature(major) }));
}

export function signatureLabel(signature: number): string {
  if (signature === 0) return "sin alteraciones";
  const count = Math.abs(signature);
  return `${count} ${signature > 0 ? (count === 1 ? "sostenido" : "sostenidos") : (count === 1 ? "bemol" : "bemoles")}`;
}

/** Sugerencias generales de qué escala tocar sobre cada tipo de acorde. */
export const CHORD_SCALE_GUIDE: { chord: string; scales: ScaleId[]; tip: string }[] = [
  { chord: "maj7 (I)", scales: ["jonico", "pentaMayor"], tip: "Evita apoyarte en la 4ª: choca con la 3ª del acorde." },
  { chord: "maj7 (IV) / maj7♯11", scales: ["lidio", "pentaMayor"], tip: "La ♯4 es la nota de color." },
  { chord: "m7 (ii)", scales: ["dorico", "pentaMenor"], tip: "La 6ª mayor es la que le da el sabor dórico." },
  { chord: "m7 (vi / i menor)", scales: ["eolico", "pentaMenor"], tip: "La ♭6 le da el tono melancólico." },
  { chord: "m7 (iii)", scales: ["frigio", "pentaMenor"], tip: "Cuidado con la ♭2: úsala como tensión de paso." },
  { chord: "7 dominante (V)", scales: ["mixolidio", "pentaMayor", "blues"], tip: "En blues puedes mezclar penta menor y mayor." },
  { chord: "m7♭5 (vii°)", scales: ["locrio"], tip: "Sale de forma natural en el ii de un ii–V–i menor." },
  { chord: "V7 en tonalidad menor", scales: ["menorArmonica"], tip: "Toca la menor armónica de la tónica (Mi7 → La menor armónica)." },
];
