import {
  LayoutGrid,
  Calculator,
  Atom,
  FlaskConical,
  Dna,
  Landmark,
  Code2,
  Languages,
  Globe,
  BookOpen,
  Sparkles,
  Compass,
  Lightbulb,
  TrendingUp,
  Music,
  Palette,
  Cpu,
  GraduationCap,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

export interface TagColorConfig {
  id: string;
  label: string;
  labelEn: string;
  dotHex: string;
  badgeClass: string;
  activePillClass: string;
  accentClass: string;
  borderClass: string;
  bgSubtle: string;
}

export const AVAILABLE_TAG_COLORS: TagColorConfig[] = [
  {
    id: "sky",
    label: "Xanh lam",
    labelEn: "Sky Blue",
    dotHex: "#0284c7",
    badgeClass: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    activePillClass: "bg-sky-600 text-white font-bold shadow-sm shadow-sky-500/25",
    accentClass: "text-sky-600 dark:text-sky-400",
    borderClass: "border-sky-500/40",
    bgSubtle: "bg-sky-500/10",
  },
  {
    id: "emerald",
    label: "Xanh lục",
    labelEn: "Emerald Green",
    dotHex: "#059669",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    activePillClass: "bg-emerald-600 text-white font-bold shadow-sm shadow-emerald-500/25",
    accentClass: "text-emerald-600 dark:text-emerald-400",
    borderClass: "border-emerald-500/40",
    bgSubtle: "bg-emerald-500/10",
  },
  {
    id: "amber",
    label: "Vàng hổ phách",
    labelEn: "Amber Gold",
    dotHex: "#d97706",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    activePillClass: "bg-amber-600 text-white font-bold shadow-sm shadow-amber-500/25",
    accentClass: "text-amber-600 dark:text-amber-400",
    borderClass: "border-amber-500/40",
    bgSubtle: "bg-amber-500/10",
  },
  {
    id: "rose",
    label: "Đỏ hồng",
    labelEn: "Rose Red",
    dotHex: "#e11d48",
    badgeClass: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    activePillClass: "bg-rose-600 text-white font-bold shadow-sm shadow-rose-500/25",
    accentClass: "text-rose-600 dark:text-rose-400",
    borderClass: "border-rose-500/40",
    bgSubtle: "bg-rose-500/10",
  },
  {
    id: "cyan",
    label: "Xanh lơ",
    labelEn: "Cyan",
    dotHex: "#0891b2",
    badgeClass: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    activePillClass: "bg-cyan-600 text-white font-bold shadow-sm shadow-cyan-500/25",
    accentClass: "text-cyan-600 dark:text-cyan-400",
    borderClass: "border-cyan-500/40",
    bgSubtle: "bg-cyan-500/10",
  },
  {
    id: "teal",
    label: "Xanh ngọc",
    labelEn: "Teal",
    dotHex: "#0d9488",
    badgeClass: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
    activePillClass: "bg-teal-600 text-white font-bold shadow-sm shadow-teal-500/25",
    accentClass: "text-teal-600 dark:text-teal-400",
    borderClass: "border-teal-500/40",
    bgSubtle: "bg-teal-500/10",
  },
  {
    id: "orange",
    label: "Cam năng động",
    labelEn: "Orange",
    dotHex: "#ea580c",
    badgeClass: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    activePillClass: "bg-orange-600 text-white font-bold shadow-sm shadow-orange-500/25",
    accentClass: "text-orange-600 dark:text-orange-400",
    borderClass: "border-orange-500/40",
    bgSubtle: "bg-orange-500/10",
  },
  {
    id: "slate",
    label: "Ghi xám",
    labelEn: "Slate",
    dotHex: "#64748b",
    badgeClass: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    activePillClass: "bg-slate-700 text-white font-bold shadow-sm shadow-slate-500/25",
    accentClass: "text-slate-600 dark:text-slate-400",
    borderClass: "border-slate-500/40",
    bgSubtle: "bg-slate-500/10",
  },
];

export function getTagColorConfig(colorId?: string): TagColorConfig {
  return AVAILABLE_TAG_COLORS.find((c) => c.id === colorId) || AVAILABLE_TAG_COLORS[0];
}

export interface SubjectTag {
  id: string;
  label: string;
  labelEn: string;
  query: string;
  iconName: string;
  color?: string;
  isCustom?: boolean;
}

export const DEFAULT_SUBJECT_TAGS: SubjectTag[] = [
  { id: "all", label: "Tất cả", labelEn: "All", query: "", iconName: "LayoutGrid", color: "sky" },
  { id: "math", label: "Toán học", labelEn: "Math", query: "Toán", iconName: "Calculator", color: "sky" },
  { id: "physics", label: "Vật lý", labelEn: "Physics", query: "Vật lý", iconName: "Atom", color: "amber" },
  { id: "chemistry", label: "Hóa học", labelEn: "Chemistry", query: "Hóa", iconName: "FlaskConical", color: "emerald" },
  { id: "biology", label: "Sinh học", labelEn: "Biology", query: "Sinh", iconName: "Dna", color: "teal" },
  { id: "history", label: "Lịch sử", labelEn: "History", query: "Lịch sử", iconName: "Landmark", color: "rose" },
  { id: "cs", label: "Tin học", labelEn: "Computer Science", query: "Tin học", iconName: "Code2", color: "cyan" },
  { id: "languages", label: "Tiếng Anh", labelEn: "English", query: "Tiếng Anh", iconName: "Languages", color: "orange" },
];

export const AVAILABLE_TAG_ICONS = [
  { name: "Calculator", label: "Toán học" },
  { name: "Atom", label: "Vật lý" },
  { name: "FlaskConical", label: "Hóa học" },
  { name: "Dna", label: "Sinh học" },
  { name: "Landmark", label: "Lịch sử" },
  { name: "Code2", label: "Tin học / Lập trình" },
  { name: "Languages", label: "Ngoại ngữ / Tiếng Anh" },
  { name: "Globe", label: "Địa lý" },
  { name: "BookOpen", label: "Văn học / Đọc hiểu" },
  { name: "Sparkles", label: "Kỹ năng / AI" },
  { name: "Compass", label: "Triết học / Định hướng" },
  { name: "Lightbulb", label: "Tư duy / Sáng tạo" },
  { name: "TrendingUp", label: "Kinh tế / Tài chính" },
  { name: "Music", label: "Âm nhạc" },
  { name: "Palette", label: "Mỹ thuật / Hội họa" },
  { name: "Cpu", label: "Công nghệ / Kỹ thuật" },
  { name: "GraduationCap", label: "Đại học / Khóa học chung" },
  { name: "Stethoscope", label: "Y tế / Sức khỏe" },
];

export const ICON_MAP: Record<string, LucideIcon> = {
  LayoutGrid,
  Calculator,
  Atom,
  FlaskConical,
  Dna,
  Landmark,
  Code2,
  Languages,
  Globe,
  BookOpen,
  Sparkles,
  Compass,
  Lightbulb,
  TrendingUp,
  Music,
  Palette,
  Cpu,
  GraduationCap,
  Stethoscope,
};

export function getTagIconComponent(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || BookOpen;
}

const STORAGE_KEY = "edusgpt.subject_tags.v1";

export function loadSavedSubjectTags(): SubjectTag[] {
  if (typeof window === "undefined") return DEFAULT_SUBJECT_TAGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SUBJECT_TAGS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure each tag has a valid color fallback
      const enriched = parsed.map((t: SubjectTag) => {
        if (!t.color) {
          const def = DEFAULT_SUBJECT_TAGS.find((d) => d.id === t.id);
          return { ...t, color: def?.color || "sky" };
        }
        return t;
      });
      // Ensure "all" is always the first tag
      const hasAll = enriched.some((t: SubjectTag) => t.id === "all");
      if (!hasAll) {
        return [DEFAULT_SUBJECT_TAGS[0], ...enriched];
      }
      return enriched;
    }
  } catch {
    // Fall back to defaults
  }
  return DEFAULT_SUBJECT_TAGS;
}

export function saveSubjectTags(tags: SubjectTag[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
  } catch {
    // quota or privacy block
  }
}

export function resetSubjectTagsToDefault(): SubjectTag[] {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  return DEFAULT_SUBJECT_TAGS;
}
