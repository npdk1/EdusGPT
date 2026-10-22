"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  HelpCircle,
  LoaderCircle,
  Settings,
  Sparkles,
  Trash2,
  X,
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
    title: "Lesson Settings & Optimization",
    subtitle: "Manage content, optimize disk usage, or delete this lesson.",
    storageSection: "Storage Optimization (Trim Content)",
    storageDesc:
      "Finished studying this lesson? You can remove the presentation slides and speech audio to free up disk space, keeping only the quizzes and flashcards for quick revision.",
    keepQuizLabel: "Keep Interactive Quizzes (Quiz)",
    keepQuizHint: "Retain interactive multiple-choice questions for practice.",
    keepFlashcardsLabel: "Keep Revision Flashcards & Concepts",
    keepFlashcardsHint: "Retain key bullet points, formulas, and mindmaps as study cards.",
    storageNote:
      "All slide narration scripts and cached TTS audio files will be permanently purged to maximize storage savings.",
    applyTrim: "Optimize Storage Now",
    trimming: "Optimizing...",
    trimSuccess: "Lesson storage optimized successfully! Slides and TTS audio have been pruned.",
    keepAtLeastOne: "Please keep at least Quiz or Flashcards.",
    deleteSection: "Deletion Options",
    deleteDesc:
      "Choose whether to temporarily move this lesson to the trash or delete it permanently from disk.",
    softDeleteTitle: "Move to Trash (data/temp_delete/)",
    softDeleteDesc:
      "The lesson is encrypted and moved to the temporary trash folder. It disappears from the active library but can be recovered if needed.",
    softDeleteBtn: "Move to Trash",
    permanentDeleteTitle: "Delete Permanently",
    permanentDeleteDesc:
      "Completely wipes the encrypted lesson file and purges all associated audio files from disk. Cannot be undone.",
    permanentDeleteBtn: "Delete Permanently",
    confirmPermanent: "Are you sure you want to permanently delete \"{title}\"? This action cannot be undone.",
    deleting: "Deleting...",
    cancel: "Close",
    scenes: "scenes",
  },
  vi: {
    title: "Cấu hình & Tối ưu bài học",
    subtitle: "Quản lý thành phần, tối ưu dung lượng hoặc xóa bài giảng này.",
    storageSection: "Tối ưu dung lượng (Gọt bớt nội dung)",
    storageDesc:
      "Đã học xong bài này? Bạn có thể xóa slide thuyết minh & audio giọng đọc để tiết kiệm bộ nhớ, chỉ giữ lại phần Trắc nghiệm và Thẻ ghi nhớ Flashcard để ôn tập nhanh.",
    keepQuizLabel: "Giữ lại Trắc nghiệm tương tác (Quiz)",
    keepQuizHint: "Giữ nguyên bộ câu hỏi trắc nghiệm để luyện tập sau này.",
    keepFlashcardsLabel: "Giữ lại Thẻ ghi nhớ Flashcard & Ý chính",
    keepFlashcardsHint: "Giữ lại các ý cốt lõi, công thức và sơ đồ tư duy làm thẻ ôn tập.",
    storageNote:
      "Lời thuyết minh của slide và toàn bộ file audio TTS trong cache sẽ được gỡ bỏ triệt để nhằm tối ưu dung lượng ổ cứng.",
    applyTrim: "Thực hiện tối ưu dung lượng",
    trimming: "Đang tối ưu...",
    trimSuccess: "Đã tối ưu dung lượng thành công! Slide thuyết minh và audio TTS đã được dọn sạch.",
    keepAtLeastOne: "Vui lòng chọn giữ lại ít nhất Trắc nghiệm hoặc Thẻ ghi nhớ.",
    deleteSection: "Tùy chọn xóa bài học",
    deleteDesc:
      "Chọn xóa tạm vào thùng rác để có thể phục hồi, hoặc xóa vĩnh viễn khỏi máy tính.",
    softDeleteTitle: "Xóa thường (Bỏ vào Thùng rác data/temp_delete/)",
    softDeleteDesc:
      "Bài giảng được chuyển sang thư mục data/temp_delete/ và vẫn được mã hóa bảo mật. Bài học biến mất khỏi thư viện nhưng có thể phục hồi khi cần.",
    softDeleteBtn: "Chuyển vào Thùng rác",
    permanentDeleteTitle: "Xóa vĩnh viễn khỏi đĩa",
    permanentDeleteDesc:
      "Xóa triệt để file bài giảng đã mã hóa và toàn bộ file âm thanh TTS liên quan khỏi ổ cứng. Không thể khôi phục.",
    permanentDeleteBtn: "Xóa vĩnh viễn",
    confirmPermanent: "Bạn có chắc chắn muốn xóa vĩnh viễn bài \"{title}\"? Thao tác này không thể hoàn tác.",
    deleting: "Đang xóa...",
    cancel: "Đóng",
    scenes: "cảnh",
  },
};

export function CourseSettingsModal({
  course,
  isOpen,
  onClose,
  onRefresh,
}: CourseSettingsModalProps) {
  const t = useCopy(MODAL_COPY);

  const [keepQuiz, setKeepQuiz] = useState(true);
  const [keepFlashcards, setKeepFlashcards] = useState(true);
  const [trimming, setTrimming] = useState(false);
  const [trimDone, setTrimDone] = useState(false);
  const [deleting, setDeleting] = useState<"trash" | "permanent" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !course) return null;

  const handleTrim = async () => {
    if (!keepQuiz && !keepFlashcards) {
      setError(t.keepAtLeastOne);
      return;
    }

    setTrimming(true);
    setError(null);
    setTrimDone(false);

    try {
      const response = await fetch("/api/courses/trim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: course.id,
          keepQuiz,
          keepFlashcards,
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to trim course");
      }

      setTrimDone(true);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error trimming course");
    } finally {
      setTrimming(false);
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
        throw new Error(payload.error || "Failed to delete course");
      }

      onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting course");
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
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-ink-700 bg-ink-900 shadow-2xl p-6 text-mist-100 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-ink-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-300 border border-brand-500/20">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-mist-50 line-clamp-1">
                {course.title}
              </h2>
              <p className="text-xs text-mist-400">
                {course.subject}
                {course.grade ? ` · ${course.grade}` : ""} · {course.sceneCount} {t.scenes}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-mist-400 hover:bg-ink-800 hover:text-mist-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error ? (
          <div className="flex items-center gap-2 rounded-xl border border-ember-500/50 bg-ember-500/10 px-3.5 py-2.5 text-xs sm:text-sm text-mist-100">
            <AlertTriangle className="h-4 w-4 shrink-0 text-ember-400" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* Section 1: Storage Optimization */}
        <div className="flex flex-col gap-3 rounded-xl border border-brand-500/30 bg-brand-500/[0.04] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-300">
            <Sparkles className="h-4 w-4" />
            <span>{t.storageSection}</span>
          </div>
          <p className="text-xs text-mist-300 leading-relaxed">{t.storageDesc}</p>

          <div className="mt-1 flex flex-col gap-2.5 bg-ink-950/40 rounded-xl p-3 border border-ink-800">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={keepQuiz}
                onChange={(e) => setKeepQuiz(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-ink-600 bg-ink-800 text-brand-500 focus:ring-brand-400 focus:ring-offset-ink-900"
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-mist-100 flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-gold-400" />
                  {t.keepQuizLabel}
                </span>
                <span className="text-[11px] text-mist-400">{t.keepQuizHint}</span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={keepFlashcards}
                onChange={(e) => setKeepFlashcards(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-ink-600 bg-ink-800 text-brand-500 focus:ring-brand-400 focus:ring-offset-ink-900"
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-mist-100 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-brand-300" />
                  {t.keepFlashcardsLabel}
                </span>
                <span className="text-[11px] text-mist-400">{t.keepFlashcardsHint}</span>
              </div>
            </label>
          </div>

          <p className="text-[11px] text-mist-400 italic bg-ink-900/50 p-2 rounded-lg border border-ink-800/80">
            * {t.storageNote}
          </p>

          {trimDone ? (
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{t.trimSuccess}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleTrim}
              disabled={trimming || (!keepQuiz && !keepFlashcards)}
              className="mt-1 btn-primary justify-center text-xs py-2"
            >
              {trimming ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" /> {t.trimming}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> {t.applyTrim}
                </>
              )}
            </button>
          )}
        </div>

        {/* Section 2: Deletion Options */}
        <div className="flex flex-col gap-3 rounded-xl border border-ink-700 bg-ink-950/40 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-mist-200">
            <Trash2 className="h-4 w-4 text-mist-400" />
            <span>{t.deleteSection}</span>
          </div>
          <p className="text-xs text-mist-400">{t.deleteDesc}</p>

          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            {/* Soft Delete */}
            <div className="flex flex-col justify-between gap-3 rounded-xl border border-gold-500/30 bg-gold-500/[0.05] p-3">
              <div>
                <p className="text-xs font-semibold text-gold-300 flex items-center gap-1.5">
                  <Archive className="h-3.5 w-3.5" />
                  {t.softDeleteTitle}
                </p>
                <p className="mt-1 text-[11px] text-mist-400 leading-relaxed">
                  {t.softDeleteDesc}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete("trash")}
                disabled={deleting !== null}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-gold-500/40 bg-gold-500/15 py-2 text-xs font-semibold text-gold-200 hover:bg-gold-500/25 transition-colors disabled:opacity-50"
              >
                {deleting === "trash" ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Archive className="h-3.5 w-3.5" />
                )}
                <span>{t.softDeleteBtn}</span>
              </button>
            </div>

            {/* Permanent Delete */}
            <div className="flex flex-col justify-between gap-3 rounded-xl border border-ember-500/30 bg-ember-500/[0.05] p-3">
              <div>
                <p className="text-xs font-semibold text-ember-300 flex items-center gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" />
                  {t.permanentDeleteTitle}
                </p>
                <p className="mt-1 text-[11px] text-mist-400 leading-relaxed">
                  {t.permanentDeleteDesc}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete("permanent")}
                disabled={deleting !== null}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-ember-500/40 bg-ember-500/20 py-2 text-xs font-semibold text-ember-200 hover:bg-ember-500/30 transition-colors disabled:opacity-50"
              >
                {deleting === "permanent" ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span>{t.permanentDeleteBtn}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-ink-800">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost px-4 py-2 text-xs font-semibold"
          >
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
