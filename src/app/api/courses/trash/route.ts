import { type NextRequest, NextResponse } from "next/server";
import {
  listTrashCourses,
  restoreCourseFromTrash,
  deleteTrashItemPermanently,
  emptyTrash,
  readTrashCourse,
} from "@/lib/server/course-store";

function guard(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return null;
  try {
    const originUrl = new URL(origin);
    if (originUrl.host !== host) {
      return NextResponse.json(
        { error: "Forbidden cross-origin request." },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid origin." }, { status: 400 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const downloadId = searchParams.get("download");

  if (downloadId) {
    const lesson = await readTrashCourse(downloadId);
    if (!lesson) {
      return NextResponse.json({ error: "Không tìm thấy bài trong thùng rác" }, { status: 404 });
    }
    return new NextResponse(JSON.stringify(lesson, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(lesson.title || "backup")}.json"`,
      },
    });
  }

  const trash = await listTrashCourses();
  return NextResponse.json(
    { ok: true, trash, total: trash.length },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  let body: { action?: string; id?: string; fileName?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON không hợp lệ." }, { status: 400 });
  }

  const target = body.fileName || body.id;
  if (!target) {
    return NextResponse.json({ error: "Thiếu id hoặc fileName bài giảng cần khôi phục." }, { status: 400 });
  }

  if (body.action === "restore") {
    const restored = await restoreCourseFromTrash(target);
    if (!restored) {
      return NextResponse.json({ error: "Không thể khôi phục bài giảng này (có thể đã bị xóa hẳn hoặc không tìm thấy)." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, action: "restore", lesson: restored });
  }

  return NextResponse.json({ error: "Action không hợp lệ." }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  if (searchParams.get("all") === "true") {
    const count = await emptyTrash();
    return NextResponse.json({ ok: true, purged: count });
  }

  const target = searchParams.get("fileName") || searchParams.get("id");
  if (!target) {
    return NextResponse.json({ error: "Thiếu id hoặc fileName cần xóa." }, { status: 400 });
  }

  const removed = await deleteTrashItemPermanently(target);
  if (!removed) {
    return NextResponse.json({ error: "Không tìm thấy bài giảng trong thùng rác." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, removed: true });
}
