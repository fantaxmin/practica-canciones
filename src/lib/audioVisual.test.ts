import { describe, expect, it } from "vitest";
import { audioPosition, pulseAppearance } from "./audioVisual";

describe("posición visual del reloj de audio", () => {
  it("mantiene el estado previo al inicio y calcula negras, corcheas y semicorcheas", () => {
    expect(audioPosition(9.99, 10, 120, 4, 32)).toMatchObject({ step: -1, bar: -1, phase: 0 });
    expect(audioPosition(10, 10, 120, 4, 32)).toMatchObject({ step: 0, beat: 0, phase: 0 });
    expect(audioPosition(10.375, 10, 120, 4, 32)).toMatchObject({ step: 3, beat: 0, phase: .75 });
    expect(audioPosition(10.75, 10, 120, 2, 16)).toMatchObject({ step: 3, beat: 1, phase: .5 });
    expect(audioPosition(12, 10, 120, 1, 8)).toMatchObject({ step: 4, bar: 1, beat: 0, phase: 0 });
  });
  it("conserva la fase con el reloj suspendido, sin depender del tiempo de pared", () => {
    const paused = audioPosition(10.75, 10, 120, 4, 32);
    for (let frame = 0; frame < 100; frame++) expect(audioPosition(10.75, 10, 120, 4, 32)).toEqual(paused);
    expect(audioPosition(11, 10, 120, 4, 32)).toMatchObject({ absoluteStep: 8, phase: 0 });
  });
  it("salta directamente al compás actual tras segundo plano, también en loop", () => {
    expect(audioPosition(71.25, 10, 120, 4, 32)).toEqual({ absoluteStep: 490, step: 10, bar: 30, beat: 2, phase: .5 });
    expect(audioPosition(3610, 10, 120, 4, 32)).toMatchObject({ absoluteStep: 28800, step: 0, bar: 1800 });
  });
  it("un cambio de BPM con nuevo inicio reinicia sin arrastrar pasos ni fase anteriores", () => {
    expect(audioPosition(12.25, 10, 120, 4, 32).absoluteStep).toBe(18);
    expect(audioPosition(12.25, 12.4, 60, 4, 32).step).toBe(-1);
    expect(audioPosition(12.9, 12.4, 60, 4, 32)).toMatchObject({ step: 2, beat: 0, phase: .5 });
  });
  it("no acumula deriva y resuelve fronteras decimales", () => {
    for (const bpm of [40, 97, 160, 200]) {
      expect(audioPosition(10 + 127 * 60 / bpm / 4, 10, bpm, 4, 128).absoluteStep).toBe(127);
    }
    expect(audioPosition(.3, .1, 150, 2, 16).step).toBe(1);
  });
  it("rechaza entradas que producirían índices o estilos inválidos", () => {
    for (const args of [[NaN, 0, 120, 4, 16], [1, Infinity, 120, 4, 16], [1, 0, 0, 4, 16], [1, 0, 120, .5, 16], [1, 0, 120, 4, 0]]) {
      expect(() => audioPosition(...args as [number, number, number, number, number])).toThrow(RangeError);
    }
  });
});

describe("marcador de pulso", () => {
  it("acentúa el primer tiempo y no anima en subdivisiones intermedias", () => {
    const first = pulseAppearance(audioPosition(0, 0, 120, 4, 16), false);
    const second = pulseAppearance(audioPosition(.5, 0, 120, 4, 16), false);
    expect(first.scale).toBeGreaterThan(second.scale);
    expect(pulseAppearance(audioPosition(.25, 0, 120, 4, 16), false)).toEqual({ scale: 1, opacity: .45 });
  });
  it("reduced-motion es estático, parar o suspender devuelve el marcador neutro", () => {
    for (const time of [0, .1, .5, 20]) {
      const position = audioPosition(time, 0, 120, 4, 16);
      expect(pulseAppearance(position, true)).toEqual({ scale: 1, opacity: 1 });
      expect(pulseAppearance(position, false, false)).toEqual({ scale: 1, opacity: .25 });
    }
  });
});
