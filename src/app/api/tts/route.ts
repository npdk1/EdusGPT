import { gzipSync } from "node:zlib";
import { NextResponse, type NextRequest } from "next/server";
import { speak, isVoiceId, pickVoice, DEFAULT_VOICE, VOICES, type LessonVoiceId, type WordMark } from "@/lib/server/tts";
import { pruneCache, readCachedAudio, writeCachedAudio } from "@/lib/server/tts-cache";
import { readTtsEngine } from "@/lib/server/tts-settings";
import { localVoiceStatus } from "@/lib/server/tts-local";
import { clientKey, rateLimit, rejectRemote } from "@/lib/server/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Streaming MP3 must never be cached by a CDN. */
export const maxDuration = 120;

/**
 * Word timings ride along in a header on the audio response, so the browser
 * does not need a second round trip to learn when each word is spoken.
 *
 * Rounded to whole milliseconds and gzipped: a 4,000-character narration is
 * ~800 words, which is ~24 kB of raw JSON — well past the ~8 kB header budget
 * browsers and proxies allow. Millisecond precision is far finer than the eye
 * needs on a subtitle, and the compressed form lands around 2 kB.
 */
function encodeWords(words: WordMark[]): string {
  const compact = words.map((mark) => [
    Math.round(mark.start * 1000),
    Math.round(mark.end * 1000),
    mark.text,
  ]);
  return gzipSync(Buffer.from(JSON.stringify(compact))).toString("base64");
}
/**
 * A scene narration is typically 100-400 characters. The cap is generous but
 * bounded: past this, synthesis time grows linearly and the request is not worth
 * blocking a UI on. Split across scenes instead.
 */
const MAX_TEXT = 4_000;

/**
 * The voices on offer, and which engine is reading them.
 *
 * The client needs the engine for one reason: in local mode the chosen name is a
 * request for a tempo, not a different person, and the studio says so rather than
 * letting the teacher wonder why "Nam Minh" sounds like Hoài My.
 */
export async function GET() {
  const [engine, local] = await Promise.all([readTtsEngine(), localVoiceStatus()]);
  return NextResponse.json({
    voices: VOICES,
    default: DEFAULT_VOICE,
    maxChars: MAX_TEXT,
    engine,
    local: {
      ready: local.ready,
      reason: local.reason,
      cuda: local.cuda,
      ffmpeg: local.ffmpeg,
      models: local.models.map((model) => ({ id: model.id, label: model.label })),
    },
  });
}

export async function POST(request: NextRequest) {
  const remote = rejectRemote(request);
  if (remote) return remote;

  // Every miss costs an outbound call and time on the one shared socket, so this
  // is the endpoint most worth capping. The budget is per minute rather than per
  // call because synthesis is slow: a long narration is tens of seconds, and a
  // cap that a single slow request could exhaust would break the next slide too.
  const limit = rateLimit(clientKey(request, "tts"), 120, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Quá nhiều yêu cầu đọc. Thử lại sau ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  let body: { text?: unknown; voice?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body phải là JSON." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Thiếu nội dung cần đọc." }, { status: 400 });
  }
  if (text.length > MAX_TEXT) {
    return NextResponse.json(
      { error: `Đoạn văn dài ${text.length} ký tự, vượt giới hạn ${MAX_TEXT}.` },
      { status: 413 },
    );
  }

  // The studio remembers one voice, but a lesson can be written in another
  // language than the screen: read an English slide with an English voice rather
  // than pronouncing it with Vietnamese one.
  const voice: LessonVoiceId = pickVoice(
    isVoiceId(body.voice) ? body.voice : DEFAULT_VOICE,
    text,
  );

  // Narrating the same sentence again is the common case, not the exception:
  // serve it from disk and skip the voice service entirely. The cache is keyed
  // by engine as well, so a teacher who switches engines hears the new one.
  const engine = await readTtsEngine();
  const cached = await readCachedAudio(text, voice, engine);
  if (cached) {
    return new NextResponse(Buffer.from(cached.audio), {
      headers: {
        "content-type": cached.contentType,
        "content-length": String(cached.audio.length),
        "cache-control": "no-store",
        "x-tts-voice": voice,
        "x-tts-engine": engine,
        "x-tts-cache": "hit",
        ...(cached.words ? { "x-tts-words": encodeWords(cached.words) } : {}),
      },
    });
  }

  try {
    const { audio, chunks, words, contentType, engine: used, notice } = await speak(text, voice);
    await writeCachedAudio(text, voice, used, audio, words, contentType);
    // Cheap, and only occasionally does real work.
    void pruneCache();
    return new NextResponse(Buffer.from(audio), {
      headers: {
        "content-type": contentType,
        "content-length": String(audio.length),
        "cache-control": "no-store",
        "x-tts-voice": voice,
        "x-tts-engine": used,
        "x-tts-chunks": String(chunks),
        "x-tts-cache": "miss",
        "x-tts-words": encodeWords(words),
        // Only ever set when the chosen engine could not do it: the studio shows
        // it once so the teacher knows which voice actually read the slide.
        ...(notice ? { "x-tts-notice": encodeURIComponent(notice) } : {}),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Không đọc được bằng giọng Việt. Thử lại, hoặc dùng giọng trình duyệt.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
