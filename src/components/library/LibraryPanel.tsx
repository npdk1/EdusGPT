"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Clock,
  FolderOpen,
  LoaderCircle,
  Play,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCopy } from "@/i18n/provider";

/**
 * The screen's own sentences, in both languages.
 *
 * A sentence that needs a number keeps it beside the words — a `{n}` placeholder
 * in a string, a second expression in JSX — so one key still reads correctly for
 * one scene and for forty.
 */
const COPY = {
  en: {
    libraryInLibrary: "lessons in the library",
    libraryRefresh: "Refresh",
    libraryDeleteAll: "Delete all",
    libraryDeleteAllTitle: "Delete every lesson in the library",
    libraryDeleteAllConfirm: "Delete all {n} lessons in the library? This cannot be undone.",
    libraryNewLesson: "New lesson",
    libraryCreating: "Creating",
    libraryScenes: "scenes",
    libraryCreateFailed: "Lesson creation failed",
    libraryStoppedHint: "It may have stopped (the server shut down mid-run)",
    libraryViewProgressTitle: "Open the live session to watch and listen to each scene",
    libraryViewProgress: "View progress",
    libraryDeleteDraft: "Delete draft {title}",
    libraryDeleteCourse: "Delete {title}",
    libraryJustNow: "just now",
    libraryMinutesAgo: "{n} minutes ago",
    libraryHoursAgo: "{n} hours ago",
    libraryDaysAgo: "{n} days ago",
    libraryLoadFailed: "The library could not be loaded.",
    libraryNetworkError: "Network error.",
    libraryDeleteLessonFailed: "The lesson could not be deleted.",
    libraryDeleteLibraryFailed: "The library could not be cleared.",
    libraryLoading: "Loading the library…",
    libraryEmptyTitle: "The library is empty",
    libraryEmptyWhere: "Lessons you generate are saved here, in",
    libraryEmptyKeep:
      ". Nothing is lost when you change browser or clear browser data.",
    libraryCreateFirst: "Create your first lesson",
    librarySample: "sample",
    libraryOpen: "Open",
  },
  vi: {
    libraryInLibrary: "bài trong thư viện",
    libraryRefresh: "Làm mới",
    libraryDeleteAll: "Xoá hết",
    libraryDeleteAllTitle: "Xoá toàn bộ bài trong thư viện",
    libraryDeleteAllConfirm:
      "Xoá hết {n} bài trong thư viện? Không khôi phục được.",
    libraryNewLesson: "Sinh bài mới",
    libraryCreating: "Đang tạo",
    libraryScenes: "cảnh",
    libraryCreateFailed: "Tạo bài thất bại",
    libraryStoppedHint: "Có thể đã dừng (máy chủ tắt giữa chừng)",
    libraryViewProgressTitle: "Mở phòng học để xem và nghe từng cảnh",
    libraryViewProgress: "Xem tiến độ",
    libraryDeleteDraft: "Xoá bản nháp {title}",
    libraryDeleteCourse: "Xoá {title}",
    libraryJustNow: "vừa xong",
    libraryMinutesAgo: "{n} phút trước",
    libraryHoursAgo: "{n} giờ trước",
    libraryDaysAgo: "{n} ngày trước",
    libraryLoadFailed: "Không tải được thư viện.",
    libraryNetworkError: "Lỗi mạng.",
    libraryDeleteLessonFailed: "Không xoá được bài.",
    libraryDeleteLibraryFailed: "Không xoá được thư viện.",
    libraryLoading: "Đang tải thư viện…",
    libraryEmptyTitle: "Thư viện còn trống",
    libraryEmptyWhere: "Bài bạn sinh sẽ được lưu ở đây, trong",
    libraryEmptyKeep:
      ". Không mất khi đổi trình duyệt hay xoá dữ liệu trình duyệt.",
    libraryCreateFirst: "Đi sinh bài đầu tiên",
    librarySample: "mẫu",
    libraryOpen: "Mở",
  },
} satisfies Record<string, Record<string, string>>;

type LibraryCopy = (typeof COPY)["en"];

interface CourseSummary {
  id: string;
  title: string;
  subject: string;
  grade?: string;
  sceneCount: number;
  duration: number;
  updatedAt: string;
  source: "sample" | "gemini";
  model?: string;
}

/** A lesson still being written — shown as a "Creating…" card, not nothing. */
interface DraftInfo {
  id: string;
  title: string;
  subject: string;
  total: number;
  done: number;
  message: string;
  updatedAt: string;
  error?: string;
}

/** A draft older than this with no error is a run the server did not finish. */
const STALE_DRAFT_MS = 15 * 60 * 1000;

function draftState(draft: DraftInfo): "failed" | "stale" | "running" {
  if (draft.error) return "failed";
  if (Date.now() - new Date(draft.updatedAt).getTime() > STALE_DRAFT_MS) {
    return "stale";
  }
  return "running";
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function relative(iso: string, t: LibraryCopy): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return t.libraryJustNow;
  if (minutes < 60) return t.libraryMinutesAgo.replace("{n}", String(minutes));
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t.libraryHoursAgo.replace("{n}", String(hours));
  return t.libraryDaysAgo.replace("{n}", String(Math.round(hours / 24)));
}

/** Server-backed course library — survives a browser reinstall. */
export function LibraryPanel() {
  const t = useCopy(COPY);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [drafts, setDrafts] = useState<DraftInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const response = await fetch("/api/courses", { cache: "no-store" });
      const payload = (await response.json()) as {
        ok?: boolean;
        courses?: CourseSummary[];
        drafts?: DraftInfo[];
        error?: string;
      };
      if (!response.ok) {
        if (!quiet) setError(payload.error ?? t.libraryLoadFailed);
        return;
      }
      setCourses(payload.courses ?? []);
      setDrafts(payload.drafts ?? []);
    } catch (caught) {
      if (!quiet) {
        setError(caught instanceof Error ? caught.message : t.libraryNetworkError);
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  // While anything is being written, re-read quietly so the draft card's
  // progress bar moves without flashing the whole library.
  useEffect(() => {
    if (drafts.length === 0) return;
    const timer = window.setInterval(() => {
      void load(true);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [drafts.length, load]);

  const remove = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      const response = await fetch(`/api/courses?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? t.libraryDeleteLessonFailed);
        return;
      }
      // Failed lessons are drafts, not courses: filter both or the card stays
      // until the next reload, which is exactly the reported bug.
      setCourses((current) => current.filter((item) => item.id !== id));
      setDrafts((current) => current.filter((item) => item.id !== id));
    } finally {
      setBusyId(null);
    }
  }, [t]);

  const removeAll = useCallback(async () => {
    if (
      !window.confirm(
        t.libraryDeleteAllConfirm.replace("{n}", String(courses.length)),
      )
    ) {
      return;
    }
    setClearing(true);
    setError(null);
    try {
      const response = await fetch("/api/courses?all=true", {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? t.libraryDeleteLibraryFailed);
        return;
      }
      setCourses([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.libraryNetworkError);
    } finally {
      setClearing(false);
    }
  }, [courses.length, t]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-mist-400">
          <FolderOpen className="h-4 w-4 text-brand-300" />
          {courses.length} {t.libraryInLibrary}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className="btn-ghost">
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t.libraryRefresh}
          </button>
          {courses.length > 0 ? (
            <button
              type="button"
              onClick={() => void removeAll()}
              disabled={clearing || loading}
              className="btn-ghost"
              title={t.libraryDeleteAllTitle}
            >
              {clearing ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {t.libraryDeleteAll}
            </button>
          ) : null}
          <Link href="/studio" className="btn-primary">
            <Sparkles className="h-4 w-4" /> {t.libraryNewLesson}
          </Link>
        </div>
      </div>

      {drafts.map((draft) => {
        const state = draftState(draft);
        const percent =
          draft.total > 0 ? Math.round((draft.done / draft.total) * 100) : 0;
        return (
          <div
            key={draft.id}
            className="rounded-xl border border-gold-500/40 bg-gold-500/[0.06] p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-mist-50">
                  {state === "running" ? (
                    <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-gold-300" />
                  ) : (
                    <BookOpen className="h-4 w-4 shrink-0 text-mist-400" />
                  )}
                  <span className="truncate">{draft.title}</span>
                </p>
                <p className="mt-0.5 text-xs text-mist-400">
                  {state === "running" ? (
                    <>
                      {t.libraryCreating} {draft.done}/{draft.total} {t.libraryScenes}
                    </>
                  ) : state === "failed" ? (
                    t.libraryCreateFailed
                  ) : (
                    t.libraryStoppedHint
                  )}
                  {draft.subject ? ` · ${draft.subject}` : ""}
                  {` · ${relative(draft.updatedAt, t)}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {state === "running" ? (
                  <Link
                    // The classroom, not the builder: it is the screen that
                    // shows this run's progress. With no live stream in this tab
                    // it polls the draft, so the link works from anywhere.
                    href={`/classroom?id=${encodeURIComponent(draft.id)}`}
                    className="btn-ghost px-3 py-1.5 text-xs"
                    title={t.libraryViewProgressTitle}
                  >
                    {t.libraryViewProgress}
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => void remove(draft.id)}
                  disabled={busyId === draft.id}
                  className="btn-icon"
                  aria-label={t.libraryDeleteDraft.replace("{title}", draft.title)}
                >
                  {busyId === draft.id ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            {state === "running" ? (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-400 to-gold-400 transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.max(2, percent)}%` }}
                />
              </div>
            ) : null}
            <p className="mt-1.5 text-xs text-mist-400">
              {state === "failed" ? draft.error : draft.message}
            </p>
          </div>
        );
      })}

      {error ? (
        <p className="rounded-xl border border-ember-500/50 bg-ember-500/10 px-3.5 py-2.5 text-sm text-mist-100">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 py-10 text-sm text-mist-400">
          <LoaderCircle className="h-4 w-4 animate-spin" /> {t.libraryLoading}
        </p>
      ) : courses.length === 0 ? (
        <div className="panel p-8 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-mist-500" />
          <p className="mt-3 font-semibold text-mist-100">{t.libraryEmptyTitle}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-mist-400">
            {t.libraryEmptyWhere}{" "}
            <code className="font-mono text-gold-200">data/courses/</code>
            {t.libraryEmptyKeep}
          </p>
          <Link href="/studio" className="btn-primary mt-4">
            <Sparkles className="h-4 w-4" /> {t.libraryCreateFirst}
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <li key={course.id} className="panel flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-mist-50">{course.title}</h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    course.source === "gemini"
                      ? "bg-brand-500/15 text-brand-200"
                      : "bg-ink-700 text-mist-300"
                  }`}
                >
                  {course.source === "gemini" ? "AI" : t.librarySample}
                </span>
              </div>

              <p className="text-xs text-mist-400">
                {course.subject}
                {course.grade ? ` · ${course.grade}` : ""}
              </p>

              <p className="flex items-center gap-3 font-mono text-[11px] text-mist-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatClock(course.duration)}
                </span>
                <span>
                  {course.sceneCount} {t.libraryScenes}
                </span>
                <span>{relative(course.updatedAt, t)}</span>
              </p>

              <div className="mt-auto flex gap-2 pt-1">
                <Link
                  href={`/lesson?c=${encodeURIComponent(course.id)}`}
                  className="btn-primary flex-1 px-3 py-1.5 text-xs"
                >
                  <Play className="h-3.5 w-3.5" /> {t.libraryOpen}
                </Link>
                <button
                  type="button"
                  onClick={() => void remove(course.id)}
                  disabled={busyId === course.id}
                  className="btn-icon"
                  aria-label={t.libraryDeleteCourse.replace("{title}", course.title)}
                >
                  {busyId === course.id ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
