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
 * One implementation covers OpenRouter, Groq and NVIDIA because the wire
 * format is identical:
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
 * Why these two on top of OpenRouter: each is OpenAI-compatible, each still
 * has a no-card free tier, and each fails differently (per-model daily token
 * caps on Groq, request-per-minute caps on NVIDIA), so having more than one
 * means one vendor's quota never blocks the whole app.
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

/**
 * Budget for the catalog call (GET /models), not for generation.
 *
 * Generous on purpose: this endpoint is only hit when validating a key or
 * filling the model dropdown, never per lesson, and some vendors serve a cold
 * catalog slowly — NVIDIA's integrate API routinely needs well over 20s from
 * outside the US. A tight budget here reported a perfectly good key as broken,
 * which is the worst possible answer for a key the user just pasted.
 */
const CATALOG_TIMEOUT_MS = 60_000;

/**
 * Budget for the one-token "does this key work" round-trip.
 *
 * Same reasoning as the catalog: this only runs while validating a key, never
 * while generating a lesson, and a 70B model on NVIDIA's shared free tier can
 * queue for well over 30s from outside the US. Cutting this off early reported
 * a working key as broken — the one answer a teacher cannot act on.
 */
const PING_TIMEOUT_MS = 60_000;

export async function listChatModels(
  creds: ProviderCredentials,
): Promise<ChatModelInfo[]> {
  const key = requireKey(creds);
  const response = await fetch(endpoint(creds, "models"), {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
    signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS),
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

/**
 * Parameter count in the id, e.g. `openai/gpt-oss-120b` → 120.
 *
 * Only the first size token counts, which is why `nemotron-3-super-120b-a12b`
 * reads as 120 and not 12.
 */
function parameterBillions(id: string): number | null {
  const match = /(?:^|[^0-9a-z])(\d+)b(?![0-9a-z])/i.exec(id);
  return match ? Number(match[1]) : null;
}

/** Ranks the live list: free and general-purpose chat models first. */
export function rankChatModels(models: ChatModelInfo[], limit = 3): string[] {
  const score = (id: string): number => {
    if (MODEL_NOISE.test(id)) return Number.NEGATIVE_INFINITY;
    /*
     * A reserve model exists to cover a rate limit, not to cover a lack of
     * intelligence. Groq answered `allam-2-7b` — the only thing left in its free
     * queue once the 120B ids were throttled — with "Please reduce the length of
     * the messages or completion": the scene prompt does not fit. Below ~20B a
     * model cannot hold a lesson, so it never enters the queue.
     */
    const size = parameterBillions(id);
    if (size !== null && size < 20) return Number.NEGATIVE_INFINITY;
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

/**
 * Appends a line to `AI_DEBUG_LOG` when that env var names a file.
 *
 * A vendor can reject a request for a reason the app never sees again — a 400
 * about a parameter, a model id that vanished, a reasoning model that returned
 * an empty answer. Without the raw line the only symptom is "scene failed",
 * which is exactly the guesswork this project keeps trying to avoid.
 */
const DEBUG_LOG_FILE = process.env.AI_DEBUG_LOG?.trim();

async function debugLog(message: string): Promise<void> {
  if (!DEBUG_LOG_FILE) return;
  try {
    const [{ appendFile }, path] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
    ]);
    await appendFile(
      path.join(process.cwd(), DEBUG_LOG_FILE),
      `${new Date().toISOString()} ${message}\n`,
      "utf8",
    );
  } catch {
    /* Debug logging must never break a generation. */
  }
}

function schemaAsPrompt(schema?: Record<string, unknown>): string {
  if (!schema) return "";
  return `\nTrả về DUY NHẤT một JSON hợp lệ theo schema sau, không thêm chú thích hay markdown:\n${JSON.stringify(schema)}`;
}

/**
 * A per-minute cap is a queue, not a dead end.
 *
 * Groq's free tier counts tokens per minute per *organisation*, and one lesson
 * scene already asks for ~6.4k of its 8k. With the route writing six scenes in
 * parallel, every one of them was refused with "Rate limit reached … tokens per
 * minute", then the adapter rotated to a different model (which shares the same
 * cap) and woke up at the same instant as the others. Measured, not guessed: the
 * fix is to honour the vendor's own "try again in 16.7s", keep the same model,
 * and spread the following requests out.
 *
 * The gate is module-level on purpose — the throttling is per account, so the
 * calls that have to queue are the ones in other requests, not other loops.
 */
const THROTTLE_SPACING_START_MS = 4_000;
const THROTTLE_SPACING_MIN_MS = 750;
/** Give up rather than spin for the rest of the request budget. */
const THROTTLE_ATTEMPTS = 5;

const throttle = {
  cooldownUntil: 0,
  spacingMs: THROTTLE_SPACING_START_MS,
  nextSlotAt: 0,
};

/** "… Please try again in 16.6875s." / `Retry-After: 20` → milliseconds. */
function retryAfterMs(message: string, headers?: Headers): number {
  const header = headers?.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1_000;
  }
  const match = /try again in\s+(\d+(?:\.\d+)?)\s*(ms|s)?/i.exec(message);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return (match[2]?.toLowerCase() === "ms" ? value : value * 1_000);
}

/**
 * A daily cap does not come back; a per-minute one does.
 *
 * Splitting the two matters because only the second is worth waiting out.
 */
function isThrottleOnly(message: string): boolean {
  if (!/rate limit|too many requests|\btpm\b|\brpm\b/i.test(message)) return false;
  return !/per day|per_day|daily|\bday\b/i.test(message);
}

/**
 * A shared free tier answering 503 is a queue at the vendor, not a broken
 * model.
 *
 * Measured on NVIDIA's free tier: during a busy stretch every model it serves
 * returned `503 Service temporarily overloaded` or `ResourceExhausted: Worker
 * local total request limit reached (49/32)` for 40 minutes straight, and the
 * same id answered a full lesson minutes either side of that window. Rotating
 * on a 503 therefore walks the whole fallback queue in about half a minute and
 * then reports every entry as broken when not one of them is — the failure
 * mode this branch exists to prevent.
 */
function isCapacityWait(message: string): boolean {
  return /temporarily overloaded|service unavailable|resource ?exhausted|worker local total request limit|all servers/i.test(
    message,
  );
}

/**
 * How long to sit out a 503 before trying the same call again.
 *
 * Grows because the first retry of a saturated pool is usually still
 * saturated: NVIDIA's overload window lasted tens of minutes, and a handful of
 * quick retries would spend the request budget there and never reach a healthy
 * moment.
 */
const CAPACITY_WAIT_START_MS = 30_000;
const CAPACITY_WAIT_MAX_MS = 180_000;
let capacityStreak = 0;

function noteThrottle(message: string, headers?: Headers, floorMs = 0): void {
  const wait = Math.max(retryAfterMs(message, headers), floorMs);
  throttle.cooldownUntil = Math.max(throttle.cooldownUntil, Date.now() + wait);
  throttle.spacingMs = THROTTLE_SPACING_START_MS;
  throttle.nextSlotAt = Math.max(throttle.nextSlotAt, throttle.cooldownUntil);
  void debugLog(`THROTTLE wait=${wait}ms spacing=${throttle.spacingMs}ms`);
}

/** Remembers that the pool is full, so the next wait starts further out. */
function noteCapacity(message: string, headers?: Headers): void {
  capacityStreak += 1;
  const floor = Math.min(CAPACITY_WAIT_START_MS * capacityStreak, CAPACITY_WAIT_MAX_MS);
  noteThrottle(message, headers, floor);
}

/** Called before every request: waits out the cooldown, then takes a slot. */
async function respectThrottle(): Promise<void> {
  const gateAt = Math.max(throttle.cooldownUntil, throttle.nextSlotAt);
  const wait = gateAt - Date.now();
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  throttle.nextSlotAt = Date.now() + throttle.spacingMs;
}

/** A call got through: halve the spacing and let the cooldown lapse. */
function noteSuccess(): void {
  if (throttle.cooldownUntil <= Date.now()) throttle.cooldownUntil = 0;
  // The pool answered, so the next overload starts from the short wait again.
  capacityStreak = 0;
  throttle.spacingMs = Math.max(
    THROTTLE_SPACING_MIN_MS,
    Math.round(throttle.spacingMs / 2),
  );
}

/**
 * Models that burn part of the token budget on a reasoning trace before they
 * answer. Matched on the id because vendors expose the same family under
 * different prefixes (`openai/gpt-oss-120b`, `nvidia/nemotron-3-…`).
 *
 * `nemotron` was missing at first, and the symptom was quiet: scenes came back
 * as 679 characters of valid-looking JSON that stopped mid-object, because the
 * hidden trace had taken most of the 2048 tokens before `content` began.
 */
const REASONING_MODEL =
  /gpt-oss|deepseek-(?:r1|reasoner|reasoning)|qwq|thinking|reason|nemotron/i;

/**
 * Room kept aside for the reasoning trace.
 *
 * Measured against Groq's `openai/gpt-oss-120b` with a real scene prompt: the
 * trace came to 2634 characters while the JSON answer needed 508, so a 2048
 * token budget was spent before `content` began — every scene came back empty
 * and the whole lesson failed. Adding headroom plus a low reasoning effort
 * (202 characters for the same prompt) is what makes these models usable here.
 */
const REASONING_HEADROOM_TOKENS = 2048;

/**
 * Pulls the first decodable object out of a reply that may open with prose.
 *
 * A size limit on the preamble is not enough. The 550B model restates the
 * assignment in its own words before answering — measured at 250 characters for
 * the outline stage and 7000 for a scene prompt ("The user wants me to create a
 * JSON for a specific slide (Scene 6/16) … Constraints: …"). Those tokens come
 * straight out of the answer budget, so the reply also arrives truncated, and a
 * truncated object is unparseable no matter where it starts.
 *
 * So rather than guessing a length, every `{` in the reply is tried as a
 * candidate start and the text after it is repaired and parsed. Real answers
 * are found on the first or second try; narration that merely mentions braces
 * fails fast and costs nothing.
 */
function extractJson<T>(text: string): T | null {
  const whole = repairJson<T>(text);
  if (whole !== null) return whole;

  for (let at = text.indexOf("{"); at !== -1 && at < text.length; at = text.indexOf("{", at + 1)) {
    const parsed = repairJson<T>(text.slice(at));
    if (parsed !== null) return parsed;
    if (text.length - at > 200_000) break;
  }
  return null;
}

/**
 * Wall-clock budget for one chat call that the caller did not cap.
 *
 * 90 s was sized for the fast models Groq serves, where a 3k-token answer
 * streams in seconds. It was too tight for the big hosted models: on the
 * outline stage, `nvidia/nemotron-3-ultra-550b-a55b` on the free shared tier
 * queued for over 90 s on a 6k-token prompt and was aborted three times in a
 * row, before it ever produced a token. The whole-call `deadline` still caps
 * the total, so a generous per-call budget only matters when there is time left.
 */
const CHAT_TIMEOUT_MS = 240_000;

/**
 * Closing line on every prompt.
 *
 * `response_format: json_object` is the machine-readable contract, but some
 * hosted models treat it as a formatting hint rather than an instruction: the
 * 550B Nemotron restates the task ("The user wants me to create a JSON for a
 * specific slide …") before emitting anything, and that restatement is paid for
 * out of `max_tokens`, so the answer arrives cut in half. Saying it in words
 * costs a few tokens and removes the whole failure mode.
 */
const JSON_ONLY_SUFFIX =
  "\n\nTrả lời bằng đúng một đối tượng JSON hợp lệ. Không viết lời dẫn, không tóm tắt yêu cầu, không bọc trong markdown. Ký tự đầu tiên của câu trả lời phải là `{`.";

function buildBody(
  model: string,
  options: ChatGenerateOptions,
): Record<string, unknown> {
  const contentBudget = options.maxOutputTokens ?? 4096;
  const reasons = REASONING_MODEL.test(model);
  return {
    model,
    messages: [
      ...(options.system ? [{ role: "system", content: options.system }] : []),
      { role: "user", content: options.prompt + schemaAsPrompt(options.schema) + JSON_ONLY_SUFFIX },
    ],
    temperature: options.temperature ?? 0.7,
    max_tokens: reasons ? contentBudget + REASONING_HEADROOM_TOKENS : contentBudget,
    response_format: { type: "json_object" },
    // Several vendors default these families to a high reasoning effort. Only
    // sent to models that are known to accept it, so no other vendor sees a
    // field it might reject.
    ...(reasons ? { reasoning_effort: "low" } : {}),
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
      PING_TIMEOUT_MS,
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
    let attempt = await ping(creds, candidate);
    // A per-minute refusal here is contention with another request, not a bad
    // key or a dead model: wait the vendor's own cooldown and ask again. Same
    // for an overloaded pool, which reports 503 rather than 429.
    if (!attempt.ok && (isThrottleOnly(attempt.message) || isCapacityWait(attempt.message))) {
      if (isCapacityWait(attempt.message)) noteCapacity(attempt.message);
      else noteThrottle(attempt.message);
      await respectThrottle();
      attempt = await ping(creds, candidate);
    }
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
    const catalog = await listChatModels(creds);
    /*
     * Reserves come from this vendor's own vetted list first, intersected with
     * the live catalogue.
     *
     * Ranking the raw catalogue alone put `deepseek-ai/deepseek-v4.1-flash`
     * second: "flash" scores well, the account cannot answer it, and every
     * attempt then burned a full timeout before rotating on. The ids in
     * `modelChoices` were each verified to answer this API, so they are the ones
     * worth falling back to; the rest of the catalogue is only used when the
     * vetted ones are gone.
     */
    const live = new Set(catalog.map((model) => model.id));
    const vetted = (PROVIDERS[creds.provider]?.modelChoices ?? []).filter((id) =>
      live.has(id),
    );
    for (const id of [...vetted, ...rankChatModels(catalog, 4)]) {
      if (queue.length >= 4) break;
      push(id);
    }
  } catch {
    /* keep the single candidate */
  }

  /**
   * Grown when the answer came back cut off.
   *
   * Measured on the outline stage: `nvidia/nemotron-3-ultra-550b-a55b` returned
   * 5002 characters of JSON that started with `{` and stopped mid-object,
   * because Vietnamese costs several tokens per character and the stage budget
   * ran out. That is a truncation, not a broken model, so the retry asks for more
   * room on the *same* model instead of rotating away from a good one.
   */
  let budgetScale = 1;

  const deadline = Date.now() + (options.totalTimeoutMs ?? 150_000);
  let queueIndex = 0;
  let transientStreak = 0;
  let throttleStreak = 0;
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
      await respectThrottle();
      response = await chat(
        creds,
        buildBody(
          model,
          budgetScale === 1
            ? options
            : {
                ...options,
                maxOutputTokens: Math.round(
                  (options.maxOutputTokens ?? 4096) * budgetScale,
                ),
              },
        ),
        // A bigger budget takes proportionally longer to stream: measured at
        // roughly 30 s per 3k output tokens on the 550B model, so the flat 90 s
        // killed exactly the retries that had just been given room to finish.
        // The whole-call `deadline` is still the outer bound.
        Math.min(
          (options.timeoutMs ?? CHAT_TIMEOUT_MS) * budgetScale,
          Math.max(10_000, deadline - Date.now()),
        ),
      );
    } catch (error) {
      lastError = new GeminiError(
        error instanceof Error ? error.message : `Không gọi được ${vendorLabel(creds)}.`,
        502,
      );
      await debugLog(
        `THROW ${vendorLabel(creds)} model=${model}: ${lastError.message}`,
      );
      transientStreak += 1;
      await backoff(transientStreak);
      continue;
    }

    if (response.ok) {
      noteSuccess();
      const payload = (await response.json()) as {
        choices?: Array<{
          finish_reason?: string | null;
          message?: { content?: string | null; reasoning?: string };
        }>;
        usage?: unknown;
      };
      const answer = payload.choices?.[0]?.message;
      // Reasoning models can spend the whole budget on their trace and leave
      // `content` null. Their trace usually *ends* with the answer, so it is
      // worth reading rather than failing the call.
      const text = (answer?.content ?? answer?.reasoning ?? "").trim();
      const finish = payload.choices?.[0]?.finish_reason;
      if (!text) {
        await debugLog(
          `EMPTY ${vendorLabel(creds)} model=${model} finish=${finish ?? "?"} usage=${JSON.stringify(payload.usage ?? {})}`,
        );
        // Same truncation story as below, one step earlier: the model spent the
        // whole budget and had no room left to emit anything.
        if (finish === "length" && budgetScale < 8) {
          budgetScale *= 2;
          attempt -= 1;
          continue;
        }
        throw new GeminiError(`Model "${model}" trả về nội dung rỗng.`);
      }

      const parsed = extractJson<T>(text);
      if (parsed === null) {
        await debugLog(
          `BAD-JSON ${vendorLabel(creds)} model=${model} finish=${finish ?? "?"} len=${text.length} head=${text.slice(0, 160)}`,
        );
        lastError = new GeminiError(
          `Model "${model}" trả về JSON không hợp lệ. Thử lại hoặc đổi model.`,
        );
        // Cut off mid-object: the answer is right, the budget was too small.
        if (finish === "length" && budgetScale < 8) {
          budgetScale *= 2;
          await debugLog(
            `RETRY-WIDER ${vendorLabel(creds)} model=${model} scale=${budgetScale}`,
          );
          attempt -= 1;
          continue;
        }
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
    await debugLog(
      `HTTP ${response.status} ${vendorLabel(creds)} model=${model}: ${message}`,
    );

    /*
     * A per-minute cap is shared by every model on the account, so rotating to a
     * reserve id would only move the refusal somewhere else. Wait it out on the
     * same model, which is what the vendor asked for, and only give up if the
     * cooldown does not open within this request's budget.
     *
     * Checked before the dead-model branch below: some vendors put the word
     * "quota" in a per-minute refusal too, and that word must not send us off to
     * rotate.
     */
    if (response.status === 429 && isThrottleOnly(message)) {
      throttleStreak += 1;
      noteThrottle(message, response.headers);
      if (throttleStreak > THROTTLE_ATTEMPTS) {
        throw new GeminiError(
          `${vendorLabel(creds)} vẫn đang giới hạn tốc độ (${message}). ` +
            "Bài này cần nhiều lượt gọi liên tiếp — thử lại sau ít phút.",
          429,
        );
      }
      // Waiting is scheduling, not a failed try: a throttle must not spend one of
      // the six real attempts, or a scene would give up while merely queued.
      attempt -= 1;
      continue;
    }

    // A full worker pool is not a dead model either, so it waits on the same id
    // instead of rotating. Kept out of the branch above because the wait has to
    // grow: the first retry lands inside the same overloaded window.
    if (response.status === 503 && isCapacityWait(message)) {
      throttleStreak += 1;
      noteCapacity(message, response.headers);
      if (throttleStreak > THROTTLE_ATTEMPTS) {
        throw new GeminiError(
          `${vendorLabel(creds)} đang quá tải (${message}). ` +
            "Hàng đợi của nhà cung cấp đầy, thử lại sau vài phút.",
          503,
        );
      }
      attempt -= 1;
      continue;
    }

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