import { spawn } from "node:child_process";
import { readdir, readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { splitSentences } from "@/lib/karaoke";
import { resolveVoice } from "@/lib/lesson/voices";
import type { WordMark } from "./tts";

/**
 * The voice that runs on this machine.
 *
 * The other engine is a hosted service: one network call per slide, a rate limit,
 * and nothing at all on a laptop that is offline. Piper is a neural voice that
 * runs locally through onnxruntime — no key, no account, no request leaving the
 * machine — and on a modern CPU it synthesises faster than it is spoken, so a
 * classroom does not wait on it.
 *
 * What it does not have is a dozen voices. There is one Vietnamese voice here, so
 * the only thing a caller's chosen voice can still ask for is tempo: a "slow"
 * voice becomes a longer `length_scale` and everything else is the same voice.
 * That is stated in the settings panel rather than hidden, because a teacher who
 * picks "Nam Minh trầm" and hears a woman is better served by knowing why.
 */

const VOICE_DIR = join(process.cwd(), "data", "voices");
const SCRIPT = join(process.cwd(), "scripts", "local-voice", "piper_speak.py");
/** Bitrate for the MP3 handed to the browser; the source is 22 kHz mono. */
export const MP3_BITRATE = "96k";

export interface LocalVoiceModel {
  id: string;
  label: string;
  path: string;
  /** Piper's own language code, read from the model's config. */
  language: string;
  sampleRate: number;
  sizeMb: number;
}

export interface LocalVoiceStatus {
  /** True when a narration can actually be produced on this machine right now. */
  ready: boolean;
  /** The interpreter that will be used, or null when Python is not installed. */
  python: string | null;
  piper: boolean;
  ffmpeg: boolean;
  /** True when onnxruntime reports a CUDA provider, so the model runs on the GPU. */
  cuda: boolean;
  models: LocalVoiceModel[];
  /** Why this machine cannot speak yet. Empty when it can. */
  reason: string;
}

/** One short command, run only to find out whether a tool is there. */
function probe(
  command: string,
  args: string[],
  timeoutMs = 15_000,
): Promise<{ ok: boolean; stdout: string }> {
  return new Promise((resolve) => {
    let stdout = "";
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok, stdout });
    };
    let child;
    try {
      child = spawn(command, args, { windowsHide: true });
    } catch {
      resolve({ ok: false, stdout: "" });
      return;
    }
    const timer = setTimeout(() => {
      child.kill();
      done(false);
    }, timeoutMs);
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.on("error", () => done(false));
    child.on("close", (code) => done(code === 0));
  });
}

/**
 * Where Python is.
 *
 * `python` on PATH is not the same Python on every Windows machine — the Store
 * stub answers and then exits — so each candidate is asked for its version rather
 * than trusted. `EDUSGPT_PYTHON` overrides everything, which is the escape hatch
 * for a machine where the right interpreter is somewhere unusual.
 */
const PYTHON_CANDIDATES: { command: string; args: string[] }[] = [
  { command: process.env.EDUSGPT_PYTHON ?? "", args: [] },
  { command: "python", args: [] },
  { command: "py", args: ["-3"] },
  { command: "python3", args: [] },
];

export async function resolvePython(): Promise<{ command: string; args: string[] } | null> {
  for (const candidate of PYTHON_CANDIDATES) {
    if (!candidate.command) continue;
    const result = await probe(candidate.command, [
      ...candidate.args,
      "-c",
      "import sys; print(sys.version.split()[0])",
    ]);
    if (result.ok) return candidate;
  }
  return null;
}

export async function listModels(): Promise<LocalVoiceModel[]> {
  if (!existsSync(VOICE_DIR)) return [];
  const names = await readdir(VOICE_DIR).catch(() => [] as string[]);
  const models: LocalVoiceModel[] = [];
  for (const name of names) {
    if (!name.endsWith(".onnx")) continue;
    const path = join(VOICE_DIR, name);
    /**
     * Piper's own config, and it is not one shape.
     *
     * Older voices carry `"language": "vi_VN"` and a top-level `sample_rate`;
     * the current ones carry a `language` object (`code`, `family`, `name_native`)
     * and put the rate under `audio`. A hand-rolled cast to one of the two threw
     * a TypeError on every downloaded voice, which surfaced as the whole settings
     * route answering 500 with an empty body — so both shapes are read here and
     * the id's own prefix is the last resort.
     */
    let config: {
      language?: string | { code?: string; family?: string; name_native?: string };
      sample_rate?: number;
      audio?: { sample_rate?: number };
    } = {};
    try {
      config = JSON.parse(await readFile(`${path}.json`, "utf8"));
    } catch {
      /* a model without its config still speaks; only the label suffers */
    }
    const id = name.replace(/\.onnx$/, "");
    const spoken =
      typeof config.language === "string" ? config.language : config.language?.code;
    const language = spoken ?? id.split(/[-_]/)[0] ?? "vi";
    models.push({
      id,
      label: `${id} (${language.replace(/[_-].*$/, "").toUpperCase()})`,
      path,
      language,
      sampleRate: config.audio?.sample_rate ?? config.sample_rate ?? 22050,
      sizeMb: Math.round(statSync(path).size / 1_048_576),
    });
  }
  return models.sort((a, b) => a.id.localeCompare(b.id));
}

let cachedStatus: { at: number; status: LocalVoiceStatus } | null = null;
/** Probing spawns processes; a panel that polls every few seconds must not. */
const STATUS_TTL_MS = 30_000;

export async function localVoiceStatus(force = false): Promise<LocalVoiceStatus> {
  if (!force && cachedStatus && Date.now() - cachedStatus.at < STATUS_TTL_MS) {
    return cachedStatus.status;
  }
  const status = await probeStatus();
  cachedStatus = { at: Date.now(), status };
  return status;
}

/**
 * What this machine can actually do, and what is still missing.
 *
 * Every probe runs even when the answer is already "no": the panel exists to tell
 * a teacher which single thing to fix, and a report that stopped at the first
 * failure showed "Python: not found, Piper: not found" on a machine that had both
 * and was missing nothing but a voice file. So the checks are collected first and
 * the verdict is decided afterwards.
 */
async function probeStatus(): Promise<LocalVoiceStatus> {
  const models = await listModels();
  const script = existsSync(SCRIPT);
  const python = await resolvePython();
  const piper = python
    ? (await probe(python.command, [...python.args, "-c", "import piper"])).ok
    : false;
  const providers =
    piper && python
      ? await probe(python.command, [
          ...python.args,
          "-c",
          "import onnxruntime; print(','.join(onnxruntime.get_available_providers()))",
        ])
      : null;
  const ffmpeg = await probe("ffmpeg", ["-version"]);
  const base: LocalVoiceStatus = {
    ready: false,
    python: python?.command ?? null,
    piper,
    ffmpeg: ffmpeg.ok,
    cuda: providers?.stdout.includes("CUDAExecutionProvider") ?? false,
    models,
    reason: "",
  };
  if (!script) return { ...base, reason: `Thiếu script đọc giọng: ${SCRIPT}` };
  if (!python) {
    return { ...base, reason: "Máy này chưa có Python. Cài Python 3.10+ rồi thử lại." };
  }
  if (!piper) return { ...base, reason: "Chưa cài piper-tts. Bấm “Cài giọng cho máy này”." };
  if (models.length === 0) {
    return { ...base, reason: "Chưa có giọng nào trong data/voices — bấm “Cài giọng cho máy này”." };
  }
  return { ...base, ready: true, reason: "" };
}

/**
 * The model's tempo, from the voice the lesson asked for.
 *
 * `length_scale` above 1 stretches the audio, so 1.15 is the slow voice. Pitch is
 * not something this model can change, and pretending otherwise would produce a
 * promise the engine cannot keep.
 */
function lengthScaleFor(voice: string): number {
  const entry = resolveVoice(voice);
  return entry?.prosody?.rate === "slow" ? 1.15 : 1;
}

export interface LocalNarration {
  audio: Uint8Array;
  /** MP3 when ffmpeg is installed, WAV otherwise — both play in a browser. */
  contentType: "audio/mpeg" | "audio/wav";
  words: WordMark[];
  /** Sentences handed to the model, which is also how many timings came back. */
  chunks: number;
  model: string;
  /** Seconds of audio produced. */
  seconds: number;
}

/**
 * How long a word is likely to take, relative to its neighbours.
 *
 * Piper reports how long each *sentence* took, not where its words fell, so the
 * words inside a sentence are spread by how much there is to say. Vietnamese is
 * written in syllables, so counting vowel groups is a far better guess than
 * counting characters: "năng" (one syllable) gets a fifth of "không" and a
 * fortieth of "bảo toàn". Punctuation rides on the word before it rather than
 * claiming a window of its own, which is what the caption's alignment expects.
 */
export function speechWeight(token: string): number {
  if (token.trim().length === 0) return 0;
  const letters = token.replace(/[^\p{L}\p{N}]/gu, "");
  if (letters.length === 0) return 0;
  const syllables = letters
    .toLocaleLowerCase("vi")
    .split(/[^a-zàáâãèéêìíòóôõùúýăĩũơưđạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]+/g)
    .filter(Boolean).length;
  // A trailing comma or full stop is a beat of silence the sentence really has,
  // so it is worth a little time of its own.
  const pause = /[,.;:!?…]["'’”)]*$/.test(token) ? 0.4 : 0;
  return Math.max(0.35, syllables) + pause;
}

/**
 * Spreads each sentence's real duration across its words.
 *
 * Sentence boundaries and durations are exact — they come from the model — so
 * the caption always changes sentence on the beat. Inside a sentence the split is
 * an estimate, and it is only ever a few tens of milliseconds out on a word the
 * eye is already following past.
 */
export function wordsFromTimings(
  sentences: string[],
  durations: number[],
): WordMark[] {
  const marks: WordMark[] = [];
  let cursor = 0;
  for (let i = 0; i < sentences.length; i += 1) {
    const seconds = durations[i] ?? 0;
    const tokens = sentences[i].split(/\s+/).filter((token) => token.length > 0);
    const weights = tokens.map(speechWeight);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let at = cursor;
    for (let t = 0; t < tokens.length; t += 1) {
      const share = total > 0 ? (weights[t] / total) * seconds : seconds / tokens.length;
      // Punctuation-only tokens are spoken as part of the word before them, so
      // they are handed that word's window rather than one of their own; the
      // alignment skips them either way.
      if (weights[t] > 0) {
        marks.push({ start: at, end: at + share, text: tokens[t] });
      }
      at += share;
    }
    cursor += seconds;
  }
  return marks;
}

function run(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let child;
    try {
      child = spawn(command, args, { windowsHide: true });
    } catch (error) {
      resolve({ code: -1, stdout: "", stderr: String(error) });
      return;
    }
    const timer = setTimeout(() => child.kill(), timeoutMs);
    const done = (code: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    };
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      stderr += String(error);
      done(-1);
    });
    child.on("close", (code) => done(code ?? -1));
  });
}

/** Reads a lesson's narration on this machine. Throws when it cannot. */
export async function speakLocal(text: string, voice: string): Promise<LocalNarration> {
  const status = await localVoiceStatus();
  if (!status.ready || !status.python) {
    throw new Error(status.reason || "Giọng trên máy chưa sẵn sàng.");
  }
  const model = modelForLanguage(status.models, voice.split("-")[0]?.toLowerCase() ?? "vi");
  if (!model) throw new Error("Chưa có giọng nào trong data/voices.");
  const sentences = splitSentences(text);
  if (sentences.length === 0) throw new Error("Không có câu nào để đọc.");

  const python = await resolvePython();
  if (!python) throw new Error("Không tìm thấy Python.");

  const dir = await mkdtemp(join(tmpdir(), "edusgpt-voice-"));
  const input = join(dir, "sentences.json");
  const wav = join(dir, "narration.wav");
  const align = join(dir, "align.json");
  try {
    await writeFile(input, JSON.stringify(sentences), "utf8");
    const result = await run(
      python.command,
      [
        ...python.args,
        SCRIPT,
        "--model",
        model.path,
        "--input",
        input,
        "--out",
        wav,
        "--align",
        align,
        "--length-scale",
        String(lengthScaleFor(voice)),
        ...(status.cuda ? ["--cuda"] : []),
      ],
      // Long enough for a full scene of narration on a slow machine: four
      // minutes of audio on a CPU voice is about a minute of work.
      240_000,
    );
    if (result.code !== 0) {
      throw new Error(`Piper không đọc được: ${result.stderr.slice(0, 300) || result.stdout.slice(0, 300)}`);
    }

    let durations: number[] = [];
    try {
      const parsed = JSON.parse(await readFile(align, "utf8")) as {
        sentences?: { seconds: number }[];
      };
      durations = (parsed.sentences ?? []).map((entry) => entry.seconds);
    } catch {
      throw new Error("Piper không trả về mốc thời gian.");
    }

    let audio: Uint8Array;
    let contentType: LocalNarration["contentType"] = "audio/wav";
    if (status.ffmpeg) {
      const mp3 = join(dir, "narration.mp3");
      const converted = await run(
        "ffmpeg",
        ["-y", "-loglevel", "error", "-i", wav, "-codec:a", "libmp3lame", "-b:a", MP3_BITRATE, mp3],
        120_000,
      );
      if (converted.code === 0 && existsSync(mp3)) {
        audio = new Uint8Array(await readFile(mp3));
        contentType = "audio/mpeg";
      } else {
        audio = new Uint8Array(await readFile(wav));
      }
    } else {
      audio = new Uint8Array(await readFile(wav));
    }

    return {
      audio,
      contentType,
      words: wordsFromTimings(sentences, durations),
      chunks: sentences.length,
      model: model.id,
      seconds: durations.reduce((sum, value) => sum + value, 0),
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Picks the model for a lesson's language, falling back to whatever is there.
 *
 * Matched on the primary subtag, not the whole tag: a lesson asks for `vi` and a
 * downloaded voice says `vi_VN`, and treating those as different languages sent
 * every Vietnamese lesson to an English model when one was installed alongside.
 */
export function modelForLanguage(models: LocalVoiceModel[], language: string): LocalVoiceModel | null {
  const primary = language.split(/[-_]/)[0].toLowerCase();
  const match = (value: string) => value.split(/[-_]/)[0].toLowerCase() === primary;
  return models.find((model) => match(model.language)) ?? models[0] ?? null;
}
