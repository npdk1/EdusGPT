import { NextResponse, type NextRequest } from "next/server";
import { buildStandaloneHtml } from "@/lib/lesson/export-html";
import { coerceLesson } from "@/lib/lesson/validate";
import { slugify } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Compiles a lesson into one self-contained HTML file — one page, no server, and
 * bidirectional scrubbing plus A→B looping kept intact.
 */
export async function POST(request: NextRequest) {
  let body: { lesson?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body phải là JSON." }, { status: 400 });
  }

  const lesson = coerceLesson(body.lesson);
  if (!lesson) {
    return NextResponse.json(
      { error: "Dữ liệu bài giảng không hợp lệ." },
      { status: 400 },
    );
  }

  const html = buildStandaloneHtml({ lesson });
  const filename = `${slugify(lesson.title) || "bai-giang"}.html`;

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
