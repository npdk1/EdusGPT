import { NextResponse, type NextRequest } from "next/server";
import { isLocalRequest } from "@/lib/ai/config";

export const LOCAL_ONLY_MESSAGE =
  "Chỉ chạy được trên máy của bạn. Nếu cần truy cập từ máy khác, tự đặt " +
  "ALLOW_REMOTE_KEY_ADMIN=true và hiểu rằng API key sẽ không còn được bảo vệ.";

/**
 * Rejects anything that is not a local caller.
 *
 * The Host header is not evidence — the client chooses it, so `Host: localhost`
 * satisfies any check built on it. The real control is binding the server to the
 * loopback interface (`next dev -H 127.0.0.1`, which `npm run dev` now does).
 * This is defence in depth, and it also stops a reverse proxy that forwards a
 * LAN request into a loopback-bound port.
 */
export function rejectRemote(request: NextRequest): NextResponse | null {
  if (isLocalRequest(request.headers.get("host"))) return null;
  return NextResponse.json({ error: LOCAL_ONLY_MESSAGE }, { status: 403 });
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
/** Keeps the map from growing without bound on a long-lived dev server. */
const MAX_TRACKED_KEYS = 500;

/**
 * A fixed-window limiter, in memory, per process.
 *
 * Not a substitute for a real rate limiter, but enough to stop one misbehaving
 * client from draining the AI quota or pinning the single TTS socket.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();

  // Opportunistic sweep; cheaper than maintaining an ordered structure.
  if (buckets.size > MAX_TRACKED_KEYS) {
    for (const [id, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(id);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Best-effort client identity for rate limiting; never a security boundary. */
export function clientKey(request: NextRequest, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return `${scope}:${ip}`;
}
