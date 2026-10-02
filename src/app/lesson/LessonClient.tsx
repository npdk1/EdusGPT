"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { Lesson } from "@/lib/lesson/types";
import { LessonPlayer } from "@/components/player/LessonPlayer";
import { SAMPLE_LESSON, SAMPLE_LESSONS } from "@/lib/lesson/sample-lesson";
import { loadStoredLessons } from "@/lib/lesson/storage";

interface LessonClientProps {
  /** Resolved on the server from `?c=<id>`; null on the plain /lesson route. */
  courseId: string | null;
}

/**
 * The player is a client island because it must fetch a library course by id.
 * The id itself is resolved on the server, so the player still renders
 * server-side on the plain `/lesson` route — using `useSearchParams` here would
 * force the whole player behind a Suspense fallback on first paint.
 */
export default function LessonClient({ courseId }: LessonClientProps) {
  const [lesson, setLesson] = useState<Lesson>(SAMPLE_LESSON);
  const [loading, setLoading] = useState(Boolean(courseId));
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) {
      setLesson(SAMPLE_LESSON);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    void (async () => {
      try {
        const response = await fetch(`/api/courses?id=${encodeURIComponent(courseId)}`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (response.status === 404) {
          // Not on the server yet — it may still be in this browser, for
          // instance a lesson generated moments ago whose save has not landed.
          // Falling straight through to the sample used to show Newton's law in
          // place of the Python lesson the teacher had just created.
          const local = loadStoredLessons().find((item) => item.id === courseId);
          if (local) {
            setLesson(local);
            setLoadError(
              "Bài này chưa được lưu lên máy chủ, đang mở bản trong trình duyệt. " +
                "Bấm \"Lưu vào thư viện\" ở trang tạo bài để giữ lâu dài.",
            );
            return;
          }
          setLoadError("Không tìm thấy bài này trong thư viện.");
          setLesson(SAMPLE_LESSON);
          return;
        }
        const payload = (await response.json()) as { lesson?: Lesson };
        if (!cancelled && payload.lesson) setLesson(payload.lesson);
      } catch {
        if (!cancelled) setLoadError("Không tải được bài từ máy chủ.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  if (loading) {
    return (
      <p className="panel flex items-center gap-2 p-10 text-sm text-mist-400">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Đang tải bài từ thư viện…
      </p>
    );
  }

  return (
    <>
      {loadError ? (
        <p className="mb-4 rounded-xl border border-gold-500/40 bg-gold-500/[0.08] px-3.5 py-2.5 text-sm text-mist-100">
          {loadError} Đang hiển thị bài mẫu thay thế.
        </p>
      ) : null}
      <LessonPlayer
        initialLesson={lesson}
        samples={SAMPLE_LESSONS.filter((item) => item.id !== lesson.id)}
      />
    </>
  );
}
