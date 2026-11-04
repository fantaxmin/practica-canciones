import { afterEach, describe, expect, it, vi } from "vitest";

function mockAudio() {
  const played: { frequency: number; start: number; stop: ReturnType<typeof vi.fn> }[] = [];
  const levels: number[] = [];
  const created = vi.fn();
  class AudioContext {
    currentTime = 100;
    state = "running";
    destination = {};
    constructor() { created(); }
    createGain() {
      return {
        gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime(value: number) { levels.push(value); }, exponentialRampToValueAtTime() {} },
        connect() { return this; }, disconnect() {},
      };
    }
    createOscillator() {
      const stop = vi.fn();
      return {
        type: "", frequency: { value: 0 }, onended: null,
        connect() { return this; },
        start(start: number) { played.push({ frequency: this.frequency.value, start, stop }); }, stop,
      };
    }
  }
  vi.stubGlobal("window", { AudioContext });
  return { played, levels, created };
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("acompañamiento de acordes", () => {
  it("conserva volumen e inicio de las llamadas existentes y permanece silencioso al importar", async () => {
    const audio = mockAudio();
    const { playChord } = await import("./synth");
    expect(audio.created).not.toHaveBeenCalled();
    playChord([57, 60, 64], 2);
    expect(audio.played.map((note) => note.start)).toEqual([100, 100, 100]);
    expect(audio.levels).toEqual(Array(3).fill(0.6 / Math.sqrt(3)));
  });

  it("permite acordes suaves sincronizados con el bajo y cancela notas futuras", async () => {
    const audio = mockAudio();
    const { playChord, playNote, stopAll, midiToFrequency } = await import("./synth");
    playChord([60, 64, 67], 2, 0.18, 0.06);
    playNote(36, 0.5, 0.06, 0.75);
    expect(audio.played.map((note) => note.start)).toEqual(Array(4).fill(100.06));
    expect(audio.played.map((note) => note.frequency)).toEqual([60, 64, 67, 36].map(midiToFrequency));
    expect(audio.levels.slice(0, 3)).toEqual(Array(3).fill(0.18 / Math.sqrt(3)));
    expect(audio.levels[3]).toBe(0.75);
    stopAll();
    expect(audio.played.every((note) => note.stop.mock.calls.some((call) => call.length === 0))).toBe(true);
  });
});
