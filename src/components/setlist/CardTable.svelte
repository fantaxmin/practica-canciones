<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { Snippet } from "svelte";
  import type { Instrument, Song } from "../../lib/types";
  import {
    MOTION,
    createMotionScope,
    createTokenGuard,
    flyGhostCard,
    prefersReducedMotion,
    type GhostFlightHandle,
  } from "../../lib/motion";
  import SongCard from "./SongCard.svelte";
  import PlayedCard from "./PlayedCard.svelte";

  interface Props {
    songs: Song[];
    currentIndex: number;
    practicedIds: string[];
    stage: "deal" | "playing" | "complete";
    dealKey: string | number;
    instrument: Instrument;
    actions?: Snippet;
  }

  let {
    songs,
    currentIndex,
    practicedIds,
    stage,
    dealKey,
    instrument,
    actions,
  }: Props = $props();

  interface GhostItem {
    id: number;
    song: Song;
    order: number;
    status: "pending" | "current" | "practiced" | "skipped";
    startFace: "back" | "front";
    flip: boolean;
    from: DOMRect;
    to: DOMRect;
    fromRotation: number;
    toRotation: number;
    duration: number;
    kind: "draw" | "discard" | "return";
  }

  const FAN_MAX_CARDS = 5;
  const FAN_MIN_WIDTH = 768;

  let tableEl = $state<HTMLDivElement>();
  let deckEl = $state<HTMLDivElement>();
  let discardEl = $state<HTMLDivElement>();
  let playedSlotEl = $state<HTMLDivElement>();
  let playedCardRef = $state<ReturnType<typeof PlayedCard>>();
  let containerWidth = $state(0);
  let now = $state(Date.now());

  let ghosts = $state<GhostItem[]>([]);
  let hidePlayedCard = $state(false);
  let isAnimatingPlayed = $state(false);
  let pendingFocus = $state(false);

  const fanEls = new Map<string, HTMLElement>();
  const ghostEls = new Map<number, { root: HTMLElement; front: HTMLElement | null; back: HTMLElement | null }>();

  const dealGuard = createTokenGuard();
  const flightGuard = createTokenGuard();
  let dealCleanup: (() => void) | null = null;
  let activeFlights: GhostFlightHandle[] = [];
  let ghostSeq = 0;

  let prev: {
    initialized: boolean;
    stage: Props["stage"];
    currentIndex: number;
    songs: Song[];
    dealKey: string | number;
    isFan: boolean;
  } = {
    initialized: false,
    stage: "deal",
    currentIndex: 0,
    songs: [],
    dealKey: "",
    isFan: false,
  };

  const isFan = $derived(songs.length <= FAN_MAX_CARDS && containerWidth >= FAN_MIN_WIDTH);
  const practicedSet = $derived(new Set(practicedIds));
  const currentSong = $derived(stage === "playing" ? (songs[currentIndex] ?? null) : null);
  const remainingSongs = $derived(
    stage === "playing" ? songs.slice(currentIndex + 1) : stage === "deal" ? songs : []
  );
  const remainingCount = $derived(remainingSongs.length);
  const discardedSongs = $derived(
    stage === "playing" ? songs.slice(0, currentIndex) : stage === "complete" ? songs : []
  );
  const lastDiscarded = $derived(
    discardedSongs.length ? discardedSongs[discardedSongs.length - 1] : null
  );
  const lastDiscardedIndex = $derived(discardedSongs.length ? discardedSongs.length - 1 : -1);

  function cardStatus(song: Song, index: number): "pending" | "current" | "practiced" | "skipped" {
    if (practicedSet.has(song.id)) return "practiced";
    if (stage === "playing" && index === currentIndex) return "current";
    if (stage === "complete" || (stage === "playing" && index < currentIndex)) return "skipped";
    return "pending";
  }

  function fanStyle(index: number, total: number, compact = false): string {
    const mid = (total - 1) / 2;
    const offset = index - mid;
    const angle = offset * (compact ? 4.5 : 6);
    const archY = Math.abs(offset) * Math.abs(offset) * (compact ? 3 : 5);
    return `--fan-rot:${angle}deg; --fan-y:${archY}px; --fan-z:${index + 1};`;
  }

  function registerFanCard(node: HTMLElement, songId: string) {
    let currentId = songId;
    fanEls.set(currentId, node);
    return {
      update(nextId: string) {
        if (nextId !== currentId) {
          fanEls.delete(currentId);
          currentId = nextId;
          fanEls.set(currentId, node);
        }
      },
      destroy() {
        fanEls.delete(currentId);
      },
    };
  }

  function registerGhost(node: HTMLElement, ghostId: number) {
    const capture = () => {
      ghostEls.set(ghostId, {
        root: node,
        front: node.querySelector<HTMLElement>("[data-ghost-face='front']"),
        back: node.querySelector<HTMLElement>("[data-ghost-face='back']"),
      });
    };
    capture();
    return {
      destroy() {
        ghostEls.delete(ghostId);
      },
    };
  }

  function cancelFlights() {
    flightGuard.invalidate();
    for (const handle of activeFlights) {
      handle.kill();
    }
    activeFlights = [];
    ghosts = [];
    hidePlayedCard = false;
    isAnimatingPlayed = false;
  }

  function isValidRect(rect: DOMRect | null | undefined): rect is DOMRect {
    return Boolean(rect && rect.width > 0 && rect.height > 0);
  }

  function readRect(el: HTMLElement | undefined | null): DOMRect | null {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return isValidRect(r) ? r : null;
  }

  function runDealAnimation() {
    dealCleanup?.();
    dealCleanup = null;
    const token = dealGuard.next();

    void tick().then(() => {
      if (!dealGuard.isCurrent(token) || !tableEl) return;
      dealCleanup = createMotionScope(tableEl, ({ gsap, reduced }) => {
        if (reduced) return;

        if (isFan) {
          const items = tableEl!.querySelectorAll<HTMLElement>("[data-deal-card]");
          if (!items.length) return;
          gsap.from(items, {
            y: 44,
            opacity: 0,
            scaleX: 0.08,
            duration: MOTION.duration.deal,
            stagger: MOTION.duration.stagger,
            ease: MOTION.ease.back,
            clearProps: "transform,opacity",
          });
        } else {
          const layers = tableEl!.querySelectorAll<HTMLElement>("[data-deck-layer]");
          if (!layers.length) return;
          gsap.from(layers, {
            y: -22,
            x: (i: number) => (i % 2 === 0 ? -14 : 14),
            rotation: (i: number) => (i % 2 === 0 ? -7 : 7),
            opacity: 0,
            duration: MOTION.duration.deal,
            stagger: 0.05,
            ease: MOTION.ease.out,
            clearProps: "transform,opacity",
          });
        }
      });
    });
  }

  interface FlightRequest {
    token: number;
    goingForward: boolean;
    goingBackward: boolean;
    enteringPlaying: boolean;
    incomingSong: Song | null;
    incomingOrder: number;
    outgoingSong: Song | null;
    outgoingOrder: number;
    outgoingStatus: "pending" | "current" | "practiced" | "skipped";
    prevPlayedRect: DOMRect | null;
    prevDeckRect: DOMRect | null;
    prevDiscardRect: DOMRect | null;
    prevFanRect: DOMRect | null;
    wasFan: boolean;
  }

  async function runFlightTransition(req: FlightRequest) {
    await tick();
    if (!flightGuard.isCurrent(req.token)) return;

    const newPlayedRect = readRect(playedSlotEl);
    const newDiscardRect = readRect(discardEl);
    const newDeckRect = readRect(deckEl);

    const nextGhosts: GhostItem[] = [];

    if (req.outgoingSong && isValidRect(req.prevPlayedRect)) {
      if (req.goingForward) {
        const target = newDiscardRect ?? req.prevDiscardRect;
        if (isValidRect(target)) {
          nextGhosts.push({
            id: ++ghostSeq,
            song: req.outgoingSong,
            order: req.outgoingOrder,
            status: req.outgoingStatus,
            startFace: "front",
            flip: false,
            from: req.prevPlayedRect,
            to: target,
            fromRotation: 0,
            toRotation: -4,
            duration: MOTION.duration.discard,
            kind: "discard",
          });
        }
      } else if (req.goingBackward) {
        const target =
          readRect(fanEls.get(req.outgoingSong.id)) ?? newDeckRect ?? req.prevDeckRect;
        if (isValidRect(target)) {
          nextGhosts.push({
            id: ++ghostSeq,
            song: req.outgoingSong,
            order: req.outgoingOrder,
            status: "pending",
            startFace: "front",
            flip: !req.wasFan,
            from: req.prevPlayedRect,
            to: target,
            fromRotation: 0,
            toRotation: 4,
            duration: MOTION.duration.discard,
            kind: "return",
          });
        }
      }
    }

    let hasDrawGhost = false;
    if (req.incomingSong && isValidRect(newPlayedRect)) {
      let origin: DOMRect | null = null;
      let startFace: "back" | "front" = "back";
      let flip = true;

      if (req.goingBackward) {
        origin = req.prevDiscardRect ?? newDiscardRect;
        startFace = "front";
        flip = false;
      } else if (req.wasFan && isValidRect(req.prevFanRect)) {
        origin = req.prevFanRect;
        startFace = "front";
        flip = false;
      } else {
        origin = req.prevDeckRect ?? newDeckRect;
        startFace = "back";
        flip = true;
      }

      if (isValidRect(origin)) {
        hasDrawGhost = true;
        nextGhosts.push({
          id: ++ghostSeq,
          song: req.incomingSong,
          order: req.incomingOrder,
          status: "current",
          startFace,
          flip,
          from: origin,
          to: newPlayedRect,
          fromRotation: req.goingBackward ? -4 : 0,
          toRotation: 0,
          duration: MOTION.duration.flight,
          kind: "draw",
        });
      }
    }

    if (!nextGhosts.length) {
      hidePlayedCard = false;
      isAnimatingPlayed = false;
      return;
    }

    if (!hasDrawGhost) {
      hidePlayedCard = false;
      isAnimatingPlayed = false;
    }

    ghosts = nextGhosts;
    await tick();
    if (!flightGuard.isCurrent(req.token)) return;

    const handles: GhostFlightHandle[] = [];

    for (const item of nextGhosts) {
      const refs = ghostEls.get(item.id);
      if (!refs) {
        if (item.kind === "draw") {
          hidePlayedCard = false;
          isAnimatingPlayed = false;
        }
        continue;
      }

      const handle = flyGhostCard({
        el: refs.root,
        from: item.from,
        to: item.to,
        token: req.token,
        isCurrent: (t) => flightGuard.isCurrent(t),
        flip: item.flip,
        frontEl: refs.front,
        backEl: refs.back,
        startFace: item.startFace,
        duration: item.duration,
        fromRotation: item.fromRotation,
        toRotation: item.toRotation,
        onComplete() {
          ghosts = ghosts.filter((g) => g.id !== item.id);
          if (item.kind === "draw") {
            hidePlayedCard = false;
            isAnimatingPlayed = false;
          }
        },
      });
      handles.push(handle);
    }

    activeFlights = handles;
  }

  onMount(() => {
    const clock = setInterval(() => {
      now = Date.now();
    }, 60_000);
    return () => {
      clearInterval(clock);
      dealGuard.invalidate();
      dealCleanup?.();
      cancelFlights();
    };
  });

  $effect(() => {
    const el = tableEl;
    if (!el) return;
    containerWidth = el.getBoundingClientRect().width;
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        containerWidth = entry.contentRect.width;
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

  $effect(() => {
    if (stage === "deal") {
      void dealKey;
      void songs.length;
      void isFan;
      runDealAnimation();
    } else {
      dealGuard.invalidate();
      dealCleanup?.();
      dealCleanup = null;
    }
  });

  $effect.pre(() => {
    const nextStage = stage;
    const nextIndex = currentIndex;
    const nextSongs = songs;
    const nextDealKey = dealKey;
    const fanNow = isFan;

    if (!prev.initialized) {
      prev = {
        initialized: true,
        stage: nextStage,
        currentIndex: nextIndex,
        songs: nextSongs,
        dealKey: nextDealKey,
        isFan: fanNow,
      };
      if (nextStage === "playing" && nextIndex === 0 && nextSongs[0] && !prefersReducedMotion()) {
        hidePlayedCard = true;
        isAnimatingPlayed = true;
        const token = flightGuard.next();
        void runFlightTransition({
          token,
          goingForward: false,
          goingBackward: false,
          enteringPlaying: true,
          incomingSong: nextSongs[0],
          incomingOrder: 1,
          outgoingSong: null,
          outgoingOrder: 0,
          outgoingStatus: "pending",
          prevPlayedRect: null,
          prevDeckRect: null,
          prevDiscardRect: null,
          prevFanRect: null,
          wasFan: fanNow,
        });
      }
      return;
    }

    if (nextDealKey !== prev.dealKey || nextStage === "deal") {
      cancelFlights();
      prev = {
        initialized: true,
        stage: nextStage,
        currentIndex: nextIndex,
        songs: nextSongs,
        dealKey: nextDealKey,
        isFan: fanNow,
      };
      return;
    }

    const indexChanged = nextIndex !== prev.currentIndex;
    const stageChanged = nextStage !== prev.stage;
    const fanChanged = fanNow !== prev.isFan;

    if (fanChanged && !indexChanged && !stageChanged) {
      cancelFlights();
      prev = {
        initialized: true,
        stage: nextStage,
        currentIndex: nextIndex,
        songs: nextSongs,
        dealKey: nextDealKey,
        isFan: fanNow,
      };
      return;
    }

    if (indexChanged || stageChanged) {
      const prevPlayedRect = readRect(playedSlotEl);
      const prevDeckRect = readRect(deckEl);
      const prevDiscardRect = readRect(discardEl);
      const incomingSong = nextStage === "playing" ? (nextSongs[nextIndex] ?? null) : null;
      const prevFanRect = incomingSong ? readRect(fanEls.get(incomingSong.id)) : null;
      const outgoingSong =
        prev.stage === "playing" ? (prev.songs[prev.currentIndex] ?? null) : null;

      const returningFromComplete =
        prev.stage === "complete" &&
        nextStage === "playing" &&
        nextIndex === prev.currentIndex - 1;
      const goingForward =
        prev.stage === "playing" &&
        (nextStage === "complete" || (nextStage === "playing" && nextIndex > prev.currentIndex));
      const goingBackward =
        returningFromComplete ||
        (prev.stage === "playing" && nextStage === "playing" && nextIndex < prev.currentIndex);
      const enteringPlaying =
        prev.stage !== "playing" && nextStage === "playing" && !returningFromComplete;
      const outgoingOrder = prev.currentIndex + 1;
      const outgoingStatus = outgoingSong
        ? practicedSet.has(outgoingSong.id)
          ? "practiced"
          : "skipped"
        : "skipped";

      cancelFlights();

      if (!prefersReducedMotion() && !fanChanged && (goingForward || goingBackward || enteringPlaying)) {
        if (incomingSong) {
          hidePlayedCard = true;
          isAnimatingPlayed = true;
        }
        const token = flightGuard.next();
        void runFlightTransition({
          token,
          goingForward,
          goingBackward,
          enteringPlaying,
          incomingSong,
          incomingOrder: nextIndex + 1,
          outgoingSong,
          outgoingOrder,
          outgoingStatus,
          prevPlayedRect,
          prevDeckRect,
          prevDiscardRect,
          prevFanRect,
          wasFan: fanNow,
        });
      }
    }

    prev = {
      initialized: true,
      stage: nextStage,
      currentIndex: nextIndex,
      songs: nextSongs,
      dealKey: nextDealKey,
      isFan: fanNow,
    };
  });

  $effect(() => {
    if (stage !== "playing") {
      pendingFocus = false;
      return;
    }
    if (!hidePlayedCard && currentSong && pendingFocus) {
      pendingFocus = false;
      void applyFocusToCurrent();
    }
  });

  async function applyFocusToCurrent(): Promise<void> {
    await tick();
    if (hidePlayedCard || stage !== "playing") {
      if (stage === "playing") pendingFocus = true;
      return;
    }
    playedSlotEl?.scrollIntoView?.({
      block: "nearest",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
    if (playedCardRef) {
      await playedCardRef.focusHeading();
    }
  }

  export async function focusCurrent(): Promise<void> {
    await tick();
    if (stage !== "playing") return;
    if (hidePlayedCard) {
      pendingFocus = true;
      return;
    }
    pendingFocus = false;
    await applyFocusToCurrent();
  }
</script>

<div class="card-table" bind:this={tableEl} data-stage={stage} data-layout={isFan ? "fan" : "deck"}>
  {#if stage === "deal"}
    <div class="deal-stage">
      {#if isFan}
        <ol class="card-fan deal-fan" aria-label={`Mano repartida de ${songs.length} canciones`}>
          {#each songs as song, index (song.id)}
            <li class="fan-slot" style={fanStyle(index, songs.length)}>
              <div class="fan-card-wrap" data-deal-card use:registerFanCard={song.id}>
                <SongCard {song} order={index + 1} {instrument} face="front" />
              </div>
            </li>
          {/each}
        </ol>
      {:else}
        <div class="deck-deal-wrap">
          <div class="deck-pile deal-deck" bind:this={deckEl}>
            {#each { length: Math.min(3, Math.max(1, songs.length)) } as _, layer}
              <div
                class="deck-layer"
                class:top={layer === Math.min(3, Math.max(1, songs.length)) - 1}
                style={`--layer:${layer};`}
                data-deck-layer
                aria-hidden="true"
              >
                <SongCard {instrument} face="back" />
              </div>
            {/each}
          </div>
          <p class="deck-caption">
            <strong>{songs.length} {songs.length === 1 ? "carta" : "cartas"}</strong> listas en el mazo
          </p>
        </div>
      {/if}
    </div>
  {:else if stage === "playing"}
    <div class="playing-stage">
      <div class="table-rail">
        <div class="pile-block remaining-block" aria-label="Cartas restantes">
          <p class="pile-label">
            {#if remainingCount > 0}
              {isFan ? "En mano" : "Mazo"} · <span>quedan {remainingCount}</span>
            {:else}
              {isFan ? "En mano" : "Mazo"} · <span>vacío</span>
            {/if}
          </p>

          {#if isFan}
            {#if remainingSongs.length}
              <ol class="card-fan mini-fan" aria-label="Cartas restantes en la mano">
                {#each remainingSongs as song, offset (song.id)}
                  {@const order = currentIndex + 1 + offset + 1}
                  <li class="fan-slot mini" style={fanStyle(offset, remainingSongs.length, true)}>
                    <div class="fan-card-wrap mini" use:registerFanCard={song.id}>
                      <SongCard {song} {order} {instrument} face="front" compact />
                    </div>
                  </li>
                {/each}
              </ol>
            {:else}
              <div class="empty-slot" bind:this={deckEl}>
                <span>Última carta en mesa</span>
              </div>
            {/if}
          {:else}
            <div class="deck-pile compact" class:empty={remainingCount === 0} bind:this={deckEl}>
              {#if remainingCount > 0}
                {#each { length: Math.min(3, remainingCount) } as _, layer}
                  <div
                    class="deck-layer"
                    class:top={layer === Math.min(3, remainingCount) - 1}
                    style={`--layer:${layer};`}
                    aria-hidden="true"
                  >
                    <SongCard {instrument} face="back" compact />
                  </div>
                {/each}
                <span class="pile-badge" aria-hidden="true">quedan {remainingCount}</span>
              {:else}
                <div class="empty-slot compact">
                  <span>Sin cartas</span>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <div class="pile-block discard-block" aria-label="Pila de descartes">
          <p class="pile-label">
            Descartes · <span>{discardedSongs.length}</span>
          </p>
          <div class="discard-pile" class:empty={!lastDiscarded} bind:this={discardEl}>
            {#if lastDiscarded}
              {#if discardedSongs.length > 1}
                <div class="discard-under" aria-hidden="true"></div>
              {/if}
              <div class="discard-top">
                <SongCard
                  song={lastDiscarded}
                  order={lastDiscardedIndex + 1}
                  {instrument}
                  face="front"
                  status={cardStatus(lastDiscarded, lastDiscardedIndex)}
                  compact
                />
              </div>
            {:else}
              <div class="empty-slot compact">
                <span>Vacío</span>
              </div>
            {/if}
          </div>
        </div>
      </div>

      {#if currentSong}
        <div class="played-slot" bind:this={playedSlotEl}>
          <PlayedCard
            bind:this={playedCardRef}
            song={currentSong}
            order={currentIndex + 1}
            total={songs.length}
            {instrument}
            {now}
            hidden={hidePlayedCard}
            mediaReady={!isAnimatingPlayed}
            {actions}
          />
        </div>
      {/if}
    </div>
  {:else if stage === "complete"}
    <div class="complete-stage">
      <div class="pile-block">
        <p class="pile-label">Mazo · <span>vacío</span></p>
        <div class="empty-slot compact" bind:this={deckEl}>
          <span>0 restantes</span>
        </div>
      </div>
      <div class="pile-block">
        <p class="pile-label">Descartes · <span>{discardedSongs.length}</span></p>
        <div class="discard-pile" class:empty={!lastDiscarded} bind:this={discardEl}>
          {#if lastDiscarded}
            {#if discardedSongs.length > 1}
              <div class="discard-under" aria-hidden="true"></div>
            {/if}
            <div class="discard-top">
              <SongCard
                song={lastDiscarded}
                order={lastDiscardedIndex + 1}
                {instrument}
                face="front"
                status={cardStatus(lastDiscarded, lastDiscardedIndex)}
                compact
              />
            </div>
          {:else}
            <div class="empty-slot compact">
              <span>Vacío</span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if ghosts.length}
    <div class="ghost-layer" aria-hidden="true">
      {#each ghosts as ghost (ghost.id)}
        <div class="ghost-card" use:registerGhost={ghost.id}>
          <div class="ghost-face" data-ghost-face="front">
            <SongCard
              song={ghost.song}
              order={ghost.order}
              {instrument}
              face="front"
              status={ghost.status}
            />
          </div>
          <div class="ghost-face" data-ghost-face="back">
            <SongCard {instrument} face="back" />
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .card-table {
    position: relative;
    width: 100%;
    min-width: 0;
  }

  /* ---- Fase de reparto ---- */
  .deal-stage {
    padding: 16px 0 8px;
  }

  .card-fan {
    list-style: none;
    margin: 0;
    padding: 20px 12px 24px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .fan-slot {
    position: relative;
    z-index: var(--fan-z, 1);
    width: 168px;
    height: 224px;
    margin-left: -26px;
    transform: translateY(var(--fan-y, 0px)) rotate(var(--fan-rot, 0deg));
    transform-origin: center bottom;
    transition: transform 0.18s ease, z-index 0s;
    flex-shrink: 0;
  }

  .fan-slot:first-child {
    margin-left: 0;
  }

  .fan-slot:hover,
  .fan-slot:focus-within {
    z-index: 20;
    transform: translateY(calc(var(--fan-y, 0px) - 14px)) rotate(0deg) scale(1.04);
  }

  .fan-card-wrap {
    width: 100%;
    height: 100%;
  }

  /* Mano compacta restante durante "playing" en escritorio */
  .card-fan.mini-fan {
    padding: 8px 6px 12px;
    justify-content: flex-start;
  }

  .fan-slot.mini {
    width: 118px;
    height: 148px;
    margin-left: -34px;
  }

  .fan-slot.mini:first-child {
    margin-left: 0;
  }

  .fan-slot.mini:hover,
  .fan-slot.mini:focus-within {
    transform: translateY(calc(var(--fan-y, 0px) - 8px)) rotate(0deg) scale(1.05);
  }

  /* Mazo apilado (móvil o >5 cartas) */
  .deck-deal-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 12px 0;
  }

  .deck-pile {
    position: relative;
    width: 156px;
    height: 210px;
  }

  .deck-pile.compact {
    width: 116px;
    height: 148px;
  }

  .deck-layer {
    position: absolute;
    inset: 0;
    transform: translate(
        calc((var(--layer, 0) - 1) * 4px),
        calc((var(--layer, 0) - 1) * -3px)
      )
      rotate(calc((var(--layer, 0) - 1) * 2deg));
  }

  .deck-layer.top {
    transform: none;
  }

  .deck-caption {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--muted);
    text-align: center;
  }

  .deck-caption strong {
    color: var(--text);
    font-family: "Bricolage Grotesque", sans-serif;
  }

  .pile-badge {
    position: absolute;
    left: 50%;
    bottom: 8px;
    transform: translateX(-50%);
    white-space: nowrap;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--border);
    color: var(--bg);
    font-family: "Bricolage Grotesque", sans-serif;
    font-weight: 700;
    font-size: 0.75rem;
    box-shadow: var(--shadow-card);
  }

  /* ---- Fase de juego ---- */
  .playing-stage {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .table-rail {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--surface-muted) 65%, var(--surface));
  }

  .pile-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .remaining-block {
    flex: 1 1 auto;
  }

  .pile-label {
    margin: 0;
    font-family: "Bricolage Grotesque", sans-serif;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }

  .pile-label span {
    color: var(--text);
  }

  .discard-pile {
    position: relative;
    width: 112px;
    height: 140px;
  }

  .discard-under {
    position: absolute;
    inset: 0;
    border-radius: var(--radius-md);
    border: 1.5px solid var(--line);
    background: var(--surface-muted);
    transform: translate(-4px, 3px) rotate(-3deg);
  }

  .discard-top {
    position: relative;
    width: 100%;
    height: 100%;
    transform: rotate(-1.5deg);
  }

  .empty-slot {
    display: grid;
    place-items: center;
    text-align: center;
    padding: 12px;
    min-height: 104px;
    min-width: 120px;
    border-radius: var(--radius-md);
    border: 1.5px dashed var(--line);
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 600;
    background: color-mix(in srgb, var(--surface) 60%, transparent);
  }

  .empty-slot.compact {
    width: 112px;
    height: 140px;
    min-width: 0;
    min-height: 0;
  }

  .played-slot {
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    min-width: 0;
  }

  @media (min-width: 900px) {
    .playing-stage {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 268px;
      grid-template-areas: "played rail";
      align-items: start;
      gap: 16px;
    }

    .played-slot {
      grid-area: played;
      max-width: none;
      margin: 0;
    }

    .table-rail {
      grid-area: rail;
      flex-direction: column;
      gap: 12px;
      padding: 10px 12px;
    }

    .card-table[data-layout="deck"] .table-rail {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .card-table[data-layout="deck"] .pile-block {
      align-items: center;
    }

    .card-fan.mini-fan {
      padding: 4px 2px 8px;
    }

    .fan-slot.mini {
      width: 86px;
      height: 112px;
      margin-left: -36px;
    }

    .deck-pile.compact,
    .discard-pile,
    .empty-slot.compact {
      width: 104px;
      height: 130px;
    }
  }

  /* ---- Fase completa ---- */
  .complete-stage {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 24px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }

  /* ---- Capa de cartas fantasma ---- */
  .ghost-layer {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 1000;
  }

  .ghost-card {
    position: fixed;
    top: 0;
    left: 0;
    pointer-events: none;
    will-change: transform;
  }

  .ghost-face {
    width: 100%;
    height: 100%;
  }

  @media (max-width: 640px) {
    .table-rail {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      padding: 10px;
    }

    .pile-block {
      align-items: center;
    }

    .deck-pile.compact,
    .discard-pile,
    .empty-slot.compact {
      width: 104px;
      height: 134px;
    }

    .pile-badge {
      font-size: 0.6875rem;
      padding: 2px 8px;
    }
  }

  @media (max-width: 360px) {
    .deck-pile.compact,
    .discard-pile,
    .empty-slot.compact {
      width: 92px;
      height: 120px;
    }
  }
</style>
