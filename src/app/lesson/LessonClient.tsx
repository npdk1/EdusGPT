"use client";

import { useEffect, useState } from "react";
import { ChevronDown, LoaderCircle } from "lucide-react";
import type { Lesson } from "@/lib/lesson/types";
import type { RunLogEntry } from "@/lib/lesson/run-log";
import { RunLog } from "@/components/studio/GenerationTimeline";
import { LessonPlayer } from "@/components/player/LessonPlayer";
import { SAMPLE_LESSON, SAMPLE_LESSONS } from "@/lib/lesson/sample-lesson";
import { loadStoredLessons } from "@/lib/lesson/storage";
import { useCopy } from "@/i18n/provider";

const COPY = {
  en: {
    lessonLoading: "Loading lesson from the library…",
    lessonLocalOnly:
      "This lesson is not on the server yet, so the copy in your browser is open. Press \"Save to library\" on the create page to keep it.",
    lessonMissing: "This lesson was not found in the library.",
    lessonLoadFailed: "The lesson could not be loaded from the server.",
    lessonSampleNotice: "Showing a sample lesson instead.",
    lessonLogTitle: "Generation log ({count} lines)",
  },
  vi: {
    lessonLoading: "Đang tải bài từ thư viện…",
    lessonLocalOnly:
      "Bài này chưa được lưu lên máy chủ, đang mở bản trong trình duyệt. Bấm \"Lưu vào thư viện\" ở trang tạo bài để giữ lâu dài.",
    lessonMissing: "Không tìm thấy bài này trong thư viện.",
    lessonLoadFailed: "Không tải được bài từ máy chủ.",
    lessonSampleNotice: "Đang hiển thị bài mẫu thay thế.",
    lessonLogTitle: "Nhật ký tạo bài ({count} dòng)",
  },
};

/** Fills the one `{count}` slot in the run-log label. */
function logTitle(copy: string, count: number): string {
  return copy.replace("{count}", String(count));
}

/**
 * Why the lesson could not be fetched, kept as a dictionary key rather than a
 * sentence: a language switch then re-reads the message instead of leaving the
 * previous language on screen until the next fetch.
 */
type LoadErrorKey = keyof typeof COPY.en;

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
  const t = useCopy(COPY);
  const [lesson, setLesson] = useState<Lesson>(SAMPLE_LESSON);
  const [loading, setLoading] = useState(Boolean(courseId));
  const [loadError, setLoadError] = useState<LoadErrorKey | null>(null);
  /** The run log saved with the lesson, shown behind a toggle below. */
  const [runLog, setRunLog] = useState<RunLogEntry[]>([]);
  const [logOpen, setLogOpen] = useState(false);

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
            setLoadError("lessonLocalOnly");
            return;
          }
          setLoadError("lessonMissing");
          setLesson(SAMPLE_LESSON);
          return;
        }
        const payload = (await response.json()) as { lesson?: Lesson; log?: RunLogEntry[] };
        if (!cancelled && payload.lesson) setLesson(payload.lesson);
        if (!cancelled && Array.isArray(payload.log)) setRunLog(payload.log);
      } catch {
        if (!cancelled) setLoadError("lessonLoadFailed");
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
        <LoaderCircle className="h-4 w-4 animate-spin" /> {t.lessonLoading}
      </p>
    );
  }

  return (
    // A column, so the player can take the height the page hands it and the run
    // log below it can be capped rather than pushing the stage off the screen.
    <div className="flex min-h-0 flex-1 flex-col">
      {loadError ? (
        <p className="mb-4 rounded-xl border border-gold-500/40 bg-gold-500/[0.08] px-3.5 py-2.5 text-sm text-mist-100">
          {t[loadError]} {t.lessonSampleNotice}
        </p>
      ) : null}
      <LessonPlayer
        initialLesson={lesson}
        samples={SAMPLE_LESSONS.filter((item) => item.id !== lesson.id)}
      />
      {runLog.length > 0 ? (
        <div className="panel mt-4 p-4 lg:max-h-[28vh] lg:overflow-y-auto">
          <button
            type="button"
            onClick={() => setLogOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-2 text-left"
            aria-expanded={logOpen}
          >
            <span className="text-sm font-semibold text-mist-100">
              {logTitle(t.lessonLogTitle, runLog.length)}
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-mist-400 transition-transform ${logOpen ? "rotate-180" : ""}`}
            />
          </button>
          {logOpen ? <RunLog log={runLog} /> : null}
        </div>
      ) : null}
    </div>
  );
}
