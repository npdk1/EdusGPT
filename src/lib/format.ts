/** Timecode helpers — one place, so the scrubber and the player agree. */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** `01:23.4` for humans, `00:01:23.13` when frame stepping matters. */
export function formatClock(seconds: number, withFrames = false, fps = 30): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const totalSeconds = Math.floor(safe);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const tenths = Math.floor((safe - totalSeconds) * 10);

  if (withFrames) {
    const frames = Math.floor((safe - totalSeconds) * fps);
    const base = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    return `${base}.${String(frames).padStart(2, "0")}`;
  }

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
}

/**
 * "3 minutes ago", in the language on screen.
 *
 * Vietnamese counts the way it likes to and English does not need the
 * distinction, so each language gets its own sentences rather than one set of
 * fragments stitched together. Defaults to English — the primary language.
 */
export function formatRelativeTime(
  iso: string | null | undefined,
  lang: "en" | "vi" = "en",
): string {
  const vi = lang === "vi";
  if (!iso) return vi ? "chưa có" : "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return vi ? "chưa có" : "never";
  const diffSeconds = Math.round((Date.now() - then) / 1000);
  if (diffSeconds < 5) return vi ? "vừa xong" : "just now";
  const seconds = vi ? `${diffSeconds} giây trước` : `${diffSeconds}s ago`;
  if (diffSeconds < 60) return seconds;
  const minutes = Math.round(diffSeconds / 60);
  if (minutes < 60) return vi ? `${minutes} phút trước` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return vi ? `${hours} giờ trước` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return vi ? `${days} ngày trước` : `${days}d ago`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
