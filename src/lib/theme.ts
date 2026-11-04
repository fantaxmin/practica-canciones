import { writable } from "svelte/store";

const STORAGE_KEY = "practica-canciones:dark-mode";

function loadInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export const darkMode = writable<boolean>(loadInitial());

darkMode.subscribe((isDark) => {
  document.documentElement.classList.toggle("dark", isDark);
  try {
    localStorage.setItem(STORAGE_KEY, isDark ? "1" : "0");
  } catch {
    // localStorage no disponible, no persistimos
  }
});
