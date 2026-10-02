import { NextResponse, type NextRequest } from "next/server";
import {
  PROVIDER_IDS,
  PROVIDERS,
  forgetApiKey,
  isLocalRequest,
  publicAiStatus,
  recordValidation,
  resolveProvider,
  saveApiKey,
  saveCliProvider,
  validateBaseUrl,
  type ProviderId,
} from "@/lib/ai/config";
import { validateKey } from "@/lib/ai/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCAL_ONLY_MESSAGE =
  "Trang cài đặt key chỉ hoạt động khi bạn mở web bằng localhost (bảo vệ key).";

export async function GET() {
  return NextResponse.json(
    { ai: await publicAiStatus() },
    { headers: { "cache-control": "no-store" } },
  );
}

interface SettingsBody {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  provider?: string;
  /** true = chỉ kiểm tra, không ghi .env */
  dryRun?: boolean;
}

/**
 * Validates a key against its provider, then (unless dryRun) writes it to
 * `.env` — the "cài thẳng qua web" flow, for either Gemini or OpenRouter.
 */
export async function POST(request: NextRequest) {
  if (!isLocalRequest(request.headers.get("host"))) {
    return NextResponse.json({ error: LOCAL_ONLY_MESSAGE }, { status: 403 });
  }

  let body: SettingsBody = {};
  try {
    body = (await request.json()) as SettingsBody;
  } catch {
    return NextResponse.json({ error: "Body phải là JSON." }, { status: 400 });
  }

  const provider: ProviderId = PROVIDER_IDS.includes(body.provider as ProviderId)
    ? (body.provider as ProviderId)
    : "gemini";
  const spec = PROVIDERS[provider];

  // CLI backends have no key: the agent authenticates once, interactively, and
  // from then on the app just needs to know the binary is installed. Everything
  // below this branch is about secrets, so it must not apply.
  if (spec.kind === "cli") {
    const current = await resolveProvider(provider);
    const validation = await validateKey({
      provider,
      apiKey: null,
      baseUrl: spec.defaultBaseUrl,
      model: body.model?.trim() || current.model,
      source: "none",
    });
    if (!validation.ok) {
      return NextResponse.json(
        { ok: false, validation, ai: await publicAiStatus() },
        { status: 400 },
      );
    }
    if (!body.dryRun) {
      await saveCliProvider(provider, { model: validation.model ?? body.model });
      await recordValidation(true, validation.message, {
        provider,
        model: validation.model,
      });
    }
    return NextResponse.json({
      ok: true,
      saved: !body.dryRun,
      validation,
      ai: await publicAiStatus(),
    });
  }

  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Thiếu API key." }, { status: 400 });
  }
  if (apiKey.length < 16 || /\s/.test(apiKey)) {
    return NextResponse.json(
      { error: "Key không hợp lệ: quá ngắn hoặc chứa khoảng trắng." },
      { status: 400 },
    );
  }

  // Resolve the *same* provider the key will be saved under, so baseUrl/model
  // defaults come from that vendor's spec.
  const current = await resolveProvider(provider);

  // Defence in depth: a base URL that clearly belongs to the *other* provider
  // is ignored. Without this, pasting an OpenRouter key while the Gemini base
  // URL was still in the form sent it to Google, which replied "expected OAuth 2
  // access token" — a confusing error for an entirely wrong reason.
  const requested = body.baseUrl?.trim();
  const foreignProvider = Object.values(PROVIDERS).find(
    (spec) => spec.id !== provider && requested?.includes(new URL(spec.defaultBaseUrl).host),
  );
  const candidate = requested && !foreignProvider ? requested : current.baseUrl;

  // Checked here, before validateKey, and regardless of dryRun: that call
  // attaches the API key to an outbound request, so an unchecked base URL
  // exfiltrates the key to whoever chose the host. Validating only on save
  // left the probe path wide open.
  let baseUrl: string;
  try {
    baseUrl = validateBaseUrl(provider, candidate);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Base URL không hợp lệ.",
      },
      { status: 400 },
    );
  }

  const isStoredKey = Boolean(current.apiKey) && current.apiKey === apiKey;

  const validation = await validateKey({
    provider,
    apiKey,
    baseUrl,
    model: body.model?.trim() || current.model,
    source: "env.local",
  });

  if (!validation.ok) {
    // Only the health of the *stored* key belongs on disk. A rejected paste of
    // some other key must not turn the status card red for a key that still
    // works — the caller still receives the message in this response.
    if (isStoredKey) await recordValidation(false, validation.message);
    return NextResponse.json(
      {
        ok: false,
        validation,
        hint: foreignProvider
          ? `Đã bỏ qua base URL "${requested}" vì đó là host của ${foreignProvider.label}. Đang dùng ${baseUrl}.`
          : undefined,
        ai: await publicAiStatus(),
      },
      { status: 400 },
    );
  }

  if (body.dryRun) {
    if (isStoredKey) {
      await recordValidation(true, validation.message, { model: validation.model });
    }
    return NextResponse.json({
      ok: true,
      saved: false,
      validation,
      ai: await publicAiStatus(),
    });
  }

  // A rejected base URL is the caller's mistake, not a server fault: say 400
  // with the reason, before any key is written to disk.
  let saved;
  try {
    saved = await saveApiKey(apiKey, {
      provider,
      model: validation.model ?? body.model,
      baseUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Không lưu được cấu hình.",
      },
      { status: 400 },
    );
  }
  void saved;
  await recordValidation(true, validation.message, {
    provider,
    model: validation.model,
  });

  return NextResponse.json({
    ok: true,
    saved: true,
    validation,
    ai: await publicAiStatus(),
  });
}

export async function DELETE(request: NextRequest) {
  if (!isLocalRequest(request.headers.get("host"))) {
    return NextResponse.json({ error: LOCAL_ONLY_MESSAGE }, { status: 403 });
  }
  let provider: ProviderId = "gemini";
  try {
    const body = (await request.json().catch(() => ({}))) as { provider?: string };
    if (PROVIDER_IDS.includes(body.provider as ProviderId)) {
      provider = body.provider as ProviderId;
    }
  } catch {
    /* no body: fall back to the active provider */
  }
  await forgetApiKey(provider);
  return NextResponse.json({ ok: true, ai: await publicAiStatus() });
}
