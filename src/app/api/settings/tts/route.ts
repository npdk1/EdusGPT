import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_ENGINE,
  isTtsEngine,
  readTtsEngine,
  writeTtsEngine,
} from "@/lib/server/tts-settings";
import { localVoiceStatus } from "@/lib/server/tts-local";
import { rejectRemote } from "@/lib/server/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Which engine reads the narration, and whether this machine could.
 *
 * The status travels with the setting rather than being fetched separately: the
 * panel renders both from one response, and a teacher who picks "máy này" on a
 * machine with no voice installed needs to be told that in the same breath.
 */
export async function GET() {
  const [engine, local] = await Promise.all([readTtsEngine(), localVoiceStatus()]);
  return NextResponse.json({ engine, default: DEFAULT_ENGINE, local });
}

export async function POST(request: NextRequest) {
  const remote = rejectRemote(request);
  if (remote) return remote;

  let body: { engine?: unknown };
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

  await writeTtsEngine(body.engine);
  // Re-probed rather than reported from the old cache: picking the machine's
  // voice is exactly the moment the answer changes.
  const local = await localVoiceStatus(true);
  return NextResponse.json({ engine: body.engine, local });
}
