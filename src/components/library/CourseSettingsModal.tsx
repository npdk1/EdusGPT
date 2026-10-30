"use client";

import { useState } from "react";
import {
  Archive,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileText,
  LoaderCircle,
  Trash2,
  VolumeX,
  X,
  Layers,
} from "lucide-react";
import { useCopy } from "@/i18n/provider";

export interface CourseSummary {
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

interface CourseSettingsModalProps {
  course: CourseSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

const MODAL_COPY = {
  en: {
    title: "Lesson Options & Deletion",
    subtitle: "Backup, clean up cache, or delete this lesson with safety.",
    lessonInfo: "Lesson Details",
    scenes: "scenes",
    downloadBackup: "Download Backup (.json)",
    downloading: "Preparing download...",
    deleteSectionTitle: "Choose Deletion Type",
    softDeleteTitle: "1. Temporary Delete (Move to Trash)",
    softDeleteDesc:
      "Safely moves this lesson into data/temp_delete/. It hides from your active library, but you can restore or retrieve it anytime from Trash.",
    softDeleteBtn: "Move to Trash",
    permanentDeleteTitle: "2. Permanent Delete (Wipe from Disk)",
    permanentDeleteDesc:
      "Completely deletes the lesson file and purges all generated voice audio from disk. This action cannot be undone.",
    permanentDeleteBtn: "Delete Permanently",
    confirmPermanent:
      "Are you sure you want to PERMANENTLY delete \"{title}\"? All files will be wiped and cannot be recovered.",
    deleting: "Processing...",
    optionalCleanup: "Optional: Free Up Storage (Keep Lesson)",
    cleanupAudioTitle: "Clear Audio Voice Cache",
    cleanupAudioDesc: "Deletes cached TTS voice clips for this lesson to free disk space. Speech will re-generate seamlessly when played.",
    cleanupAudioBtn: "Clear Voice Audio",
    cleanupSuccess: "Voice cache cleared successfully!",
    cleaning: "Cleaning...",
    cancel: "Close",
  },
  vi: {
    title: "Tùy chọn & Quản lý bài học",
    subtitle: "Sao lưu, dọn dẹp hoặc xóa bài giảng này một cách an toàn.",
    lessonInfo: "Thông tin bài học",
    scenes: "cảnh",
    downloadBackup: "Tải bản sao lưu (.json)",
    downloading: "Đang tải xuống...",
    deleteSectionTitle: "Chọn hình thức xóa bài giảng",
    softDeleteTitle: "1. Xóa tạm thời (Chuyển vào Thùng rác)",
    softDeleteDesc:
      "Bài giảng được chuyển sang thư mục tạm data/temp_delete/ và ẩn khỏi Thư viện. Bạn có thể khôi phục lại bất kỳ lúc nào mà không sợ mất dữ liệu.",
    softDeleteBtn: "Chuyển vào Thùng rác",
    permanentDeleteTitle: "2. Xóa vĩnh viễn khỏi thiết bị",
    permanentDeleteDesc:
      "Xóa hoàn toàn file bài giảng và dọn sạch toàn bộ file âm thanh giọng đọc TTS khỏi ổ cứng. Thao tác này không thể hoàn tác.",
    permanentDeleteBtn: "Xóa vĩnh viễn",
    confirmPermanent:
      "Bạn có chắc chắn muốn XÓA VĨNH VIỄN bài \"{title}\"? Toàn bộ dữ liệu sẽ bị xóa triệt để và không thể khôi phục.",
    deleting: "Đang xử lý...",
    optionalCleanup: "Tùy chọn: Giải phóng dung lượng (Vẫn giữ bài học)",
    cleanupAudioTitle: "Dọn dẹp cache giọng đọc (Audio)",
    cleanupAudioDesc: "Gỡ bỏ các file audio đã đọc của bài này để tiết kiệm bộ nhớ. Khi mở lại bài giảng, hệ thống sẽ tự phát giọng đọc bình thường.",
    cleanupAudioBtn: "Dọn cache giọng đọc",
    cleanupSuccess: "Đã dọn sạch cache giọng đọc thành công!",
    cleaning: "Đang dọn dẹp...",
    cancel: "Đóng",
  },
};

export function CourseSettingsModal({
  course,
  isOpen,
  onClose,
  onRefresh,
}: CourseSettingsModalProps) {
  const t = useCopy(MODAL_COPY);

  const [deleting, setDeleting] = useState<"trash" | "permanent" | null>(null);
  const [cleaningAudio, setCleaningAudio] = useState(false);
  const [cleanAudioSuccess, setCleanAudioSuccess] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !course) return null;

  const handleDownloadBackup = async () => {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(`/api/export/json?id=${encodeURIComponent(course.id)}`);
      if (!res.ok) throw new Error("Không thể tải file bài giảng.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${course.title.replace(/[/\\?%*:|"<>]/g, "_")}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi tải file sao lưu");
    } finally {
      setDownloading(false);
    }
  };

  const handleClearAudio = async () => {
    setCleaningAudio(true);
    setError(null);
    setCleanAudioSuccess(false);
    try {
      // Call trim with keepQuiz: true, keepFlashcards: true (purges audio TTS from disk)
      const res = await fetch("/api/courses/trim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: course.id, keepQuiz: true, keepFlashcards: true }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Không thể dọn dẹp audio");
      }
      setCleanAudioSuccess(true);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi dọn dẹp audio");
    } finally {
      setCleaningAudio(false);
    }
  };

  const handleDelete = async (mode: "trash" | "permanent") => {
    if (mode === "permanent") {
      const confirmed = window.confirm(
        t.confirmPermanent.replace("{title}", course.title),
      );
      if (!confirmed) return;
    }

    setDeleting(mode);
    setError(null);

    try {
      const response = await fetch(
        `/api/courses?id=${encodeURIComponent(course.id)}&mode=${mode}`,
        { method: "DELETE" },
      );

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Không thể xóa bài giảng");
      }

      onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi xóa bài học");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl border border-ink-800 bg-ink-900 shadow-2xl p-6 sm:p-7 text-mist-100 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-ink-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/20 shadow-xs">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-mist-50">
                {t.title}
              </h2>
              <p className="text-xs text-mist-400">
                {t.subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-mist-400 hover:bg-ink-800 hover:text-mist-100 transition-colors"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error ? (
          <div className="flex items-center gap-2.5 rounded-2xl border border-ember-500/40 bg-ember-500/10 p-3 text-xs sm:text-sm text-mist-100">
            <AlertTriangle className="h-4 w-4 shrink-0 text-ember-400" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* Card thông tin bài giảng & Nút sao lưu tải về */}
        <div className="rounded-2xl border border-ink-800 bg-ink-950/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded-md border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 text-[11px] font-bold text-brand-300">
                {course.subject}
              </span>
              {course.grade ? (
                <span className="rounded-md border border-ink-700 bg-ink-850 px-2 py-0.5 text-[11px] font-medium text-mist-300">
                  {course.grade}
                </span>
              ) : null}
            </div>
            <h3 className="text-sm font-bold text-mist-50 truncate" title={course.title}>
              {course.title}
            </h3>
            <p className="text-xs text-mist-400 mt-0.5 flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-mist-400" />
                {course.sceneCount} {t.scenes}
              </span>
              <span>•</span>
              <span>{Math.round(course.duration || 0)}s</span>
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadBackup}
            disabled={downloading}
            className="btn-ghost shrink-0 border border-ink-700 hover:border-brand-500/50 hover:bg-brand-500/10 text-xs px-3.5 py-2 font-semibold text-mist-200 hover:text-brand-300 inline-flex items-center gap-1.5"
            title="Tải bản sao lưu đề phòng cần dùng lại"
          >
            {downloading ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5 text-brand-400" />
            )}
            <span>{t.downloadBackup}</span>
          </button>
        </div>

        {/* Khu vực Xóa: 2 lựa chọn rõ ràng */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-mist-300">
            {t.deleteSectionTitle}
          </h4>

          <div className="grid gap-3.5 sm:grid-cols-2">
            {/* 1. Xóa tạm thời (Thùng rác) */}
            <div className="flex flex-col justify-between rounded-2xl border border-gold-500/35 bg-gold-500/[0.04] p-4.5 gap-4 hover:border-gold-500/50 transition-all">
              <div>
                <div className="flex items-center gap-2 text-gold-300 font-bold text-xs sm:text-sm">
                  <Archive className="h-4 w-4 shrink-0 text-gold-400" />
                  <span>{t.softDeleteTitle}</span>
                </div>
                <p className="mt-2 text-xs text-mist-300 leading-relaxed">
                  {t.softDeleteDesc}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleDelete("trash")}
                disabled={deleting !== null}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gold-500/50 bg-gold-500/20 py-2.5 px-4 text-xs font-bold text-gold-200 hover:bg-gold-500/30 active:scale-98 transition-all disabled:opacity-50"
              >
                {deleting === "trash" ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    <span>{t.deleting}</span>
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4 text-gold-300" />
                    <span>{t.softDeleteBtn}</span>
                  </>
                )}
              </button>
            </div>

            {/* 2. Xóa vĩnh viễn */}
            <div className="flex flex-col justify-between rounded-2xl border border-red-500/35 bg-red-500/[0.04] p-4.5 gap-4 hover:border-red-500/50 transition-all">
              <div>
                <div className="flex items-center gap-2 text-red-400 font-bold text-xs sm:text-sm">
                  <Trash2 className="h-4 w-4 shrink-0 text-red-400" />
                  <span>{t.permanentDeleteTitle}</span>
                </div>
                <p className="mt-2 text-xs text-mist-300 leading-relaxed">
                  {t.permanentDeleteDesc}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleDelete("permanent")}
                disabled={deleting !== null}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/50 bg-red-500/20 py-2.5 px-4 text-xs font-bold text-red-300 hover:bg-red-500/30 active:scale-98 transition-all disabled:opacity-50"
              >
                {deleting === "permanent" ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    <span>{t.deleting}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 text-red-400" />
                    <span>{t.permanentDeleteBtn}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Tùy chọn giải phóng dung lượng audio nhẹ nhàng (Giữ nguyên bài) */}
        <div className="rounded-2xl border border-ink-800 bg-ink-950/40 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-mist-200 flex items-center gap-1.5">
                <VolumeX className="h-3.5 w-3.5 text-brand-400" />
                {t.cleanupAudioTitle}
              </p>
              <p className="text-[11px] text-mist-400 mt-0.5 leading-relaxed">
                {t.cleanupAudioDesc}
              </p>
            </div>

            {cleanAudioSuccess ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 shrink-0">
                <CheckCircle2 className="h-4 w-4" />
                {t.cleanupSuccess}
              </span>
            ) : (
              <button
                type="button"
                onClick={handleClearAudio}
                disabled={cleaningAudio}
                className="btn-ghost shrink-0 border border-ink-700 hover:border-brand-500/40 hover:bg-ink-800 text-xs px-3.5 py-1.5 font-medium text-mist-300"
              >
                {cleaningAudio ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  t.cleanupAudioBtn
                )}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-ink-800">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost px-5 py-2 text-xs font-semibold"
          >
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
