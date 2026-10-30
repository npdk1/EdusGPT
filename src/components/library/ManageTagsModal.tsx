"use client";

import { useState } from "react";
import {
  Tags,
  Plus,
  Trash2,
  RotateCcw,
  X,
  Check,
  Palette,
} from "lucide-react";
import {
  type SubjectTag,
  AVAILABLE_TAG_ICONS,
  AVAILABLE_TAG_COLORS,
  DEFAULT_SUBJECT_TAGS,
  getTagIconComponent,
  getTagColorConfig,
} from "@/lib/library/subject-tags";

interface ManageTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tags: SubjectTag[];
  onSaveTags: (newTags: SubjectTag[]) => void;
  lang: "vi" | "en";
}

export function ManageTagsModal({
  isOpen,
  onClose,
  tags,
  onSaveTags,
  lang,
}: ManageTagsModalProps) {
  const [currentTags, setCurrentTags] = useState<SubjectTag[]>(tags);
  const [newLabelVi, setNewLabelVi] = useState("");
  const [newLabelEn, setNewLabelEn] = useState("");
  const [newQuery, setNewQuery] = useState("");
  const [newIconName, setNewIconName] = useState("BookOpen");
  const [newColor, setNewColor] = useState<string>("sky");
  const [activeColorPickerTagId, setActiveColorPickerTagId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const vi = newLabelVi.trim();
    if (!vi) {
      setError(lang === "vi" ? "Vui lòng nhập tên thẻ môn học." : "Please enter a tag name.");
      return;
    }

    // Check duplicate
    if (currentTags.some((t) => t.label.toLowerCase() === vi.toLowerCase())) {
      setError(lang === "vi" ? `Thẻ "${vi}" đã tồn tại.` : `Tag "${vi}" already exists.`);
      return;
    }

    const en = newLabelEn.trim() || vi;
    const query = newQuery.trim() || vi;
    const id = `custom_${Date.now()}_${vi.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

    const newTag: SubjectTag = {
      id,
      label: vi,
      labelEn: en,
      query,
      iconName: newIconName,
      color: newColor,
      isCustom: true,
    };

    const nextList = [...currentTags, newTag];
    setCurrentTags(nextList);
    onSaveTags(nextList);

    // Reset input form
    setNewLabelVi("");
    setNewLabelEn("");
    setNewQuery("");
    setNewIconName("BookOpen");
    setNewColor("sky");
    setError(null);
  };

  const handleUpdateTagColor = (tagId: string, colorId: string) => {
    const nextList = currentTags.map((t) => (t.id === tagId ? { ...t, color: colorId } : t));
    setCurrentTags(nextList);
    onSaveTags(nextList);
    setActiveColorPickerTagId(null);
  };

  const handleDeleteTag = (tagId: string) => {
    if (tagId === "all") return;
    const nextList = currentTags.filter((t) => t.id !== tagId);
    setCurrentTags(nextList);
    onSaveTags(nextList);
    setError(null);
  };

  const handleResetDefaults = () => {
    setCurrentTags(DEFAULT_SUBJECT_TAGS);
    onSaveTags(DEFAULT_SUBJECT_TAGS);
    setError(null);
  };

  const previewColorCfg = getTagColorConfig(newColor);
  const PreviewIcon = getTagIconComponent(newIconName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-ink-700 bg-ink-950 p-6 shadow-2xl space-y-5 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-ink-800 pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400">
              <Tags className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-mist-50">
                {lang === "vi" ? "Quản lý thẻ lọc môn học" : "Manage Subject Filter Tags"}
              </h2>
              <p className="text-xs text-mist-400">
                {lang === "vi"
                  ? "Tùy chỉnh biểu tượng, màu sắc, thêm hoặc xóa các thẻ trên thanh lọc bài giảng"
                  : "Customize icons, colors, add or remove filter tags in your lesson library"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-mist-400 hover:bg-ink-800 hover:text-mist-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          {/* Current Tags List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-mist-200">
              <span>
                {lang === "vi"
                  ? `Danh sách thẻ hiện tại (${currentTags.length})`
                  : `Current Tags (${currentTags.length})`}
              </span>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="inline-flex items-center gap-1 text-[11px] text-amber-500 hover:text-amber-400 hover:underline"
                title={lang === "vi" ? "Khôi phục 8 thẻ môn học mặc định" : "Restore default 8 tags"}
              >
                <RotateCcw className="h-3 w-3" />
                <span>{lang === "vi" ? "Khôi phục mặc định" : "Reset defaults"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentTags.map((tag) => {
                const TagIcon = getTagIconComponent(tag.iconName);
                const colorCfg = getTagColorConfig(tag.color);
                const isAll = tag.id === "all";
                const isColorPickerOpen = activeColorPickerTagId === tag.id;

                return (
                  <div
                    key={tag.id}
                    className="relative flex flex-col rounded-xl border border-ink-800 bg-ink-900/60 p-2.5 text-xs transition-colors hover:border-ink-700"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${colorCfg.badgeClass}`}
                        >
                          <TagIcon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-mist-100 truncate flex items-center gap-1.5">
                            <span>{lang === "vi" ? tag.label : tag.labelEn || tag.label}</span>
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: colorCfg.dotHex }}
                              title={lang === "vi" ? colorCfg.label : colorCfg.labelEn}
                            />
                          </div>
                          <div className="text-[10px] text-mist-500 truncate">
                            Query: &quot;{tag.query || "*"}&quot;
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Quick Color Picker Button */}
                        <button
                          type="button"
                          onClick={() =>
                            setActiveColorPickerTagId(isColorPickerOpen ? null : tag.id)
                          }
                          className="flex h-7 px-1.5 items-center gap-1 rounded-lg border border-ink-800 bg-ink-850 hover:border-ink-700 text-mist-400 hover:text-mist-200 transition-colors"
                          title={lang === "vi" ? "Đổi màu thẻ" : "Change tag color"}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: colorCfg.dotHex }}
                          />
                          <Palette className="h-3 w-3" />
                        </button>

                        {isAll ? (
                          <span className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium text-mist-400">
                            {lang === "vi" ? "Cố định" : "Fixed"}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteTag(tag.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-mist-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                            title={lang === "vi" ? `Xóa thẻ "${tag.label}"` : `Delete tag "${tag.label}"`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Quick Color Popover */}
                    {isColorPickerOpen ? (
                      <div className="mt-2 pt-2 border-t border-ink-800/80 flex items-center justify-between gap-1 animate-fade-in">
                        <span className="text-[10px] text-mist-400 font-medium">
                          {lang === "vi" ? "Chọn màu:" : "Color:"}
                        </span>
                        <div className="flex items-center gap-1">
                          {AVAILABLE_TAG_COLORS.map((c) => {
                            const isCurColor = (tag.color || "sky") === c.id;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => handleUpdateTagColor(tag.id, c.id)}
                                className={`h-5 w-5 rounded-full flex items-center justify-center transition-all ${
                                  isCurColor
                                    ? "ring-2 ring-white ring-offset-1 ring-offset-ink-950 scale-110"
                                    : "hover:scale-115 opacity-80 hover:opacity-100"
                                }`}
                                style={{ backgroundColor: c.dotHex }}
                                title={lang === "vi" ? c.label : c.labelEn}
                              >
                                {isCurColor ? <Check className="h-3 w-3 text-white" /> : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add New Tag Section */}
          <form onSubmit={handleAddTag} className="rounded-2xl border border-ink-800 bg-ink-900/40 p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-mist-100">
              <Plus className="h-4 w-4 text-brand-400" />
              <span>{lang === "vi" ? "Thêm thẻ môn học mới" : "Add New Subject Tag"}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-mist-300">
                  {lang === "vi" ? "Tên thẻ (Tiếng Việt) *" : "Tag Name (Vietnamese) *"}
                </label>
                <input
                  type="text"
                  value={newLabelVi}
                  onChange={(e) => {
                    setNewLabelVi(e.target.value);
                    if (!newQuery) setNewQuery(e.target.value);
                  }}
                  placeholder={lang === "vi" ? "VD: Địa lý, Triết học..." : "e.g. Geography..."}
                  className="w-full rounded-xl border border-ink-800 bg-ink-900 px-3 py-2 text-xs text-mist-100 placeholder:text-mist-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-mist-300">
                  {lang === "vi" ? "Tên tiếng Anh (Tùy chọn)" : "English Name (Optional)"}
                </label>
                <input
                  type="text"
                  value={newLabelEn}
                  onChange={(e) => setNewLabelEn(e.target.value)}
                  placeholder="e.g. Geography, Philosophy..."
                  className="w-full rounded-xl border border-ink-800 bg-ink-900 px-3 py-2 text-xs text-mist-100 placeholder:text-mist-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-mist-300">
                {lang === "vi" ? "Từ khóa tìm kiếm (Query)" : "Search Query"}
              </label>
              <input
                type="text"
                value={newQuery}
                onChange={(e) => setNewQuery(e.target.value)}
                placeholder={lang === "vi" ? "VD: Địa lý (hoặc để trống sẽ tự lấy tên thẻ)" : "Search keyword..."}
                className="w-full rounded-xl border border-ink-800 bg-ink-900 px-3 py-2 text-xs text-mist-100 placeholder:text-mist-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Choose Tag Color */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-mist-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5 text-brand-400" />
                  <span>{lang === "vi" ? "Chọn màu sắc cho thẻ:" : "Choose Tag Color:"}</span>
                </span>
                <span className="text-[10px] font-semibold text-mist-400">
                  {lang === "vi" ? previewColorCfg.label : previewColorCfg.labelEn}
                </span>
              </label>

              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 p-2 rounded-xl border border-ink-850 bg-ink-950/60">
                {AVAILABLE_TAG_COLORS.map((c) => {
                  const isSelected = newColor === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setNewColor(c.id)}
                      className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all ${
                        isSelected
                          ? `border-brand-500 bg-brand-500/15 shadow-xs scale-102`
                          : "border-transparent hover:border-ink-700 hover:bg-ink-800/60"
                      }`}
                      title={lang === "vi" ? c.label : c.labelEn}
                    >
                      <span
                        className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 shadow-xs"
                        style={{ backgroundColor: c.dotHex }}
                      >
                        {isSelected ? <Check className="h-3 w-3 text-white" /> : null}
                      </span>
                      <span className="text-[9px] font-medium text-mist-300 truncate max-w-full text-center">
                        {lang === "vi"
                          ? c.id === "sky"
                            ? "Lam"
                            : c.id === "emerald"
                            ? "Lục"
                            : c.id === "amber"
                            ? "Vàng"
                            : c.id === "rose"
                            ? "Đỏ"
                            : c.id === "cyan"
                            ? "Lơ"
                            : c.id === "teal"
                            ? "Ngọc"
                            : c.id === "orange"
                            ? "Cam"
                            : "Ghi"
                          : c.labelEn.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Icon Picker Grid */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-mist-300 flex items-center justify-between">
                <span>{lang === "vi" ? "Chọn biểu tượng đại diện:" : "Choose Icon:"}</span>
                <span className="text-[10px] text-brand-400">
                  {AVAILABLE_TAG_ICONS.find((i) => i.name === newIconName)?.label}
                </span>
              </label>

              <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5 p-2 rounded-xl border border-ink-850 bg-ink-950/60 max-h-32 overflow-y-auto">
                {AVAILABLE_TAG_ICONS.map((item) => {
                  const IconComp = getTagIconComponent(item.name);
                  const isSelected = newIconName === item.name;

                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => setNewIconName(item.name)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                        isSelected
                          ? "border border-brand-500 bg-brand-500/20 text-brand-300 shadow-xs"
                          : "border border-transparent text-mist-400 hover:border-ink-700 hover:bg-ink-800 hover:text-mist-100"
                      }`}
                      title={item.label}
                    >
                      <IconComp className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Preview Box */}
            <div className="rounded-xl border border-ink-800/80 bg-ink-950/50 p-2.5 space-y-1.5">
              <div className="text-[10px] font-semibold text-mist-400 uppercase tracking-wider">
                {lang === "vi" ? "Xem trước hiển thị thẻ:" : "Tag Preview:"}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Default Unselected Pill */}
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-ink-800 bg-ink-900/60 px-3 py-1.5 text-xs text-mist-300">
                  <PreviewIcon className={`h-3.5 w-3.5 ${previewColorCfg.accentClass}`} />
                  <span>{newLabelVi.trim() || (lang === "vi" ? "Tên thẻ" : "Tag Name")}</span>
                </div>

                {/* Selected Active Pill */}
                <div
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${previewColorCfg.activePillClass}`}
                >
                  <PreviewIcon className="h-3.5 w-3.5 text-white" />
                  <span>{newLabelVi.trim() || (lang === "vi" ? "Tên thẻ (Đang chọn)" : "Selected Tag")}</span>
                </div>
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
                {error}
              </div>
            ) : null}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={!newLabelVi.trim()}
                className="btn-primary text-xs px-4 py-2 font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{lang === "vi" ? "Thêm thẻ vào danh sách" : "Add to Tag List"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-ink-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn-primary text-xs px-5 py-2 font-bold inline-flex items-center gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            <span>{lang === "vi" ? "Hoàn tất" : "Done"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
