import { BASS_EADG } from "./theory/fretboard";

export type GrooveLevel = 1 | 2 | 3 | 4 | 5;
export interface BassNote {
  /** Índice desde la cuerda grave: 0 = Mi, 1 = La, 2 = Re, 3 = Sol. */
  string: number;
  fret: number;
}
export interface GrooveStep {
  /** Duración en negras: 1, 0.5 o múltiplos de 0.25. */
  duration: number;
  note: BassNote | null;
  accent?: boolean;
  ghost?: boolean;
}
export interface GrooveExercise {
  id: string;
  level: GrooveLevel;
  name: string;
  description: string;
  bpm: number;
  subdivision: 2 | 4;
  bars: GrooveStep[][];
}
const root: BassNote = { string: 0, fret: 0 };
const fifth: BassNote = { string: 1, fret: 2 };
const octave: BassNote = { string: 2, fret: 2 };
const n = (duration: number, note = root, accent = false): GrooveStep => ({ duration, note, accent });
const r = (duration: number): GrooveStep => ({ duration, note: null });
const x = (): GrooveStep => ({ duration: 0.25, note: root, ghost: true });

/** Todos los patrones están en Mi, afinación EADG; cada array es un compás de 4/4. */
export const GROOVES: readonly GrooveExercise[] = [
  { id: "pulso", level: 1, name: "La fundamental", description: "Negras regulares en Mi. Igual volumen y duración en cada ataque.", bpm: 60, subdivision: 2,
    bars: [[n(1, root, true), n(1), n(1), n(1)]] },
  { id: "apoyo", level: 1, name: "Apoyo en el uno", description: "Mantén las negras y acentúa solo el comienzo de cada compás.", bpm: 70, subdivision: 2,
    bars: [[n(1, root, true), n(1), n(1), n(1)], [n(1, root, true), n(1), n(1), n(1)]] },
  { id: "corcheas", level: 2, name: "Motor de corcheas", description: "Alterna índice y medio; deja respirar el último contratiempo.", bpm: 75, subdivision: 2,
    bars: [[n(.5, root, true), n(.5), n(.5), n(.5), n(.5), n(.5), n(.5), r(.5)]] },
  { id: "espacios", level: 2, name: "El silencio también toca", description: "Apaga la cuerda en cada silencio sin perder la cuenta.", bpm: 80, subdivision: 2,
    bars: [[n(.5, root, true), r(.5), n(1), r(.5), n(.5), n(.5), r(.5)], [n(1, root, true), n(.5), r(.5), n(.5), r(.5), n(1)]] },
  { id: "rock", level: 3, name: "Quinta de rock", description: "Cruza de Mi a Si con ataques uniformes y cuerdas bien apagadas.", bpm: 85, subdivision: 2,
    bars: [[n(.5, root, true), n(.5), n(.5, fifth), n(.5, fifth), n(.5), n(.5), n(.5, fifth), n(.5)]] },
  { id: "pop", level: 3, name: "Salto de octava", description: "Alterna fundamental, quinta y octava sin acelerar los saltos.", bpm: 90, subdivision: 2,
    bars: [[n(1, root, true), n(.5, octave), n(.5, fifth), n(1), n(.5, fifth), n(.5, octave)], [n(.5, root, true), n(.5, octave), n(1, fifth), n(.5), r(.5), n(1, octave)]] },
  { id: "funk", level: 4, name: "Anticipación funk", description: "Sostén las síncopas. Cuenta 1 e + a sin adelantar los ataques.", bpm: 70, subdivision: 4,
    bars: [[n(.75, root, true), n(.5), r(.25), n(.75, octave), n(.25, fifth), r(.5), n(1)]] },
  { id: "desplazado", level: 4, name: "Respuesta a contratiempo", description: "Encadena dos compases con entradas desplazadas y semicorcheas.", bpm: 80, subdivision: 4,
    bars: [[n(.5, root, true), r(.25), n(.5), n(.75, fifth), n(.25), r(.25), n(.5, octave), n(.5), r(.5)], [r(.25), n(.5), n(.25, fifth), n(.5), n(.5, octave), r(.25), n(.25), n(.5, fifth), n(.75), n(.25)]] },
  { id: "ghost", level: 5, name: "Notas muertas", description: "Relaja la mano izquierda para las x: percusión breve, sin altura definida.", bpm: 65, subdivision: 4,
    bars: [[n(.5, root, true), x(), x(), n(.5, fifth), r(.5), n(.5), x(), n(.25, octave), n(.5), r(.5)]] },
  { id: "ghost-funk", level: 5, name: "Conversación funk", description: "Combina notas muertas suaves, octavas y acentos sin perder el pulso.", bpm: 80, subdivision: 4,
    bars: [[n(.75, root, true), x(), r(.25), x(), n(.5, octave), n(.5), x(), x(), n(.75, fifth), x()], [r(.5), x(), n(.25), n(.5, octave, true), x(), x(), n(.75), x(), n(.5, fifth), r(.5)]] },
];

export function stepMidi(step: GrooveStep): number | null {
  return step.note ? BASS_EADG.strings[step.note.string] + step.note.fret : null;
}

/** Celdas de una tablatura: los sostenidos conservan el paso sin repetir su ataque. */
export function barCells(bar: readonly GrooveStep[], subdivision: 2 | 4) {
  return bar.flatMap((step, stepIndex) => Array.from({ length: step.duration * subdivision }, (_, i) => ({ step, stepIndex, onset: i === 0 })));
}
