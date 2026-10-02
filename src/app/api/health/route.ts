import { NextResponse } from "next/server";
import { publicAiStatus } from "@/lib/ai/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Single place the browser asks "is the AI wired up, and how?". */
export async function GET() {
  try {
    const ai = await publicAiStatus();
    return NextResponse.json(
      { ok: true, ai, checkedAt: new Date().toISOString() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "unknown error",
      },
      { status: 500 },
    );
  }
}
