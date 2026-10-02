import { NextResponse, type NextRequest } from "next/server";
import { searchSlideImage } from "@/lib/server/images";
import { clientKey, rateLimit, rejectRemote } from "@/lib/server/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUERY = 120;

/** Looks up a real, licensed image from the open web. Never generates one. */
export async function GET(request: NextRequest) {
  const remote = rejectRemote(request);
  if (remote) return remote;

  const limit = rateLimit(clientKey(request, "images"), 60, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Quá nhiều lần tìm ảnh. Thử lại sau ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length < 3) {
    return NextResponse.json({ error: "Cần từ khoá tìm ảnh." }, { status: 400 });
  }

  try {
    // No hit is a normal answer, not an error: the slide renders without a photo.
    const images = await searchSlideImage(query.slice(0, MAX_QUERY));
    return NextResponse.json({ ok: true, query, images });
  } catch (error) {
    return NextResponse.json(
      { ok: false, images: [], error: error instanceof Error ? error.message : "Lỗi tìm ảnh." },
      { status: 502 },
    );
  }
}
