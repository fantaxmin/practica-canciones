import { playChord, playSequence, stopAll } from "./audio/synth";
import type { Exercise } from "./earTraining";

/** Solo se llama desde un gesto del usuario, nunca al generar el ejercicio. */
export function playExercise(exercise: Exercise): void {
  stopAll();
  if (exercise.playback === "armonico") playChord(exercise.midis, 1.8);
  else playSequence(exercise.midis, 100);
}
