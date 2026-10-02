import fs from "node:fs/promises";
import path from "node:path";

/**
 * Which models have actually written a whole lesson on this install.
 *
 * The setup screen shows a model dropdown built from whatever the vendor
 * reports in `/models`. That list says which ids *exist*, not which ones can be
 * trusted with a full lesson — and on free tiers the difference is large: a
 * reasoning model can burn its whole token budget on thinking and hand back
 * nothing, a small model can refuse the JSON contract outright, and a hosted id
 * can be retired between the catalog call and the request.
 *
 * So this file records the only evidence that settles it: a lesson finished, and
 * the model that actually wrote it (`lesson.model`, which is the *generated*
 * model, not the configured one — see the lesson route). Anything not in here
 * gets no mark, which is the point: an untested id and a failing id look the
 * same to the user, and that is honest.
 *
 * Deliberately not stored in `data/ai-settings.json`: that file is about
 * configuration the user picked, this is about measurement. Mixing the two
 * means a script that audits models writes into the user's saved settings.
 */

const TRUST_FILE = path.join(process.cwd(), "data", "model-trust.json");

export interface ModelTrustEntry {
  provider: string;
  model: string;
  /** Proof, not decoration: the lesson this id produced, end to end. */
  lessonId: string | null;
  scenes: number;
  words: number;
  verifiedAt: string;
}

interface TrustFile {
  entries: ModelTrustEntry[];
}

const EMPTY: TrustFile = { entries: [] };

function isEntry(value: unknown): value is ModelTrustEntry {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ModelTrustEntry>;
  return (
    typeof item.provider === "string" &&
    typeof item.model === "string" &&
    typeof item.verifiedAt === "string"
  );
}

/**
 * Reads the trust file. A malformed file yields no entries rather than an
 * error: a bad measurement record must never take down lesson generation.
 */
export async function readModelTrust(): Promise<ModelTrustEntry[]> {
  try {
    const raw = await fs.readFile(TRUST_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<TrustFile>;
    const list = Array.isArray(parsed.entries) ? parsed.entries : [];
    return list.filter(isEntry);
  } catch {
    return [];
  }
}

/** Models that have written a lesson, keyed by provider, newest write first. */
export async function trustedModelsByProvider(): Promise<Record<string, string[]>> {
  const entries = (await readModelTrust()).sort((a, b) =>
    b.verifiedAt.localeCompare(a.verifiedAt),
  );
  const out: Record<string, string[]> = {};
  for (const entry of entries) {
    if (!entry.model) continue;
    const bucket = (out[entry.provider] ??= []);
    if (!bucket.includes(entry.model)) bucket.push(entry.model);
  }
  return out;
}

export async function isModelTrusted(provider: string, model: string): Promise<boolean> {
  const entries = await readModelTrust();
  return entries.some((item) => item.provider === provider && item.model === model);
}

export interface ModelTrustUpdate {
  provider: string;
  model: string;
  lessonId?: string | null;
  scenes: number;
  words: number;
}

/**
 * Records (or refreshes) one model's proof. Called after a lesson finishes, so
 * a second run through the same model updates the evidence instead of piling up
 * duplicates.
 */
export async function recordModelTrust(update: ModelTrustUpdate): Promise<void> {
  const model = update.model?.trim();
  if (!update.provider || !model) return;
  const entries = await readModelTrust();
  const entry: ModelTrustEntry = {
    provider: update.provider,
    model,
    lessonId: update.lessonId ?? null,
    scenes: Number.isFinite(update.scenes) ? update.scenes : 0,
    words: Number.isFinite(update.words) ? update.words : 0,
    verifiedAt: new Date().toISOString(),
  };
  const next = [entry, ...entries.filter((item) => !(item.provider === entry.provider && item.model === entry.model))];

  try {
    await fs.mkdir(path.dirname(TRUST_FILE), { recursive: true });
    await fs.writeFile(TRUST_FILE, `${JSON.stringify({ entries: next }, null, 2)}\n`, "utf8");
  } catch {
    // Losing the mark is survivable; failing the lesson over it is not.
  }
}