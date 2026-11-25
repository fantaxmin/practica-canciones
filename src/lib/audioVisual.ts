export interface AudioPosition {
  /** Índice dentro de la secuencia; -1 durante la cuenta previa. */
  step: number;
  absoluteStep: number;
  /** Compás absoluto y negra del compás (ambos desde cero), en 4/4. */
  bar: number;
  beat: number;
  /** Fracción de negra transcurrida, independiente de la subdivisión. */
  phase: number;
}

/** Función sin reloj propio: una suspensión congela el tiempo; un salto se resuelve directamente. */
export function audioPosition(time: number, start: number, bpm: number, subdivision: number, steps: number): AudioPosition {
  if (![time, start, bpm].every(Number.isFinite) || bpm <= 0
    || !Number.isInteger(subdivision) || subdivision < 1 || !Number.isInteger(steps) || steps < 1) {
    throw new RangeError("Tiempo, tempo, subdivisión o pasos inválidos");
  }
  if (time < start) return { step: -1, absoluteStep: -1, bar: -1, beat: -1, phase: 0 };
  const raw = (time - start) * bpm / 60 * subdivision;
  // Corregir únicamente el ruido flotante junto a un límite de paso.
  const position = Math.abs(raw - Math.round(raw)) < 1e-9 ? Math.round(raw) : raw;
  const absoluteStep = Math.floor(position);
  const beats = position / subdivision;
  return {
    step: absoluteStep % steps,
    absoluteStep,
    bar: Math.floor(beats / 4),
    beat: Math.floor(beats) % 4,
    phase: beats - Math.floor(beats),
  };
}

/** El marcador late en cada negra; en movimiento reducido permanece estático. */
export function pulseAppearance(position: AudioPosition, reduced: boolean, running = true): { scale: number; opacity: number } {
  if (!running || position.step < 0) return { scale: 1, opacity: .25 };
  if (reduced) return { scale: 1, opacity: 1 };
  const impulse = Math.max(0, 1 - position.phase / .35);
  const accent = position.beat === 0 ? 1 : .65;
  return { scale: 1 + .3 * impulse * accent, opacity: .45 + .55 * impulse * accent };
}
