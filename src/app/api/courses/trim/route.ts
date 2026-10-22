import { NextResponse, type NextRequest } from "next/server";
import { isLocalRequest } from "@/lib/ai/config";
import { isValidCourseId, trimCourseContent } from "@/lib/server/course-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function guard(request: NextRequest): NextResponse | null {
  return isLocalRequest(request.headers.get("host"))
    ? null
    : NextResponse.json(
        { error: "Thư viện chỉ truy cập được qua localhost." },
        { status: 403 },
      );
}

export async function POST(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  let body: { id?: string; keepQuiz?: boolean; keepFlashcards?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body phải là JSON." }, { status: 400 });
  }

  if (!body.id || !isValidCourseId(body.id)) {
    return NextResponse.json({ error: "Id bài giảng không hợp lệ." }, { status: 400 });
  }

  const trimmed = await trimCourseContent(body.id, {
    keepQuiz: body.keepQuiz !== false,
    keepFlashcards: body.keepFlashcards !== false,
  });

  if (!trimmed) {
    return NextResponse.json({ error: "Không tìm thấy bài giảng để tối ưu." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, lesson: trimmed });
}
