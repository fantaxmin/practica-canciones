import { afterEach, describe, expect, it, vi } from "vitest";
import { generateSetlist, withoutExcludedArtists } from "./setlist";
import type { Song } from "./types";

const song = (id: string, artist: string, durationSeconds = 180): Song => ({
  id, title: id, artist, youtubeUrl: "", driveUrl: "", audioFileId: null, durationSeconds,
  instruments: { bajo: true, guitarra: true }, lastPracticedAt: null,
});
const songs = [song("a1", "Soda Stereo"), song("a2", "Soda Stereo"), song("b1", "Cerati"), song("c1", "Café Tacvba"), song("x", "")];

describe("excluir artistas", () => {
  it("nunca incluye a los artistas excluidos, aunque sobre tiempo", () => {
    for (let i = 0; i < 50; i++) {
      const result = generateSetlist(songs, "bajo", 3600, undefined, ["Soda Stereo"]);
      expect(result.map((s) => s.id).sort()).toEqual(["b1", "c1", "x"]);
    }
  });
  it("ignora mayúsculas y espacios", () => {
    expect(withoutExcludedArtists(songs, ["  soda stereo ", "CERATI"]).map((s) => s.id)).toEqual(["c1", "x"]);
  });
  it("sin exclusiones devuelve todo", () => {
    expect(withoutExcludedArtists(songs, [])).toBe(songs);
    expect(generateSetlist(songs, "bajo", 3600)).toHaveLength(5);
  });
  it("un artista prioritario excluido no aparece", () => {
    const result = generateSetlist(songs, "bajo", 3600, "Cerati", ["Cerati"]);
    expect(result.some((s) => s.artist === "Cerati")).toBe(false);
  });
  it("si todos están excluidos, el setlist queda vacío", () => {
    expect(generateSetlist(songs.slice(0, 4), "bajo", 3600, undefined, ["Soda Stereo", "Cerati", "Café Tacvba"])).toEqual([]);
  });
});


describe("rebarajar y ponderar", () => {
  afterEach(() => vi.restoreAllMocks());
  it("elige un conjunto distinto con el menor solapamiento disponible", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const pool = [song("a", "X"), song("b", "X"), song("c", "X"), song("d", "X")];
    const result = generateSetlist(pool, "bajo", 360, undefined, [], { previousIds: ["a", "b"] });
    expect(result.map((s) => s.id)).toEqual(["c", "d"]);
  });
  it("cambia al menos el orden si todo el repertorio cabe", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const result = generateSetlist(songs, "bajo", 3600, undefined, [], { previousIds: songs.map((s) => s.id) });
    expect(result.map((s) => s.id)).not.toEqual(songs.map((s) => s.id));
    expect(result.map((s) => s.id).sort()).toEqual(songs.map((s) => s.id).sort());
  });
  it("conserva prioridad, exclusiones y límite al evitar la mano anterior", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const result = generateSetlist(songs, "bajo", 540, "Soda Stereo", ["Cerati"], { previousIds: ["a1", "a2", "c1"] });
    expect(result.slice(0, 2).map((s) => s.artist)).toEqual(["Soda Stereo", "Soda Stereo"]);
    expect(result.some((s) => s.id === "b1")).toBe(false);
    expect(result.reduce((sum, s) => sum + s.durationSeconds, 0)).toBeLessThanOrEqual(540);
    expect(result.map((s) => s.id)).toContain("x");
  });
  it("pondera antigüedad sin excluir por buckets a canciones recientes", () => {
    const recent = { ...song("recent", "X"), lastPracticedAt: Date.now() };
    const old = song("old", "X");
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(generateSetlist([recent, old], "bajo", 180)[0].id).toBe("old");
    vi.mocked(Math.random).mockReturnValueOnce(0.999).mockReturnValueOnce(0.01);
    expect(generateSetlist([recent, old], "bajo", 180)[0].id).toBe("recent");
  });
  it("acepta manos inevitables de una carta y tiempos inválidos", () => {
    expect(generateSetlist([songs[0]], "bajo", 180, undefined, [], { previousIds: ["a1"] })).toEqual([songs[0]]);
    expect(generateSetlist(songs, "bajo", NaN)).toEqual([]);
    expect(generateSetlist(songs, "bajo", 1)).toEqual([]);
  });
});
