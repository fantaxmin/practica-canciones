/** Sintetizador mínimo con Web Audio: sin samples, solo osciladores con envolvente. */
let context: AudioContext | null = null;
let master: GainNode | null = null;
const active = new Set<OscillatorNode>();

function audio(): { ctx: AudioContext; out: GainNode } {
  if (!context) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    context = new Ctor();
    master = context.createGain();
    master.gain.value = 0.5;
    master.connect(context.destination);
  }
  if (context.state === "suspended") void context.resume();
  return { ctx: context, out: master! };
}

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Programa una nota; `start` en segundos relativos a ahora. */
export function playNote(midi: number, duration = 0.5, start = 0, volume = 0.6): void {
  const { ctx, out } = audio();
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = midiToFrequency(midi);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(volume * 0.35, t0 + duration * 0.6);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(out);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
  active.add(osc);
  osc.onended = () => { active.delete(osc); gain.disconnect(); };
}

/** Toca las notas una tras otra; devuelve la duración total en segundos. */
export function playSequence(midis: number[], bpm = 120): number {
  const step = 60 / bpm;
  midis.forEach((midi, i) => playNote(midi, step * 0.95, i * step));
  return midis.length * step;
}

/** Acorde programable; volumen total por defecto compatible con las llamadas existentes. */
export function playChord(midis: number[], duration = 1.4, volume = 0.6, start = 0): void {
  const noteVolume = volume / Math.sqrt(Math.max(1, midis.length));
  midis.forEach((midi) => playNote(midi, duration, start, noteVolume));
}

export function stopAll(): void {
  for (const osc of active) {
    try { osc.stop(); } catch { /* ya terminó */ }
  }
  active.clear();
}

/** Contexto compartido; llamar únicamente después de una interacción del usuario. */
export function audioContext(): AudioContext {
  return audio().ctx;
}
