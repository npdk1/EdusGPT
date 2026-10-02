import type { ProviderCredentials } from "./config";
import { PROVIDERS } from "./config";
import {
  GeminiError,
  findDegenerateText,
  isModelUnavailable,
  isQuotaExhausted,
  repairJson,
} from "./gemini";

/**
 * Adapter for every vendor that speaks the OpenAI chat-completions dialect.
 *
 * One implementation covers OpenRouter, Groq, NVIDIA and Mistral because the
 * wire format is identical:
 *   - auth      : `Authorization: Bearer <key>` (NOT x-goog-api-key)
 *   - models    : GET /models, ids like "openai/gpt-oss-120b"
 *   - chat      : POST /chat/completions
 *   - structured output uses `json_object` plus the schema written into the
 *     prompt; `json_schema` strict mode is rejected by several of these
 *     models, and our schema carries Gemini-only keys (`propertyOrdering`).
 *
 * Only the base URL and the vendor label differ, and both come from the
 * provider map — so a new OpenAI-compatible vendor is a config entry, not a
 * new adapter.
 *
 * Why these three on top of OpenRouter: each is OpenAI-compatible, each still
 * has a no-card free tier, and each fails differently (per-model daily token
 * caps on Groq, per-hour Neurons on Cloudflare, project credits on Mistral), so
 * having more than one means one vendor's quota never blocks the whole app.
 * Mind the caps: a 95-slide lesson is ~96 calls and well past Groq's 200k
 * tokens/day, so free cloud is realistically for short lessons and chat.
 */

export interface ChatModelInfo {
  id: string;
  displayName: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  methods: string[];
}

interface RawChatModel {
  id?: string;
  name?: string;
  description?: string;
  context_length?: number;
  top_provider?: { max_completion_tokens?: number };
  architecture?: { input_modalities?: string[] };
}

/** Vendor name for user-facing messages; never a hardcoded brand name. */
function vendorLabel(creds: ProviderCredentials): string {
  return PROVIDERS[creds.provider]?.label ?? "nhà cung cấp";
}

function endpoint(creds: ProviderCredentials, suffix: string): string {
  const base = creds.baseUrl.replace(/\/+$/, "");
  return `${base}/${suffix.replace(/^\/+/, "")}`;
}

function requireKey(creds: ProviderCredentials): string {
  if (!creds.apiKey) {
    throw new GeminiError(
      `Chưa có API key cho ${vendorLabel(creds)}. Mở /setup, chọn ${vendorLabel(creds)} rồi dán key.`,
      428,
    );
  }
  return creds.apiKey;
}

async function readError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const payload = JSON.parse(text) as {
      error?: { message?: string };
      message?: string;
    };
    if (payload.error?.message) return payload.error.message;
    if (payload.message) return payload.message;
  } catch {
    /* not JSON — fall through */
  }
  return text.slice(0, 400) || `HTTP ${response.status}`;
}

export async function listChatModels(
  creds: ProviderCredentials,
): Promise<ChatModelInfo[]> {
  const key = requireKey(creds);
  const response = await fetch(endpoint(creds, "models"), {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new GeminiError(await readError(response), response.status);
  }
  const payload = (await response.json()) as { data?: RawChatModel[] };

  return (payload.data ?? [])
    .map((model) => {
      const id = model.id ?? "";
      /*
       * Only text-in models can write a lesson script.
       *
       * This used to require text to be the *only* modality
       * (`inputs.every((item) => item === "text")`), which silently discarded
       * every multimodal model — and on these catalogues that is most of the
       * interesting selection, because the good chat models accept images too.
       * Accepting text *among* the inputs is the rule that was actually meant.
       */
      const inputs = model.architecture?.input_modalities ?? ["text"];
      return {
        id,
        displayName: model.name ?? id,
        description: model.description,
        inputTokenLimit: model.context_length,
        outputTokenLimit: model.top_provider?.max_completion_tokens,
        methods: inputs.includes("text") ? ["chat"] : [],
      };
    })
    .filter((model) => model.id && model.methods.length > 0)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Ids that exist on an OpenAI-compatible vendor but cannot write structured
 * lessons: embedding, speech, moderation, safety-classifier and vision-only
 * endpoints all answer `/chat/completions` with 200 and then produce nothing
 * usable.
 */
const MODEL_NOISE =
  /(embedding|embed|whisper|tts|audio|speech|ocr|voxtral|bark|moderation|rerank|guard|clip|stable-diffusion|bge)/i;

/** Ranks the live list: free and general-purpose chat models first. */
export function rankChatModels(models: ChatModelInfo[], limit = 3): string[] {
  const score = (id: string): number => {
    if (MODEL_NOISE.test(id)) return Number.NEGATIVE_INFINITY;
    let value = 0;
    if (id.endsWith(":free")) value += 40; // free tier first
    if (/flash/i.test(id)) value += 30;
    if (/gemini/i.test(id)) value += 20;
    if (/lite|mini|nano|haiku|small/i.test(id)) value += 10;
    if (/sonnet|claude|gpt-4o-mini|gpt-oss/i.test(id)) value += 5;
    if (/preview|experimental|\bexp\b/i.test(id)) value -= 20;
    return value;
  };

  return models
    .map((model) => ({ id: model.id, score: score(model.id) }))
    .filter((model) => model.score > Number.NEGATIVE_INFINITY)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((model) => model.id);
}

function schemaAsPrompt(schema?: Record<string, unknown>): string {
  if (!schema) return "";
  return `\nTrả về DUY NHẤT một JSON hợp lệ theo schema sau, không thêm chú thích hay markdown:\n${JSON.stringify(schema)}`;
}

function buildBody(
  model: string,
  options: ChatGenerateOptions,
): Record<string, unknown> {
  return {
    model,
    messages: [
      ...(options.system ? [{ role: "system", content: options.system }] : []),
      { role: "user", content: options.prompt + schemaAsPrompt(options.schema) },
    ],
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxOutputTokens ?? 4096,
    response_format: { type: "json_object" },
  };
}

function chat(
  creds: ProviderCredentials,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<Response> {
  return fetch(endpoint(creds, "chat/completions"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${requireKey(creds)}`,
      // OpenRouter reads these for attribution on its dashboard. The other
      // vendors ignore unknown headers, so they ride along harmlessly.
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "EdusGPT",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export interface ChatGenerateOptions {
  system?: string;
  prompt: string;
  schema?: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
  model?: string;
  timeoutMs?: number;
  totalTimeoutMs?: number;
  validate?: (data: unknown) => string | null;
}

/** One cheap round-trip proving the key works on this model. */
async function ping(
  creds: ProviderCredentials,
  model: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await chat(
      creds,
      {
        model,
        messages: [{ role: "user", content: "Reply with exactly: pong" }],
        max_tokens: 16,
        temperature: 0,
      },
      30_000,
    );
    if (response.ok) return { ok: true, message: "" };
    return { ok: false, message: await readError(response) };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : `Không gọi được ${vendorLabel(creds)}.`,
    };
  }
}

export async function validateChatKey(creds: ProviderCredentials): Promise<{
  ok: boolean;
  message: string;
  model?: string;
  models?: number;
  latencyMs?: number;
}> {
  const startedAt = Date.now();

  let models: ChatModelInfo[];
  try {
    models = await listChatModels(creds);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof GeminiError || error instanceof Error
          ? error.message
          : `Không gọi được ${vendorLabel(creds)}.`,
    };
  }

  if (models.length === 0) {
    return { ok: false, message: "Key hợp lệ nhưng không thấy model chat nào." };
  }

  const candidates: string[] = [];
  const push = (id?: string) => {
    if (id && !candidates.includes(id)) candidates.push(id);
  };
  push(creds.model);
  for (const id of rankChatModels(models, 4)) push(id);

  let lastMessage = "";
  for (const candidate of candidates.slice(0, 4)) {
    const attempt = await ping(creds, candidate);
    if (attempt.ok) {
      const switched = candidate !== creds.model;
      const latencyMs = Date.now() - startedAt;
      return {
        ok: true,
        model: candidate,
        models: models.length,
        latencyMs,
        message:
          `Key hoạt động. Model "${candidate}" trả lời trong ${latencyMs}ms.` +
          (switched ? ` Đã tự chuyển từ "${creds.model}" sang model này.` : ""),
      };
    }
    lastMessage = attempt.message;
    if (!isModelUnavailable(lastMessage) && !isQuotaExhausted(lastMessage)) break;
  }

  return { ok: false, message: lastMessage, models: models.length };
}

export async function generateChatJson<T>(
  creds: ProviderCredentials,
  options: ChatGenerateOptions,
): Promise<{ data: T; model: string; text: string; usage?: unknown }> {
  const queue: string[] = [];
  const push = (id?: string) => {
    if (id && !queue.includes(id)) queue.push(id);
  };
  push(options.model?.trim() || creds.model);
  try {
    for (const id of rankChatModels(await listChatModels(creds), 3)) {
      push(id);
    }
  } catch {
    /* keep the single candidate */
  }

  const deadline = Date.now() + (options.totalTimeoutMs ?? 150_000);
  let queueIndex = 0;
  let transientStreak = 0;
  let lastError: GeminiError | null = null;

  const backoff = (streak: number) =>
    new Promise((resolve) =>
      setTimeout(resolve, Math.min(500 * 2 ** (streak - 1), 4000)),
    );

  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (queueIndex >= queue.length || Date.now() > deadline) break;
    const model = queue[queueIndex];

    let response: Response;
    try {
      response = await chat(
        creds,
        buildBody(model, options),
        Math.min(
          options.timeoutMs ?? 90_000,
          Math.max(10_000, deadline - Date.now()),
        ),
      );
    } catch (error) {
      lastError = new GeminiError(
        error instanceof Error ? error.message : `Không gọi được ${vendorLabel(creds)}.`,
        502,
      );
      transientStreak += 1;
      await backoff(transientStreak);
      continue;
    }

    if (response.ok) {
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: unknown;
      };
      const text = (payload.choices?.[0]?.message?.content ?? "").trim();
      if (!text) {
        throw new GeminiError(`Model "${model}" trả về nội dung rỗng.`);
      }

      const parsed = repairJson<T>(text);
      if (parsed === null) {
        lastError = new GeminiError(
          `Model "${model}" trả về JSON không hợp lệ. Thử lại hoặc đổi model.`,
        );
        if (queueIndex + 1 < queue.length) {
          queueIndex += 1;
          continue;
        }
        throw lastError;
      }

      // A small model can loop forever and still emit parseable JSON.
      const degenerate = findDegenerateText(parsed);
      if (degenerate) {
        lastError = new GeminiError(
          `Model "${model}" lặp lại vô hạn (${degenerate}). Đang đổi model…`,
        );
        if (queueIndex + 1 < queue.length) {
          queueIndex += 1;
          continue;
        }
        throw lastError;
      }

      const rejection = options.validate?.(parsed) ?? null;
      if (rejection) {
        lastError = new GeminiError(`Model "${model}": ${rejection}`);
        if (queueIndex + 1 < queue.length) {
          queueIndex += 1;
          continue;
        }
        throw lastError;
      }

      return { data: parsed, model, text, usage: payload.usage };
    }

    const message = await readError(response);
    lastError = new GeminiError(message, response.status);

    // A dead or rate-limited model cannot be fixed by retrying the same id.
    if (isModelUnavailable(message) || isQuotaExhausted(message)) {
      if (queueIndex + 1 < queue.length) {
        queueIndex += 1;
        continue;
      }
      throw new GeminiError(
        `${message}. Đã thử hết model dự trữ. Thử lại sau hoặc đổi model trong /setup.`,
        response.status,
      );
    }

    if (response.status === 429 || response.status >= 500) {
      transientStreak += 1;
      if (transientStreak > 2 && queueIndex + 1 < queue.length) {
        queueIndex += 1;
        transientStreak = 0;
        continue;
      }
      await backoff(transientStreak);
      continue;
    }

    throw lastError;
  }

  throw (
    lastError ??
    new GeminiError(
      `Hết thời gian chờ ${vendorLabel(creds)}. Bấm lại sau ít phút.`,
      504,
    )
  );
}