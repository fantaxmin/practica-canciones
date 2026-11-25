import type { PracticeSession } from "./practiceSession";

export function startPractice(session: PracticeSession): PracticeSession {
  return session.stage === "deal" && session.songIds.length
    ? { ...session, stage: "warmup", warmup: "pending" } : session;
}

export function finishWarmup(session: PracticeSession, warmup: "done" | "skipped" = "done"): PracticeSession {
  return session.stage === "warmup"
    ? { ...session, warmup, stage: session.currentIndex >= session.songIds.length ? "complete" : "playing" } : session;
}

export function skip(session: PracticeSession): PracticeSession {
  if (session.stage !== "playing" || session.currentIndex >= session.songIds.length) return session;
  const currentIndex = session.currentIndex + 1;
  return { ...session, currentIndex, stage: currentIndex >= session.songIds.length ? "complete" : "playing" };
}

export function practiced(session: PracticeSession): PracticeSession {
  const next = skip(session);
  if (next === session) return session;
  return { ...next, practicedIds: [...new Set([...session.practicedIds, session.songIds[session.currentIndex]])] };
}

export function back(session: PracticeSession): PracticeSession {
  return (session.stage === "playing" || session.stage === "complete") && session.currentIndex > 0
    ? { ...session, currentIndex: session.currentIndex - 1, stage: "playing" } : session;
}

export function reshuffle(session: PracticeSession, songIds: readonly string[]): PracticeSession {
  return { ...session, songIds: [...songIds], currentIndex: 0, practicedIds: [], stage: "deal", warmup: undefined };
}
