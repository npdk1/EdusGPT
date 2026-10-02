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

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "chưa có";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "chưa có";
  const diffSeconds = Math.round((Date.now() - then) / 1000);
  if (diffSeconds < 5) return "vừa xong";
  if (diffSeconds < 60) return `${diffSeconds} giây trước`;
  const minutes = Math.round(diffSeconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  return `${days} ngày trước`;
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
