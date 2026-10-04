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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Which engine reads the narration, whether this machine could, and which of the
 * three local engines are installed.
 *
 * All of it travels with the setting rather than being fetched separately: the
 * panel renders both from one response, and a teacher who picks "máy này" on a
 * machine with no voice installed needs to be told that in the same breath.
 *
 * The Hugging Face token rides along because one of the engines cannot download
 * its weights without it; the panel asks once and never has to ask again.
 */
export async function GET() {
  const [config, local, catalog] = await Promise.all([
    readTtsConfig(),
    localVoiceStatus(),
    localVoiceCatalog(),
  ]);
  return NextResponse.json({
    engine: config.engine,
    default: DEFAULT_ENGINE,
    // The token comes back masked: the panel only needs to know that one is set,
    // and a settings screen is not the place to read somebody's key out loud.
    hfToken: config.hfToken ? "••••" : "",
    local,
    providers: catalog.providers,
  });
}

export async function POST(request: NextRequest) {
  const remote = rejectRemote(request);
  if (remote) return remote;

  let body: { engine?: unknown; hfToken?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body phải là JSON." }, { status: 400 });
  }
  if (!isTtsEngine(body.engine)) {
    return NextResponse.json(
      { error: "Chỉ nhận “local” (giọng trên máy) hoặc “cloud” (API)." },
      { status: 400 },
    );
  }

  const patch: { engine: "local" | "cloud"; hfToken?: string } = { engine: body.engine };
  if (typeof body.hfToken === "string") patch.hfToken = body.hfToken.trim();

  const config = await writeTtsConfig(patch);
  // Re-probed rather than reported from the old cache: picking the machine's
  // voice is exactly the moment the answer changes.
  const local = await localVoiceStatus(true);
  return NextResponse.json({
    engine: config.engine,
    hfToken: config.hfToken ? "••••" : "",
    local,
  });
}