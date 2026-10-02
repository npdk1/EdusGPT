import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { WordMark } from "./tts";

/**
 * On-disk cache for synthesised narration.
 *
 * A scene is spoken on every play-through, and a teacher presents the same
 * lesson dozens of times. Re-synthesising identical text each time burns the
 * voice service's rate limit and makes playback wait; the audio for a given
 * sentence never changes, so this turns every repeat into a file read.
 *
 * The service throttles unauthenticated clients hard, so the cache is what keeps
 * a classroom smooth rather than a curiosity.
 */
const CACHE_DIR = join(process.cwd(), "data", "tts-cache");
/** Bounded so a long-running install cannot fill the disk. */
const MAX_ENTRIES = 2_000;

function keyFor(text: string, voice: string): string {
  return createHash("sha256").update(`${voice}\n${text}`).digest("hex");
}

export interface CachedNarration {
  audio: Uint8Array;
  /**
   * Word timings, or null when the cached entry predates karaoke. Keeping them
   * beside the audio matters: a cache hit is the common case on a second
   * play-through, and re-synthesising just to recover the timings would cost a
   * full voice call for data we already had.
   */
  words: WordMark[] | null;
}

export async function readCachedAudio(
  text: string,
  voice: string,
): Promise<CachedNarration | null> {
  try {
    const base = keyFor(text, voice);
    const audio = new Uint8Array(await readFile(join(CACHE_DIR, `${base}.mp3`)));
    let words: WordMark[] | null = null;
    try {
      const raw = JSON.parse(await readFile(join(CACHE_DIR, `${base}.words.json`), "utf8"));
      if (Array.isArray(raw)) words = raw as WordMark[];
    } catch {
      words = null;
    }
    return { audio, words };
  } catch {
    return null;
  }
}

/** Written to a temp file then renamed, so a crash never leaves a partial MP3. */
export async function writeCachedAudio(
  text: string,
  voice: string,
  audio: Uint8Array,
  words?: WordMark[],
): Promise<void> {
  const base = keyFor(text, voice);
  const target = join(CACHE_DIR, `${base}.mp3`);
  const temp = `${target}.${process.pid}.tmp`;
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(temp, audio);
    await rename(temp, target);
    if (words && words.length > 0) {
      await writeFile(join(CACHE_DIR, `${base}.words.json`), JSON.stringify(words));
    }
  } catch {
    await rm(temp, { force: true }).catch(() => {});
  }
}

/** Drops the oldest entries once the cache outgrows MAX_ENTRIES. */
export async function pruneCache(): Promise<void> {
  try {
    const names = (await readdir(CACHE_DIR)).filter((name) => name.endsWith(".mp3"));
    if (names.length <= MAX_ENTRIES) return;

    const stamped = await Promise.all(
      names.map(async (name) => ({
        name,
        mtime: (await stat(join(CACHE_DIR, name)).catch(() => null))?.mtimeMs ?? 0,
      })),
    );
    stamped.sort((a, b) => a.mtime - b.mtime);
    await Promise.all(
      stamped
        .slice(0, stamped.length - MAX_ENTRIES)
        .map((entry) => rm(join(CACHE_DIR, entry.name), { force: true })),
    );
  } catch {
    /* a cache that cannot be pruned is not worth failing a request over */
  }
}