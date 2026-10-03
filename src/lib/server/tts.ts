import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Speech synthesis, Vietnamese and English first.
 *
 * Microsoft Edge's neural voices are genuinely native Vietnamese — the model was
 * trained on Vietnamese speakers, so stress and tone land correctly instead of
 * being spelled out letter by letter. It also needs no API key, which matters
 * because a teacher should be able to press play the moment they install this.
 *
 * The catalogue itself lives in `@/lib/lesson/voices`, so client components can
 * ask which voice suits a lesson's language; this module only talks to the
 * service.
 */
export {
  DEFAULT_VOICE,
  EN_VOICES,
  VI_VOICES,
  VOICES,
  isVoiceId,
  isVietnameseVoice,
  pickVoice,
  resolveVoice,
  voiceForLanguage,
  voicesForLanguage,
  type LessonVoiceId,
} from "@/lib/lesson/voices";

import { resolveVoice, type LessonVoiceId } from "@/lib/lesson/voices";

/**
 * Keeps a bug in msedge-tts from killing the whole app.
 *
 * The library writes and unlinks its `metadata.json` from inside stream
 * callbacks. When a chunk comes back with no boundary metadata, those callbacks
 * touch a file that is not there — and an exception thrown from a stream
 * handler cannot be caught by the `await` that started the work, so it surfaces
 * as an uncaughtException and takes the server down. The workaround above
 * (creating the file up front) covers the unlink path, but not the write path
 * when the temp directory disappears underneath a concurrent request.
 *
 * So the failure is contained here rather than left to a try/catch that cannot
 * reach it. Nothing is lost: the caller has already moved on, and the narration
 * it wanted was either served from cache or failed in a way it handles. Swallow
 * only this one shape — an unexpected error must still crash loudly in dev
 * rather than be hidden behind a lesson that mysteriously goes quiet.
 */
const TEMP_DIR_PREFIX = "eduaistudio-tts-";
const tempPathNoise = /\bENOENT\b|eduaistudio-tts-/;

process.on("uncaughtException", (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const path = (error as { path?: string } | null)?.path ?? "";
  if (tempPathNoise.test(message) || path.includes(TEMP_DIR_PREFIX)) {
    return;
  }
  // Anything else is a real bug: rethrow so it is loud rather than swallowed.
  throw error;
});

/** Edge TTS hard-limits a single request; split on sentence boundaries. */
const MAX_CHARS_PER_REQUEST = 1_200;

/**
 * A single chunk must finish inside this window. Without it one stalled stream
 * wedges the shared socket and every later request waits on it forever — an
 * aborted client request is enough to trigger.
 *
 * 45 seconds, not 25: a slide narration of 400-600 characters is ordinary, and
 * measured at 440 characters the service took past 25s. Failing that meant the
 * voice fell back to the browser for a large share of lessons. The stall this
 * guards against is still caught — it just takes longer to declare.
 */
const CHUNK_TIMEOUT_MS = 45_000;

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} quá ${Math.round(ms / 1000)}s`)),
      ms,
    );
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function splitForSpeech(text: string, limit = MAX_CHARS_PER_REQUEST): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean ? [clean] : [];

  const out: string[] = [];
  let buf = "";
  for (const part of clean.split(/(?<=[.!?…])\s+/)) {
    if (buf && buf.length + part.length + 1 > limit) {
      out.push(buf);
      buf = part;
    } else {
      buf = buf ? `${buf} ${part}` : part;
    }
  }
  if (buf) out.push(buf);
  return out;
}

/**
 * Edge's endpoint occasionally drops a synthesis turn mid-stream, and hands out
 * fresh trust tokens slowly enough that back-to-back handshakes trip it. Both
 * look the same to us and both are worth retrying — the alternative is a lesson
 * that silently loses its narration.
 */
function isRetryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|429|503/i.test(
      message,
    )
    || /stream closed|turn\.end|websocket|not open/i.test(message)
    || /quá \d+s$/.test(message) // our own chunk timeout: a stalled socket
  );
}

/**
 * One long-lived socket, reused across requests.
 *
 * Edge's endpoint throttles fresh handshakes: opening a connection per sentence
 * made roughly one in three narrations fail with a mid-stream close. Holding a
 * single connection and rebuilding it only when it actually dies cuts the
 * handshakes to roughly one, which is both faster and far more reliable.
 */
interface Connection {
  tts: MsEdgeTTS;
  dir: string;
}

let shared: Connection | null = null;
/** Serialises synthesis: one socket, one request at a time. */
let queue: Promise<unknown> = Promise.resolve();

function openConnection(): Promise<Connection> {
  const tts = new MsEdgeTTS();
  const connection: Connection = { tts, dir: "" };
  return (async () => {
    try {
      connection.dir = await mkdtemp(join(tmpdir(), "eduaistudio-tts-"));
      return connection;
    } catch (error) {
      try { tts.close(); } catch { /* never opened */ }
      throw error;
    }
  })();
}

async function closeConnection(connection: Connection | null) {
  if (!connection) return;
  try { connection.tts.close(); } catch { /* already gone */ }
  await rm(connection.dir, { recursive: true, force: true }).catch(() => {});
  if (shared === connection) shared = null;
}

/** Serialises access: one shared socket, one synthesis at a time. */
function withConnection<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(
    () => task(),
    () => task(),
  );
  // Keep the chain alive even when a task rejects, or every later call inherits
  // the rejection.
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Duration of an MP3 in seconds, by walking its frame headers.
 *
 * Needed only to line up the second and later chunks: the voice service reports
 * word offsets per request, each starting at zero, but the chunks are
 * concatenated into a single file, so chunk N's timings have to be shifted by
 * the real length of chunks 1..N-1.
 *
 * A byte-size estimate would be wrong for anything but constant-bitrate, and
 * this stream is not guaranteed to be. The fallback is deliberately crude but
 * it is only ever a few tens of milliseconds off, which is invisible.
 */
const MP3_BITRATES_V1_L3 = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
];
const MP3_RATES_V1 = [44100, 48000, 32000, 0];

function mp3DurationSeconds(audio: Uint8Array): number {
  try {
    let offset = 0;
    // Skip an ID3v2 tag if present, so the walk does not start on garbage.
    if (
      audio[0] === 0x49 && audio[1] === 0x44 && audio[2] === 0x33
    ) {
      const size =
        ((audio[6] & 0x7f) << 21) | ((audio[7] & 0x7f) << 14)
        | ((audio[8] & 0x7f) << 7) | (audio[9] & 0x7f);
      offset = 10 + size;
    }

    let samples = 0;
    let sampleRate = 0;
    while (offset + 4 <= audio.length) {
      if (audio[offset] !== 0xff || (audio[offset + 1] & 0xe0) !== 0xe0) {
        offset += 1;
        continue;
      }
      const header = audio[offset + 1];
      // Only MPEG-1 Layer III is emitted here; anything else is not ours.
      if ((header & 0x18) !== 0x18 || (header & 0x06) !== 0x02) {
        offset += 1;
        continue;
      }
      const bitrate = MP3_BITRATES_V1_L3[(audio[offset + 2] & 0xe0) >> 5];
      const rate = MP3_RATES_V1[(audio[offset + 2] & 0x0c) >> 2];
      if (bitrate === 0 || rate === 0) {
        offset += 1;
        continue;
      }
      const padding = (audio[offset + 2] & 0x02) >> 1;
      samples += 1152;
      sampleRate = rate;
      offset += (Math.floor((144 * bitrate * 1000) / rate) + padding);
    }
    if (samples > 0 && sampleRate > 0) return samples / sampleRate;
  } catch {
    /* fall through to the estimate */
  }
  // 96 kbps constant, which is what we request.
  return (audio.length * 8) / 96_000;
}

/** One word's speaking window, in seconds from the start of the audio. */
export interface WordMark {
  start: number;
  end: number;
  /**
   * The word as the service read it, not as the slide spells it. The client
   * needs it to line the boundaries up with the subtitle: the slide shows
   * "9 × 1" while the service reports "9", "x", "1".
   */
  text: string;
}

interface Synthesis {
  audio: Uint8Array;
  words: WordMark[];
}

/** Edge reports offsets in 100-nanosecond ticks, per chunk. */
async function readWordMarks(metadataFilePath: string): Promise<WordMark[]> {
  const marks: WordMark[] = [];
  let raw: string;
  try {
    raw = await readFile(metadataFilePath, "utf8");
  } catch {
    return marks;
  }
  try {
    const parsed = JSON.parse(raw) as {
      Metadata?: Array<{ Data?: { Offset?: number; Duration?: number; text?: { Text?: string } } }>;
    };
    for (const entry of parsed.Metadata ?? []) {
      const offsetTicks = entry.Data?.Offset;
      const durationTicks = entry.Data?.Duration;
      if (typeof offsetTicks !== "number") continue;
      const start = offsetTicks / 1e7;
      const end = start + (typeof durationTicks === "number" ? durationTicks / 1e7 : 0.2);
      marks.push({
        start,
        end: Math.max(end, start + 0.05),
        text: entry.Data?.text?.Text ?? "",
      });
    }
  } catch {
    /* a malformed metadata file just means no karaoke for this line */
  }
  return marks;
}

/** Synthesises every chunk down one connection, then hands the bytes back. */
async function synthesizeOnce(
  pieces: string[],
  voice: LessonVoiceId,
): Promise<Synthesis> {
  if (!shared) shared = await openConnection();
  const { name, prosody } = resolveVoice(voice);

  const buffers: Uint8Array[] = [];
  const words: WordMark[] = [];
  // Word timings are per-chunk and start at zero, but the chunks are
  // concatenated into one file — so every chunk's timings must be shifted by
  // the real duration of everything before it.
  let timelineOffset = 0;

  // One metadata handshake per narration, not per chunk: the voice and the
  // format never change mid-narration, and each setMetadata is a network
  // round trip. (The third argument stays mandatory — msedge-tts reads
  // `metadataOptions.voiceLocale` unguarded, so omitting it throws as soon as
  // the voice is already configured.)
  await shared.tts.setMetadata(name, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {
    // Without this the service returns audio with no word timings at all, and
    // the subtitle can only be highlighted by guessing.
    wordBoundaryEnabled: true,
  });

  for (const piece of pieces) {
    const dir = await mkdtemp(join(shared.dir, "chunk-"));
    try {
      // Work around a bug in msedge-tts: when a chunk comes back with no
      // boundary metadata, its error path calls `unlinkSync` on a file it never
      // wrote. That throws ENOENT from inside a stream handler, where nothing
      // can catch it, and the exception takes the whole server process down.
      // Creating the file first makes that unlink a harmless no-op.
      const metadataPath = join(dir, "metadata.json");
      await writeFile(metadataPath, "").catch(() => {});

      const { audioFilePath, metadataFilePath } = await withTimeout(
        shared.tts.toFile(`${dir}/`, piece, prosody),
        CHUNK_TIMEOUT_MS,
        "Tổng hợp giọng nói",
      );
      const audio = new Uint8Array(await readFile(audioFilePath));
      if (metadataFilePath) {
        for (const mark of await readWordMarks(metadataFilePath)) {
          words.push({
            start: mark.start + timelineOffset,
            end: mark.end + timelineOffset,
            text: mark.text,
          });
        }
      }
      buffers.push(audio);
      timelineOffset += mp3DurationSeconds(audio);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  const total = buffers.reduce((sum, b) => sum + b.length, 0);
  const audio = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    audio.set(b, offset);
    offset += b.length;
  }
  return { audio, words };
}

export interface SpeakResult {
  audio: Uint8Array;
  voice: LessonVoiceId;
  chunks: number;
  /** Per-word timings, empty when the service sent no boundary metadata. */
  words: WordMark[];
}

const MAX_ATTEMPTS = 3;

export async function speak(text: string, voice: LessonVoiceId): Promise<SpeakResult> {
  const pieces = splitForSpeech(text);
  if (pieces.length === 0) throw new Error("Không có chữ để đọc.");

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const { audio, words } = await withConnection(() => synthesizeOnce(pieces, voice));
      return { audio, voice, chunks: pieces.length, words };
    } catch (error) {
      lastError = error;
      // A dropped socket stays dropped; the next attempt needs a new one.
      await closeConnection(shared);
      if (attempt === MAX_ATTEMPTS || !isRetryable(error)) break;
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("TTS thất bại");
}
