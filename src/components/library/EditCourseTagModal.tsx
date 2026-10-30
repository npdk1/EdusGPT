"use client";

import { useState, useEffect } from "react";
import {
  Tag,
  Check,
  X,
  LoaderCircle,
  Plus,
  Bookmark,
  Sparkles,
} from "lucide-react";
import { type SubjectTag, getTagIconComponent, getTagColorConfig } from "@/lib/library/subject-tags";

export interface CourseTagEditTarget {
  id: string;
  title: string;
  subject: string;
  grade?: string;
}

interface EditCourseTagModalProps {
  course: CourseTagEditTarget | null;
  isOpen: boolean;
  onClose: () => void;
  availableTags: SubjectTag[];
  onCourseUpdated: (updated: { id: string; subject: string; grade?: string }) => void;
  lang: "vi" | "en";
}

export function EditCourseTagModal({
  course,
  isOpen,
  onClose,
  availableTags,
  onCourseUpdated,
  lang,
}: EditCourseTagModalProps) {
  const [selectedSubject, setSelectedSubject] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when course changes
  useEffect(() => {
    if (course) {
      setSelectedSubject(course.subject || "");
      setCustomSubject("");
      setGrade(course.grade || "");
      setError(null);
    }
  }, [course]);

  if (!isOpen || !course) return null;

  // Filter out "all"
  const selectableTags = availableTags.filter((t) => t.id !== "all");

  const isMatchedInPresets = selectableTags.some(
    (t) =>
      t.label.toLowerCase() === selectedSubject.toLowerCase() ||
      t.query.toLowerCase() === selectedSubject.toLowerCase(),
  );

  const effectiveSubject = customSubject.trim() || selectedSubject.trim();

  const handleSelectPreset = (tag: SubjectTag) => {
    setSelectedSubject(tag.label);
    setCustomSubject("");
    setError(null);
  };

  const handleSave = async () => {
    if (!effectiveSubject) {
      setError(lang === "vi" ? "Vui lòng chọn hoặc nhập tên thẻ môn học." : "Please select or enter a subject tag.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/courses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: course.id,
          subject: effectiveSubject,
          grade: grade.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Không thể cập nhật thẻ bài giảng.");
      }

      onCourseUpdated({
        id: course.id,
        subject: effectiveSubject,
        grade: grade.trim() || undefined,
      });

      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra khi lưu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-lg rounded-2xl border border-ink-700 bg-ink-950 p-6 shadow-2xl space-y-5"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-ink-800 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-500/30 bg-brand-500/10 text-brand-400">
              <Tag className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-mist-50">
                {lang === "vi" ? "Chỉnh sửa thẻ môn học bài giảng" : "Edit Lesson Subject Tag"}
              </h2>
              <p className="text-xs text-mist-400">
                {lang === "vi"
                  ? "Đổi phân loại môn học nếu bài giảng bị gán nhầm thẻ"
                  : "Change subject category if this lesson was misclassified"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-mist-400 hover:bg-ink-800 hover:text-mist-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Course Info Preview */}
        <div className="rounded-xl border border-ink-800 bg-ink-900/60 p-3.5 space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-mist-400">
            {lang === "vi" ? "Bài giảng đang chọn" : "Target Lesson"}
          </div>
          <div className="text-sm font-bold text-mist-100 line-clamp-1">
            {course.title}
          </div>
          <div className="flex items-center gap-2 text-xs text-mist-300">
            <span>{lang === "vi" ? "Thẻ hiện tại:" : "Current tag:"}</span>
            <span className="rounded-md border border-ink-700 bg-ink-850 px-2 py-0.5 font-semibold text-brand-400">
              {course.subject || (lang === "vi" ? "Chưa có thẻ" : "Untagged")}
            </span>
            {course.grade ? (
              <span className="text-mist-400">· Khối {course.grade}</span>
            ) : null}
          </div>
        </div>

        {/* Quick Select Presets */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-mist-200 flex items-center justify-between">
            <span>{lang === "vi" ? "Chọn nhanh từ danh sách thẻ:" : "Choose from existing tags:"}</span>
            <span className="text-[11px] font-normal text-mist-400">
              {lang === "vi" ? "Nhấp để chọn thẻ" : "Click to select"}
            </span>
          </label>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1 border border-ink-850 rounded-xl bg-ink-900/40">
            {selectableTags.map((tag) => {
              const TagIcon = getTagIconComponent(tag.iconName);
              const colorCfg = getTagColorConfig(tag.color);
              const isSelected =
                !customSubject.trim() &&
                (selectedSubject.toLowerCase() === tag.label.toLowerCase() ||
                  selectedSubject.toLowerCase() === tag.query.toLowerCase());

              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleSelectPreset(tag)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    isSelected
                      ? `${colorCfg.activePillClass}`
                      : "border border-ink-800 bg-ink-900/80 text-mist-300 hover:border-ink-700 hover:bg-ink-850 hover:text-mist-100"
                  }`}
                >
                  <TagIcon
                    className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                      isSelected ? "text-white" : colorCfg.accentClass
                    }`}
                  />
                  <span>{lang === "vi" ? tag.label : tag.labelEn || tag.label}</span>
                  {isSelected ? <Check className="h-3.5 w-3.5 text-white ml-0.5" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Or enter custom subject */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-mist-200">
            {lang === "vi" ? "Hoặc tự nhập tên thẻ môn học mới:" : "Or enter custom subject tag:"}
          </label>
          <div className="relative">
            <input
              type="text"
              value={customSubject}
              onChange={(e) => {
                setCustomSubject(e.target.value);
                setError(null);
              }}
              placeholder={lang === "vi" ? "Ví dụ: Địa lý, Triết học, Kinh tế..." : "e.g. Geography, Philosophy, Economics..."}
              className="w-full rounded-xl border border-ink-800 bg-ink-900 px-3.5 py-2.5 text-xs sm:text-sm text-mist-100 placeholder:text-mist-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          {customSubject.trim() ? (
            <p className="text-[11px] text-amber-500 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {lang === "vi"
                ? `Sẽ lưu môn học: "${customSubject.trim()}"`
                : `Will save subject: "${customSubject.trim()}"`}
            </p>
          ) : null}
        </div>

        {/* Optional Grade */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-mist-200">
            {lang === "vi" ? "Khối lớp / Trình độ (tùy chọn):" : "Grade / Level (optional):"}
          </label>
          <input
            type="text"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder={lang === "vi" ? "Ví dụ: 10, 11, 12, Đại học..." : "e.g. 10, 11, 12, University..."}
            className="w-full rounded-xl border border-ink-800 bg-ink-900 px-3.5 py-2.5 text-xs sm:text-sm text-mist-100 placeholder:text-mist-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Error message */}
        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            {error}
          </div>
        ) : null}

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-ink-800">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn-ghost text-xs px-4 py-2"
          >
            {lang === "vi" ? "Hủy" : "Cancel"}
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !effectiveSubject}
            className="btn-primary text-xs px-5 py-2 font-bold inline-flex items-center gap-1.5"
          >
            {saving ? (
              <>
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                <span>{lang === "vi" ? "Đang lưu..." : "Saving..."}</span>
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>{lang === "vi" ? "Lưu thay đổi" : "Save Changes"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
