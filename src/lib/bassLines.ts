import { BASS_EADG } from "./theory/fretboard";
import { mod, pitchClass, type SpelledNote } from "./theory/notes";
import { diatonicChords, type DiatonicChord } from "./theory/relatives";

export type BassDegree = "R" | "3" | "5" | "8" | "aprox";
export type BassStyle = "roots" | "fifths" | "octaves" | "arpeggio" | "approach";
export interface BassProgression {
  id: string;
  label: string;
  mode: "jonico" | "eolico";
  degrees: readonly number[];
}
export const BASS_PROGRESSIONS: readonly BassProgression[] = [
  { id: "one-five", label: "I–V", mode: "jonico", degrees: [1, 5] },
  { id: "blues", label: "I–IV–V–I", mode: "jonico", degrees: [1, 4, 5, 1] },
  { id: "pop", label: "I–vi–IV–V", mode: "jonico", degrees: [1, 6, 4, 5] },
  { id: "two-five-one", label: "ii–V–I", mode: "jonico", degrees: [2, 5, 1] },
  { id: "minor", label: "i–VI–III–VII", mode: "eolico", degrees: [1, 6, 3, 7] },
];
export const BASS_STYLES: readonly { id: BassStyle; label: string; pattern: readonly BassDegree[]; explanation: string }[] = [
  { id: "roots", label: "Fundamentales", pattern: ["R", "R", "R", "R"], explanation: "La fundamental deja claro cada acorde. Cuatro negras estables te ayudan a sostener el pulso." },
  { id: "fifths", label: "Fundamental + quinta", pattern: ["R", "5", "R", "5"], explanation: "La quinta añade movimiento sin cambiar el carácter del acorde. Alterna con la fundamental manteniendo el pulso." },
  { id: "octaves", label: "Fundamental, quinta y octava", pattern: ["R", "5", "8", "5"], explanation: "La octava repite la fundamental en un registro más agudo. Abre el sonido y te permite practicar cambios de cuerda." },
  { id: "arpeggio", label: "Arpegio con tercera", pattern: ["R", "3", "5", "3"], explanation: "La tercera revela si el acorde es mayor o menor. El recorrido 1–3–5–3 dibuja su armonía con claridad." },
  { id: "approach", label: "Aproximación cromática", pattern: ["R", "3", "5", "aprox"], explanation: "En el cuarto tiempo, una nota a un semitono de la próxima fundamental crea tensión y conduce al siguiente acorde. El último compás prepara la vuelta al primero." },
];
export interface BassNote {
  midi: number;
  grado: BassDegree;
  /** Tiempo local del compás, desde 0; duración en negras. */
  tiempo: number;
  duracion: number;
  /** Cuerda: 0 = Mi, 1 = La, 2 = Re, 3 = Sol. */
  cuerda: number;
  traste: number;
}
export interface BassBar { chord: DiatonicChord; notes: BassNote[] }
export interface BassLine { progression: BassProgression; style: BassStyle; bars: BassBar[] }

export function chordIntervals(chord: DiatonicChord): number[] {
  return [0, chord.triad === "mayor" || chord.triad === "aumentado" ? 4 : 3,
    chord.triad === "disminuido" ? 6 : chord.triad === "aumentado" ? 8 : 7];
}

interface Candidate { base: number; note: BassNote }
function roots(chord: DiatonicChord): number[] {
  // Deja espacio para la quinta y una octava real dentro de MIDI 28–55.
  return Array.from({ length: 16 }, (_, i) => i + 28).filter((midi) => mod(midi, 12) === pitchClass(chord.root));
}
function positions(midi: number): { cuerda: number; traste: number }[] {
  return BASS_EADG.strings.flatMap((open, cuerda) => {
    const traste = midi - open;
    return traste >= 0 && traste <= 12 ? [{ cuerda, traste }] : [];
  });
}
/** Coste de desplazamiento compartido por el generador y las comprobaciones. */
export function bassMovement(a: BassNote, b: BassNote): number {
  return Math.abs(a.traste - b.traste) * 2 + Math.abs(a.cuerda - b.cuerda) + Math.abs(a.midi - b.midi) * 0.1;
}

/** Generador determinista, sin audio ni estado. Optimiza la digitación de toda la vuelta. */
export function generateBassLine(root: SpelledNote, progressionId = "one-five", style: BassStyle = "roots"): BassLine {
  const progression = BASS_PROGRESSIONS.find((p) => p.id === progressionId);
  const definition = BASS_STYLES.find((s) => s.id === style);
  if (!progression || !definition) throw new RangeError("Progresión o estilo de bajo desconocido");
  const harmony = diatonicChords(root, progression.mode);
  const chords = progression.degrees.map((degree) => harmony[degree - 1]);
  const steps = chords.flatMap((chord, bar) => definition.pattern.map((grado, tiempo) => {
    const intervals = chordIntervals(chord);
    return roots(chord).flatMap((base) => {
      const midis = grado === "aprox"
        ? [...new Set(roots(chords[(bar + 1) % chords.length]).flatMap((next) => [next - 1, next + 1]))]
        : [base + ({ R: 0, "3": intervals[1], "5": intervals[2], "8": 12 }[grado])];
      return midis.filter((midi) => midi >= 28 && midi <= 55).flatMap((midi) => positions(midi).map((position) => ({
        base, note: { midi, grado, tiempo, duracion: 1, ...position },
      })));
    });
  }));
  const connects = (a: Candidate, b: Candidate) => b.note.tiempo === 0
    ? a.note.grado !== "aprox" || Math.abs(a.note.midi - b.note.midi) === 1
    : a.base === b.base;
  const comfort = (c: Candidate) => c.note.traste * 0.05;
  let bestCost = Infinity;
  let bestPath: Candidate[] = [];
  // Fijar el inicio permite optimizar también la unión final→inicio del loop.
  for (const first of steps[0]) {
    let previous = steps[0].map((candidate) => ({ cost: candidate === first ? comfort(first) : Infinity, path: [candidate] }));
    for (let step = 1; step < steps.length; step++) {
      previous = steps[step].map((candidate) => {
        let cost = Infinity;
        let path: Candidate[] = [];
        steps[step - 1].forEach((prior, i) => {
          if (!connects(prior, candidate) || !Number.isFinite(previous[i].cost)) return;
          const nextCost = previous[i].cost + bassMovement(prior.note, candidate.note) + comfort(candidate);
          if (nextCost < cost) { cost = nextCost; path = [...previous[i].path, candidate]; }
        });
        return { cost, path };
      });
    }
    previous.forEach((result, i) => {
      const last = steps[steps.length - 1][i];
      if (!connects(last, first)) return;
      const cost = result.cost + bassMovement(last.note, first.note);
      if (cost < bestCost) { bestCost = cost; bestPath = result.path; }
    });
  }
  if (!bestPath.length) throw new RangeError("No hay digitación para esta línea");
  return { progression, style, bars: chords.map((chord, i) => ({ chord, notes: bestPath.slice(i * 4, i * 4 + 4).map((c) => c.note) })) };
}
