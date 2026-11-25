import { audioContext } from "./synth";

export const MIN_BPM = 40;
export const MAX_BPM = 200;
export function clampBpm(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(Number.isFinite(bpm) ? bpm : MIN_BPM)));
}

/** Tiempos absolutos en segundos. Subdivisión = pasos por negra. Sin acumulación de error. */
export function schedulerTimes(bpm: number, subdivision: number, start: number, count: number): number[] {
  if (!Number.isFinite(bpm) || bpm < MIN_BPM || bpm > MAX_BPM || !Number.isInteger(subdivision) || subdivision < 1 || !Number.isFinite(start) || !Number.isInteger(count) || count < 0) {
    throw new RangeError("Tempo, subdivisión, inicio o cantidad inválidos");
  }
  return Array.from({ length: count }, (_, i) => start + i * 60 / bpm / subdivision);
}

/** Marcas en milisegundos; una pausa > 2 s reinicia la serie. Promedia hasta 8 intervalos. */
export function tapTempo(taps: readonly number[]): number | null {
  const intervals: number[] = [];
  for (let i = 1; i < taps.length; i++) {
    const gap = taps[i] - taps[i - 1];
    if (!Number.isFinite(gap) || gap <= 0 || gap > 2000) intervals.length = 0;
    else intervals.push(gap);
  }
  const recent = intervals.slice(-8);
  return recent.length ? clampBpm(60000 / (recent.reduce((sum, n) => sum + n, 0) / recent.length)) : null;
}

export function clickAudible(bar: number, beat: number, backbeat: boolean, silentBars: boolean): boolean {
  return (!silentBars || bar % 4 < 2) && (!backbeat || beat === 1 || beat === 3);
}

export interface MetronomeOptions {
  bpm: number;
  bars: number;
  subdivision: 2 | 4;
  backbeat?: boolean;
  silentBars?: boolean;
  /** Se llama con anticipación: programar el audio en time, nunca reproducirlo inmediatamente. */
  onStep?: (index: number, time: number) => void;
}
export interface Metronome {
  context: AudioContext;
  startTime: number;
  endTime: number;
  stop: () => void;
}

/** Invocar tras pulsar un botón. El timeout solo despierta al scheduler; el reloj es Web Audio. */
export function startMetronome(options: MetronomeOptions): Metronome {
  const ctx = audioContext();
  const startTime = ctx.currentTime + .15;
  const times = schedulerTimes(options.bpm, options.subdivision, startTime, options.bars * 4 * options.subdivision);
  const endTime = startTime + options.bars * 4 * 60 / options.bpm;
  const nodes = new Set<OscillatorNode>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let next = 0;
  let stopped = false;

  function click(time: number, accent: boolean) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1600 : 1000;
    gain.gain.setValueAtTime(accent ? .22 : .13, time);
    gain.gain.exponentialRampToValueAtTime(.0001, time + .035);
    osc.connect(gain).connect(ctx.destination);
    nodes.add(osc);
    osc.onended = () => { nodes.delete(osc); osc.disconnect(); gain.disconnect(); };
    osc.start(time);
    osc.stop(time + .04);
  }
  function schedule() {
    if (stopped) return;
    if (ctx.state === "closed") return;
    // Un contexto suspendido conserva su reloj: no programar notas que lo reanuden.
    if (ctx.state && ctx.state !== "running") {
      timer = setTimeout(schedule, 25);
      return;
    }
    const now = ctx.currentTime;
    while (next < times.length && times[next] < now + .1) {
      const index = next++;
      const time = times[index];
      // Tras un bloqueo del hilo, omitir eventos vencidos evita ráfagas de clics.
      if (time < now) continue;
      const bar = Math.floor(index / (4 * options.subdivision));
      const beat = Math.floor(index / options.subdivision) % 4;
      if (index % options.subdivision === 0 && clickAudible(bar, beat, !!options.backbeat, !!options.silentBars)) click(time, beat === 0);
      options.onStep?.(index, time);
    }
    if (next < times.length) timer = setTimeout(schedule, 25);
  }
  schedule();
  return { context: ctx, startTime, endTime, stop() {
    stopped = true;
    clearTimeout(timer);
    for (const osc of nodes) {
      try { osc.stop(); } catch { /* Ya finalizado. */ }
    }
    nodes.clear();
  } };
}
