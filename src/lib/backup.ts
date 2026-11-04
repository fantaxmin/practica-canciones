import { get } from "svelte/store";
import { songs } from "./stores";
import { practiceLog, type PracticeEvent } from "./practiceLog";
import { practiceSession, type PracticeSession } from "./practiceSession";
import { getAudioBlob, getAudioHandle } from "./audioStore";
import type { Song } from "./types";

const BACKUP_VERSION = 1;

interface SongBackup extends Omit<Song, "audioFileId"> {
  audioFileId: null;
  localAudioFileName?: string;
}

interface AppBackup {
  app: "practica-canciones";
  version: number;
  exportedAt: string;
  songs: SongBackup[];
  practiceLog: PracticeEvent[];
  practiceSession: PracticeSession | null;
}

export interface ImportSummary {
  songs: number;
  practiceEvents: number;
  audioFilesToRelink: number;
}

export async function createBackup(): Promise<AppBackup> {
  const songBackups = await Promise.all(
    get(songs).map(async ({ audioFileId, ...song }) => {
      const blob = audioFileId ? await getAudioBlob(audioFileId).catch(() => null) : null;
      const handle = audioFileId && !blob ? await getAudioHandle(audioFileId).catch(() => null) : null;
      const name = blob?.name ?? handle?.name;
      return {
        ...song,
        audioFileId: null,
        ...(name ? { localAudioFileName: name } : {}),
      };
    })
  );

  return {
    app: "practica-canciones",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    songs: songBackups,
    practiceLog: get(practiceLog),
    practiceSession: get(practiceSession),
  };
}

function isSong(value: unknown): value is SongBackup {
  if (!value || typeof value !== "object") return false;
  const song = value as Partial<SongBackup>;
  return (
    typeof song.id === "string" &&
    typeof song.title === "string" &&
    typeof song.artist === "string" &&
    typeof song.youtubeUrl === "string" &&
    (song.driveUrl === undefined || typeof song.driveUrl === "string") &&
    typeof song.durationSeconds === "number" &&
    !!song.instruments &&
    typeof song.instruments.bajo === "boolean" &&
    typeof song.instruments.guitarra === "boolean"
  );
}

export function parseBackup(raw: string): { backup: AppBackup; summary: ImportSummary } {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") throw new Error("El archivo no contiene un respaldo válido.");
  const data = parsed as Partial<AppBackup>;
  if (data.app !== "practica-canciones" || data.version !== BACKUP_VERSION) {
    throw new Error("El respaldo pertenece a otra aplicación o usa una versión no compatible.");
  }
  if (!Array.isArray(data.songs) || !data.songs.every(isSong)) {
    throw new Error("La lista de canciones del respaldo está dañada.");
  }
  if (!Array.isArray(data.practiceLog)) {
    throw new Error("El historial de práctica del respaldo está dañado.");
  }

  const backup = data as AppBackup;
  backup.songs = backup.songs.map((song) => ({ ...song, driveUrl: song.driveUrl ?? "" }));
  return {
    backup,
    summary: {
      songs: backup.songs.length,
      practiceEvents: backup.practiceLog.length,
      audioFilesToRelink: backup.songs.filter((song) => song.localAudioFileName).length,
    },
  };
}

export function restoreBackup(backup: AppBackup): void {
  songs.set(backup.songs.map(({ localAudioFileName: _name, ...song }) => ({ ...song, driveUrl: song.driveUrl ?? "", audioFileId: null })));
  practiceLog.set(backup.practiceLog);
  practiceSession.set(backup.practiceSession ?? null);
}
