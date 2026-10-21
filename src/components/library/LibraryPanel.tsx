"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  FolderOpen,
  HelpCircle,
  LoaderCircle,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
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
    libraryQuiz: "Quiz",
    libraryQuizTitle: "Practice interactive quizzes for this lesson",
    libraryFlashcard: "Cards",
    libraryFlashcardTitle: "Quick flashcard revision for this lesson",
    libraryPrevPage: "Previous",
    libraryNextPage: "Next",
    libraryPageInfo: "Page {page} of {total} ({count} lessons)",
    librarySearchPlaceholder: "Smart search lessons (title, subject, grade, keywords)...",
    libraryClearSearch: "Clear search",
    librarySearchMatch: "Found {count} lessons matching \"{query}\"",
    libraryResetSearch: "Clear filter",
    librarySearchEmptyTitle: "No matching lessons found",
    librarySearchEmptyDesc: "No lessons matched \"{query}\". Try a different search term.",
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
    libraryQuiz: "Quiz",
    libraryQuizTitle: "Luyện trắc nghiệm tương tác cho bài học này",
    libraryFlashcard: "Thẻ",
    libraryFlashcardTitle: "Ôn tập bằng thẻ ghi nhớ Flashcard",
    libraryPrevPage: "Trang trước",
    libraryNextPage: "Trang sau",
    libraryPageInfo: "Trang {page} trên {total} (tổng {count} bài)",
    librarySearchPlaceholder: "Tìm kiếm thông minh bài giảng (tiêu đề, môn học, lớp, từ khóa, tiếng Việt không dấu)...",
    libraryClearSearch: "Xóa tìm kiếm",
    librarySearchMatch: "Tìm thấy {count} bài học phù hợp với \"{query}\"",
    libraryResetSearch: "Xóa bộ lọc",
    librarySearchEmptyTitle: "Không tìm thấy kết quả phù hợp",
    librarySearchEmptyDesc: "Không có bài học nào khớp với từ khóa \"{query}\". Bạn thử tìm từ khóa khác xem sao nhé.",
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
  voice?: string;
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
  const [totalCourses, setTotalCourses] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimerRef = useRef<number | null>(null);
  const [drafts, setDrafts] = useState<DraftInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async (targetPage = page, query = searchQuery, quiet = false) => {
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const qEncoded = encodeURIComponent(query.trim());
      const url = `/api/courses?page=${targetPage}&limit=9${qEncoded ? `&q=${qEncoded}` : ""}`;
      const response = await fetch(url, { cache: "no-store" });
      const payload = (await response.json()) as {
        ok?: boolean;
        courses?: CourseSummary[];
        total?: number;
        page?: number;
        totalPages?: number;
        drafts?: DraftInfo[];
        error?: string;
      };
      if (!response.ok) {
        if (!quiet) setError(payload.error ?? t.libraryLoadFailed);
        return;
      }
      setCourses(payload.courses ?? []);
      setTotalCourses(payload.total ?? payload.courses?.length ?? 0);
      setTotalPages(payload.totalPages ?? 1);
      if (typeof payload.page === "number") setPage(payload.page);
      setDrafts(payload.drafts ?? []);
    } catch (caught) {
      if (!quiet) {
        setError(caught instanceof Error ? caught.message : t.libraryNetworkError);
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [page, searchQuery, t]);

  useEffect(() => {
    void load(1, "");
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    searchTimerRef.current = window.setTimeout(() => {
      setPage(1);
      void load(1, value);
    }, 250);
  };

  const clearSearch = () => {
    setSearchQuery("");
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    setPage(1);
    void load(1, "");
  };

  // While anything is being written, re-read quietly so the draft card's
  // progress bar moves without flashing the whole library.
  useEffect(() => {
    if (drafts.length === 0) return;
    const timer = window.setInterval(() => {
      void load(page, searchQuery, true);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [drafts.length, load, page, searchQuery]);

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
      await load(page, searchQuery, true);
    } finally {
      setBusyId(null);
    }
  }, [load, page, searchQuery, t]);

  const removeAll = useCallback(async () => {
    if (
      !window.confirm(
        t.libraryDeleteAllConfirm.replace("{n}", String(totalCourses)),
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
      setTotalCourses(0);
      setTotalPages(1);
      setPage(1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.libraryNetworkError);
    } finally {
      setClearing(false);
    }
  }, [totalCourses, t]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-mist-400">
          <FolderOpen className="h-4 w-4 text-brand-300" />
          {totalCourses} {t.libraryInLibrary}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load(page)} className="btn-ghost">
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t.libraryRefresh}
          </button>
          {totalCourses > 0 ? (
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

      {/* Thanh dài tìm kiếm thông minh */}
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t.librarySearchPlaceholder}
          className="w-full rounded-2xl border border-ink-700 bg-ink-900/80 px-4 py-3 pl-11 pr-10 text-xs sm:text-sm text-mist-100 placeholder:text-mist-500 focus:border-brand-500 focus:bg-ink-900 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all shadow-inner"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg text-mist-400 hover:bg-ink-800 hover:text-mist-100"
            title={t.libraryClearSearch}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {searchQuery.trim() ? (
        <div className="flex items-center justify-between text-xs text-mist-400 px-1">
          <span>
            {t.librarySearchMatch
              .replace("{count}", String(totalCourses))
              .replace("{query}", searchQuery)}
          </span>
          <button
            type="button"
            onClick={clearSearch}
            className="text-brand-400 hover:underline"
          >
            {t.libraryResetSearch}
          </button>
        </div>
      ) : null}

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
                    href={`/classroom?id=${encodeURIComponent(draft.id)}${draft.voice ? `&voice=${encodeURIComponent(draft.voice)}` : ""}`}
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
        searchQuery.trim() ? (
          <div className="panel p-8 text-center">
            <Search className="mx-auto h-8 w-8 text-mist-500" />
            <p className="mt-3 font-semibold text-mist-100">{t.librarySearchEmptyTitle}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-mist-400">
              {t.librarySearchEmptyDesc.replace("{query}", searchQuery)}
            </p>
            <button
              type="button"
              onClick={clearSearch}
              className="btn-primary mt-4 inline-flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" /> {t.libraryResetSearch}
            </button>
          </div>
        ) : (
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
        )
      ) : (
        <>
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

              <div className="mt-auto flex items-center gap-1.5 pt-1">
                <Link
                  href={`/lesson?c=${encodeURIComponent(course.id)}`}
                  className="btn-primary flex-[1.6] min-w-0 justify-center px-2 py-1.5 text-xs font-semibold"
                  title={t.libraryOpen}
                >
                  <Play className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{t.libraryOpen}</span>
                </Link>
                <Link
                  href={`/quiz?c=${encodeURIComponent(course.id)}`}
                  className="inline-flex flex-1 min-w-0 items-center justify-center gap-1 rounded-xl border border-gold-500/40 bg-gold-500/10 px-1 py-1.5 text-xs font-semibold text-gold-300 transition-colors hover:border-gold-400 hover:bg-gold-500/20"
                  title={t.libraryQuizTitle}
                >
                  <HelpCircle className="h-3.5 w-3.5 shrink-0 text-gold-400" />
                  <span className="whitespace-nowrap">{t.libraryQuiz}</span>
                </Link>
                <Link
                  href={`/flashcard?c=${encodeURIComponent(course.id)}`}
                  className="inline-flex flex-1 min-w-0 items-center justify-center gap-1 rounded-xl border border-brand-500/40 bg-brand-500/10 px-1 py-1.5 text-xs font-semibold text-brand-300 transition-colors hover:border-brand-400 hover:bg-brand-500/20"
                  title={t.libraryFlashcardTitle}
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-300" />
                  <span className="whitespace-nowrap">{t.libraryFlashcard}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => void remove(course.id)}
                  disabled={busyId === course.id}
                  className="btn-icon shrink-0"
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

        {/* Phân trang (Pagination) */}
        {totalPages > 1 ? (
          <nav
            aria-label="Pagination"
            className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-800/80 pt-4"
          >
            <div className="text-xs text-mist-400">
              {t.libraryPageInfo
                .replace("{page}", String(page))
                .replace("{total}", String(totalPages))
                .replace("{count}", String(totalCourses))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const p = Math.max(1, page - 1);
                  setPage(p);
                  void load(p);
                }}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 rounded-xl border border-ink-700 bg-ink-900/60 px-3 py-1.5 text-xs font-semibold text-mist-200 transition-colors hover:border-brand-500/50 hover:bg-ink-800 hover:text-mist-50 disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>{t.libraryPrevPage}</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                  const isActive = p === page;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setPage(p);
                        void load(p);
                      }}
                      disabled={loading}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-mono font-semibold transition-colors ${
                        isActive
                          ? "bg-brand-500 text-mist-50 shadow-sm"
                          : "border border-ink-700/80 bg-ink-900/50 text-mist-300 hover:border-brand-500/50 hover:bg-ink-800 hover:text-mist-50"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  const p = Math.min(totalPages, page + 1);
                  setPage(p);
                  void load(p);
                }}
                disabled={page >= totalPages || loading}
                className="inline-flex items-center gap-1 rounded-xl border border-ink-700 bg-ink-900/60 px-3 py-1.5 text-xs font-semibold text-mist-200 transition-colors hover:border-brand-500/50 hover:bg-ink-800 hover:text-mist-50 disabled:pointer-events-none disabled:opacity-40"
              >
                <span>{t.libraryNextPage}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </nav>
        ) : null}
      </>
      )}
    </div>
  );
}
