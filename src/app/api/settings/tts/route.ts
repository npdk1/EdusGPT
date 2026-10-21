import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_ENGINE,
  isTtsEngine,
  readTtsConfig,
  writeTtsConfig,
} from "@/lib/server/tts-settings";
import { localVoiceStatus } from "@/lib/server/tts-local";
import { localVoiceCatalog } from "@/lib/server/local-voices";
import { rejectRemote } from "@/lib/server/guard";
import { maskKey } from "@/lib/ai/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Which engine reads the narration, whether this machine could, and which of the
 * two local engines are installed.
 *
 * All of it travels with the setting rather than being fetched separately: the
 * panel renders both from one response, and a teacher who picks "máy này" on a
 * machine with no voice installed needs to be told that in the same breath.
 */
export async function GET() {
  const [config, local, catalog] = await Promise.all([
    readTtsConfig(),
    localVoiceStatus(),
    localVoiceCatalog(),
  ]);
  const envGroqKey = process.env.GROQ_API_KEY?.trim() || "";
  const sttKeyHint = config.sttApiKey
    ? maskKey(config.sttApiKey)
    : envGroqKey
      ? `${maskKey(envGroqKey)} (tự động từ Groq API key)`
      : "";

  return NextResponse.json({
    engine: config.engine,
    speechRate: config.speechRate,
    sttApiKey: config.sttApiKey || envGroqKey,
    sttKeyHint,
    default: DEFAULT_ENGINE,
    local,
    providers: catalog.providers,
  });
}

export async function POST(request: NextRequest) {
  const remote = rejectRemote(request);
  if (remote) return remote;

  let body: { engine?: unknown; speechRate?: unknown; sttApiKey?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body phải là JSON." }, { status: 400 });
  }

  const patch: Parameters<typeof writeTtsConfig>[0] = {};
  if (isTtsEngine(body.engine)) {
    patch.engine = body.engine;
  }
  if (typeof body.speechRate === "number" && body.speechRate >= 0.75 && body.speechRate <= 1.5) {
    patch.speechRate = Number(body.speechRate.toFixed(2));
  }
  if (typeof body.sttApiKey === "string") {
    patch.sttApiKey = body.sttApiKey.trim();
  }

  const config = await writeTtsConfig(patch);
  const local = await localVoiceStatus(true);
  return NextResponse.json({
    ok: true,
    engine: config.engine,
    speechRate: config.speechRate,
    sttApiKey: config.sttApiKey,
    local,
  });
}