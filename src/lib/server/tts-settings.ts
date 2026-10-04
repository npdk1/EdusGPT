import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Which engine speaks the narration, and the one key that lets a gated model in.
 *
 * Two settings, one file:
 *
 *   - `engine`   — `local` reads on this machine, `cloud` uses the hosted voice
 *                  service. Local is the default because it is the one that cannot
 *                  fail for a reason the teacher cannot fix.
 *   - `hfToken`  — some local models are published on Hugging Face behind a gate.
 *                  v-tts is one of them: without a token its weights cannot be
 *                  downloaded and the engine cannot speak. A read-only public token
 *                  for public models is all that is needed, and it stays on this
 *                  machine in `data/`, which is gitignored.
 *
 * Written to `data/tts-settings.json` rather than to the AI settings file: this is a
 * choice about speech, not about a model, and the two are read by different parts of
 * the app.
 */
export type TtsEngine = "local" | "cloud";

const SETTINGS_DIR = join(process.cwd(), "data");
const SETTINGS_FILE = join(SETTINGS_DIR, "tts-settings.json");

export const DEFAULT_ENGINE: TtsEngine = "local";

export interface TtsConfig {
  engine: TtsEngine;
  hfToken: string;
}

export function isTtsEngine(value: unknown): value is TtsEngine {
  return value === "local" || value === "cloud";
}

/**
 * Read once per process.
 *
 * Every slide asks which engine it is using, and a settings file read from disk
 * that often would be a disk read per slide for an answer that changes when the
 * teacher opens /setup. The cache is dropped by `writeTtsConfig`.
 */
let cached: TtsConfig | null = null;

export async function readTtsConfig(): Promise<TtsConfig> {
  if (cached) return cached;
  try {
    const raw = JSON.parse(await readFile(SETTINGS_FILE, "utf8")) as {
      engine?: unknown;
      hfToken?: unknown;
    };
    cached = {
      engine: isTtsEngine(raw.engine) ? raw.engine : DEFAULT_ENGINE,
      hfToken: typeof raw.hfToken === "string" ? raw.hfToken.trim() : "",
    };
  } catch {
    // No file yet — a fresh clone, or a machine that has never spoken. Local is
    // the default and needs no setup beyond the voice itself.
    cached = { engine: DEFAULT_ENGINE, hfToken: "" };
  }
  return cached;
}

export async function writeTtsConfig(patch: Partial<TtsConfig>): Promise<TtsConfig> {
  const next: TtsConfig = { ...(await readTtsConfig()), ...patch };
  await mkdir(SETTINGS_DIR, { recursive: true });
  const temp = `${SETTINGS_FILE}.${process.pid}.tmp`;
  // Temp then rename, so a crash mid-write never leaves a settings file that
  // parses to nothing and silently resets the teacher's choice.
  await writeFile(temp, JSON.stringify(next, null, 2), "utf8");
  await rename(temp, SETTINGS_FILE);
  cached = next;
  return next;
}

export async function readTtsEngine(): Promise<TtsEngine> {
  return (await readTtsConfig()).engine;
}

export async function writeTtsEngine(engine: TtsEngine): Promise<TtsEngine> {
  return (await writeTtsConfig({ engine })).engine;
}

/** The Hugging Face token, or "" when the teacher has not set one. */
export async function readHfToken(): Promise<string> {
  return (await readTtsConfig()).hfToken;
}

/** Test seam, and what a settings change calls to forget the cached answer. */
export function forgetTtsEngine(): void {
  cached = null;
}