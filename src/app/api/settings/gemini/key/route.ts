import { NextResponse, type NextRequest } from "next/server";
import {
  PROVIDER_IDS,
  PROVIDERS,
  isLocalRequest,
  resolveProvider,
  type ProviderId,
} from "@/lib/ai/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCAL_ONLY_MESSAGE =
  "Trang cài đặt key chỉ hoạt động khi bạn mở web bằng localhost (bảo vệ key).";

/**
 * Returns the stored key for one provider so the setup form can show it in
 * its password box. Localhost only, like the save/delete routes — the key
 * never crosses the wire for a remote visitor.
 */
export async function GET(request: NextRequest) {
  if (!isLocalRequest(request.headers.get("host"))) {
    return NextResponse.json({ error: LOCAL_ONLY_MESSAGE }, { status: 403 });
  }
  const requested = new URL(request.url).searchParams.get("provider");
  const provider: ProviderId = PROVIDER_IDS.includes(requested as ProviderId)
    ? (requested as ProviderId)
    : "gemini";
  // CLI providers hold no secret — there is nothing to echo back into the form.
  if (PROVIDERS[provider].kind === "cli") {
    return NextResponse.json(
      { ok: true, provider, key: null, source: "none", kind: "cli" },
      { headers: { "cache-control": "no-store" } },
    );
  }
  const creds = await resolveProvider(provider);
  return NextResponse.json(
    { ok: true, provider, key: creds.apiKey ?? null, source: creds.source },
    { headers: { "cache-control": "no-store" } },
  );
}
