import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  file: Blob;
  artwork?: Blob;
  addedAt: number;
};

/**
 * The shared event log. LocalBeats only ever appends `play`, but Memory Radio
 * and Life RPG are meant to read this same store, so the type stays open.
 */
export type LogEvent = {
  id?: number;
  type: "play";
  trackId: string;
  at: number;
  lat?: number;
  lng?: number;
};

interface Schema extends DBSchema {
  tracks: { key: string; value: Track };
  events: { key: number; value: LogEvent; indexes: { at: number } };
}

let dbPromise: Promise<IDBPDatabase<Schema>> | undefined;

export function getDB() {
  dbPromise ??= openDB<Schema>("localbeats", 1, {
    upgrade(db) {
      db.createObjectStore("tracks", { keyPath: "id" });
      const events = db.createObjectStore("events", {
        keyPath: "id",
        autoIncrement: true,
      });
      events.createIndex("at", "at");
    },
  });
  return dbPromise;
}

/**
 * Identity is name+size, not a content hash — hashing every file would mean
 * reading a whole library into memory just to dedupe an import.
 * ponytail: collides only for same-name same-size files; hash if that ever bites.
 */
export const trackId = (file: { name: string; size: number }) =>
  `${file.name}:${file.size}`;

export async function allTracks(): Promise<Track[]> {
  const tracks = await (await getDB()).getAll("tracks");
  return tracks.sort(
    (a, b) =>
      a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title),
  );
}

export async function getTrack(id: string) {
  return (await getDB()).get("tracks", id);
}

export async function putTrack(track: Track) {
  return (await getDB()).put("tracks", track);
}

export async function deleteTrack(id: string) {
  return (await getDB()).delete("tracks", id);
}

/** Append-only. Location is attached by the caller, never fetched here. */
export async function logPlay(
  trackId: string,
  coords?: { lat: number; lng: number },
) {
  return (await getDB()).add("events", {
    type: "play",
    trackId,
    at: Date.now(),
    ...coords,
  });
}

export async function eventsBetween(from: number, to: number) {
  return (await getDB()).getAllFromIndex(
    "events",
    "at",
    IDBKeyRange.bound(from, to),
  );
}

/**
 * Parses tags and stores the audio. Returns how many were new, so the UI can
 * say something useful when you re-pick a folder you already imported.
 */
export async function importFiles(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ added: number; skipped: number }> {
  // 1.1MB parser — only pulled in when you actually import.
  const { parseBlob } = await import("music-metadata");
  const db = await getDB();
  let added = 0;
  let skipped = 0;

  for (const [i, file] of files.entries()) {
    const id = trackId(file);
    if (await db.get("tracks", id)) {
      skipped++;
    } else {
      let title = file.name.replace(/\.[^.]+$/, "");
      let artist = "Unknown artist";
      let album = "";
      let duration = 0;
      let artwork: Blob | undefined;

      try {
        const { common, format } = await parseBlob(file, { duration: true });
        if (common.title) title = common.title;
        if (common.artist) artist = common.artist;
        if (common.album) album = common.album;
        duration = format.duration ?? 0;
        const pic = common.picture?.[0];
        if (pic) artwork = new Blob([pic.data as BlobPart], { type: pic.format });
      } catch {
        // Unreadable tags are not a reason to lose the file — keep the filename.
      }

      await db.put("tracks", {
        id,
        title,
        artist,
        album,
        duration,
        file,
        artwork,
        addedAt: Date.now(),
      });
      added++;
    }
    onProgress?.(i + 1, files.length);
  }

  return { added, skipped };
}
