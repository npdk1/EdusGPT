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

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.round(hours / 24)} ngày trước`;
}

/** Server-backed course library — survives a browser reinstall. */
export function LibraryPanel() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/courses", { cache: "no-store" });
      const payload = (await response.json()) as {
        ok?: boolean;
        courses?: CourseSummary[];
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "Không tải được thư viện.");
        return;
      }
      setCourses(payload.courses ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Lỗi mạng.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
        setError(payload?.error ?? "Không xoá được bài.");
        return;
      }
      setCourses((current) => current.filter((item) => item.id !== id));
    } finally {
      setBusyId(null);
    }
  }, []);

  const removeAll = useCallback(async () => {
    if (
      !window.confirm(
        `Xoá hết ${courses.length} bài trong thư viện? Không khôi phục được.`,
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
        setError(payload?.error ?? "Không xoá được thư viện.");
        return;
      }
      setCourses([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Lỗi mạng.");
    } finally {
      setClearing(false);
    }
  }, [courses.length]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-mist-400">
          <FolderOpen className="h-4 w-4 text-brand-300" />
          {courses.length} bài trong thư viện
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className="btn-ghost">
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Làm mới
          </button>
          {courses.length > 0 ? (
            <button
              type="button"
              onClick={() => void removeAll()}
              disabled={clearing || loading}
              className="btn-ghost"
              title="Xoá toàn bộ bài trong thư viện"
            >
              {clearing ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Xoá hết
            </button>
          ) : null}
          <Link href="/studio" className="btn-primary">
            <Sparkles className="h-4 w-4" /> Sinh bài mới
          </Link>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-ember-500/50 bg-ember-500/10 px-3.5 py-2.5 text-sm text-mist-100">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 py-10 text-sm text-mist-400">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Đang tải thư viện…
        </p>
      ) : courses.length === 0 ? (
        <div className="panel p-8 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-mist-500" />
          <p className="mt-3 font-semibold text-mist-100">Thư viện còn trống</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-mist-400">
            Bài bạn sinh sẽ được lưu ở đây, trong{" "}
            <code className="font-mono text-gold-200">data/courses/</code>. Không
            mất khi đổi trình duyệt hay xoá dữ liệu trình duyệt.
          </p>
          <Link href="/studio" className="btn-primary mt-4">
            <Sparkles className="h-4 w-4" /> Đi sinh bài đầu tiên
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
                  {course.source === "gemini" ? "AI" : "mẫu"}
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
                <span>{course.sceneCount} cảnh</span>
                <span>{relative(course.updatedAt)}</span>
              </p>

              <div className="mt-auto flex gap-2 pt-1">
                <Link
                  href={`/lesson?c=${encodeURIComponent(course.id)}`}
                  className="btn-primary flex-1 px-3 py-1.5 text-xs"
                >
                  <Play className="h-3.5 w-3.5" /> Mở
                </Link>
                <button
                  type="button"
                  onClick={() => void remove(course.id)}
                  disabled={busyId === course.id}
                  className="btn-icon"
                  aria-label={`Xoá ${course.title}`}
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
