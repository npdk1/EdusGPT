/**
 * Helpers every provider adapter shares, kept apart from any vendor client.
 *
 * These used to live in `gemini.ts`, back when Gemini was the only backend and
 * the Gemini endpoint, the JSON repairer and the repetition guard could share a
 * file. Now that Gemini is gone they would have dragged a dead HTTP client
 * along with them, so the vendor-neutral half moved here and the class lost its
 * vendor name: `GeminiError` is `AiError`, because it is raised by Groq and
 * NVIDIA just as often.
 */

export class AiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = "AiError";
    this.statusCode = statusCode;
  }
}

/**
 * Ids that exist but cannot turn a topic into structured lesson JSON:
 * image, TTS, music, transcription, embeddings, research and specialist models.
 *
 * Offering these in the dropdown means the user picks one, generation runs, and
 * the JSON schema validation fails with a message that never mentions the real
 * cause — so the *name* check has to run before a model is ever suggested.
 */
const MODEL_NOISE =
  /(image|tts|audio|video|transcribe|music|lyria|imagen|veo|embedding|computer-use|robotics|nano-banana|antigravity|deep-research|gemma|customtools|omni|search)/i;

export function isNoiseModel(id: string): boolean {
  return MODEL_NOISE.test(id);
}

/** A vendor's wording for "this model id is not usable by your project". */
export function isModelUnavailable(message: string): boolean {
  return /no longer available|not available to new users|not found|is not found|not supported|is not available|deprecated|unrecognized model|invalid model|UNSUPPORTED/i.test(
    message,
  );
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