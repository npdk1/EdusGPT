/**
 * Fitting a lesson-sized request inside a provider's per-minute token budget.
 *
 * Some free tiers are small. Groq's allows 8000 tokens a minute on
 * `openai/gpt-oss-20b`, and it counts the answer budget we *ask for* against that
 * number, not the tokens actually spent: a scene call that reserves room for a
 * 4096-token answer plus 2048 tokens of reasoning trace, next to a prompt of
 * around 2200 tokens, is refused before the model sees a single word —
 *
 *   Request too large for model `openai/gpt-oss-20b` … on tokens per minute
 *   (TPM): Limit 8000, Requested 8405
 *
 * That refusal is the only place the real number is ever written down, and it
 * arrives after the request is built. So: read it, remember it for the model,
 * and size every later call to fit — the answer budget first (it is the part we
 * choose), then the wall clock between calls (a lesson is sixteen scenes in a
 * row, and sixteen full-budget calls cannot fit in one minute either).
 *
 * Nothing here guesses a provider's limit. Until a vendor says what its ceiling
 * is, every call is sized the way it always was.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
const STORE_FILE = join(DATA_DIR, "token-limits.json");

/** Keep a tenth of the budget free: the vendor's own estimate is approximate. */
const SAFETY = 0.9;

/**
 * The smallest answer worth asking for.
 *
 * Below this a scene JSON cannot fit — title, subtitle, bullets and the narration
 * alone are several hundred tokens — and a refusal loop is a better outcome than
 * a truncated object the parser will reject anyway.
 */
const MIN_OUTPUT_TOKENS = 1400;

/**
 * Rough tokens for a Vietnamese prompt, prompt engineering without a tokenizer.
 *
 * Measured against Groq's `openai/gpt-oss-120b` with a real scene prompt: 19566
 * characters of Vietnamese came to 5323 tokens, so 3.7 characters per token is
 * what this language actually costs. The divisor here stays a little under that
 * on purpose — under-estimating the prompt would send the oversized request the
 * vendor just refused, and over-estimating only makes the answer budget smaller
 * than it needed to be.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.4);
}

/** `provider/model`, the key a limit belongs to. */
export function tokenLimitKey(provider: string, model: string): string {
  return `${provider}/${model}`;
}

/**
 * The refusal, read back as numbers.
 *
 * Groq words it "Limit 8000, Requested 8405"; other vendors phrase the same
 * refusal differently, so this looks for the two numbers rather than the sentence.
 */
export function parseTokenCeiling(
  message: string,
): { limit: number; requested: number } | null {
  if (!/too large|tokens per minute|\bTPM\b/i.test(message)) return null;
  const limit = /Limit\s+([\d,]+)/i.exec(message);
  const requested = /Requested\s+([\d,]+)/i.exec(message);
  const limitNumber = limit ? Number(limit[1].replace(/,/g, "")) : 0;
  const requestedNumber = requested ? Number(requested[1].replace(/,/g, "")) : 0;
  if (!limitNumber) return null;
  return { limit: limitNumber, requested: requestedNumber || 0 };
}

/* -------------------------------------------------------------------------- */
/*  Remembering what each model allows                                         */
/* -------------------------------------------------------------------------- */

interface TokenStore {
  limits: Record<string, number>;
  /** Models whose prompts a lesson has to keep small, learned the same way. */
  compact: Record<string, boolean>;
}

let cached: { at: number; store: TokenStore } | null = null;
const TTL_MS = 60_000;

const EMPTY_STORE: TokenStore = { limits: {}, compact: {} };

async function readStore(): Promise<TokenStore> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.store;
  let store = EMPTY_STORE;
  try {
    const raw = JSON.parse(await readFile(STORE_FILE, "utf8")) as Partial<TokenStore>;
    store = { limits: raw.limits ?? {}, compact: raw.compact ?? {} };
  } catch {
    store = EMPTY_STORE;
  }
  cached = { at: Date.now(), store };
  return store;
}

async function writeStore(store: TokenStore): Promise<void> {
  cached = { at: Date.now(), store };
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const temp = `${STORE_FILE}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(store, null, 2), "utf8");
    await rename(temp, STORE_FILE);
  } catch {
    /* the in-memory copy is the one that matters for this run */
  }
}

/** A model the app has never been refused by, and therefore knows nothing about. */
export async function readTokenLimit(
  provider: string,
  model: string,
): Promise<number | null> {
  const limit = (await readStore()).limits[tokenLimitKey(provider, model)];
  return typeof limit === "number" && limit > 0 ? limit : null;
}

/**
 * Writes the ceiling down so the next run starts already fitted.
 *
 * A lesson is sixteen calls; paying the first one to be refused would cost a
 * whole scene, which is exactly the scene the teacher is waiting for.
 */
export async function noteTokenLimit(
  provider: string,
  model: string,
  limit: number,
): Promise<void> {
  const key = tokenLimitKey(provider, model);
  const store = await readStore();
  // Only ever tighten: a raised limit upstream must not be undone by an old file.
  if (store.limits[key] && store.limits[key] <= limit) return;
  store.limits[key] = limit;
  await writeStore(store);
}

/**
 * Remembers that this model's prompts have to be short.
 *
 * The ceiling alone says how much room there is; it does not say a lesson prompt
 * needs to be rewritten to fit. The lesson route learns that by being refused,
 * and writes it down here so the next lesson starts in the smaller coat rather
 * than spending its first scene finding out.
 */
export async function readCompactModel(
  provider: string,
  model: string,
): Promise<boolean> {
  return (await readStore()).compact[tokenLimitKey(provider, model)] === true;
}

export async function noteCompactModel(provider: string, model: string): Promise<void> {
  const key = tokenLimitKey(provider, model);
  const store = await readStore();
  if (store.compact[key]) return;
  store.compact[key] = true;
  await writeStore(store);
}

/** What to forget, for a test seam and for the settings screen's "relearn". */
export function forgetTokenLimits(): void {
  cached = null;
}

/**
 * The answer budget that fits.
 *
 * Given what the prompt costs and what the model may spend in a minute, this is
 * the largest `max_tokens` that leaves the rest of the budget for other calls in
 * the same window — and never so small that the JSON cannot be written.
 */
export function maxOutputTokensFor(
  limit: number | null,
  inputTokens: number,
  wanted: number,
): number {
  if (!limit) return wanted;
  const room = Math.floor(limit * SAFETY) - inputTokens;
  if (room < MIN_OUTPUT_TOKENS) return MIN_OUTPUT_TOKENS;
  return Math.min(wanted, room);
}

/* -------------------------------------------------------------------------- */
/*  Pacing                                                                     */
/* -------------------------------------------------------------------------- */

interface Spend {
  at: number;
  tokens: number;
}

/**
 * Keeps a run inside the rolling window.
 *
 * Sizing each call is only half of it: sixteen scenes in a row will spend the
 * budget twice over even when every call fits on its own. This remembers what the
 * run has spent in the last minute and waits out the rest before the next call —
 * the same thing a person would do after being told to slow down.
 *
 * The answer half of the next call is guessed from what the last ones actually
 * cost, not from the ceiling they were allowed. Reserving the whole answer budget
 * every time would work, but it would also put one scene a minute on a model that
 * finishes a scene in a third of it — and sixteen scenes is already a wait the
 * teacher is watching.
 */
export class TokenPacer {
  /** Shared across calls: the window belongs to the model, not to one stage. */
  private spent: Spend[] = [];

  /** Mean answer size of this run so far, in tokens. */
  private avgOutput = 0;

  /** Records a call that went through, so the next one can wait its turn. */
  note(inputTokens: number, outputTokens: number): void {
    const total = inputTokens + outputTokens;
    if (total > 0) this.spent.push({ at: Date.now(), tokens: total });
    if (outputTokens > 0) {
      this.avgOutput = this.avgOutput > 0 ? this.avgOutput * 0.7 + outputTokens * 0.3 : outputTokens;
    }
    this.trim();
  }

  /**
   * What the next call is likely to cost, before it is sent.
   *
   * The first call of a run has nothing to learn from, so it guesses a modest
   * answer; a wrong guess in either direction is corrected by what comes back.
   */
  estimateCall(inputTokens: number, maxOutputTokens: number): number {
    const guess = this.avgOutput > 0 ? Math.round(this.avgOutput * 1.5) : 800;
    return inputTokens + Math.min(maxOutputTokens, Math.max(500, guess));
  }

  /** Tokens spent in the trailing minute. */
  private usedInWindow(): number {
    this.trim();
    return this.spent.reduce((total, item) => total + item.tokens, 0);
  }

  private trim(): void {
    const cutoff = Date.now() - 60_000;
    this.spent = this.spent.filter((item) => item.at > cutoff);
  }

  /**
   * Waits until `cost` tokens fit in the window.
   *
   * Returns how long it waited, so the caller can say so: a lesson that pauses for
   * twenty seconds looks broken from the outside unless it explains itself.
   */
  async waitForRoom(limit: number | null, cost: number): Promise<number> {
    if (!limit) return 0;
    // An estimate larger than the whole ceiling would wait forever and then send
    // the request anyway, so it is capped: the vendor's own accounting is the
    // authority, and a request it still refuses is re-learned and re-fitted.
    const budget = Math.floor(limit * 0.85);
    const planned = Math.min(cost, budget);
    if (planned >= budget) return 0;
    const started = Date.now();
    // At most one full window: past that the vendor's own refusal is the better
    // answer than a stall the teacher cannot interrupt.
    for (;;) {
      const used = this.usedInWindow();
      if (used + planned <= budget) break;
      const oldest = this.spent[0]?.at ?? Date.now();
      const freeIn = Math.max(1_000, oldest + 60_000 - Date.now());
      if (Date.now() - started > 62_000) break;
      await new Promise((resolve) => setTimeout(resolve, Math.min(freeIn, 15_000)));
    }
    return Date.now() - started;
  }
}