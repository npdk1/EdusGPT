import { NextResponse, type NextRequest } from "next/server";
import { PROVIDERS, PROVIDER_IDS, resolveProvider, type ProviderId } from "@/lib/ai/config";
import { credentialGate } from "@/lib/ai/readiness";
import { AiError, listModels } from "@/lib/ai/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseProvider(raw: string | null): ProviderId | null {
  if (!raw) return null;
  return (PROVIDER_IDS as readonly string[]).includes(raw) ? (raw as ProviderId) : null;
}

/**
 * Live model list for one provider.
 *
 * The provider comes from the query string rather than being inferred from the
 * active backend, and that distinction is the whole point: /setup lets you look
 * at a vendor you have not switched to yet. Asking for its models used to
 * return the *other* vendor's list under this one's label, so the dropdown
 * offered Gemini ids while the OpenRouter tab was open and the fetch
 * "succeeded" while showing something unrelated.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("provider");
  if (raw && !parseProvider(raw)) {
    return NextResponse.json(
      { ok: false, error: `Provider không hợp lệ: ${raw}` },
      { status: 400 },
    );
  }

  const creds = await resolveProvider(parseProvider(raw) ?? undefined);
  const gate = await credentialGate(creds);
  if (gate) {
    return NextResponse.json(
      { ok: false, provider: creds.provider, error: gate },
      { status: 428 },
    );
  }

  try {
    const models = await listModels(creds);
    return NextResponse.json(
      {
        ok: true,
        provider: creds.provider,
        providerLabel: PROVIDERS[creds.provider].label,
        model: creds.model,
        models,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof AiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Không lấy được danh sách model";
    return NextResponse.json(
      { ok: false, provider: creds.provider, error: message },
      { status: 502 },
    );
  }
}
