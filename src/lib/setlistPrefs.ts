import { writable } from "svelte/store";

const STORAGE_KEY = "practica-canciones:excluded-artists";

function load(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((a): a is string => typeof a === "string") : [];
  } catch {
    return [];
  }
}

/** Artistas que el usuario retiró de la generación de setlists; se recuerda entre sesiones. */
export const excludedArtists = writable<string[]>(load());

excludedArtists.subscribe((artists) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(artists));
  } catch {
    // localStorage no disponible, no persistimos
  }
});
