import { describe, expect, it, vi } from "vitest";
vi.mock("../lib/stores", async () => {
  const { writable } = await import("svelte/store");
  return { songs: writable([]) };
});
import { renderedSongOrder } from "./SongList.svelte";
import type { Song } from "../lib/types";
const song = (id: string): Song => ({
  id, title: id, artist: "Test", youtubeUrl: "", driveUrl: "", audioFileId: null,
  durationSeconds: 180, instruments: { bajo: true, guitarra: true }, lastPracticedAt: null,
});
const all = [song("a"), song("b"), song("c")];

describe("orden estable del repertorio con reproductor abierto", () => {
  it("sin media, DOM y orden de lectura siguen la ordenación visible", () => {
    expect(renderedSongOrder(all, [all[2], all[0]])).toEqual([all[2], all[0], all[1]]);
  });
  it("abrir media conserva exactamente la secuencia keyed previa", () => {
    const before = renderedSongOrder(all, [all[2], all[0]]);
    expect(renderedSongOrder(all, [all[2], all[0]], before.map((s) => s.id))).toEqual(before);
  });
  it("ordenar y filtrar con media no mueve ni sustituye ninguna tarjeta existente", () => {
    const pinned = ["c", "a", "b"];
    const before = renderedSongOrder(all, all, pinned);
    for (const filtered of [[all[0], all[2]], [all[1]], [], [...all].reverse()]) {
      const after = renderedSongOrder(all, filtered, pinned);
      expect(after.map((s) => s.id)).toEqual(before.map((s) => s.id));
      after.forEach((entry, index) => expect(entry).toBe(before[index]));
    }
  });
  it("eliminar otra canción solo retira su nodo, sin reordenar los restantes", () => {
    expect(renderedSongOrder([all[0], all[2]], [all[0]], ["c", "a", "b"]).map((s) => s.id)).toEqual(["c", "a"]);
  });
  it("las canciones nuevas se añaden sin desplazar nodos existentes en el orden keyed", () => {
    const added = song("d");
    expect(renderedSongOrder([added, ...all], [added, ...all], ["c", "a", "b"]).map((s) => s.id)).toEqual(["c", "a", "b", "d"]);
  });
});
