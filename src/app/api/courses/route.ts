import { NextResponse, type NextRequest } from "next/server";
import { isLocalRequest, publicAiStatus } from "@/lib/ai/config";
import {
  deleteAllCourses,
  deleteCourse,
  isValidCourseId,
  listCourses,
  readCourse,
  renameCourse,
  saveCourse,
} from "@/lib/server/course-store";
import { coerceLesson } from "@/lib/lesson/validate";
import { newLessonId } from "@/lib/lesson/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The library is local-only, same rule as the key store. */
function guard(request: NextRequest): NextResponse | null {
  return isLocalRequest(request.headers.get("host"))
    ? null
    : NextResponse.json(
        { error: "Thư viện chỉ truy cập được qua localhost." },
        { status: 403 },
      );
}

export async function GET(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    if (!isValidCourseId(id)) {
      return NextResponse.json({ error: "Id không hợp lệ." }, { status: 400 });
    }
    const lesson = await readCourse(id);
    if (!lesson) {
      return NextResponse.json({ error: "Không tìm thấy bài." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, lesson });
  }

  return NextResponse.json(
    { ok: true, courses: await listCourses() },
    { headers: { "cache-control": "no-store" } },
  );
}

/** Create or overwrite a course. */
export async function POST(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  let body: { lesson?: unknown; title?: string };
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

  if (!isValidCourseId(lesson.id)) lesson.id = newLessonId();
  if (body.title?.trim()) lesson.title = body.title.trim().slice(0, 200);

  await saveCourse(lesson);
  return NextResponse.json({ ok: true, id: lesson.id, lesson });
}

/** Rename without resending the whole lesson. */
export async function PATCH(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  let body: { id?: string; title?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body phải là JSON." }, { status: 400 });
  }

  if (!body.id || !body.title) {
    return NextResponse.json({ error: "Thiếu id hoặc title." }, { status: 400 });
  }

  const lesson = await renameCourse(body.id, body.title);
  if (!lesson) {
    return NextResponse.json({ error: "Không tìm thấy bài." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, lesson });
}

export async function DELETE(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  if (params.get("all") === "true") {
    const removed = await deleteAllCourses();
    return NextResponse.json({ ok: true, removed, ai: await publicAiStatus() });
  }

  const id = params.get("id") ?? undefined;
  if (!id) {
    return NextResponse.json({ error: "Thiếu id." }, { status: 400 });
  }

  const removed = await deleteCourse(id);
  if (!removed) {
    return NextResponse.json({ error: "Không tìm thấy bài." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ai: await publicAiStatus() });
}
