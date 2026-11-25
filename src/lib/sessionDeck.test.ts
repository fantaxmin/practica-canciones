import { describe, expect, it } from "vitest";
import { migratePracticeSession, type PracticeSession } from "./practiceSession";
import { startPractice, finishWarmup, practiced, skip, back, reshuffle } from "./sessionDeck";
const session = (): PracticeSession => ({ instrument: "bajo", minutes: 15, songIds: ["a", "b"], currentIndex: 0, practicedIds: [], stage: "deal" });
describe("session deck", () => {
  it("recorre reparto, calentamiento, práctica y final sin mutar el origen", () => {
    const original = session();
    const warmup = startPractice(original);
    expect(warmup.stage).toBe("warmup");
    const playing = finishWarmup(warmup, "skipped");
    expect(playing).toMatchObject({ stage: "playing", warmup: "skipped", currentIndex: 0 });
    const next = practiced(playing);
    expect(next).toMatchObject({ currentIndex: 1, practicedIds: ["a"] });
    expect(skip(next)).toMatchObject({ stage: "complete", currentIndex: 2, practicedIds: ["a"] });
    expect(original).toEqual(session());
  });
  it("Anterior recupera incluso desde complete sin borrar ni duplicar prácticas", () => {
    const first = finishWarmup(startPractice(session()));
    const next = practiced(first);
    expect(practiced(back(next)).practicedIds).toEqual(["a"]);
    const done = practiced(next);
    expect(back(done)).toMatchObject({ stage: "playing", currentIndex: 1, practicedIds: ["a", "b"] });
    expect(practiced(back(done)).practicedIds).toEqual(["a", "b"]);
  });
  it("ignora acciones fuera de fase y los límites", () => {
    const deal = session();
    expect(practiced(deal)).toBe(deal);
    expect(skip(deal)).toBe(deal);
    expect(finishWarmup(deal)).toBe(deal);
    const playing = finishWarmup(startPractice(deal));
    expect(back(playing)).toBe(playing);
    const done = skip(skip(playing));
    expect(skip(done)).toBe(done);
    expect(practiced(done)).toBe(done);
  });
  it("rebarajar reinicia únicamente la sesión y copia los ids", () => {
    const ids = ["c", "a"];
    const result = reshuffle(practiced(finishWarmup(startPractice(session()))), ids);
    ids.push("d");
    expect(result).toMatchObject({ stage: "deal", currentIndex: 0, practicedIds: [], songIds: ["c", "a"], warmup: undefined });
  });
  it("migra sesiones anteriores y conserva las fases nuevas", () => {
    const { stage: _stage, ...legacy } = session();
    expect(migratePracticeSession({ ...legacy, warmup: "pending" })?.stage).toBe("warmup");
    for (const warmup of [undefined, "done", "skipped"]) {
      expect(migratePracticeSession({ ...legacy, warmup })?.stage).toBe("playing");
      expect(migratePracticeSession({ ...legacy, warmup, currentIndex: 2 })?.stage).toBe("complete");
    }
    expect(migratePracticeSession(session())?.stage).toBe("deal");
    expect(migratePracticeSession(null)).toBeNull();
  });
});
