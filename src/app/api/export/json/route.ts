import { NextResponse, type NextRequest } from "next/server";
import { coerceLesson } from "@/lib/lesson/validate";
import { slugify } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Round-trips a lesson as plain JSON: easy to edit by hand or feed to a renderer. */
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

  const filename = `${slugify(lesson.title) || "bai-giang"}.lesson.json`;
  const payload = `${JSON.stringify(
    { format: "eduai-studio/lesson@1", exportedAt: new Date().toISOString(), lesson },
    null,
    2,
  )}\n`;

  return new NextResponse(payload, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
