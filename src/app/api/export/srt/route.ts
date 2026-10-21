import { NextResponse, type NextRequest } from "next/server";
import { coerceLesson } from "@/lib/lesson/validate";
import { splitSentences, type WordMark } from "@/lib/karaoke";
import { slugify } from "@/lib/format";
import { readCachedAudio } from "@/lib/server/tts-cache";
import { readSttApiKey, readTtsEngine } from "@/lib/server/tts-settings";
import { DEFAULT_VOICE, pickVoice } from "@/lib/lesson/voices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatSrtTimestamp(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  const millis = Math.floor((safe % 1) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

interface SrtCue {
  start: number;
  end: number;
  text: string;
}

/**
 * Intelligent subtitle chunking from exact WordMark tokens:
 * 1. Groups words into natural sentences and clauses.
 * 2. Never leaves a dangling 1-2 words at the end of a sentence.
 * 3. Keeps cue length readable (6-16 words, or natural sentence boundary).
 * 4. Timestamps are 100% exact to the audio speech boundaries.
 */
function groupWordsIntoCues(words: WordMark[], sceneStart: number): SrtCue[] {
  if (!words || words.length === 0) return [];
  const cues: SrtCue[] = [];
  let current: WordMark[] = [];

  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    current.push(w);

    const isPunctSentence = /[.!?…]$/.test(w.text);
    const isPunctClause = /[,;:]$/.test(w.text);

    // Lookahead: how many words remain until the next sentence end?
    let remainingInSentence = 0;
    for (let j = i + 1; j < words.length; j += 1) {
      remainingInSentence += 1;
      if (/[.!?…]$/.test(words[j].text)) break;
    }

    let shouldBreak = false;
    if (isPunctSentence) {
      shouldBreak = true;
    } else if (isPunctClause && current.length >= 6 && remainingInSentence >= 4) {
      shouldBreak = true;
    } else if (current.length >= 14 && remainingInSentence >= 4) {
      shouldBreak = true;
    } else if (i === words.length - 1) {
      shouldBreak = true;
    }

    if (shouldBreak && current.length > 0) {
      const start = sceneStart + current[0].start;
      const rawEnd = sceneStart + current[current.length - 1].end;
      const nextWordStart = i + 1 < words.length ? sceneStart + words[i + 1].start : rawEnd + 0.5;
      const end = Math.min(nextWordStart, rawEnd + 0.15);

      cues.push({
        start,
        end,
        text: current.map((cw) => cw.text).join(" "),
      });
      current = [];
    }
  }
  return cues;
}

async function transcribeWithGroq(
  audioBytes: Uint8Array,
  groqKey: string,
  sceneStart: number,
): Promise<SrtCue[] | null> {
  try {
    const form = new FormData();
    form.append("file", new Blob([Buffer.from(audioBytes)], { type: "audio/mpeg" }), "audio.mp3");
    form.append("model", "whisper-large-v3-turbo");
    form.append("response_format", "verbose_json");

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      segments?: Array<{ start: number; end: number; text: string }>;
    };
    if (!Array.isArray(data.segments) || data.segments.length === 0) return null;
    return data.segments.map((seg) => ({
      start: sceneStart + seg.start,
      end: sceneStart + seg.end,
      text: seg.text.trim(),
    }));
  } catch {
    return null;
  }
}

/**
 * Exports lesson narration as an industry-standard SubRip Subtitle (.srt) file.
 * Prioritizes millisecond-exact timings from TTS word marks or Groq Whisper STT.
 * Compatible with YouTube, VLC, CapCut, Premiere, and any video editor.
 *
 * Query params:
 * ?mode=continuous -> for audio-continuous MP4 videos (scenes play speech back-to-back)
 * ?mode=timeline   -> (default) aligns with the web player's full scene.start timeline
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

  const url = new URL(request.url);
  const isContinuous = url.searchParams.get("mode") === "continuous";

  const cues: string[] = [];
  let cueNumber = 1;
  const engine = await readTtsEngine();
  const groqSttKey = await readSttApiKey();
  let accumulatedTime = 0;

  for (const scene of lesson.scenes) {
    const text = typeof scene.narration === "string" ? scene.narration.trim() : "";
    if (!text) continue;

    const voice = pickVoice(lesson.voice ?? DEFAULT_VOICE, text);
    const cached = await readCachedAudio(text, voice, engine);

    const audioSeconds =
      cached?.words && cached.words.length > 0
        ? cached.words[cached.words.length - 1].end
        : Math.max(1, text.split(/\s+/).filter(Boolean).length / 3.2);

    const sceneStart = isContinuous ? accumulatedTime : scene.start;

    let sceneCues: SrtCue[] | null = null;

    // 1. Try exact word boundaries from cached TTS
    if (cached?.words && cached.words.length > 0) {
      sceneCues = groupWordsIntoCues(cached.words, sceneStart);
    }

    // 2. If no word marks but audio and Groq API key available, use Whisper STT
    if ((!sceneCues || sceneCues.length === 0) && cached?.audio && groqSttKey) {
      sceneCues = await transcribeWithGroq(cached.audio, groqSttKey, sceneStart);
    }

    // 3. Fallback: proportional sentence distribution based on word count
    if (!sceneCues || sceneCues.length === 0) {
      const sentences = splitSentences(text, 14);
      if (sentences.length > 0) {
        const wordsPerSentence = sentences.map(
          (s) => s.split(/\s+/).filter(Boolean).length || 1,
        );
        const totalWords = wordsPerSentence.reduce((a, b) => a + b, 0);
        let offset = sceneStart;

        sceneCues = [];
        for (let i = 0; i < sentences.length; i += 1) {
          const sentenceWords = wordsPerSentence[i];
          const sentenceDuration = (sentenceWords / totalWords) * audioSeconds;
          const start = offset;
          const end = offset + sentenceDuration;
          offset = end;
          sceneCues.push({ start, end, text: sentences[i] });
        }
      }
    }

    if (sceneCues) {
      for (const cue of sceneCues) {
        cues.push(
          `${cueNumber}\n${formatSrtTimestamp(cue.start)} --> ${formatSrtTimestamp(cue.end)}\n${cue.text}\n`,
        );
        cueNumber += 1;
      }
    }

    // Advance continuous counter by audio length + standard 0.5s pause
    accumulatedTime += audioSeconds + 0.5;
  }

  const filename = `${slugify(lesson.title) || "bai-giang"}.srt`;
  const srtContent = cues.join("\n");

  return new NextResponse(srtContent, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
