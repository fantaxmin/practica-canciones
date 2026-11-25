<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { MOTION, gsap, reducedMotion } from "../../lib/motion";

  interface Props {
    container: HTMLElement | undefined;
    activeKey: string;
    selector?: string;
    scrollActiveIntoView?: boolean;
  }

  let {
    container,
    activeKey,
    selector = ".active",
    scrollActiveIntoView = false,
  }: Props = $props();

  let indicatorEl = $state<HTMLSpanElement>();
  let ready = $state(false);
  let hasPositioned = false;

  function measure(el: HTMLElement, root: HTMLElement) {
    if (el.offsetParent === root) {
      return {
        x: el.offsetLeft,
        y: el.offsetTop,
        width: el.offsetWidth,
        height: el.offsetHeight,
      };
    }
    const elRect = el.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    return {
      x: elRect.left - rootRect.left + root.scrollLeft,
      y: elRect.top - rootRect.top + root.scrollTop,
      width: elRect.width,
      height: elRect.height,
    };
  }

  function syncIndicator(animate: boolean) {
    if (!container || !indicatorEl) return;
    const active = container.querySelector<HTMLElement>(selector);
    if (!active) {
      ready = false;
      return;
    }

    const rect = measure(active, container);
    if (rect.width <= 0 || rect.height <= 0) return;

    gsap.killTweensOf(indicatorEl);

    if (!animate || !hasPositioned || $reducedMotion) {
      gsap.set(indicatorEl, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        opacity: 1,
      });
    } else {
      gsap.to(indicatorEl, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        opacity: 1,
        duration: MOTION.duration.indicator,
        ease: MOTION.ease.out,
        overwrite: "auto",
      });
    }

    hasPositioned = true;
    ready = true;
  }

  $effect(() => {
    void activeKey;
    const root = container;
    if (!root) return;

    let cancelled = false;
    void tick().then(() => {
      if (cancelled || !container) return;
      const shouldAnimate = hasPositioned;
      syncIndicator(shouldAnimate);
      if (scrollActiveIntoView && shouldAnimate) {
        const active = container.querySelector<HTMLElement>(selector);
        active?.scrollIntoView?.({
          block: "nearest",
          inline: "nearest",
          behavior: $reducedMotion ? "auto" : "smooth",
        });
      }
    });

    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    const root = container;
    if (!root) return;
    root.classList.toggle("has-sliding-indicator", ready);
    return () => {
      root.classList.remove("has-sliding-indicator");
    };
  });

  $effect(() => {
    const root = container;
    if (!root) return;

    const snap = () => syncIndicator(false);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(snap);
      ro.observe(root);
      for (const child of root.querySelectorAll<HTMLElement>("button, a")) {
        ro.observe(child);
      }
    }
    window.addEventListener("resize", snap);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", snap);
    };
  });

  onDestroy(() => {
    if (indicatorEl) gsap.killTweensOf(indicatorEl);
  });
</script>

<span
  class="sliding-indicator"
  class:ready
  bind:this={indicatorEl}
  aria-hidden="true"
></span>

<style>
  .sliding-indicator {
    position: absolute;
    top: 0;
    left: 0;
    border-radius: 999px;
    background: var(--coral);
    border: 1px solid var(--line);
    pointer-events: none;
    z-index: 0;
    opacity: 0;
    will-change: transform, width, height;
  }

  .sliding-indicator.ready {
    opacity: 1;
  }
</style>
