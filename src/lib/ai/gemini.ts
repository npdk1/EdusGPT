import type { GeminiCredentials } from "./config";

/**
 * Minimal, dependency-free client for the Google Generative Language API.
 * Everything runs server-side: the browser never sees the API key.
 */

export interface GeminiModelInfo {
  id: string;
  displayName: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  methods: string[];
}

interface RawModel {
  name?: string;
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
}

export class GeminiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = "GeminiError";
    this.statusCode = statusCode;
  }
}

function endpoint(creds: GeminiCredentials, suffix: string): string {
  const base = creds.baseUrl.replace(/\/+$/, "");
  return `${base}/${suffix.replace(/^\/+/, "")}`;
}

function requireKey(creds: GeminiCredentials): string {
  if (!creds.apiKey) {
    throw new GeminiError("Chưa có Gemini API key. Mở /setup để dán key của bạn.", 428);
  }
  return creds.apiKey;
}

async function readError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const payload = JSON.parse(text) as {
      error?: { message?: string; status?: string };
    };
    if (payload.error?.message) return payload.error.message;
  } catch {
    /* not JSON — fall through to the raw body */
  }
  return text.slice(0, 400) || `HTTP ${response.status}`;
}

export async function listModels(
  creds: GeminiCredentials,
): Promise<GeminiModelInfo[]> {
  const key = requireKey(creds);
  const response = await fetch(endpoint(creds, "models?pageSize=100"), {
    headers: { "x-goog-api-key": key },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new GeminiError(await readError(response), response.status);
  }
  const payload = (await response.json()) as { models?: RawModel[] };
  return (payload.models ?? [])
    .map((model) => ({
      id: (model.name ?? "").replace(/^models\//, ""),
      displayName: model.displayName ?? model.name ?? "unknown",
      description: model.description,
      inputTokenLimit: model.inputTokenLimit,
      outputTokenLimit: model.outputTokenLimit,
      methods: model.supportedGenerationMethods ?? [],
    }))
    .filter(
      (model) =>
        model.id &&
        (model.methods.length === 0 || model.methods.includes("generateContent")),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Models that are "generateContent"-capable but useless for a text lesson:
 * image/TTS/music/realtime/embedding/specialised preview variants.
 */
const MODEL_NOISE =
  /(image|tts|audio|video|transcribe|music|lyria|imagen|veo|embedding|computer-use|robotics|nano-banana|antigravity|deep-research|gemma|customtools|omni|search)/i;

/** A model this app can actually generate a lesson with. */
export function isTextModel(id: string): boolean {
  return id.startsWith("gemini-") && !isNoiseModel(id);
}

/**
 * Ids that exist but cannot turn a topic into structured lesson JSON:
 * image, TTS, music, transcription, embeddings, research and specialist models.
 *
 * Shared across both providers. Gemini namespaces its variants as `gemini-*`
 * while OpenRouter nests vendor paths (`google/gemini-2.5-flash-image`), so the
 * *name* check is the part that has to be common — offering these in the
 * dropdown means the user picks one, generation runs, and the JSON schema
 * validation fails with a message that never mentions the real cause.
 */
export function isNoiseModel(id: string): boolean {
  return MODEL_NOISE.test(id);
}

/**
 * Rank the live model list so we never depend on a hardcoded, rot-prone id.
 * The `-latest` aliases score highest because Google keeps them pointing at
 * whatever is currently available to the calling project.
 */
export function recommendModels(models: GeminiModelInfo[], limit = 3): string[] {
  const score = (id: string): number => {
    if (!isTextModel(id)) return Number.NEGATIVE_INFINITY;
    let value = 0;
    if (id.includes("flash")) value += 40;
    if (id.includes("pro")) value += 20;
    if (/-latest$/.test(id)) value += 50;
    const version = /^gemini-(\d+)\.(\d+)/.exec(id);
    if (version) value += Number(version[1]) * 10 + Number(version[2]);
    if (/preview|-\d{2}-\d{4}$|experimental/i.test(id)) value -= 25;
    return value;
  };

  return models
    .filter((model) => model.methods.includes("generateContent"))
    .map((model) => ({ id: model.id, score: score(model.id) }))
    .filter((model) => model.score > Number.NEGATIVE_INFINITY)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((model) => model.id);
}

/** Google's wording for "this model id is not usable by your project". */
export function isModelUnavailable(message: string): boolean {
  return /no longer available|not available to new users|not found|is not found|not supported|is not available|deprecated|unrecognized model|invalid model|UNSUPPORTED/i.test(
    message,
  );
}

/** Overload / rate-limit statuses that are worth waiting out. */
const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Detects the "model got stuck" failure mode: a short phrase repeated dozens of
 * times until the token budget dies. Structured generation on small models
 * does this, and the JSON still *parses* — so a repetition guard is the only
 * thing standing between the teacher and a 10.000-character quiz question.
 */
export function findDegenerateText(
  value: unknown,
  path = "",
  maxLength = 1600,
): string | null {
  if (typeof value === "string") {
    if (value.length > maxLength) {
      return `${path || "value"} quá dài (${value.length} ký tự)`;
    }
    if (looksRepetitive(value)) {
      return `${path || "value"} bị lặp lại vô tận (${value.length} ký tự)`;
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findDegenerateText(value[index], `${path}[${index}]`, maxLength);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const found = findDegenerateText(child, path ? `${path}.${key}` : key, maxLength);
      if (found) return found;
    }
  }
  return null;
}

function looksRepetitive(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length < 120) return false;

  // Any 24-char window appearing 4+ times means the model is looping.
  const window = 24;
  const counts = new Map<string, number>();
  for (let index = 0; index + window <= normalized.length; index += 8) {
    const chunk = normalized.slice(index, index + window);
    const count = (counts.get(chunk) ?? 0) + 1;
    if (count >= 4) return true;
    counts.set(chunk, count);
  }
  return false;
}

/**
 * A 429 meaning "quota exhausted for this key" is not something a two-second
 * backoff fixes — the free tier resets over hours. We still try one different
 * model, then fail with the real reason instead of burning six attempts.
 */
export function isQuotaExhausted(message: string): boolean {
  return /quota|exceeded your current quota|resource_exhausted|insufficient_quota|billing/i.test(
    message,
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));



/**
 * Salvages a JSON object out of a model response that is *almost* valid.
 *
 * Strict-JSON mode still fails in three common ways: a ```json fence, prose
 * around the payload, or the output being cut off mid-object by the token cap.
 * Truncation is handled by closing the open strings/arrays/braces; if that
 * cannot produce valid JSON we return null and the caller reports the real
 * finishReason instead of guessing.
 */
export function repairJson<T>(raw: string): T | null {
  const text = raw.trim();

  const direct = tryParse<T>(text);
  if (direct !== null) return direct;

  // 1) strip code fences
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced?.[1]) {
    const parsed = tryParse<T>(fenced[1].trim());
    if (parsed !== null) return parsed;
  }

  // 2) take the outermost {...} and repair truncation
  const start = text.indexOf("{");
  if (start < 0) return null;
  const slice = text.slice(start);

  const closed = closeOpenStructures(slice);
  for (const candidate of [closed, dropTrailingComma(closed)]) {
    if (!candidate) continue;
    const parsed = tryParse<T>(candidate);
    if (parsed !== null) return parsed;
  }
  return null;
}

function tryParse<T>(text: string): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function dropTrailingComma(text: string): string {
  return text.replace(/,\s*([}\]])/g, "$1");
}

/** Walks the string tracking quote/escape state, then closes what is open. */
function closeOpenStructures(text: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const char of text) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      if (inString) escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{" || char === "[") stack.push(char);
    else if (char === "}" || char === "]") stack.pop();
  }

  if (stack.length === 0 && !inString) return text;

  let out = text;
  if (inString) out += '"';
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    out += stack[index] === "{" ? "}" : "]";
  }
  return out;
}

/** One cheap round-trip that asks a specific model for a single token.
 *
 * Transient 5xx/429 answers are retried immediately — overload on the busy
 * `-latest` aliases is common and usually gone within a second.
 */
async function pingModel(
  creds: GeminiCredentials,
  model: string,
): Promise<{ ok: boolean; message: string }> {
  let message = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(
        endpoint(creds, `models/${encodeURIComponent(model)}:generateContent`),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": requireKey(creds),
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "ping" }] }],
            generationConfig: {
              maxOutputTokens: 8,
              temperature: 0,
              // Reply instantly: validation must not wait on a thinking budget.
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (response.ok) return { ok: true, message: "" };
      message = await readError(response);
      if (TRANSIENT_STATUS.has(response.status) && attempt < 2) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      return { ok: false, message };
    } catch (error) {
      message = error instanceof Error ? error.message : "Không gọi được Google API";
      if (attempt < 2) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      return { ok: false, message };
    }
  }
  return { ok: false, message };
}

/**
 * Proves a key works. If the *configured* model is rejected (model ids age
 * out — e.g. `gemini-2.5-flash` became unavailable to new projects), we walk
 * the recommended fallbacks and, on success, report the model that answered so
 * the caller can persist it instead of failing the whole save.
 */
export async function validateKey(creds: GeminiCredentials): Promise<{
  ok: boolean;
  message: string;
  model?: string;
  models?: number;
  latencyMs?: number;
}> {
  const startedAt = Date.now();

  let models: GeminiModelInfo[];
  try {
    models = await listModels(creds);
  } catch (error) {
    const message =
      error instanceof GeminiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Không gọi được Google API";
    return { ok: false, message };
  }

  if (models.length === 0) {
    return { ok: false, message: "Key hợp lệ nhưng không có model generateContent nào." };
  }

  const candidates: string[] = [];
  const push = (model?: string) => {
    if (model && !candidates.includes(model)) candidates.push(model);
  };
  push(creds.model);
  for (const model of recommendModels(models, 4)) push(model);

  let lastMessage = "";
  for (const candidate of candidates.slice(0, 4)) {
    const attempt = await pingModel(creds, candidate);
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
          (switched
            ? ` Model "${creds.model}" không dùng được nên đã tự chuyển sang "${candidate}".`
            : ""),
      };
    }
    lastMessage = attempt.message;
    // Anything that is not a model problem (quota, permission, billing) will
    // affect every candidate too — stop burning attempts.
    if (!isModelUnavailable(lastMessage)) break;
  }

  return { ok: false, message: lastMessage, models: models.length };
}


export interface GenerateJsonOptions {
  system?: string;
  prompt: string;
  schema?: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
  model?: string;
  timeoutMs?: number;
  /** Wall-clock budget for all attempts together. */
  totalTimeoutMs?: number;
  /**
   * Domain-level check applied to the parsed payload. Returning a string marks
   * the attempt as failed (and hops to the next model); returning null accepts
   * it. Used to reject structurally-valid-but-useless generations, e.g. a quiz
   * scene that came back with zero answer options.
   */
  validate?: (data: unknown) => string | null;
}

/** Calls `generateContent` in strict-JSON mode and parses the result.
 *
 * Model ids age out without notice (`gemini-2.5-flash` → unavailable to new
 * projects), so a model-level rejection transparently retries the next
 * recommended model instead of surfacing an error to the teacher.
 */
export async function generateJson<T>(
  creds: GeminiCredentials,
  options: GenerateJsonOptions,
): Promise<{ data: T; model: string; text: string; usage?: unknown }> {
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: options.prompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens ?? 8192,
      responseMimeType: "application/json",
      // Long lesson scripts (with quiz options and narration) overflow the
      // default thinking budget on some models and come back truncated.
      ...(options.schema ? { responseSchema: options.schema } : {}),
    },
  };
  if (options.system) {
    body.systemInstruction = { role: "system", parts: [{ text: options.system }] };
  }

  // Candidate order: requested model → live recommendations. `queueIndex`
  // advances when a model ages out *or* when it stays overloaded.
  const queue: string[] = [];
  const push = (model?: string) => {
    if (model && !queue.includes(model)) queue.push(model);
  };
  push(options.model?.trim() || creds.model);
  // Fill the rest of the queue up front. Model discovery used to run only when
  // a model was declared dead, so overload (503) on the preferred model had
  // nowhere to go and simply surfaced as an error.
  try {
    for (const candidate of recommendModels(await listModels(creds), 4)) {
      push(candidate);
    }
  } catch {
    /* list endpoint unreachable: keep the single candidate we already have */
  }

  // Small models are excellent for short JSON but they loop on a big lesson
  // schema. When the caller did not pin a model, try the strongest flash first
  // and keep the lite tier as the last resort — the reverse order wastes a
  // 30-second degenerate generation before falling back.
  if (!options.model) {
    const lite = queue.filter((id) => /lite/i.test(id));
    const rest = queue.filter((id) => !/lite/i.test(id));
    queue.length = 0;
    push(...rest, ...lite);
  }

  let queueIndex = 0;
  let transientStreak = 0;
  let lastError: GeminiError | null = null;

  // Total wall-clock budget for the whole retry ladder. Without it, six
  // candidates × a 120s timeout can hang a request for twelve minutes, and
  // the browser gives up first without ever seeing an explanation.
  const deadline = Date.now() + (options.totalTimeoutMs ?? 150_000);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (queueIndex >= queue.length) break;
    if (Date.now() > deadline) {
      throw (
        lastError ??
        new GeminiError(
          "Hết thời gian chờ Gemini. Bấm lại, hoặc đổi sang model nhẹ hơn trong /setup.",
          504,
        )
      );
    }
    const model = queue[queueIndex];

    let response: Response;
    try {
      response = await fetch(
        endpoint(creds, `models/${encodeURIComponent(model)}:generateContent`),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": requireKey(creds),
          },
          body: JSON.stringify(body),
          cache: "no-store",
          // Never let a single attempt outlive the overall budget.
          signal: AbortSignal.timeout(
            Math.min(
              options.timeoutMs ?? 90_000,
              Math.max(10_000, deadline - Date.now()),
            ),
          ),
        },
      );
    } catch (error) {
      // An abort here is our own budget, not a network glitch: report it as a
      // timeout so the teacher gets an actionable message instead of a stack.
      if (Date.now() >= deadline) {
        throw new GeminiError(
          "Hết thời gian chờ Gemini (máy chủ đang quá tải). Bấm “Sinh bài giảng” lại sau ít phút, hoặc đổi sang model nhẹ hơn trong /setup.",
          504,
        );
      }
      lastError = new GeminiError(
        error instanceof Error ? error.message : "Không gọi được Google API",
        502,
      );
      if (attempt + 1 >= 6) throw lastError;
      transientStreak += 1;
      await sleep(Math.min(500 * 2 ** (transientStreak - 1), 4000));
      continue;
    }

    if (response.ok) {
      const payload = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          finishReason?: string;
        }>;
        usageMetadata?: unknown;
      };
      const text = (payload.candidates?.[0]?.content?.parts ?? [])
        .map((part) => part.text ?? "")
        .join("")
        .trim();

      if (!text) {
        throw new GeminiError(
          `Model "${model}" không trả về nội dung (finishReason: ${
            payload.candidates?.[0]?.finishReason ?? "unknown"
          }).`,
        );
      }
      const parsed = repairJson<T>(text);
      if (parsed !== null) {
        // The JSON can be perfectly valid and still be garbage: a small model
        // that loops repeats one sentence until the budget dies. Catch that
        // here and move to the next model instead of storing the junk.
        const degenerate = findDegenerateText(parsed);
        if (degenerate) {
          lastError = new GeminiError(
            `Model "${model}" lặp lại vô hạn (${degenerate}). Đang chuyển sang model khác…`,
          );
          if (queueIndex + 1 < queue.length) {
            queueIndex += 1;
            transientStreak = 0;
            continue;
          }
          // Every candidate degenerated. A 1M-token context is the difference
          // between "loops forever" and "writes the whole lesson", so make one
          // last attempt at that before giving up.
          if (attempt + 1 < 6) {
            body.generationConfig = {
              ...(body.generationConfig as Record<string, unknown>),
              maxOutputTokens: 32768,
            };
            queueIndex = 0;
            transientStreak = 0;
            continue;
          }
          throw lastError;
        }
        const rejection = options.validate?.(parsed) ?? null;
        if (rejection) {
          lastError = new GeminiError(`Model "${model}": ${rejection}`);
          if (queueIndex + 1 < queue.length) {
            queueIndex += 1;
            transientStreak = 0;
            continue;
          }
          throw lastError;
        }

        return { data: parsed, model, text, usage: payload.usageMetadata };
      }

      // Unparseable payload. If the model simply ran out of output tokens the
      // lesson schema is too big for this cap — raise the budget and try once
      // more rather than telling the teacher to "thử lại" for ever.
      const finishReason = payload.candidates?.[0]?.finishReason ?? "unknown";
      if (finishReason === "MAX_TOKENS" && attempt + 1 < 6) {
        body.generationConfig = {
          ...(body.generationConfig as Record<string, unknown>),
          maxOutputTokens: Math.min(
            32768,
            Math.round(Number((body.generationConfig as Record<string, unknown>)?.maxOutputTokens ?? 8192) * 2),
          ),
        };
        continue;
      }

      lastError = new GeminiError(
        `Model "${model}" trả về JSON không hợp lệ (finishReason: ${finishReason}). Thử lại hoặc đổi model.`,
      );
      if (isModelUnavailable(lastError.message) && queueIndex + 1 < queue.length) {
        queueIndex += 1;
        continue;
      }
      throw lastError;
    }

    const message = await readError(response);
    lastError = new GeminiError(message, response.status);

    // 1) model id age-out → move to the next candidate (discovering more once)
    if (isModelUnavailable(message)) {
      if (queueIndex === queue.length - 1) {
        try {
          for (const candidate of recommendModels(await listModels(creds), 2)) {
            push(candidate);
          }
        } catch {
          /* nothing else to fall back to */
        }
      }
      if (queueIndex + 1 < queue.length) {
        queueIndex += 1;
        transientStreak = 0;
        continue;
      }
      throw lastError;
    }

    // 2) overload / rate limit → wait it out, then switch model if it persists
    if (TRANSIENT_STATUS.has(response.status) && attempt + 1 < 6) {
      // Quota exhaustion is a billing/limits state, not a spike: retrying the
      // same model is pointless, so hop to the next candidate immediately.
      if (isQuotaExhausted(message)) {
        if (queueIndex + 1 < queue.length) {
          queueIndex += 1;
          transientStreak = 0;
          continue;
        }
        throw new GeminiError(
          `${message}. Đã thử hết các model dự trữ trong danh sách. Đợi hết hạn mức hoặc dùng key có billing.`,
          response.status,
        );
      }
      transientStreak += 1;
      if (transientStreak > 2 && queueIndex + 1 < queue.length) {
        queueIndex += 1;
        transientStreak = 0;
        continue;
      }
      await sleep(Math.min(500 * 2 ** (transientStreak - 1), 4000));
      continue;
    }

    throw lastError;
  }

  if (lastError && TRANSIENT_STATUS.has(lastError.statusCode)) {
    throw new GeminiError(
      `${lastError.message}. Đã thử lại và đổi model nhiều lần. Máy chủ Gemini đang quá tải, bấm “Sinh bài giảng” lại sau ít phút (hoặc đổi model tại /setup).`,
      lastError.statusCode,
    );
  }
  throw lastError ?? new GeminiError("Không gọi được Gemini API", 502);
}
