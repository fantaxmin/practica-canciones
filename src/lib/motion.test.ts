import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => {
  const animations: any[] = [];
  const animate = vi.fn((_targets: unknown, vars: any) => {
    const callbacks: Record<string, any> = { onComplete: vars.onComplete };
    const animation: any = {
      kill: vi.fn(),
      totalProgress: vi.fn(() => { callbacks.onComplete?.(); return animation; }),
      eventCallback: vi.fn((name: string, callback?: unknown) => {
        if (callback === undefined) return callbacks[name];
        callbacks[name] = callback;
        return animation;
      }),
    };
    animations.push(animation);
    return animation;
  });
  return { animations, animate, register: vi.fn(), getState: vi.fn(() => ({})), flipFrom: vi.fn() };
});
vi.mock("gsap", () => ({ default: { from: mocks.animate, to: mocks.animate, registerPlugin: mocks.register } }));
vi.mock("gsap/Flip", () => ({ Flip: { getState: mocks.getState, from: mocks.flipFrom } }));
import { countUp, createAnimationGroup, flipLayout, loadFlip, reducedMotion, staggerIn } from "./motion";

function mediaQuery(reduced = false) {
  const listeners = new Set<() => void>();
  const query = {
    matches: reduced,
    addEventListener: vi.fn((_event: string, listener: () => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_event: string, listener: () => void) => listeners.delete(listener)),
  };
  vi.stubGlobal("window", { matchMedia: vi.fn(() => query) });
  return { query, change(value: boolean) { query.matches = value; for (const listener of listeners) listener(); } };
}
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); mocks.animations.length = 0; });

describe("motion", () => {
  it("agrupa handles y animaciones GSAP; vaciar es idempotente", () => {
    const group = createAnimationGroup();
    const handle = { kill: vi.fn(), finish: vi.fn() };
    const animation = mocks.animate([], {});
    expect(group.add(handle)).toBe(handle);
    group.add(animation);
    group.finishAll(); group.finishAll(); group.killAll();
    expect(handle.finish).toHaveBeenCalledTimes(1);
    expect(animation.totalProgress).toHaveBeenCalledWith(1);
    expect(animation.kill).toHaveBeenCalledTimes(1);
    const other = { kill: vi.fn(), finish: vi.fn() };
    group.add(other); group.killAll(); group.finishAll();
    expect(other.kill).toHaveBeenCalledTimes(1);
    expect(other.finish).not.toHaveBeenCalled();
  });
  it("comparte el listener y lo retira al desuscribir", () => {
    const { query, change } = mediaQuery();
    const values: boolean[] = [];
    const a = reducedMotion.subscribe((value) => values.push(value));
    const b = reducedMotion.subscribe(() => {});
    expect(query.addEventListener).toHaveBeenCalledTimes(1);
    change(true);
    expect(values.at(-1)).toBe(true);
    a(); b();
    expect(query.removeEventListener).toHaveBeenCalledTimes(1);
  });
  it("countUp reducido escribe el destino formateado sin crear tween", () => {
    mediaQuery(true);
    const el = { textContent: "" } as HTMLElement;
    const handle = countUp(el, 42, { format: (n) => `${n} min` });
    handle.finish(); handle.finish();
    expect(el.textContent).toBe("42 min");
    expect(mocks.animate).not.toHaveBeenCalled();
  });
  it("finish y cambio de preferencia finalizan una sola vez y limpian el listener", () => {
    const { query, change } = mediaQuery();
    const el = { textContent: "" } as HTMLElement;
    const handle = countUp(el, 42);
    expect(el.textContent).toBe("0");
    change(true); handle.finish(); handle.kill();
    expect(el.textContent).toBe("42");
    expect(mocks.animations[0].totalProgress).toHaveBeenCalledTimes(1);
    expect(query.removeEventListener).toHaveBeenCalledTimes(1);
  });
  it("kill cancela sin saltar al destino", () => {
    mediaQuery();
    const el = { textContent: "" } as HTMLElement;
    const handle = countUp(el, 42, { from: 3 });
    handle.kill(); handle.finish();
    expect(el.textContent).toBe("3");
    expect(mocks.animations[0].kill).toHaveBeenCalledTimes(1);
  });
  it("stagger limita el número de elementos y permite max=0", () => {
    mediaQuery();
    const targets = Array.from({ length: 20 }, () => ({} as Element));
    const handle = staggerIn(targets, { max: 4 });
    expect(mocks.animate.mock.calls.at(-1)?.[0]).toEqual(targets.slice(0, 4));
    handle.finish(); handle.finish();
    expect(mocks.animations[0].totalProgress).toHaveBeenCalledTimes(1);
    const capped = staggerIn(targets, { max: 99 });
    expect((mocks.animate.mock.calls.at(-1)?.[0] as Element[]).length).toBe(12);
    capped.kill();
    mocks.animate.mockClear();
    staggerIn(targets, { max: 0 });
    expect(mocks.animate).not.toHaveBeenCalled();
  });
  it("stagger reducido no anima", () => {
    mediaQuery(true);
    staggerIn([{} as Element]);
    expect(mocks.animate).not.toHaveBeenCalled();
  });
  it("Flip reducido ejecuta mutate sin cargar ni capturar geometría", async () => {
    mediaQuery(true);
    const mutate = vi.fn(async () => {});
    await flipLayout([], mutate);
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mocks.getState).not.toHaveBeenCalled();
  });
  it("carga y registra Flip una sola vez", async () => {
    const [a, b] = await Promise.all([loadFlip(), loadFlip()]);
    expect(a).toBe(b);
    expect(mocks.register).toHaveBeenCalledTimes(1);
  });
});
