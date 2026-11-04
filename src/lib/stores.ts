import { writable } from "svelte/store";
import type { Song } from "./types";
import { loadSongs, saveSongs } from "./storage";

export const songs = writable<Song[]>(loadSongs());

songs.subscribe(saveSongs);
