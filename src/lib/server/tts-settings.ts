import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Which engine speaks the narration.
 *
 * Two, and the choice is the teacher's:
 *
 *   - `local`  — a voice model on this machine. No key, no account, nothing sent
 *                anywhere, and it keeps working with the network unplugged. This
 *                is the default because it is the one that cannot fail for a
 *                reason the teacher cannot fix.
 *   - `cloud`  — the hosted voice service. More voices, and word timings measured
 *                per word rather than spread across a sentence.
 *
 * Written to `data/tts-settings.json` rather than to the AI settings file: this is
 * a choice about speech, not about a model, and the two are read by different
 * parts of the app.
 */
export type TtsEngine = "local" | "cloud";

const SETTINGS_DIR = join(process.cwd(), "data");
const SETTINGS_FILE = join(SETTINGS_DIR, "tts-settings.json");

export const DEFAULT_ENGINE: TtsEngine = "local";

export function isTtsEngine(value: unknown): value is TtsEngine {
  return value === "local" || value === "cloud";
}

/**
 * Read once per process.
 *
 * Every slide asks which engine it is using, and a settings file read from disk
 * that often would be a disk read per slide for an answer that changes when the
 * teacher opens /setup. The cache is dropped by `writeTtsEngine`.
 */
let cached: TtsEngine | null = null;

export async function readTtsEngine(): Promise<TtsEngine> {
  if (cached) return cached;
  try {
    const raw = JSON.parse(await readFile(SETTINGS_FILE, "utf8")) as { engine?: unknown };
    cached = isTtsEngine(raw.engine) ? raw.engine : DEFAULT_ENGINE;
  } catch {
    // No file yet — a fresh clone, or a machine that has never spoken. Local is
    // the default and needs no setup beyond the voice itself.
    cached = DEFAULT_ENGINE;
  }
  return cached;
}

export async function writeTtsEngine(engine: TtsEngine): Promise<TtsEngine> {
  await mkdir(SETTINGS_DIR, { recursive: true });
  const temp = `${SETTINGS_FILE}.${process.pid}.tmp`;
  // Temp then rename, so a crash mid-write never leaves a settings file that
  // parses to nothing and silently resets the teacher's choice.
  await writeFile(temp, JSON.stringify({ engine }, null, 2), "utf8");
  await rename(temp, SETTINGS_FILE);
  cached = engine;
  return engine;
}

/** Test seam, and what a settings change calls to forget the cached answer. */
export function forgetTtsEngine(): void {
  cached = null;
}
