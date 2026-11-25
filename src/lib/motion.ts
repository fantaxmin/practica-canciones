import gsap from "gsap";
import { tick } from "svelte";
import { readable, type Readable } from "svelte/store";

export { gsap };

/** Tokens compartidos de duración (en segundos) y easing para toda la app. */
export const MOTION = {
  duration: {
    view: 0.16,
    indicator: 0.22,
    count: 0.6,
    staggerList: 0.04,
    fast: 0.18,
    deal: 0.34,
    flip: 0.24,
    flight: 0.38,
    discard: 0.28,
    stagger: 0.055,
  },
  ease: {
    out: "power3.out",
    in: "power2.in",
    inOut: "power2.inOut",
    back: "back.out(1.25)",
  },
} as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Un único listener compartido mientras haya consumidores. */
export const reducedMotion: Readable<boolean> = readable(prefersReducedMotion(), (set) => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  const sync = () => set(query.matches);
  sync();
  query.addEventListener("change", sync);
  return () => query.removeEventListener("change", sync);
});

export interface MotionHandle {
  kill(): void;
  finish(): void;
}

export function createAnimationGroup() {
  const animations = new Set<MotionHandle | gsap.core.Animation>();
  return {
    add<T extends MotionHandle | gsap.core.Animation>(animation: T): T {
      animations.add(animation);
      return animation;
    },
    killAll() {
      const pending = [...animations];
      animations.clear();
      for (const animation of pending) animation.kill();
    },
    finishAll() {
      const pending = [...animations];
      animations.clear();
      for (const animation of pending) {
        if ("finish" in animation) animation.finish();
        else animation.totalProgress(1).kill();
      }
    },
  };
}

let flipPromise: Promise<typeof import("gsap/Flip").Flip> | undefined;
export function loadFlip(): Promise<typeof import("gsap/Flip").Flip> {
  return flipPromise ??= import("gsap/Flip").then(({ Flip }) => {
    gsap.registerPlugin(Flip);
    return Flip;
  }).catch((error) => {
    flipPromise = undefined;
    throw error;
  });
}

const idleHandle = (): MotionHandle => ({ kill() {}, finish() {} });

/** Finaliza también si cambia la preferencia durante la animación. */
function managedHandle(animation: gsap.core.Animation, final: () => void = () => {}): MotionHandle {
  let settled = false;
  let finalized = false;
  const finalize = () => {
    if (finalized) return;
    finalized = true;
    final();
  };
  let unsubscribe = () => {};
  const complete = animation.eventCallback("onComplete");
  const cleanup = () => {
    settled = true;
    unsubscribe();
  };
  const handle: MotionHandle = {
    kill() {
      if (settled) return;
      cleanup();
      animation.kill();
    },
    finish() {
      if (settled) return;
      cleanup();
      animation.totalProgress(1);
      finalize();
      animation.kill();
    },
  };
  animation.eventCallback("onComplete", () => {
    cleanup();
    finalize();
    complete?.call(animation);
  });
  unsubscribe = reducedMotion.subscribe((reduced) => { if (reduced) handle.finish(); });
  if (settled) unsubscribe();
  return handle;
}

export async function flipLayout(
  targets: Element[] | NodeListOf<Element>,
  mutate: () => void | Promise<void>,
  opts: { duration?: number; stagger?: number; absolute?: boolean; onEnter?: (els: Element[]) => void; onLeave?: (els: Element[]) => void } = {}
): Promise<MotionHandle> {
  if (prefersReducedMotion()) {
    await mutate();
    await tick();
    return idleHandle();
  }
  const Flip = await loadFlip();
  const state = Flip.getState(targets);
  await mutate();
  await tick();
  if (prefersReducedMotion()) return idleHandle();
  return managedHandle(Flip.from(state, {
    duration: opts.duration ?? MOTION.duration.view,
    stagger: opts.stagger ?? 0,
    absolute: opts.absolute ?? false,
    scale: true,
    ease: MOTION.ease.out,
    onEnter: opts.onEnter,
    onLeave: opts.onLeave,
  }));
}

export function staggerIn(
  targets: Element[] | NodeListOf<Element>,
  opts: { y?: number; max?: number; duration?: number; stagger?: number } = {}
): MotionHandle {
  const elements = Array.from(targets);
  const max = Math.max(0, Math.min(12, Math.floor(opts.max ?? 12)));
  if (prefersReducedMotion() || max === 0 || elements.length === 0) return idleHandle();
  return managedHandle(gsap.from(elements.slice(0, max), {
    y: opts.y ?? 12,
    opacity: 0,
    duration: opts.duration ?? MOTION.duration.view,
    stagger: opts.stagger ?? MOTION.duration.staggerList,
    ease: MOTION.ease.out,
    clearProps: "transform,opacity",
  }));
}

export function countUp(
  el: HTMLElement,
  to: number,
  opts: { from?: number; duration?: number; format?: (n: number) => string } = {}
): MotionHandle {
  const format = opts.format ?? ((value: number) => String(Math.round(value)));
  const writeFinal = () => { el.textContent = format(to); };
  if (prefersReducedMotion()) {
    writeFinal();
    return idleHandle();
  }
  const counter = { value: opts.from ?? 0 };
  el.textContent = format(counter.value);
  return managedHandle(gsap.to(counter, {
    value: to,
    duration: opts.duration ?? MOTION.duration.count,
    ease: MOTION.ease.out,
    onUpdate: () => { el.textContent = format(counter.value); },
  }), writeFinal);
}

/**
 * Envuelve animaciones dentro de un gsap.matchMedia + gsap.context con
 * prefers-reduced-motion centralizado. Devuelve el cleanup para Svelte ($effect / onMount).
 */
export function createMotionScope(
  scope: Element | undefined,
  setup: (env: { gsap: typeof gsap; reduced: boolean }) => void
): () => void {
  const mm = gsap.matchMedia();
  mm.add(
    {
      reduced: "(prefers-reduced-motion: reduce)",
      all: "all",
    },
    (context) => {
      const reduced = Boolean(context.conditions?.reduced);
      const ctx = gsap.context(() => {
        setup({ gsap, reduced });
      }, scope);
      return () => ctx.revert();
    },
    scope
  );
  return () => mm.revert();
}

export interface TokenGuard {
  readonly current: number;
  next(): number;
  invalidate(): void;
  isCurrent(token: number): boolean;
}

/** Guardia de versión para descartar callbacks de animaciones interrumpidas. */
export function createTokenGuard(): TokenGuard {
  let current = 0;
  return {
    get current() {
      return current;
    },
    next() {
      current += 1;
      return current;
    },
    invalidate() {
      current += 1;
    },
    isCurrent(token: number) {
      return token === current;
    },
  };
}

export interface GhostFlightOptions {
  el: HTMLElement;
  from: DOMRect;
  to: DOMRect;
  token: number;
  isCurrent: (token: number) => boolean;
  /** Volteo 2D usando scaleX (evita parpadeos de rotateY 3D en WebKitGTK/Tauri). */
  flip?: boolean;
  frontEl?: HTMLElement | null;
  backEl?: HTMLElement | null;
  startFace?: "back" | "front";
  duration?: number;
  ease?: string;
  fromRotation?: number;
  toRotation?: number;
  onMidpoint?: () => void;
  onComplete?: () => void;
}

export interface GhostFlightHandle extends MotionHandle {}

function isValidRect(rect: DOMRect | null | undefined): rect is DOMRect {
  return Boolean(rect && rect.width > 0 && rect.height > 0);
}

/**
 * Anima una "carta fantasma" position:fixed desde `from` hasta `to`
 * usando solo transformaciones 2D (translate/scale/rotate) y opcionalmente
 * volteo 2D con scaleX. Cancelable y protegida por token.
 */
export function flyGhostCard(options: GhostFlightOptions): GhostFlightHandle {
  const {
    el,
    from,
    to,
    token,
    isCurrent,
    flip = false,
    frontEl = null,
    backEl = null,
    startFace = "back",
    duration = MOTION.duration.flight,
    ease = MOTION.ease.out,
    fromRotation = 0,
    toRotation = 0,
    onMidpoint,
    onComplete,
  } = options;

  if (prefersReducedMotion() || !isValidRect(from) || !isValidRect(to)) {
    if (isCurrent(token)) {
      onMidpoint?.();
      onComplete?.();
    }
    return { kill() {}, finish() {} };
  }

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const sx = to.width / from.width;
  const sy = to.height / from.height;

  gsap.set(el, {
    position: "fixed",
    left: from.left,
    top: from.top,
    width: from.width,
    height: from.height,
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: fromRotation,
    transformOrigin: "center center",
    margin: 0,
    pointerEvents: "none",
    zIndex: 1000,
    opacity: 1,
  });

  if (frontEl && backEl) {
    const showBackFirst = flip && startFace === "back";
    gsap.set(frontEl, { display: showBackFirst ? "none" : "block" });
    gsap.set(backEl, { display: showBackFirst ? "block" : "none" });
  }

  const tl = gsap.timeline({
    onComplete() {
      if (isCurrent(token)) {
        onComplete?.();
      }
    },
  });

  tl.to(
    el,
    {
      x: dx,
      y: dy,
      scaleY: sy,
      rotation: toRotation,
      duration,
      ease,
    },
    0
  );

  if (flip) {
    const mid = duration * 0.42;
    tl.to(
      el,
      {
        scaleX: 0.02,
        duration: mid,
        ease: MOTION.ease.in,
        onComplete() {
          if (!isCurrent(token)) return;
          if (frontEl && backEl) {
            const swapToFront = startFace === "back";
            gsap.set(frontEl, { display: swapToFront ? "block" : "none" });
            gsap.set(backEl, { display: swapToFront ? "none" : "block" });
          }
          onMidpoint?.();
        },
      },
      0
    ).to(
      el,
      {
        scaleX: sx,
        duration: duration - mid,
        ease: MOTION.ease.out,
      },
      mid
    );
  } else {
    tl.to(
      el,
      {
        scaleX: sx,
        duration,
        ease,
      },
      0
    );
  }

  return managedHandle(tl);
}
