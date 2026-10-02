import type { ProviderCredentials, ProviderId } from "./config";
import { PROVIDERS } from "./config";
import {
  GeminiError,
  generateJson as generateGeminiJson,
  isNoiseModel,
  isTextModel,
  listModels as listGeminiModels,
  recommendModels,
  validateKey as validateGeminiKey,
} from "./gemini";
import {
  generateAntigravityJson,
  listAntigravityModels,
  validateAntigravity,
} from "./antigravity";
import {
  generateChatJson,
  listChatModels,
  validateChatKey,
} from "./openai-compatible";

/**
 * Providers that speak the OpenAI chat-completions dialect, served by one
 * adapter. They differ only in base URL and label, both from the provider map.
 */
const OPENAI_COMPATIBLE: readonly ProviderId[] = ["openrouter", "groq", "nvidia"];

/**
 * Provider-agnostic front door.
 *
 * Routes import from here and never mention a vendor: they pass credentials in
 * and get back models, a validation verdict, and structured JSON. Swapping
 * provider in /setup needs no code change.
 */

export type ModelInfo = {
  id: string;
  displayName: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  methods: string[];
};

export type ValidationResult = {
  ok: boolean;
  message: string;
  model?: string;
  models?: number;
  latencyMs?: number;
};

export type GenerateOptions = {
  system?: string;
  prompt: string;
  schema?: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
  model?: string;
  timeoutMs?: number;
  totalTimeoutMs?: number;
  validate?: (data: unknown) => string | null;
};

const isAntigravity = (creds: ProviderCredentials) =>
  creds.provider === "antigravity";
const isOpenAICompatible = (creds: ProviderCredentials) =>
  OPENAI_COMPATIBLE.includes(creds.provider);

/**
 * Whether a listed model can actually write a lesson.
 *
 * The vendor list endpoints return *every* model the account can see, which
 * includes image, TTS, music, embedding and research models — 29 of Gemini's
 * 44 were of that kind. Those cannot emit our JSON, so putting them in the
 * dropdown only lets someone pick one and get a schema-validation failure with
 * no hint about why. Filtering here keeps the number honest rather than the
 * dropdown long.
 */
function canWriteLessons(provider: ProviderId, id: string): boolean {
  if (!id) return false;
  // The local agent resolves "auto" itself and only ever emits the requested
  // JSON, so every curated Antigravity entry is lesson-capable.
  if (provider === "antigravity") return true;
  // Gemini's own ids must be a gemini text model; every other vendor nests or
  // prefixes ids differently, so only the noise check applies.
  if (provider === "gemini") return isTextModel(id);
  return !isNoiseModel(id);
}

export async function listModels(creds: ProviderCredentials): Promise<ModelInfo[]> {
  const models = isAntigravity(creds)
    ? listAntigravityModels(creds)
    : isOpenAICompatible(creds)
      ? await listChatModels(creds)
      : await listGeminiModels(creds);
  return models.filter((model) => canWriteLessons(creds.provider, model.id));
}

export async function validateKey(creds: ProviderCredentials): Promise<ValidationResult> {
  if (isAntigravity(creds)) {
    const started = Date.now();
    const verdict = await validateAntigravity(creds.model);
    return {
      ok: verdict.ok,
      message: verdict.message,
      model: creds.model,
      models: listAntigravityModels(creds).length,
      latencyMs: Date.now() - started,
    };
  }
  return isOpenAICompatible(creds)
    ? validateChatKey(creds)
    : validateGeminiKey(creds);
}

export async function generateJson<T>(
  creds: ProviderCredentials,
  options: GenerateOptions,
): Promise<{ data: T; model: string; text: string; usage?: unknown }> {
  if (isAntigravity(creds)) {
    const data = await generateAntigravityJson<T>(creds, {
      schema: options.schema ?? { type: "object" },
      system: options.system,
      prompt: options.prompt,
      timeoutMs: options.totalTimeoutMs ?? options.timeoutMs,
    });
    return { data, model: creds.model, text: JSON.stringify(data) };
  }
  return isOpenAICompatible(creds)
    ? generateChatJson<T>(creds, options)
    : generateGeminiJson<T>(creds, options);
}

/**
 * Fallback ranking used by the setup screen when only the static list is known.
 */
export function suggestModels(creds: ProviderCredentials, limit = 4): string[] {
  const spec = PROVIDERS[creds.provider] ?? PROVIDERS.gemini;
  return spec.modelChoices.slice(0, limit);
}

export { GeminiError, recommendModels };
