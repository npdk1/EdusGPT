import { NextResponse, type NextRequest } from "next/server";
import { isLocalRequest, publicAiStatus } from "@/lib/ai/config";
import {
  deleteAllCourses,
  deleteCourse,
  deleteDraft,
  isValidCourseId,
  listCourses,
  listDrafts,
  readCourse,
  readCourseLog,
  renameCourse,
  saveCourse,
  softDeleteCourse,
  trimCourseContent,
} from "@/lib/server/course-store";
import { coerceLesson } from "@/lib/lesson/validate";
import { sanitizeRunLog } from "@/lib/lesson/run-log";
import { newLessonId } from "@/lib/lesson/types";
import { normalizeVietnameseSearch } from "@/lib/format";

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

  const searchParams = new URL(request.url).searchParams;
  const id = searchParams.get("id");
  if (id) {
    if (!isValidCourseId(id)) {
      return NextResponse.json({ error: "Id không hợp lệ." }, { status: 400 });
    }
    const lesson = await readCourse(id);
    if (!lesson) {
      return NextResponse.json({ error: "Không tìm thấy bài." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, lesson, log: await readCourseLog(id) });
  }

  const allCourses = await listCourses();
  const qParam = searchParams.get("q") || searchParams.get("search");
  let filteredCourses = allCourses;

  if (qParam && qParam.trim()) {
    const term = normalizeVietnameseSearch(qParam);
    filteredCourses = allCourses.filter((course) => {
      const matchTitle = normalizeVietnameseSearch(course.title).includes(term);
      const matchSubject = normalizeVietnameseSearch(course.subject || "").includes(term);
      const matchGrade = normalizeVietnameseSearch(course.grade || "").includes(term);
      return matchTitle || matchSubject || matchGrade;
    });
  }

  const totalCourses = filteredCourses.length;
  const pageParam = searchParams.get("page");
  const limitParam = searchParams.get("limit");
  const allParam = searchParams.get("all");

  // If "all=true" is explicitly requested, return courses unpaginated
  if (allParam === "true" && !pageParam) {
    return NextResponse.json(
      {
        ok: true,
        courses: filteredCourses,
        total: totalCourses,
        page: 1,
        limit: totalCourses,
        totalPages: 1,
        drafts: await listDrafts(),
      },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const limit = Math.max(1, parseInt(limitParam || "9", 10) || 9);
  const totalPages = Math.max(1, Math.ceil(totalCourses / limit));
  const page = Math.min(totalPages, Math.max(1, parseInt(pageParam || "1", 10) || 1));
  const startIdx = (page - 1) * limit;
  const pagedCourses = filteredCourses.slice(startIdx, startIdx + limit);

  return NextResponse.json(
    {
      ok: true,
      courses: pagedCourses,
      total: totalCourses,
      page,
      limit,
      totalPages,
      drafts: await listDrafts(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/** Create or overwrite a course. */
export async function POST(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  let body: {
    lesson?: unknown;
    title?: string;
    log?: unknown;
    action?: string;
    id?: string;
    keepQuiz?: boolean;
    keepFlashcards?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body phải là JSON." }, { status: 400 });
  }

  // Handle trim action via POST
  if (body.action === "trim" && body.id) {
    if (!isValidCourseId(body.id)) {
      return NextResponse.json({ error: "Id không hợp lệ." }, { status: 400 });
    }
    const trimmed = await trimCourseContent(body.id, {
      keepQuiz: body.keepQuiz !== false,
      keepFlashcards: body.keepFlashcards !== false,
    });
    if (!trimmed) {
      return NextResponse.json({ error: "Không tìm thấy bài để tối ưu." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, action: "trim", lesson: trimmed });
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

  await saveCourse(lesson, sanitizeRunLog(body.log) ?? undefined);
  return NextResponse.json({ ok: true, id: lesson.id, lesson });
}

/** Rename or trim course without resending the whole lesson. */
export async function PATCH(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  let body: {
    id?: string;
    title?: string;
    action?: string;
    keepQuiz?: boolean;
    keepFlashcards?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body phải là JSON." }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "Thiếu id." }, { status: 400 });
  }

  if (body.action === "trim") {
    const trimmed = await trimCourseContent(body.id, {
      keepQuiz: body.keepQuiz !== false,
      keepFlashcards: body.keepFlashcards !== false,
    });
    if (!trimmed) {
      return NextResponse.json({ error: "Không tìm thấy bài để tối ưu." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, action: "trim", lesson: trimmed });
  }

  if (!body.title) {
    return NextResponse.json({ error: "Thiếu title." }, { status: 400 });
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

  const mode = params.get("mode") || "trash";

  if (mode === "permanent") {
    const removed = (await deleteCourse(id)) || (await deleteDraft(id));
    if (!removed) {
      return NextResponse.json({ error: "Không tìm thấy bài." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, mode: "permanent", ai: await publicAiStatus() });
  }

  // Default mode: soft delete to data/temp_delete/
  const softResult = await softDeleteCourse(id);
  if (softResult.ok) {
    return NextResponse.json({
      ok: true,
      mode: "trash",
      trashPath: softResult.path,
      ai: await publicAiStatus(),
    });
  }

  // Fallback to deleteDraft if it was just a draft
  const draftRemoved = await deleteDraft(id);
  if (draftRemoved) {
    return NextResponse.json({ ok: true, mode: "draft", ai: await publicAiStatus() });
  }

  return NextResponse.json({ error: "Không tìm thấy bài." }, { status: 404 });
}
