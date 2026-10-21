import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Which engine speaks the narration.
 *
 * Two settings, one file:
 *
 *   - `engine` — `local` reads on this machine, `cloud` uses the hosted voice
 *                  service. Local is the default because it is the one that cannot
 *                  fail for a reason the teacher cannot fix.
 *
 * Written to `data/tts-settings.json` rather than to the AI settings file: this is a
 * choice about speech, not about a model, and the two are read by different parts of
 * the app.
 */
export type TtsEngine = "local" | "cloud";

const SETTINGS_DIR = join(process.cwd(), "data");
const SETTINGS_FILE = join(SETTINGS_DIR, "tts-settings.json");

export const DEFAULT_ENGINE: TtsEngine = "local";
export const DEFAULT_SPEECH_RATE = 1.0;

export interface TtsConfig {
  engine: TtsEngine;
  /** Speech rate multiplier: 0.8 to 1.3 (default 1.0). */
  speechRate: number;
  /** Groq Whisper STT API key override. If omitted, uses GROQ_API_KEY from .env. */
  sttApiKey?: string;
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
      speechRate?: unknown;
      sttApiKey?: unknown;
    };
    const rate =
      typeof raw.speechRate === "number" && raw.speechRate >= 0.75 && raw.speechRate <= 1.5
        ? Number(raw.speechRate.toFixed(2))
        : DEFAULT_SPEECH_RATE;
    cached = {
      engine: isTtsEngine(raw.engine) ? raw.engine : DEFAULT_ENGINE,
      speechRate: rate,
      sttApiKey: typeof raw.sttApiKey === "string" ? raw.sttApiKey.trim() : undefined,
    };
  } catch {
    // No file yet — a fresh clone, or a machine that has never spoken. Local is
    // the default and needs no setup beyond the voice itself.
    cached = { engine: DEFAULT_ENGINE, speechRate: DEFAULT_SPEECH_RATE };
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

export async function readSpeechRate(): Promise<number> {
  return (await readTtsConfig()).speechRate;
}

export async function readSttApiKey(): Promise<string> {
  const config = await readTtsConfig();
  if (config.sttApiKey) return config.sttApiKey;
  return process.env.GROQ_API_KEY?.trim() || "";
}

export async function writeTtsEngine(engine: TtsEngine): Promise<TtsEngine> {
  return (await writeTtsConfig({ engine })).engine;
}

/** Test seam, and what a settings change calls to forget the cached answer. */
export function forgetTtsEngine(): void {
  cached = null;
}