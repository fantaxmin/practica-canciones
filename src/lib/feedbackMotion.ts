import { MOTION, gsap, prefersReducedMotion, type MotionHandle } from "./motion";

const NOOP_HANDLE: MotionHandle = {
  kill() {},
  finish() {},
};

function wrapAnimation(animation: gsap.core.Animation): MotionHandle {
  let done = false;
  return {
    kill() {
      if (done) return;
      done = true;
      animation.kill();
    },
    finish() {
      if (done) return;
      done = true;
      animation.progress(1).kill();
    },
  };
}

/** Pop corto localizado sobre la opción correcta (HTML o nodo SVG). */
export function popCorrect(
  el: Element | null | undefined,
  opts?: { scale?: number; svgOrigin?: string }
): MotionHandle {
  if (!el || prefersReducedMotion()) return NOOP_HANDLE;
  const peak = opts?.scale ?? 1.06;
  const origin = opts?.svgOrigin ? { svgOrigin: opts.svgOrigin } : {};

  const tl = gsap.timeline();
  tl.fromTo(
    el,
    { scale: 1, ...origin },
    {
      scale: peak,
      ...origin,
      duration: MOTION.duration.fast * 0.55,
      ease: MOTION.ease.out,
    }
  ).to(el, {
    scale: 1,
    ...origin,
    duration: MOTION.duration.fast * 0.9,
    ease: MOTION.ease.back,
    clearProps: "transform,transformOrigin",
  });

  return wrapAnimation(tl);
}

/** Pequeño "nudge" horizontal (<=6px, 1 vez) solo sobre la opción incorrecta. */
export function nudgeWrong(el: Element | null | undefined): MotionHandle {
  if (!el || prefersReducedMotion()) return NOOP_HANDLE;

  const tl = gsap.timeline();
  tl.to(el, {
    x: -5,
    duration: 0.08,
    ease: MOTION.ease.out,
  })
    .to(el, {
      x: 4,
      duration: 0.09,
      ease: MOTION.ease.inOut,
    })
    .to(el, {
      x: 0,
      duration: 0.09,
      ease: MOTION.ease.out,
      clearProps: "transform",
    });

  return wrapAnimation(tl);
}

/** Volteo 2D con scaleX (sin rotateY 3D, seguro en WebKitGTK/Tauri). */
export function revealFlip2D(
  targets: Element[] | NodeListOf<Element>,
  opts?: { duration?: number; stagger?: number }
): MotionHandle {
  const list = Array.from(targets);
  if (!list.length || prefersReducedMotion()) return NOOP_HANDLE;

  const tween = gsap.fromTo(
    list,
    { scaleX: 0.08, opacity: 0 },
    {
      scaleX: 1,
      opacity: 1,
      duration: opts?.duration ?? MOTION.duration.flip,
      stagger: opts?.stagger ?? 0.055,
      ease: MOTION.ease.out,
      clearProps: "transform,opacity",
    }
  );

  return wrapAnimation(tween);
}

/** Transición breve de entrada para un paso/ejercicio sin afectar foco. */
export function stepReveal(
  el: Element | null | undefined,
  opts?: { x?: number; y?: number; duration?: number }
): MotionHandle {
  if (!el || prefersReducedMotion()) return NOOP_HANDLE;

  const tween = gsap.fromTo(
    el,
    {
      opacity: 0,
      x: opts?.x ?? 0,
      y: opts?.y ?? 8,
    },
    {
      opacity: 1,
      x: 0,
      y: 0,
      duration: opts?.duration ?? MOTION.duration.view,
      ease: MOTION.ease.out,
      clearProps: "transform,opacity",
    }
  );

  return wrapAnimation(tween);
}
