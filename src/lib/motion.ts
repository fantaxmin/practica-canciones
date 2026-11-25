import gsap from "gsap";

export { gsap };

/** Tokens compartidos de duración (en segundos) y easing para toda la app. */
export const MOTION = {
  duration: {
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

export interface GhostFlightHandle {
  kill(): void;
  finish(): void;
}

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

  return {
    kill() {
      tl.kill();
    },
    finish() {
      tl.progress(1).kill();
    },
  };
}
