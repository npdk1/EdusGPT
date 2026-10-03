/**
 * The generation run log, shared by the studio timeline and the library.
 *
 * One entry per SSE event of a run, in order — the honest answer to "where is
 * the model call". The studio builds it live; the finished entries travel with
 * the lesson into `data/courses/<id>.json` (capped, see below) so the library
 * can show the same log later behind a toggle.
 */

/** One row of the run log. Mirrors the SSE event it came from. */
export interface RunLogEntry {
  /** Client clock when the event arrived, HH:MM:SS. Absent for stored rows. */
  at?: string;
  stage?: string;
  message: string;
  provider?: string;
  model?: string;
  elapsedMs?: number;
  kind: "stage" | "scene" | "done" | "error";
}

/** Cap stored logs: a 95-scene deck emits ~100 rows, the file stays small. */
export const MAX_STORED_LOG_ENTRIES = 200;

function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed ? trimmed : undefined;
}

/**
 * Accepts a log posted with a lesson and returns a safe copy, or null when
 * there is nothing worth keeping. Never throws — a bad log must not fail a
 * lesson save.
 */
export function sanitizeRunLog(value: unknown): RunLogEntry[] | null {
  try {
    if (!Array.isArray(value)) return null;
    const kept: RunLogEntry[] = [];
    for (const item of value.slice(0, MAX_STORED_LOG_ENTRIES)) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const message = cleanText(row.message, 500);
      if (!message) continue;
      const kind =
        row.kind === "stage" ||
        row.kind === "scene" ||
        row.kind === "done" ||
        row.kind === "error"
          ? row.kind
          : "stage";
      const entry: RunLogEntry = { message, kind };
      const at = cleanText(row.at, 16);
      if (at) entry.at = at;
      const stage = cleanText(row.stage, 40);
      if (stage) entry.stage = stage;
      const provider = cleanText(row.provider, 40);
      if (provider) entry.provider = provider;
      const model = cleanText(row.model, 120);
      if (model) entry.model = model;
      if (typeof row.elapsedMs === "number" && Number.isFinite(row.elapsedMs)) {
        entry.elapsedMs = Math.max(0, Math.round(row.elapsedMs));
      }
      kept.push(entry);
    }
    return kept.length > 0 ? kept : null;
  } catch {
    return null;
  }
}
