import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { WordMark } from "./tts.ts";
import type { Lesson } from "../lesson/types.ts";
import {
  decryptBinary,
  decryptText,
  encryptBinary,
  encryptText,
} from "./crypto-vault.ts";

/**
 * On-disk cache for synthesised narration with Latin-Chinese AES-256-GCM encryption.
 *
 * All audio files (.mp3, .wav) and timing files (.words.json) are securely encrypted
 * on disk in Latin-Chinese glyph representation. External media players cannot play them,
 * and text editors cannot read them. They are only decryptable by EdusGPT.
 */
const CACHE_DIR = join(process.cwd(), "data", "tts-cache");
/** Bounded so a long-running install cannot fill the disk. */
const MAX_ENTRIES = 2_000;

function keyFor(text: string, voice: string, engine: string): string {
  return createHash("sha256").update(`v5\n${engine}\n${voice}\n${text}`).digest("hex");
}

export interface CachedNarration {
  audio: Uint8Array;
  words: WordMark[] | null;
  contentType: "audio/mpeg" | "audio/wav";
}

function extension(contentType: "audio/mpeg" | "audio/wav"): string {
  return contentType === "audio/wav" ? "wav" : "mp3";
}

export async function readCachedAudio(
  text: string,
  voice: string,
  engine: string,
): Promise<CachedNarration | null> {
  const base = keyFor(text, voice, engine);
  for (const [suffix, contentType] of [
    [".mp3", "audio/mpeg"],
    [".wav", "audio/wav"],
  ] as const) {
    try {
      const rawFile = await readFile(join(CACHE_DIR, `${base}${suffix}`));
      const decryptedAudio = decryptBinary(new Uint8Array(rawFile));

      let words: WordMark[] | null = null;
      try {
        const rawWords = await readFile(join(CACHE_DIR, `${base}.words.json`), "utf8");
        const decryptedWords = decryptText(rawWords);
        const parsed = JSON.parse(decryptedWords);
        if (Array.isArray(parsed)) words = parsed as WordMark[];
      } catch {
        words = null;
      }
      return { audio: decryptedAudio, words, contentType };
    } catch {
      /* try the other extension */
    }
  }
  return null;
}

/** Written to a temp file then renamed, so a crash never leaves a partial file. */
export async function writeCachedAudio(
  text: string,
  voice: string,
  engine: string,
  audio: Uint8Array,
  words?: WordMark[],
  contentType: "audio/mpeg" | "audio/wav" = "audio/mpeg",
): Promise<void> {
  const base = keyFor(text, voice, engine);
  const target = join(CACHE_DIR, `${base}.${extension(contentType)}`);
  const temp = `${target}.${process.pid}.tmp`;

  try {
    await mkdir(CACHE_DIR, { recursive: true });

    // Encrypt audio bytes with Latin-Chinese AES-256-GCM
    const encryptedAudio = encryptBinary(audio);
    await writeFile(temp, encryptedAudio);
    await rename(temp, target);

    if (words && words.length > 0) {
      const wordsJson = JSON.stringify(words);
      const encryptedWords = encryptText(wordsJson);
      await writeFile(join(CACHE_DIR, `${base}.words.json`), `${encryptedWords}\n`, "utf8");
    }
  } catch {
    await rm(temp, { force: true }).catch(() => {});
  }
}

/**
 * Remove cached audio for all scenes of a specific lesson.
 * Useful when trimming a course or deleting it permanently to reclaim disk space.
 */
export async function deleteTtsCacheForLesson(lesson: Lesson): Promise<number> {
  const voice = lesson.voice || "vi-VN-HoaiMyNeural";
  const engines = ["edge", "piper"];
  let deletedCount = 0;

  for (const scene of lesson.scenes) {
    if (!scene.narration) continue;
    for (const engine of engines) {
      const base = keyFor(scene.narration, voice, engine);
      for (const ext of [".mp3", ".wav", ".words.json"]) {
        const filePath = join(CACHE_DIR, `${base}${ext}`);
        try {
          await rm(filePath, { force: true });
          deletedCount++;
        } catch {
          // ignore if file doesn't exist
        }
      }
    }
  }

  return deletedCount;
}

/** Drops the oldest entries once the cache outgrows MAX_ENTRIES. */
export async function pruneCache(): Promise<void> {
  try {
    const names = (await readdir(CACHE_DIR)).filter(
      (name) => name.endsWith(".mp3") || name.endsWith(".wav"),
    );
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
