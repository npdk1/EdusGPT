/**
 * AI illustration URLs (pollinations.ai, no key needed).
 *
 * When a scene carries `imagePrompt`, the player does not search the open
 * image archive — it asks pollinations.ai to render that prompt. The seed is
 * derived from the lesson plus the scene, so the same slide always gets the
 * same picture back: scrubbing back and forth never re-rolls the image.
 */

const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt";

/** djb2, kept local so the seed never depends on an import that can drift. */
function hashSeed(text: string): number {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Clean and enrich prompt to maximize Pollinations AI image quality.
 * Strips formatting artifacts and ensures clear negative prompt safeguards for educational slides.
 */
export function enrichImagePrompt(prompt: string): string {
  let cleaned = prompt.trim();
  // Strip enclosing quotes if model returned them
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  // Strip trailing punctuation
  cleaned = cleaned.replace(/[.]+$/, "").trim();

  // Ensure negative prompt safeguards against bad text rendering
  const lower = cleaned.toLowerCase();
  if (
    !lower.includes("no text") &&
    !lower.includes("no words") &&
    !lower.includes("no letters")
  ) {
    cleaned += ", no text, no watermark, clean composition";
  }
  return cleaned;
}

export interface PollinationsOptions {
  width?: number;
  height?: number;
  seed?: number | string;
  enhance?: boolean;
  model?: string;
  nologo?: boolean;
  safe?: boolean;
}

export function pollinationsImageUrl(
  lessonId: string,
  sceneId: string,
  prompt: string,
  options?: PollinationsOptions,
): string {
  const seed =
    options?.seed !== undefined
      ? typeof options.seed === "number"
        ? options.seed
        : hashSeed(String(options.seed))
      : hashSeed(`${lessonId} ${sceneId}`);

  const enrichedPrompt = enrichImagePrompt(prompt);

  const params = new URLSearchParams({
    width: String(options?.width ?? 1024),
    height: String(options?.height ?? 576), // 16:9 widescreen ratio matching slide player
    seed: String(seed),
    nologo: options?.nologo !== false ? "true" : "false",
    model: options?.model ?? "turbo",
    enhance: options?.enhance !== false ? "true" : "false", // LLM prompt expansion enabled for rich lighting, angle & details
  });

  if (options?.safe !== false) {
    params.set("safe", "true");
  }

  return `${POLLINATIONS_BASE}/${encodeURIComponent(enrichedPrompt)}?${params.toString()}`;
}

/**
 * `#rrggbb` to the `r,g,b` triple the stage's `--pointer-rgb` variable wants.
 * Anything malformed falls back to amber, the colour the pointer has always
 * been — a bad setting must never leave the teacher with no pointer at all.
 */
export function pointerColorToRgb(color: unknown): string {
  const fallback = "245,158,11";
  if (typeof color !== "string") return fallback;
  const match = /^#([0-9a-fA-F]{6})$/.exec(color.trim());
  if (!match) return fallback;
  const hex = match[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `${r},${g},${b}`;
}
