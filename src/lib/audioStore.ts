const DB_NAME = "practica-canciones";
const DB_VERSION = 2;
const HANDLE_STORE = "audio-handles";
const BLOB_STORE = "audio-blobs";
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

export interface AudioBlob {
  blob: Blob;
  name: string;
  type: string;
  size: number;
}

export function formatAudioSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString("es", { maximumFractionDigits: 2 })} MB`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      for (const store of [HANDLE_STORE, BLOB_STORE]) {
        if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

async function write(stores: string[], operation: (tx: IDBTransaction) => void): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(stores, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("No se pudo guardar el audio."));
      tx.onerror = () => reject(tx.error);
      operation(tx);
    });
  } finally {
    db.close();
  }
}

async function read<T>(store: string, id: string): Promise<T | null> {
  const db = await openDb();
  try {
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const request = tx.objectStore(store).get(id);
      let result: T | null = null;
      request.onsuccess = () => { result = request.result ?? null; };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

let persistenceRequested = false;

export async function saveAudioBlob(id: string, file: File): Promise<void> {
  if (file.size > MAX_AUDIO_BYTES) {
    throw new Error(`El archivo pesa ${formatAudioSize(file.size)}; el máximo es 50 MB.`);
  }
  if (!persistenceRequested) {
    persistenceRequested = true;
    try { void navigator.storage?.persist?.().catch(() => {}); } catch { /* Es opcional. */ }
  }
  await write([BLOB_STORE], (tx) => tx.objectStore(BLOB_STORE).put({
    blob: file, name: file.name, type: file.type, size: file.size,
  } satisfies AudioBlob, id));
}

export function getAudioBlob(id: string): Promise<AudioBlob | null> {
  return read<AudioBlob>(BLOB_STORE, id);
}

export function deleteAudioBlob(id: string): Promise<void> {
  return write([BLOB_STORE], (tx) => tx.objectStore(BLOB_STORE).delete(id));
}

/** Conservado para los archivos locales de la versión anterior. */
export function saveAudioHandle(id: string, handle: FileSystemFileHandle): Promise<void> {
  return write([HANDLE_STORE], (tx) => tx.objectStore(HANDLE_STORE).put(handle, id));
}

export function getAudioHandle(id: string): Promise<FileSystemFileHandle | null> {
  return read<FileSystemFileHandle>(HANDLE_STORE, id);
}

/** Elimina el audio, sea una copia subida o un handle heredado. */
export function deleteAudio(id: string): Promise<void> {
  return write([HANDLE_STORE, BLOB_STORE], (tx) => {
    tx.objectStore(HANDLE_STORE).delete(id);
    tx.objectStore(BLOB_STORE).delete(id);
  });
}

export const deleteAudioHandle = deleteAudio;
