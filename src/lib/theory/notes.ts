/** Clase de altura: 0 = Do … 11 = Si. */
export type PitchClass = number;
export type Notation = "latin" | "english";

/** Nota escrita: letra (0 = Do … 6 = Si) más alteración en semitonos (-2 … 2). */
export interface SpelledNote {
  letter: number;
  accidental: number;
}

export const NATURAL_PCS = [0, 2, 4, 5, 7, 9, 11] as const;
const LATIN_LETTERS = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"];
const ENGLISH_LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const ACCIDENTALS: Record<number, string> = { [-2]: "𝄫", [-1]: "♭", 0: "", 1: "♯", 2: "𝄪" };

export function mod(value: number, base: number): number {
  return ((value % base) + base) % base;
}

export function pitchClass(note: SpelledNote): PitchClass {
  return mod(NATURAL_PCS[note.letter] + note.accidental, 12);
}

/** Escribe `pc` con la letra dada, eligiendo la alteración más cercana. */
export function spellWithLetter(letter: number, pc: PitchClass): SpelledNote {
  const l = mod(letter, 7);
  return { letter: l, accidental: mod(pc - NATURAL_PCS[l] + 6, 12) - 6 };
}

export function noteName(note: SpelledNote, notation: Notation = "latin"): string {
  const letters = notation === "latin" ? LATIN_LETTERS : ENGLISH_LETTERS;
  return letters[note.letter] + (ACCIDENTALS[note.accidental] ?? "?");
}

export function sameNote(a: SpelledNote, b: SpelledNote): boolean {
  return a.letter === b.letter && a.accidental === b.accidental;
}

/** Tónicas disponibles en los selectores, con la escritura habitual de cada tonalidad. */
export const ROOTS: SpelledNote[] = [
  { letter: 0, accidental: 0 },
  { letter: 0, accidental: 1 },
  { letter: 1, accidental: -1 },
  { letter: 1, accidental: 0 },
  { letter: 2, accidental: -1 },
  { letter: 2, accidental: 0 },
  { letter: 3, accidental: 0 },
  { letter: 3, accidental: 1 },
  { letter: 4, accidental: -1 },
  { letter: 4, accidental: 0 },
  { letter: 4, accidental: 1 },
  { letter: 5, accidental: -1 },
  { letter: 5, accidental: 0 },
  { letter: 6, accidental: -1 },
  { letter: 6, accidental: 0 },
];

export function rootKey(note: SpelledNote): string {
  return `${note.letter}:${note.accidental}`;
}

export function parseRootKey(key: string): SpelledNote {
  const [letter, accidental] = key.split(":").map(Number);
  return ROOTS.find((root) => root.letter === letter && root.accidental === accidental) ?? ROOTS[0];
}
