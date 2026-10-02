import fs from "node:fs/promises";
import path from "node:path";

/**
 * Server-only credential store for every LLM provider.
 *
 * The API key itself only ever lives in `.env` (git-ignored). Everything
 * else — chosen provider/model, masked hint, last validation result — lives in
 * `data/ai-settings.json` so the browser can show state without the secret.
 *
 * Providers share one shape so the routes never branch on vendor:
 *   gemini      — x-goog-api-key against generativelanguage.googleapis.com
 *   openrouter  — Bearer token against the OpenAI-compatible /chat/completions
 *   groq        — same dialect, free tier, separate daily quota
 *   nvidia      — same dialect, free prototyping endpoints
 *   mistral     — same dialect, free-mode project credits
 *   antigravity — local `agy` agent binary (Antigravity CLI), no key, the agent
 *                 itself reads files and teaches from the course library
 *
 * The four Bearer-token entries differ only in base URL and vendor label, so
 * one adapter (`./openai-compatible`) serves all of them. Adding another
 * OpenAI-compatible vendor is therefore a config entry, not new code.
 */

/**
 * Where the app reads and writes provider settings.
 *
 * `.env` rather than `.env.local`: one file, one name, and it is the file the
 * project already ships a template for (`.env.example`), so "where do I put my
 * key" has a single answer. `.env.local` is still read as a fallback so an
 * install that predates the rename keeps working untouched — but nothing writes
 * there any more.
 */
export const ENV_FILE = path.join(process.cwd(), ".env");

/** Read-only, lowest priority. Kept so old installs survive the rename. */
const LEGACY_ENV_FILE = path.join(process.cwd(), ".env.local");

export const DATA_DIR = path.join(process.cwd(), "data");
export const SETTINGS_FILE = path.join(DATA_DIR, "ai-settings.json");

export const PROVIDER_IDS = [
  "gemini",
  "openrouter",
  "groq",
  "nvidia",
  "mistral",
  "antigravity",
] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

/**
 * `cloud` talks to a vendor HTTP API with an API key. `cli` drives a locally
 * installed agent binary instead — same app, no key, no per-token billing.
 * The distinction is a UI one (the setup screen groups by it and hides the key
 * box for CLI entries) plus one readiness rule: a cloud provider is configured
 * when a key exists, a CLI provider when its binary responds.
 */
export type ProviderKind = "cloud" | "cli";

export interface ProviderSpec {
  id: ProviderId;
  kind: ProviderKind;
  label: string;
  /** Where a user obtains a key. */
  signupUrl: string;
  /** Env vars that may hold the key, in priority order. */
  keyEnvNames: string[];
  defaultBaseUrl: string;
  defaultModel: string;
  /** Static fallback list; /setup swaps in the live list when possible. */
  modelChoices: string[];
  keyHintPrefix?: string;
  docs: string;
}

export const PROVIDERS: Record<ProviderId, ProviderSpec> = {
  gemini: {
    id: "gemini",
    kind: "cloud",
    label: "Google Gemini",
    signupUrl: "https://aistudio.google.com/apikey",
    keyEnvNames: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    // An alias Google keeps current, so the default never rots the way a pinned
    // id does (`gemini-2.5-flash` became unavailable to new projects).
    defaultModel: "gemini-flash-latest",
    modelChoices: [
      "gemini-flash-latest",
      "gemini-flash-lite-latest",
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-pro-latest",
      "gemini-2.5-flash",
    ],
    keyHintPrefix: "AIza",
    docs: "https://ai.google.dev/gemini-api/docs/rate-limits",
  },
  openrouter: {
    id: "openrouter",
    kind: "cloud",
    label: "OpenRouter",
    signupUrl: "https://openrouter.ai/keys",
    keyEnvNames: ["OPENROUTER_API_KEY"],
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    // Free tier models keep working when Gemini's daily quota is spent.
    defaultModel: "google/gemini-2.5-flash-lite",
    modelChoices: [
      "google/gemini-2.5-flash-lite",
      "google/gemini-2.0-flash-exp:free",
      "meta-llama/llama-3.3-70b-instruct",
      "qwen/qwen-2.5-72b-instruct",
      "mistralai/mistral-small",
      "deepseek/deepseek-chat",
    ],
    keyHintPrefix: "sk-or",
    docs: "https://openrouter.ai/docs",
  },
  groq: {
    id: "groq",
    kind: "cloud",
    label: "Groq",
    signupUrl: "https://console.groq.com/keys",
    keyEnvNames: ["GROQ_API_KEY"],
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    // Fastest free inference available, and the only reason to add it: its
    // no-card tier is metered per model (200k tokens/day), which fails at a
    // completely different point than OpenRouter's request-count cap.
    defaultModel: "openai/gpt-oss-120b",
    // Groq removed Llama from the free plan in 2026; these three are what the
    // rate-limit table actually lists. `agy models` / /models stays the source
    // of truth at runtime — this list is only the offline fallback.
    modelChoices: [
      "openai/gpt-oss-120b",
      "qwen/qwen3.8-27b",
      "openai/gpt-oss-20b",
    ],
    keyHintPrefix: "gsk_",
    docs: "https://console.groq.com/docs/rate-limits",
  },
  nvidia: {
    id: "nvidia",
    kind: "cloud",
    label: "NVIDIA API",
    signupUrl: "https://build.nvidia.com",
    keyEnvNames: ["NVIDIA_API_KEY"],
    defaultBaseUrl: "https://integrate.api.nvidia.com/v1",
    defaultModel: "meta/llama-3.3-70b-instruct",
    modelChoices: [
      "meta/llama-3.3-70b-instruct",
      "openai/gpt-oss-120b",
      "nvidia/llama-3.1-nemotron-70b-instruct",
      "qwen/qwen3-coder-480b-a35b-instruct",
      "deepseek-ai/deepseek-r1",
    ],
    keyHintPrefix: "nvapi-",
    docs: "https://build.nvidia.com/explore/discover",
  },
  mistral: {
    id: "mistral",
    kind: "cloud",
    label: "Mistral",
    signupUrl: "https://console.mistral.ai/api-keys",
    keyEnvNames: ["MISTRAL_API_KEY"],
    defaultBaseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
    modelChoices: [
      "mistral-small-latest",
      "magistral-medium-latest",
      "ministral-8b-latest",
      "codestral-latest",
      "open-mistral-nemo",
    ],
    docs: "https://docs.mistral.ai/deployment/laplateforme/tier/",
  },
  antigravity: {
    id: "antigravity",
    kind: "cli",
    label: "Antigravity CLI",
    signupUrl: "https://antigravity.google/docs/cli/install/",
    // The CLI authenticates with a one-time interactive login (`agy`), not an
    // API key. This name is a placeholder so the shared env-prefix logic keeps
    // working; it is never required and never checked against a vendor.
    keyEnvNames: ["ANTIGRAVITY_API_KEY"],
    defaultBaseUrl: "local://antigravity-cli",
    defaultModel: "auto",
    modelChoices: [
      "auto",
      "gemini-3.8-flash-high",
      "gemini-3.8-flash-medium",
      "gemini-3.1-pro-high",
      "claude-sonnet-4-6",
      "claude-opus-4-6-thinking",
      "gpt-oss-120b-medium",
    ],
    docs: "https://antigravity.google/docs/cli/headless/",
  },
};

/**
 * CLI providers that are *not* implemented yet.
 *
 * Listed so the setup screen can show the empty group honestly instead of
 * hiding it: a teacher who has heard of these tools should be able to see that
 * they are planned rather than wonder whether they missed a setting. Nothing
 * here is routable — `PROVIDER_IDS` is the real list of usable backends.
 */
export const PLANNED_CLI_PROVIDERS = [
  { id: "claude-code", label: "Claude Code CLI", note: "chạy `claude` trên máy bạn" },
  { id: "gemini-cli", label: "Gemini CLI", note: "chạy `gemini` trên máy bạn" },
  { id: "codex-cli", label: "Codex CLI", note: "chạy `codex` trên máy bạn" },
  { id: "ollama", label: "Ollama", note: "model chạy hoàn toàn offline" },
] as const;

/**
 * Hosts a base URL is allowed to point at.
 *
 * The API key is attached to every request made to `baseUrl`, so an unchecked
 * value is a key exfiltration primitive: point it at a host you control and
 * every later generation ships the key there. The link between the two is
 * silent, which is exactly what makes it dangerous.
 */
const ALLOWED_BASE_HOSTS: Record<ProviderId, readonly string[]> = {
  gemini: ["generativelanguage.googleapis.com"],
  openrouter: ["openrouter.ai"],
  groq: ["api.groq.com"],
  nvidia: ["integrate.api.nvidia.com"],
  mistral: ["api.mistral.ai"],
  antigravity: [],
};

/** Extra hosts, for a self-hosted gateway or an explicit corporate proxy. */
function extraBaseHosts(): string[] {
  return (process.env.AI_ALLOWED_BASE_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

export function validateBaseUrl(provider: ProviderId, raw: string): string {
  // CLI providers never touch the network: there is no host to allow-list and
  // no key riding along. The constant below is a marker, not a URL.
  if (PROVIDERS[provider]?.kind === "cli") return "local://antigravity-cli";
  const value = raw.trim();
  if (!value) throw new Error("Thiếu base URL.");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Base URL không hợp lệ: ${value}`);
  }

  // https only: an http endpoint exposes the key on the wire in plaintext.
  if (url.protocol !== "https:") {
    throw new Error("Base URL phải dùng https.");
  }

  const host = url.hostname.toLowerCase();
  const allowed = [...(ALLOWED_BASE_HOSTS[provider] ?? []), ...extraBaseHosts()];
  if (!allowed.includes(host)) {
    throw new Error(
      `Host "${host}" không được phép. Cho phép: ${allowed.join(", ") || "(chưa cấu hình)"}.` +
        " Nếu bạn cần proxy riêng, đặt AI_ALLOWED_BASE_HOSTS trong .env.",
    );
  }

  // Drop credentials and query/hash: they have no place in a base URL and are
  // a convenient way to smuggle something past a naive check.
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}

export const DEFAULT_BASE_URL = PROVIDERS.gemini.defaultBaseUrl;
export const DEFAULT_MODEL = PROVIDERS.gemini.defaultModel;
export const MODEL_CHOICES = PROVIDERS.gemini.modelChoices;

/**
 * Where a key came from: the real process env (shell/deployment), the `.env`
 * file the app writes, or nowhere. `"env.local"` is still accepted when read
 * from an older `data/ai-settings.json` and normalised to `"file"`.
 */
export type KeySource = "env" | "file" | "env.local" | "none";

export interface AiSettings {
  provider: ProviderId;
  model: string;
  baseUrl: string;
  /** Per-provider key hints, so switching providers keeps both keys. */
  keyHints: Partial<Record<ProviderId, string>>;
  keySources: Partial<Record<ProviderId, KeySource>>;
  /** Per-provider base URL, so a proxy set for one vendor never leaks to another. */
  baseUrls: Partial<Record<ProviderId, string>>;
  /**
   * Per-provider chosen model.
   *
   * `model` above is only "what the active provider uses". Without this map,
   * switching back to a vendor you had already configured showed its hardcoded
   * default instead of the model you picked, which reads as the app forgetting
   * the setting.
   */
  models: Partial<Record<ProviderId, string>>;
  lastValidatedAt: string | null;
  lastValidationOk: boolean | null;
  lastValidationMessage: string | null;
  updatedAt: string;
}

export interface ProviderCredentials {
  provider: ProviderId;
  apiKey: string | null;
  baseUrl: string;
  model: string;
  source: KeySource;
}

/** Kept as an alias so existing call sites keep compiling. */
export type GeminiCredentials = ProviderCredentials;

const FALLBACK_SETTINGS: AiSettings = {
  provider: "gemini",
  model: PROVIDERS.gemini.defaultModel,
  baseUrl: PROVIDERS.gemini.defaultBaseUrl,
  keyHints: {},
  keySources: {},
  baseUrls: {},
  models: {},
  lastValidatedAt: null,
  lastValidationOk: null,
  lastValidationMessage: null,
  updatedAt: new Date(0).toISOString(),
};

/** `AIzaSy…7f2c` — enough to recognise a key, useless to an attacker. */
export function maskKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const trimmed = key.trim();
  if (trimmed.length <= 10) return "•".repeat(trimmed.length);
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}

export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const withoutExport = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eq = withoutExport.indexOf("=");
    if (eq <= 0) continue;
    const name = withoutExport.slice(0, eq).trim();
    let value = withoutExport.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[name] = value;
  }
  return out;
}

/** Writes/updates keys in place, keeping comments and unrelated variables. */
export async function upsertEnvFile(
  updates: Record<string, string | undefined>,
): Promise<void> {
  // Base content comes from `.env` when it exists, otherwise from a pre-rename
  // `.env.local` (migrated on the first save) or from the shipped template. The
  // comments and unrelated variables in whichever file wins are preserved.
  let content = "";
  for (const candidate of [ENV_FILE, LEGACY_ENV_FILE, path.join(process.cwd(), ".env.example")]) {
    try {
      content = await fs.readFile(candidate, "utf8");
      break;
    } catch {
      /* try the next one */
    }
  }
  if (!content) content = "# Managed by EdusGPT (/setup)\n";

  const lines = content.split(/\r?\n/);
  const pending = new Map(Object.entries(updates));

  const next = lines.map((line) => {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (!match) return line;
    const name = match[1];
    if (!pending.has(name)) return line;
    const value = pending.get(name);
    pending.delete(name);
    return value === undefined ? `# ${name}=` : `${name}=${value}`;
  });

  for (const [name, value] of pending) {
    if (value === undefined) continue;
    next.push(`${name}=${value}`);
  }

  const body = `${next.join("\n").replace(/\n+$/, "")}\n`;
  await fs.mkdir(path.dirname(ENV_FILE), { recursive: true });
  await fs.writeFile(ENV_FILE, body, { encoding: "utf8", mode: 0o600 });
}

export async function readSettings(): Promise<AiSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    // Older installs stored a single provider's key in flat fields; migrate so
    // a pre-existing settings file keeps working after the multi-provider switch.
    const legacyHint = (parsed as { keyHint?: string }).keyHint ?? null;
    const provider = PROVIDER_IDS.includes(parsed.provider as ProviderId)
      ? (parsed.provider as ProviderId)
      : "gemini";
    // `keySource: "env.local"` was written before the file was renamed to
    // `.env`; normalise it so the UI never has to know the old name.
    const normaliseSources = (
      input: Partial<Record<ProviderId, KeySource>> | undefined,
    ): Partial<Record<ProviderId, KeySource>> => {
      if (!input) return {};
      const out: Partial<Record<ProviderId, KeySource>> = {};
      for (const [id, value] of Object.entries(input)) {
        if (!value) continue;
        out[id as ProviderId] = value === "env.local" ? "file" : value;
      }
      return out;
    };
    const legacySources = (parsed as { keySource?: KeySource }).keySource;
    return {
      ...FALLBACK_SETTINGS,
      ...parsed,
      provider,
      keyHints:
        parsed.keyHints ??
        (legacyHint ? { [provider]: legacyHint } : {}),
      keySources: parsed.keySources
        ? normaliseSources(parsed.keySources)
        : legacySources
          ? normaliseSources({ [provider]: legacySources })
          : {},
      baseUrls:
        parsed.baseUrls ??
        (parsed.baseUrl ? { [provider]: parsed.baseUrl } : {}),
      // A pre-`models` install only recorded one model, for whichever provider
      // was active then. Adopting it for that provider keeps the user's choice.
      models: parsed.models ?? (parsed.model ? { [provider]: parsed.model } : {}),
    };
  } catch {
    return { ...FALLBACK_SETTINGS };
  }
}

export async function writeSettings(patch: Partial<AiSettings>): Promise<AiSettings> {
  const current = await readSettings();
  const next: AiSettings = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_FILE, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

interface EnvCache {
  /** Both files' mtimes: a write to either one has to be picked up. */
  stamp: string;
  values: Record<string, string>;
}
let envCache: EnvCache | null = null;

async function parseEnvAt(file: string): Promise<Record<string, string>> {
  try {
    return parseEnvFile(await fs.readFile(file, "utf8"));
  } catch {
    return {};
  }
}

async function readEnvFileCached(): Promise<Record<string, string>> {
  const [main, legacy] = await Promise.all([fs.stat(ENV_FILE).catch(() => null), fs.stat(LEGACY_ENV_FILE).catch(() => null)]);
  const stamp = `${main?.mtimeMs ?? "none"}:${legacy?.mtimeMs ?? "none"}`;
  if (envCache && envCache.stamp === stamp) return envCache.values;

  // `.env` wins; `.env.local` is folded in underneath so an install that predates
  // the rename keeps its keys instead of silently losing them.
  const values = {
    ...(legacy ? await parseEnvAt(LEGACY_ENV_FILE) : {}),
    ...(main ? await parseEnvAt(ENV_FILE) : {}),
  };
  envCache = { stamp, values };
  return envCache.values;
}

/**
 * Priority: real process env (shell / deployment) > `.env` written by the
 * /setup page. The file is re-stat'ed per request, so a key saved through the
 * web UI works immediately — no server restart needed.
 */
export async function resolveProvider(
  providerOverride?: ProviderId,
): Promise<ProviderCredentials> {
  const settings = await readSettings();
  const fileValues = await readEnvFileCached();
  // `.env.example` documents AI_PROVIDER as a real variable, so its value in the
  // file has to count too — not just the one Next loaded into process.env at boot.
  // Without this, picking a provider in /setup only lives in data/ai-settings.json
  // and a restart silently drops it back to whatever .env still says.
  const declared =
    providerOverride ??
    process.env.AI_PROVIDER?.trim() ??
    fileValues.AI_PROVIDER?.trim() ??
    settings.provider;
  // A stale/typo'd value must not resolve to a vendor that isn't in the map:
  // falling through to the stored settings is recoverable, an undefined provider
  // is not.
  const provider: ProviderId = PROVIDER_IDS.includes(declared as ProviderId)
    ? (declared as ProviderId)
    : settings.provider;
  const spec = PROVIDERS[provider] ?? PROVIDERS.gemini;

  let apiKey: string | null = null;
  let source: KeySource = "none";

  for (const name of spec.keyEnvNames) {
    const fromProcess = process.env[name]?.trim();
    if (fromProcess) {
      apiKey = fromProcess;
      source = "env";
      break;
    }
  }
  if (!apiKey) {
    for (const name of spec.keyEnvNames) {
      const fromFile = fileValues[name]?.trim();
      if (fromFile) {
        apiKey = fromFile;
        source = "file";
        break;
      }
    }
  }

  const envPrefix = spec.keyEnvNames[0].replace(/_API_KEY$/, "");
  const rawBaseUrl =
    process.env[`${envPrefix}_BASE_URL`]?.trim() ||
    fileValues[`${envPrefix}_BASE_URL`]?.trim() ||
    settings.baseUrls[provider] ||
    spec.defaultBaseUrl;

  // Re-checked on the way out, not only on the way in. A hand-edited
  // `.env` or a tampered `data/ai-settings.json` is exactly the same
  // exfiltration path as a crafted request, and the key is attached to every
  // request made to this host. A rejected value falls back to the vendor
  // default rather than leaving the app pointed somewhere unvetted.
  let baseUrl = spec.defaultBaseUrl;
  try {
    baseUrl = validateBaseUrl(provider, rawBaseUrl);
  } catch {
    baseUrl = validateBaseUrl(provider, spec.defaultBaseUrl);
  }

  const model =
    process.env[`${envPrefix}_MODEL`]?.trim() ||
    fileValues[`${envPrefix}_MODEL`]?.trim() ||
    settings.models[provider]?.trim() ||
    (provider === settings.provider ? settings.model : "") ||
    spec.defaultModel;

  return { provider, apiKey, baseUrl, model, source };
}

/** Kept so existing call sites keep working; resolves the active provider. */
export async function resolveGemini(): Promise<GeminiCredentials> {
  return resolveProvider();
}

/** Public (browser-safe) status — never includes the key itself. */
export async function publicAiStatus() {
  const creds = await resolveProvider();
  const settings = await readSettings();
  const spec = PROVIDERS[creds.provider];
  // Cloud readiness = an API key exists. CLI readiness = the binary responds
  // (auth is a one-time interactive login, checked lazily and cached 60s).
  //
  // Probed for *every* CLI provider, not only the active one: /setup renders the
  // install badge on the card itself, and a card reading "chưa cài" while `agy`
  // is sitting on PATH is a false claim the user would act on. One extra
  // `agy --version` (~70ms) per status call buys an honest badge; all three
  // callers fetch once on mount, and the 60s cache absorbs the rest.
  const cliState = new Map<ProviderId, { available: boolean; version: string | null }>();
  if (Object.values(PROVIDERS).some((item) => item.kind === "cli")) {
    let probe: { available: boolean; version: string | null };
    try {
      const agy = await import("./antigravity");
      probe = await agy.describeAntigravity();
    } catch {
      probe = { available: false, version: null };
    }
    for (const item of Object.values(PROVIDERS)) {
      if (item.kind === "cli") cliState.set(item.id, probe);
    }
  }
  const cliActive = cliState.get(creds.provider);
  const configured = spec.kind === "cli" ? cliActive?.available === true : Boolean(creds.apiKey);
  return {
    provider: creds.provider,
    providerLabel: spec.label,
    /** Lets the header badge describe a CLI provider without inventing a key. */
    providerKind: spec.kind,
    /** Only set when the active provider is a CLI one. */
    cli: spec.kind === "cli" ? (cliActive ?? { available: false, version: null }) : null,
    configured,
    keyHint: configured ? maskKey(creds.apiKey) : (settings.keyHints[creds.provider] ?? null),
    keySource: creds.source,
    model: creds.model,
    baseUrl: creds.baseUrl,
    availableModels: [...spec.modelChoices],
    // Per-provider view, so /setup can show which keys are already installed and
    // populate the model dropdown per vendor.
    providers: Object.values(PROVIDERS).map((item) => ({
      id: item.id,
      kind: item.kind,
      label: item.label,
      signupUrl: item.signupUrl,
      docs: item.docs,
      defaultModel: item.defaultModel,
      modelChoices: [...item.modelChoices],
      keyHint: settings.keyHints[item.id] || null,
      keySource: settings.keySources[item.id] ?? "none",
      /** CLI liveness for `cli` entries, so /setup can show install state. */
      cli:
        item.kind === "cli"
          ? (cliState.get(item.id) ?? { available: false, version: null })
          : null,
      /** The model this provider would use if it became active. */
      model:
        item.id === creds.provider
          ? creds.model
          : (settings.models[item.id] ?? item.defaultModel),
      // Each vendor keeps its own base URL so a proxy never leaks across.
      baseUrl: item.id === creds.provider ? creds.baseUrl : (settings.baseUrls[item.id] ?? item.defaultBaseUrl),
    })),
    /**
     * CLI providers are grouped in the UI but not routable yet. Sent as data so
     * the setup screen renders the empty group rather than inventing the list.
     */
    plannedCliProviders: PLANNED_CLI_PROVIDERS.map((item) => ({ ...item })),
    lastValidatedAt: settings.lastValidatedAt,
    lastValidationOk: settings.lastValidationOk,
    lastValidationMessage: settings.lastValidationMessage,
    envFile: ".env",
  };
}

export type PublicAiStatus = Awaited<ReturnType<typeof publicAiStatus>>;

/** Persists a key for one provider and makes it the active one. */
export async function saveApiKey(
  apiKey: string,
  options?: { provider?: ProviderId; model?: string; baseUrl?: string },
): Promise<AiSettings> {
  const provider = options?.provider ?? "gemini";
  const spec = PROVIDERS[provider] ?? PROVIDERS.gemini;
  const trimmed = apiKey.trim();
  const envPrefix = spec.keyEnvNames[0].replace(/_API_KEY$/, "");
  const model = options?.model?.trim() || spec.defaultModel;
  // Validated before anything is written: the key rides along on every request
  // to this host, so a bad value is not a typo, it is a leak.
  const baseUrl = options?.baseUrl?.trim()
    ? validateBaseUrl(provider, options.baseUrl)
    : spec.defaultBaseUrl;

  const envUpdates: Record<string, string> = {
    [`${envPrefix}_MODEL`]: model,
    [`${envPrefix}_BASE_URL`]: baseUrl,
    // Same reason as saveCliProvider: the choice has to survive a restart.
    AI_PROVIDER: provider,
  };
  for (const name of spec.keyEnvNames) envUpdates[name] = trimmed;

  await upsertEnvFile(envUpdates);

  // Usable right now, without waiting for the dev server to restart on env change.
  for (const name of spec.keyEnvNames) process.env[name] = trimmed;
  process.env[`${envPrefix}_MODEL`] = model;
  process.env[`${envPrefix}_BASE_URL`] = baseUrl;
  process.env.AI_PROVIDER = provider;

  const settings = await readSettings();
  return writeSettings({
    provider,
    model,
    baseUrl,
    baseUrls: { ...settings.baseUrls, [provider]: baseUrl },
    models: { ...settings.models, [provider]: model },
    keyHints: { ...settings.keyHints, [provider]: maskKey(trimmed) ?? "" },
    keySources: { ...settings.keySources, [provider]: "file" },
  });
}

/** Legacy alias so existing routes keep working. */
export async function saveGeminiKey(
  apiKey: string,
  options?: { model?: string; baseUrl?: string },
): Promise<AiSettings> {
  return saveApiKey(apiKey, { ...options, provider: "gemini" });
}

/**
 * Activates a CLI provider: no key exists, so this only persists the provider
 * choice + model and clears any stale base URL. Callers must validate the
 * binary (validateAntigravity) before invoking.
 */
export async function saveCliProvider(
  provider: ProviderId,
  options?: { model?: string },
): Promise<AiSettings> {
  const spec = PROVIDERS[provider] ?? PROVIDERS.gemini;
  if (spec.kind !== "cli") {
    throw new Error(`saveCliProvider chỉ dùng cho provider CLI, nhận: ${provider}.`);
  }
  const model = options?.model?.trim() || spec.defaultModel;
  const envPrefix = spec.keyEnvNames[0].replace(/_API_KEY$/, "");

  // AI_PROVIDER goes into the file too, not just process.env: `.env` is read on
  // boot, so a choice made in /setup would otherwise evaporate on restart.
  await upsertEnvFile({
    [`${envPrefix}_MODEL`]: model,
    AI_PROVIDER: provider,
  });
  process.env[`${envPrefix}_MODEL`] = model;
  process.env.AI_PROVIDER = provider;

  const settings = await readSettings();
  return writeSettings({
    provider,
    model,
    baseUrl: spec.defaultBaseUrl,
    models: { ...settings.models, [provider]: model },
  });
}

export async function forgetApiKey(
  provider: ProviderId,
): Promise<AiSettings> {
  const spec = PROVIDERS[provider] ?? PROVIDERS.gemini;
  const envPrefix = spec.keyEnvNames[0].replace(/_API_KEY$/, "");

  const envUpdates: Record<string, undefined> = {
    [`${envPrefix}_MODEL`]: undefined,
    [`${envPrefix}_BASE_URL`]: undefined,
  };
  for (const name of spec.keyEnvNames) envUpdates[name] = undefined;
  await upsertEnvFile(envUpdates);

  for (const name of spec.keyEnvNames) delete process.env[name];
  delete process.env[`${envPrefix}_MODEL`];
  delete process.env[`${envPrefix}_BASE_URL`];

  const settings = await readSettings();
  const nextBaseUrls = { ...settings.baseUrls };
  delete nextBaseUrls[provider];
  return writeSettings({
    baseUrls: nextBaseUrls,
    keyHints: { ...settings.keyHints, [provider]: "" },
    keySources: { ...settings.keySources, [provider]: "none" },
    lastValidatedAt: null,
    lastValidationOk: null,
    lastValidationMessage: `Đã xoá key ${spec.label} khỏi .env`,
  });
}

export async function forgetGeminiKey(): Promise<AiSettings> {
  return forgetApiKey("gemini");
}

export async function recordValidation(
  ok: boolean,
  message: string,
  patch?: Partial<AiSettings>,
): Promise<AiSettings> {
  return writeSettings({
    ...patch,
    lastValidatedAt: new Date().toISOString(),
    lastValidationOk: ok,
    lastValidationMessage: message,
  });
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);

/** The credential endpoints refuse to run for anything but a local caller. */
export function isLocalRequest(hostHeader: string | null): boolean {
  if (process.env.ALLOW_REMOTE_KEY_ADMIN === "true") return true;
  if (!hostHeader) return true; // same-process invocation (tests, scripts)
  const extra = (process.env.LOCAL_ONLY_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  const host = hostHeader.split(":")[0].toLowerCase().replace(/^\[|\]$/g, "");
  return LOCAL_HOSTS.has(host) || extra.includes(host);
}

