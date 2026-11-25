<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { MOTION, createAnimationGroup, gsap, reducedMotion } from "../../lib/motion";

  interface Props {
    active: boolean;
    /** Opcional: incrementar para reiniciar el pulso si active ya es true. */
    trigger?: number;
    label?: string;
  }

  let { active, trigger = 0, label = "Marcada como practicada" }: Props = $props();

  let badgeEl = $state<HTMLSpanElement>();
  let ringEl = $state<HTMLSpanElement>();
  const group = createAnimationGroup();

  $effect(() => {
    const isActive = active;
    void trigger;
    const isReduced = $reducedMotion;

    group.killAll();
    if (!isActive) return;

    let cancelled = false;
    void tick().then(() => {
      if (cancelled || !active || !badgeEl) return;

      if (isReduced) {
        gsap.set(badgeEl, { scale: 1, opacity: 1, clearProps: "transform,opacity" });
        if (ringEl) gsap.set(ringEl, { opacity: 0, scale: 1 });
        return;
      }

      const tl = gsap.timeline();
      tl.fromTo(
        badgeEl,
        { scale: 0.45, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: MOTION.duration.deal,
          ease: MOTION.ease.back,
          clearProps: "transform,opacity",
        },
        0
      );

      if (ringEl) {
        tl.fromTo(
          ringEl,
          { scale: 0.75, opacity: 0.85 },
          {
            scale: 2.1,
            opacity: 0,
            duration: 0.42,
            ease: MOTION.ease.out,
            clearProps: "transform",
          },
          0
        );
      }

      group.add(tl);
    });

    return () => {
      cancelled = true;
      group.killAll();
    };
  });

  onDestroy(() => {
    group.killAll();
  });
</script>

{#if active}
  <span class="practiced-pulse" role="img" aria-label={label}>
    <span class="pulse-ring" bind:this={ringEl} aria-hidden="true"></span>
    <span class="pulse-badge" bind:this={badgeEl} aria-hidden="true">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 13l4 4L19 7"
          stroke="var(--on-accent)"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>
  </span>
{/if}

<style>
  .practiced-pulse {
    position: relative;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
  }

  .pulse-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid var(--accent);
    opacity: 0;
    pointer-events: none;
    will-change: transform, opacity;
  }

  .pulse-badge {
    position: relative;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--accent);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    will-change: transform, opacity;
  }
</style>
