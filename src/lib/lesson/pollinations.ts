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

export function pollinationsImageUrl(
  lessonId: string,
  sceneId: string,
  prompt: string,
): string {
  const seed = hashSeed(`${lessonId} ${sceneId}`);
  const params = new URLSearchParams({
    width: "1024",
    height: "640",
    seed: String(seed),
    nologo: "true",
    model: "flux",
  });
  return `${POLLINATIONS_BASE}/${encodeURIComponent(prompt.trim())}?${params.toString()}`;
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
