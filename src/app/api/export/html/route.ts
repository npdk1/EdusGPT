import { NextResponse, type NextRequest } from "next/server";
import { buildStandaloneHtml } from "@/lib/lesson/export-html";
import { coerceLesson } from "@/lib/lesson/validate";
import { alignSentences, type AlignedSentence } from "@/lib/karaoke";
import { DEFAULT_VOICE, isViVoice, speak } from "@/lib/server/tts";
import { slugify } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * About 30 MB of base64 audio: past that, mail clients and old phones start
 * refusing the file, and the user is better off splitting the deck. A short
 * lesson lands around one megabyte.
 */
const MAX_EXPORT_AUDIO_BYTES = 30 * 1024 * 1024;

/**
 * Compiles a lesson into one self-contained HTML file — one page, no server, and
 * bidirectional scrubbing plus A→B looping kept intact.
 */
export async function POST(request: NextRequest) {
  let body: { lesson?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body phải là JSON." }, { status: 400 });
  }

  const lesson = coerceLesson(body.lesson);
  if (!lesson) {
    return NextResponse.json(
      { error: "Dữ liệu bài giảng không hợp lệ." },
      { status: 400 },
    );
  }

  const voice = isViVoice(lesson.voice) ? lesson.voice : DEFAULT_VOICE;
  // One narration clip per scene, embedded as a data URI so the file needs no
  // server to speak. A scene that fails to synthesise stays silent instead of
  // failing the whole export.
  const audios: (string | null)[] = [];
  // Word timings per scene, cut into caption sentences with the same
  // `alignSentences` the web caption uses. The standalone file has no
  // server to ask, so the highlight data rides inside it next to the audio.
  const karaoke: AlignedSentence[][] = [];
  let audioBytes = 0;
  for (const scene of lesson.scenes) {
    if (!scene.narration) {
      audios.push(null);
      karaoke.push([]);
      continue;
    }
    try {
      const { audio, words } = await speak(scene.narration, voice);
      audioBytes += audio.length;
      if (audioBytes > MAX_EXPORT_AUDIO_BYTES) {
        return NextResponse.json(
          {
            error:
              "File giọng đọc quá nặng (trên ~30MB). Chia bài thành nhiều phần ngắn rồi xuất từng phần.",
          },
          { status: 413 },
        );
      }
      audios.push(`data:audio/mpeg;base64,${Buffer.from(audio).toString("base64")}`);
      karaoke.push(alignSentences(scene.narration, words));
    } catch {
      audios.push(null);
      karaoke.push([]);
    }
  }

  const html = buildStandaloneHtml({ lesson, audios, karaoke });
  const filename = `${slugify(lesson.title) || "bai-giang"}.html`;

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
