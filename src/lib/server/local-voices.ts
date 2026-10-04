/**
 * The local voice engines, as far as the app is concerned.
 *
 * Piper is the one this project started with: one Vietnamese voice, small, fast.
 * VieNeu-TTS and v-tts are two more Vietnamese models that run on the same
 * machine, and between them they bring something Piper cannot: a choice of
 * speakers. A teacher picking a voice for a lesson is picking a person, and
 * "Nam Minh chậm" or "Hải Đăng" is a better answer than one voice at three tempos.
 *
 * All three are Python, all three are installed into the project's own venv
 * (`run.bat` creates it, `EDUSGPT_PYTHON` points at it), and all three are
 * driven by one script per engine under `scripts/local-voice/` with the same
 * contract: sentences in, one WAV and per-sentence durations out.
 *
 * Which voices exist is a runtime question, not a catalogue — VieNeu alone ships
 * 25 speakers, and whether any of them can speak depends on what is installed.
 * So this module asks the machine, and caches the answer for a minute because a
 * settings panel polls.
 */

import { existsSync } from "node:fs";
import { readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import {
  localProviderOf,
  type LocalProvider,
  type LessonVoiceId,
} from "@/lib/lesson/voices";
import type { WordMark } from "@/lib/karaoke";
import {
  MP3_BITRATE,
  listModels,
  resolvePython,
  wordsFromTimings,
} from "./tts-local";
import { readHfToken } from "./tts-settings";

const SCRIPT_DIR = join(process.cwd(), "scripts", "local-voice");

/** How long a provider's voice list stays good before we ask the machine again. */
const VOICES_TTL_MS = 60_000;

export interface LocalVoiceOption {
  /** `provider:target`, the whole id as a lesson stores it. */
  id: LessonVoiceId;
  label: string;
  provider: LocalProvider;
  /** What the Python side calls this voice: a model file, a preset, a speaker code. */
  target: string;
  language: string;
  sampleRate?: number;
  /** One line for the picker: what this voice is, and where it came from. */
  note?: string;
}

export interface LocalProviderStatus {
  provider: LocalProvider;
  installed: boolean;
  /** Set when the engine is installed but cannot speak yet. */
  reason: string;
  voices: number;
  /** The install command the setup screen offers. */
  pip: string;
  label: string;
}

const PROVIDER_META: Record<LocalProvider, { label: string; pip: string }> = {
  piper: {
    label: "Piper",
    pip: "piper-tts",
  },
  vieneu: {
    label: "VieNeu-TTS",
    pip: "vieneu",
  },
  vtts: {
    label: "v-tts",
    pip: "git+https://github.com/tronghieuit/v-tts.git",
  },
};

/** Where VieNeu keeps its speakers, as its own SDK reports them. */
const VIENEU_NANO_VOICES = [
  "Adam",
  "Ái Hân",
  "Mỹ Duyên",
  "Đức Trí",
  "Hữu Quân",
  "Xuân Tiên",
  "Mai Anh",
  "Trúc Ly",
  "Anh Khôi",
  "Minh Quân",
  "Mạnh Dũng",
];

/** The v3 Turbo speakers, in the order the model lists them. */
const VIENEU_TURBO_VOICES = [
  "Adam bựa",
  "Trúc Ly",
  "Thiện Minh",
  "Mai Anh",
  "Hải Đăng",
  "Thùy Dung",
  "Thiền Tâm Đức",
  "Ngọc Huyền",
  "Quang Sơn",
  "Ngọc Trân",
  "Minh Đức",
  "Phạm Tuyên",
  "Xuân Vĩnh",
  "Thanh Bình",
  "Ngọc Linh",
  "Đoan Trang",
  "Quỳnh Anh",
  "Quốc Tuấn",
  "Quang Sơn",
  "Ngọc Trân",
  "Adam",
  "Thái Sơn",
  "Thục Đoan",
  "Minh Triết",
  "Mỹ Duyên",
  "Đức Trí",
  "Kim Thanh",
  "Thùy Dung",
];

const VTTS_SPEAKERS = ["NF", "SF", "NM1", "SM", "NM2"];

const VTTS_NOTES: Record<string, string> = {
  NF: "nữ Bắc",
  SF: "nữ Nam",
  NM1: "nam Bắc",
  SM: "nam Nam",
  NM2: "nam Bắc (thứ hai)",
};

type Cache = { at: number; voices: LocalVoiceOption[]; providers: LocalProviderStatus[] };
let cached: Cache | null = null;

export function forgetLocalVoices(): void {
  cached = null;
}

/**
 * The voices this machine can actually speak, and what is missing to get more.
 *
 * Probing spawns a Python process per engine, so the answer is cached for a
 * minute. Every engine is probed even after one fails, because the point of the
 * list is to show which of three buttons to press, not to report the first
 * problem found.
 */
export async function localVoiceCatalog(
  force = false,
): Promise<{ voices: LocalVoiceOption[]; providers: LocalProviderStatus[] }> {
  if (!force && cached && Date.now() - cached.at < VOICES_TTL_MS) {
    return { voices: cached.voices, providers: cached.providers };
  }
  const python = await resolvePython();
  const voices: LocalVoiceOption[] = [];
  const providers: LocalProviderStatus[] = [];

  // Piper first: it is the one that has always worked here, and its voices are
  // files on disk rather than a model that downloads itself.
  const models = await listModels();
  providers.push({
    provider: "piper",
    installed: models.length > 0,
    reason: models.length === 0 ? "Chưa có file giọng trong data/voices." : "",
    voices: models.length,
    pip: PROVIDER_META.piper.pip,
    label: PROVIDER_META.piper.label,
  });
  for (const model of models) {
    voices.push({
      id: `piper:${model.id}`,
      label: `${model.label} (Piper)`,
      provider: "piper",
      target: model.path,
      language: model.language || "vi",
      sampleRate: model.sampleRate,
      note: "chạy rất nhanh, giọng đơn",
    });
  }

  const vieneu = await probeProvider(python, "vieneu");
  const vieneuVoices = vieneu.ok ? vieneuVoicesFor() : [];
  providers.push({
    provider: "vieneu",
    installed: vieneu.ok,
    reason: vieneu.ok
      ? ""
      : "Chưa cài vieneu trong venv. Bấm “Cài” ở /setup.",
    voices: vieneuVoices.length,
    pip: PROVIDER_META.vieneu.pip,
    label: PROVIDER_META.vieneu.label,
  });
  voices.push(...vieneuVoices);

  const vtts = await probeProvider(python, "v_tts");
  const vttsVoices = vtts.ok
    ? VTTS_SPEAKERS.map((speaker) => ({
        id: `vtts:${speaker}` as LessonVoiceId,
        label: `${speaker} (v-tts)`,
        provider: "vtts" as const,
        target: speaker,
        language: "vi",
        note: VTTS_NOTES[speaker],
      }))
    : [];
  providers.push({
    provider: "vtts",
    installed: vtts.ok,
    reason: vtts.ok ? "" : "Chưa cài v-tts trong venv. Bấm “Cài” ở /setup.",
    voices: vttsVoices.length,
    pip: PROVIDER_META.vtts.pip,
    label: PROVIDER_META.vtts.label,
  });
  voices.push(...vttsVoices);

  cached = { at: Date.now(), voices, providers };
  return { voices, providers };
}

/**
 * VieNeu's speakers, without starting the model.
 *
 * Loading a backbone costs three seconds (Nano) or twenty (Turbo) and half a
 * gigabyte of downloads, so the picker works from the published list instead.
 * A name the installed build does not have falls back to the engine's default in
 * the Python script, which is a working voice rather than an error.
 */
function vieneuVoicesFor(): LocalVoiceOption[] {
  const out: LocalVoiceOption[] = [];
  for (const [mode, names, rate] of [
    ["nano", VIENEU_NANO_VOICES, 24000],
    ["turbo", VIENEU_TURBO_VOICES, 48000],
  ] as const) {
    const seen = new Set<string>();
    for (const name of names) {
      const key = name.toLocaleLowerCase("vi");
      // Turbo lists a couple of names twice, once per region; one entry is
      // enough, and two identical chips in a picker is a bug, not a feature.
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: `vieneu:${mode}:${name}` as LessonVoiceId,
        label: `${name} (VieNeu ${mode === "nano" ? "Nano" : "Turbo"})`,
        provider: "vieneu",
        target: name,
        language: "vi",
        sampleRate: rate,
        note: mode === "nano" ? "nhẹ, đọc nhanh" : "48 kHz, chất lượng cao",
      });
    }
  }
  return out;
}

async function probeProvider(
  python: { command: string; args: string[] } | null,
  module: string,
): Promise<{ ok: boolean; stdout: string }> {
  if (!python) return { ok: false, stdout: "" };
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(python.command, [...python.args, "-c", `import ${module}`], {
        windowsHide: true,
      });
    } catch {
      resolve({ ok: false, stdout: "" });
      return;
    }
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, stdout: "" });
    }, 20_000);
    let stdout = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ ok: false, stdout });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout });
    });
  });
}

export interface LocalNarrationResult {
  audio: Uint8Array;
  contentType: "audio/mpeg" | "audio/wav";
  words: WordMark[];
  chunks: number;
  voice: LessonVoiceId;
}

/**
 * Reads a piece of text with whichever local engine the voice id names.
 *
 * One Python process per call, the same as Piper: each of these models loads its
 * weights on start-up, and paying that once per slide instead of once per lesson
 * would be the difference between a lesson that previews and one that does not.
 * The sentence durations the model reports are spread across the words to build
 * the caption's timings — none of the three engines measures word boundaries.
 */
export async function speakLocalProvider(
  text: string,
  option: LocalVoiceOption,
): Promise<LocalNarrationResult> {
  const python = await resolvePython();
  if (!python) {
    throw new Error("Máy này chưa có Python 3.10+ (chạy lại run.bat để tạo venv).");
  }

  const sentences = splitSentences(text);
  const dir = join(tmpdir(), `edusgpt-${option.provider}-${process.pid}-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  const input = join(dir, "sentences.json");
  const wav = join(dir, "narration.wav");
  const align = join(dir, "align.json");

  try {
    await writeFile(input, JSON.stringify(sentences), "utf8");
    // A gated model on Hugging Face needs the teacher's read-only token; the
    // environment is inherited so the other engines are unaffected.
    const token = await readHfToken();
    const result = await runPython(python, scriptFor(option), argsFor(option, [
      "--input",
      input,
      "--out",
      wav,
      "--align",
      align,
    ]), token);
    if (result.code !== 0) {
      throw new Error(result.tail || `${option.provider} không đọc được.`);
    }
    if (!existsSync(wav)) {
      throw new Error(`${option.provider} không trả về file âm thanh.`);
    }
    const aligned = await readAlign(align);
    const words = wordsFromDurations(sentences, aligned.map((item) => item.seconds ?? 0));
    const mp3 = await encodeMp3(wav, dir);
    return {
      audio: mp3.bytes,
      contentType: mp3.contentType,
      words,
      chunks: sentences.length,
      voice: option.id,
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function scriptFor(option: LocalVoiceOption): string {
  const file =
    option.provider === "vieneu"
      ? "vieneu_speak.py"
      : option.provider === "vtts"
        ? "vtts_speak.py"
        : "piper_speak.py";
  return join(SCRIPT_DIR, file);
}

function argsFor(option: LocalVoiceOption, common: string[]): string[] {
  if (option.provider === "vieneu") {
    // `vieneu:turbo:Hải Đăng` — the middle part is the backbone, the rest the
    // speaker. Nano by default because it is the one a laptop can afford.
    const [, mode = "nano", ...rest] = option.id.split(":");
    return ["--mode", mode === "turbo" ? "turbo" : "nano", "--voice", rest.join(":"), ...common];
  }
  if (option.provider === "vtts") {
    return ["--speaker", option.target, ...common];
  }
  return ["--model", option.target, ...common];
}

interface AlignSentence {
  index?: number;
  samples?: number;
  seconds?: number;
}

async function readAlign(path: string): Promise<AlignSentence[]> {
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as {
      sentences?: AlignSentence[];
    };
    return Array.isArray(raw.sentences) ? raw.sentences : [];
  } catch {
    return [];
  }
}

/**
 * The caption's word timings, spread across each sentence's real duration.
 *
 * Shared with the Piper path (`wordsFromTimings` in `tts-local`) because the
 * problem is identical: the models say how long a sentence took, not where its
 * words fell, and a caption with no timings cannot follow the voice. Kept here as
 * a thin call so both paths stay in step.
 */
function wordsFromDurations(sentences: string[], seconds: number[]): WordMark[] {
  return wordsFromTimings(sentences, seconds);
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function runPython(
  python: { command: string; args: string[] },
  script: string,
  args: string[],
  /** Hugging Face token for the gated models; "" leaves the environment alone. */
  hfToken = "",
): Promise<{ code: number; tail: string }> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(python.command, [...python.args, script, ...args], {
        windowsHide: true,
        ...(hfToken ? { env: { ...process.env, HF_TOKEN: hfToken } } : {}),
      });
    } catch (error) {
      resolve({ code: -1, tail: String(error) });
      return;
    }
    const tail: string[] = [];
    const push = (chunk: unknown) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        tail.push(trimmed);
        if (tail.length > 14) tail.shift();
      }
    };
    child.stdout?.on("data", push);
    child.stderr?.on("data", push);
    const timer = setTimeout(() => child.kill(), 600_000);
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: -1, tail: [...tail, String(error)].join("\n") });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, tail: tail.join("\n") });
    });
  });
}

/**
 * MP3 when ffmpeg is installed, WAV otherwise — both play in a browser.
 *
 * Written to a file rather than piped: ffmpeg needs `-f mp3 pipe:1` to write to
 * stdout, and the file it makes is the same bytes with one less thing to go
 * wrong on a machine that has never run ffmpeg before.
 */
async function encodeMp3(
  wavPath: string,
  dir: string,
): Promise<{ bytes: Uint8Array; contentType: "audio/mpeg" | "audio/wav" }> {
  const wav = await readFile(wavPath);
  const mp3Path = join(dir, "narration.mp3");
  const converted = await runBinary("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    wavPath,
    "-codec:a",
    "libmp3lame",
    "-b:a",
    MP3_BITRATE,
    mp3Path,
  ]);
  if (converted.code === 0 && existsSync(mp3Path)) {
    return { bytes: new Uint8Array(await readFile(mp3Path)), contentType: "audio/mpeg" };
  }
  return { bytes: new Uint8Array(wav), contentType: "audio/wav" };
}

function runBinary(command: string, args: string[]): Promise<{ code: number }> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { windowsHide: true });
    } catch {
      resolve({ code: -1 });
      return;
    }
    child.stdout?.resume();
    child.stderr?.resume();
    const timer = setTimeout(() => child.kill(), 120_000);
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ code: -1 });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1 });
    });
  });
}
/** The catalogue entry a saved voice id names, or null if nothing matches. */
export async function localVoiceFor(
  voice: LessonVoiceId,
): Promise<LocalVoiceOption | null> {
  const provider = localProviderOf(voice);
  if (!provider) return null;
  const { voices } = await localVoiceCatalog();
  return voices.find((option) => option.id === voice) ?? null;
}