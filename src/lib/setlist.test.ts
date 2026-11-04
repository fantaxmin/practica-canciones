import { describe, expect, it } from "vitest";
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
