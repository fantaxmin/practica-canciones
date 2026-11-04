export interface Song {
  id: string;
  title: string;
  artist: string;
  youtubeUrl: string;
  driveUrl: string;
  /** Id del Blob subido o del FileSystemFileHandle heredado en IndexedDB. */
  audioFileId: string | null;
  durationSeconds: number;
  instruments: { bajo: boolean; guitarra: boolean };
  lastPracticedAt: number | null;
}

export type Instrument = "bajo" | "guitarra";

export type Tab = "repertorio" | "setlist" | "calentamiento" | "stats";
