import { afterEach, describe, expect, it, vi } from "vitest";
import { clampBpm, clickAudible, schedulerTimes, startMetronome, tapTempo } from "./metronome";

const audio = vi.hoisted(() => ({ context: null as unknown }));
vi.mock("./synth", () => ({ audioContext: () => audio.context }));
afterEach(() => vi.useRealTimers());

describe("reloj del metrónomo", () => {
  it("congela la programación suspendido y omite pasos vencidos tras segundo plano", () => {
    vi.useFakeTimers();
    const gain = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
    const ctx = {
      state: "running", currentTime: 10, destination: {}, createGain: () => gain,
      createOscillator: () => ({ start: vi.fn(), stop: vi.fn(), connect: () => gain, disconnect: vi.fn(), frequency: { value: 0 } }),
    };
    audio.context = ctx;
    const onStep = vi.fn();
    const metronome = startMetronome({ bpm: 120, bars: 1, subdivision: 4, onStep });
    ctx.currentTime = 10.06;
    ctx.state = "suspended";
    vi.advanceTimersByTime(5000);
    expect(onStep).not.toHaveBeenCalled();
    ctx.state = "running";
    vi.advanceTimersByTime(25);
    expect(onStep).toHaveBeenCalledExactlyOnceWith(0, 10.15);
    onStep.mockClear();
    ctx.currentTime = 11.51;
    vi.advanceTimersByTime(25);
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(onStep.mock.calls[0][0]).toBe(11);
    expect(onStep.mock.calls[0][1]).toBeCloseTo(11.525);
    ctx.currentTime = 12.6;
    vi.advanceTimersByTime(5000);
    expect(onStep).toHaveBeenCalledTimes(1);
    metronome.stop();
  });

  it("calcula tiempos absolutos para negras, corcheas y semicorcheas", () => {
    expect(schedulerTimes(120, 1, 10, 4)).toEqual([10, 10.5, 11, 11.5]);
    expect(schedulerTimes(60, 2, 3, 4)).toEqual([3, 3.5, 4, 4.5]);
    expect(schedulerTimes(120, 4, 0, 4)).toEqual([0, .125, .25, .375]);
    for (const bpm of [40, 97, 200]) {
      const times = schedulerTimes(bpm, 4, 12, 128);
      expect(times[127]).toBeCloseTo(12 + 127 * 60 / bpm / 4, 12);
    }
    expect(schedulerTimes(60, 1, 0, 0)).toEqual([]);
    expect(() => schedulerTimes(0, 4, 0, 1)).toThrow(RangeError);
    expect(() => schedulerTimes(201, 4, 0, 1)).toThrow(RangeError);
    expect(() => schedulerTimes(80, 0, 0, 1)).toThrow(RangeError);
  });

  it("acentúa el primer tiempo y respeta 2 y 4 y ciclos de compases mudos", () => {
    expect([0, 1, 2, 3].map((beat) => clickAudible(0, beat, true, false))).toEqual([false, true, false, true]);
    expect(Array.from({ length: 8 }, (_, bar) => clickAudible(bar, 0, false, true))).toEqual([true, true, false, false, true, true, false, false]);
    expect(clickAudible(2, 1, true, true)).toBe(false);
    expect(clickAudible(4, 1, true, true)).toBe(true);
  });

  it("programa ~100 ms por delante con Web Audio y cancela los clics pendientes", () => {
    vi.useFakeTimers();
    const oscillators: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; frequency: { value: number } }> = [];
    const gain = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
    const ctx = {
      currentTime: 10, destination: {}, createGain: () => gain,
      createOscillator: () => {
        const osc = { start: vi.fn(), stop: vi.fn(), connect: () => gain, disconnect: vi.fn(), frequency: { value: 0 }, onended: null };
        oscillators.push(osc);
        return osc;
      },
    };
    audio.context = ctx;
    const onStep = vi.fn();
    const metronome = startMetronome({ bpm: 120, bars: 1, subdivision: 4, onStep });
    expect(oscillators).toHaveLength(0);
    ctx.currentTime = 10.06;
    vi.advanceTimersByTime(25);
    expect(oscillators).toHaveLength(1);
    expect(oscillators[0].start).toHaveBeenCalledWith(10.15);
    expect(oscillators[0].frequency.value).toBe(1600);
    expect(onStep).toHaveBeenCalledWith(0, 10.15);
    ctx.currentTime = 10.6;
    vi.advanceTimersByTime(25);
    expect(oscillators[1].start).toHaveBeenCalledWith(10.65);
    expect(oscillators[1].frequency.value).toBe(1000);
    expect(metronome.endTime).toBeCloseTo(12.15);
    metronome.stop();
    expect(oscillators.every((osc) => osc.stop.mock.calls.length === 2)).toBe(true);
    const calls = onStep.mock.calls.length;
    ctx.currentTime = 11;
    vi.advanceTimersByTime(1000);
    expect(onStep).toHaveBeenCalledTimes(calls);
  });
});

describe("tap tempo", () => {
  it("usa la media de los intervalos, no la media de los BPM", () => {
    expect(tapTempo([0])).toBeNull();
    expect(tapTempo([0, 400, 1000])).toBe(120);
    expect(tapTempo([0, 1500, 3000])).toBe(40);
    expect(tapTempo([0, 300, 600])).toBe(200);
  });
  it("descarta pausas largas e intervalos inválidos", () => {
    expect(tapTempo([0, 500, 5000])).toBeNull();
    expect(tapTempo([0, 500, 5000, 6000, 7000])).toBe(60);
    expect(tapTempo([0, 0])).toBeNull();
    expect(tapTempo([200, 100])).toBeNull();
    expect(tapTempo([0, Number.NaN])).toBeNull();
    expect(clampBpm(Number.NaN)).toBe(40);
  });
  it("limita el tempo y conserva los ocho intervalos recientes", () => {
    expect(tapTempo([0, 100])).toBe(200);
    expect(tapTempo([0, 2000])).toBe(40);
    expect(tapTempo([0, 1000, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000])).toBe(120);
  });
});
