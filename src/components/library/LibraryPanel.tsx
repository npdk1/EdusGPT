"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Archive,
  Atom,
  BookOpen,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  Dna,
  Edit3,
  Flame,
  FlaskConical,
  FolderOpen,
  Globe,
  HelpCircle,
  Landmark,
  Languages,
  LayoutGrid,
  LoaderCircle,
  MoreVertical,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Tags,
  Target,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useCopy, useLang } from "@/i18n/provider";
import { CourseSettingsModal } from "./CourseSettingsModal";
import { TrashModal } from "./TrashModal";
import { EditCourseTagModal } from "./EditCourseTagModal";
import { ManageTagsModal } from "./ManageTagsModal";
import {
  DEFAULT_SUBJECT_TAGS,
  getTagIconComponent,
  getTagColorConfig,
  loadSavedSubjectTags,
  saveSubjectTags,
  type SubjectTag,
} from "@/lib/library/subject-tags";
import { getActiveLessonId } from "@/lib/lesson/storage";
import { getStudentProfile } from "@/lib/student/profile";
import { resolveSlideTheme } from "@/lib/lesson/themes";
import { sceneKindLabel } from "@/lib/lesson/types";

/**
 * The screen's own sentences, in both languages.
 */
const COPY = {
  en: {
    pageTitle: "Lesson Library",
    pageSubtitle: "Interactive video lessons with AI tutor, second-by-second scrubbing and quizzes",
    libraryRefresh: "Refresh",
    libraryTrash: "Trash",
    libraryTrashTitle: "View temporarily deleted lessons & restore backups",
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
    emptyNoCoursesTitle: "Your library is empty",
    emptyNoCoursesDesc: "No lessons saved on your machine yet. Go to Studio to create your first AI interactive lesson!",
    emptyNoCoursesAction: "Create new lesson",
    emptyTitle: "Your learning library is ready",
    emptyDesc: "Generate interactive AI lessons on any topic, complete with voice narration, synchronized visual slides, and quizzes.",
    emptyCreateBtn: "Create your first lesson",
    featureAiTitle: "Interactive AI Tutor",
    featureAiDesc: "Natural voice narration explaining complex concepts step by step",
    featureTimelineTitle: "Second-by-Second Timeline",
    featureTimelineDesc: "Jump to any scene instantly with synchronized visual slides",
    featureQuizTitle: "Quizzes & Flashcards",
    featureQuizDesc: "Reinforce learning with instant self-assessments and build your streak",
    metricLessons: "Total Lessons",
    metricCompleted: "Completed",
    metricDuration: "Total Duration",
    metricStreak: "Learning Streak",
    metricLessonsUnit: "lessons",
    metricMinutesUnit: "mins",
    metricDaysUnit: "days",
    continueLearning: "Continue recent lesson",
    continueProgress: "Lesson progress",
    continueAction: "Continue learning",
    continueQuizAction: "Practice Quiz",
    librarySample: "Sample",
    libraryOpen: "Start Learning",
    libraryQuizTitle: "Practice with multiple-choice quiz",
    libraryQuiz: "Quiz",
    libraryFlashcard: "Flashcards",
    librarySettings: "Lesson Settings",
    libraryDelete: "Delete Lesson",
    libraryPageOf: "Page {page} of {total}",
    libraryShowing: "Showing {from}–{to} of {count} lessons",
    libraryPrevious: "Previous page",
    libraryNext: "Next page",
    librarySearchPlaceholder: "Search lessons by title, subject, grade, or topic...",
    librarySearchMatch: "Found {count} lessons matching \"{query}\"",
    librarySearchEmptyTitle: "No matching lessons found",
    librarySearchEmptyDesc: "No lessons found matching \"{query}\". Try a different keyword or reset filters.",
    libraryResetSearch: "Reset search",
    libraryClearSearch: "Clear search query",
    pillAll: "All",
    pillMath: "Math",
    pillPhysics: "Physics",
    pillChemistry: "Chemistry",
    pillBiology: "Biology",
    pillHistory: "History",
    pillCS: "Computer Science",
    pillLanguages: "Languages",
    moreOptions: "More options",
  },
  vi: {
    pageTitle: "Thư viện Bài giảng",
    pageSubtitle: "Học tập tương tác với trợ giảng AI, dòng thời gian tua từng giây và luyện tập trắc nghiệm",
    libraryRefresh: "Làm mới",
    libraryTrash: "Thùng rác",
    libraryTrashTitle: "Xem bài đã xóa tạm thời & khôi phục sao lưu",
    libraryDeleteAll: "Xoá tất cả",
    libraryDeleteAllTitle: "Xoá mọi bài giảng trong thư viện",
    libraryDeleteAllConfirm: "Xoá toàn bộ {n} bài giảng trong thư viện? Thao tác này không thể hoàn tác.",
    libraryNewLesson: "Tạo bài mới",
    libraryCreating: "Đang tạo",
    libraryScenes: "cảnh",
    libraryCreateFailed: "Tạo bài giảng thất bại",
    libraryStoppedHint: "Có thể tiến trình đã dừng (máy chủ tắt giữa chừng)",
    libraryViewProgressTitle: "Mở phiên làm việc trực tiếp để xem và nghe từng cảnh",
    libraryViewProgress: "Xem tiến trình",
    libraryDeleteDraft: "Xoá bản nháp {title}",
    libraryDeleteCourse: "Xoá {title}",
    libraryJustNow: "vừa xong",
    libraryMinutesAgo: "{n} phút trước",
    libraryHoursAgo: "{n} giờ trước",
    libraryDaysAgo: "{n} ngày trước",
    libraryLoadFailed: "Không tải được thư viện.",
    libraryNetworkError: "Lỗi mạng.",
    libraryDeleteLessonFailed: "Không xoá được bài giảng.",
    libraryDeleteLibraryFailed: "Không xoá sạch được thư viện.",
    libraryLoading: "Đang tải thư viện…",
    emptyNoCoursesTitle: "Chưa có bài giảng nào trong thư viện",
    emptyNoCoursesDesc: "Chưa có bài giảng nào được lưu trên máy của bạn. Hãy sang Studio để tạo bài học đầu tiên bằng AI!",
    emptyNoCoursesAction: "Tạo bài giảng mới",
    emptyTitle: "Thư viện bài giảng của bạn đang sẵn sàng",
    emptyDesc: "Tạo bài giảng tương tác bằng AI về mọi chủ đề với giọng đọc truyền cảm, slide đồng bộ và câu hỏi trắc nghiệm.",
    emptyCreateBtn: "Tạo bài giảng đầu tiên",
    featureAiTitle: "Trợ giảng AI tương tác",
    featureAiDesc: "Giảng bài bằng giọng nói tự nhiên, giải thích cặn kẽ từng khái niệm",
    featureTimelineTitle: "Tua chính xác từng giây",
    featureTimelineDesc: "Xem slide chuyển động đồng bộ, tua đến bất kỳ nội dung nào",
    featureQuizTitle: "Trắc nghiệm & Flashcard",
    featureQuizDesc: "Luyện tập củng cố kiến thức và tích lũy chuỗi ngày học tập (Streak)",
    metricLessons: "Bài giảng",
    metricCompleted: "Đã hoàn thành",
    metricDuration: "Thời lượng",
    metricStreak: "Chuỗi học tập",
    metricLessonsUnit: "bài",
    metricMinutesUnit: "phút",
    metricDaysUnit: "ngày",
    continueLearning: "Tiếp tục bài học gần nhất",
    continueProgress: "Tiến độ bài học",
    continueAction: "Tiếp tục học ngay",
    continueQuizAction: "Luyện Quiz",
    librarySample: "Bài mẫu",
    libraryOpen: "Vào học ngay",
    libraryQuizTitle: "Luyện tập trắc nghiệm",
    libraryQuiz: "Trắc nghiệm",
    libraryFlashcard: "Flashcard",
    librarySettings: "Cài đặt bài giảng",
    libraryDelete: "Xóa bài giảng",
    libraryPageOf: "Trang {page} / {total}",
    libraryShowing: "Hiển thị {from}–{to} trong số {count} bài",
    libraryPrevious: "Trang trước",
    libraryNext: "Trang sau",
    librarySearchPlaceholder: "Tìm bài giảng theo tên, môn học, khối lớp hoặc chủ đề...",
    librarySearchMatch: "Tìm thấy {count} bài giảng khớp với \"{query}\"",
    librarySearchEmptyTitle: "Không tìm thấy bài giảng phù hợp",
    librarySearchEmptyDesc: "Không có bài giảng nào khớp với \"{query}\". Bạn có thể thử từ khóa khác hoặc xóa bộ lọc.",
    libraryResetSearch: "Đặt lại tìm kiếm",
    libraryClearSearch: "Xóa từ khóa",
    pillAll: "Tất cả",
    pillMath: "Toán học",
    pillPhysics: "Vật lý",
    pillChemistry: "Hóa học",
    pillBiology: "Sinh học",
    pillHistory: "Lịch sử",
    pillCS: "Tin học",
    pillLanguages: "Tiếng Anh",
    moreOptions: "Tùy chọn khác",
  },
};

type LibraryCopy = (typeof COPY)["en"];

interface CourseSummary {
  id: string;
  title: string;
  subject: string;
  grade?: string;
  topic?: string;
  duration: number;
  sceneCount: number;
  updatedAt: string;
  source?: string;
  theme?: string;
  voice?: string;
  firstScene?: {
    id: string;
    title: string;
    subtitle?: string;
    bullets?: string[];
    kind?: string;
    imageUrl?: string;
    layout?: string;
    accent?: string;
    icon?: string;
  };
}

interface DraftInfo {
  id: string;
  title: string;
  subject?: string;
  done: number;
  total: number;
  updatedAt: string;
  message?: string;
  error?: string;
  voice?: string;
}

const STALE_DRAFT_MS = 10 * 60 * 1000;

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

interface SubjectTheme {
  Icon: typeof BookOpen;
  accent: string;
  badge: string;
  bgGlow: string;
}

function getSubjectTheme(subject: string): SubjectTheme {
  const s = (subject || "").toLowerCase();
  if (s.includes("toán") || s.includes("math")) {
    return {
      Icon: Calculator,
      accent: "text-sky-600 dark:text-sky-400",
      badge: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
      bgGlow: "from-sky-500/15 via-ink-900 to-ink-950",
    };
  }
  if (s.includes("lý") || s.includes("vật lý") || s.includes("physic")) {
    return {
      Icon: Atom,
      accent: "text-amber-600 dark:text-amber-400",
      badge: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      bgGlow: "from-amber-500/15 via-ink-900 to-ink-950",
    };
  }
  if (s.includes("hóa") || s.includes("chem")) {
    return {
      Icon: FlaskConical,
      accent: "text-emerald-600 dark:text-emerald-400",
      badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      bgGlow: "from-emerald-500/15 via-ink-900 to-ink-950",
    };
  }
  if (s.includes("sinh") || s.includes("bio")) {
    return {
      Icon: Dna,
      accent: "text-teal-600 dark:text-teal-400",
      badge: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
      bgGlow: "from-teal-500/15 via-ink-900 to-ink-950",
    };
  }
  if (s.includes("sử") || s.includes("lịch sử") || s.includes("history")) {
    return {
      Icon: Landmark,
      accent: "text-rose-600 dark:text-rose-400",
      badge: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
      bgGlow: "from-rose-500/15 via-ink-900 to-ink-950",
    };
  }
  if (s.includes("địa") || s.includes("geography") || s.includes("geo")) {
    return {
      Icon: Globe,
      accent: "text-emerald-600 dark:text-emerald-400",
      badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      bgGlow: "from-emerald-500/15 via-ink-900 to-ink-950",
    };
  }
  if (s.includes("tin") || s.includes("code") || s.includes("it") || s.includes("lập trình") || s.includes("computer")) {
    return {
      Icon: Code2,
      accent: "text-cyan-600 dark:text-cyan-400",
      badge: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
      bgGlow: "from-cyan-500/15 via-ink-900 to-ink-950",
    };
  }
  if (s.includes("tiếng anh") || s.includes("english") || s.includes("ngoại ngữ")) {
    return {
      Icon: Languages,
      accent: "text-orange-600 dark:text-orange-400",
      badge: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
      bgGlow: "from-orange-500/15 via-ink-900 to-ink-950",
    };
  }
  if (s.includes("văn") || s.includes("literature") || s.includes("văn học")) {
    return {
      Icon: BookOpen,
      accent: "text-amber-600 dark:text-amber-400",
      badge: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      bgGlow: "from-amber-500/15 via-ink-900 to-ink-950",
    };
  }
  if (s.includes("kinh tế") || s.includes("finance") || s.includes("economy")) {
    return {
      Icon: TrendingUp,
      accent: "text-green-600 dark:text-green-400",
      badge: "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300",
      bgGlow: "from-green-500/15 via-ink-900 to-ink-950",
    };
  }
  return {
    Icon: BookOpen,
    accent: "text-brand-600 dark:text-brand-400",
    badge: "border-brand-500/30 bg-brand-500/10 text-brand-700 dark:text-brand-300",
    bgGlow: "from-brand-500/15 via-ink-900 to-ink-950",
  };
}

/** Miniature Slide 1 faithful replica for course thumbnails (like Canva/Google Slides previews). */
function Slide1Thumbnail({
  course,
  lang,
}: {
  course: CourseSummary;
  lang: "vi" | "en";
}) {
  const themePreset = resolveSlideTheme(course.theme);
  const palette = themePreset.palette;
  const first = course.firstScene;
  const title = first?.title || course.title;
  const subtitle = first?.subtitle;
  const bullets = first?.bullets || [];
  const kindLabel = sceneKindLabel((first?.kind as any) || "cover", lang);

  return (
    <div
      className="relative h-full w-full overflow-hidden select-none flex flex-col justify-between p-3.5 transition-transform duration-300"
      style={{
        backgroundColor: palette.bg,
        color: palette.ink,
      }}
    >
      {/* Background slide frame border */}
      <div
        className="pointer-events-none absolute inset-0 border"
        style={{ borderColor: `${palette.rule}80` }}
      />

      {/* Slide Top: Kicker badge & Slide 01 index */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider shadow-2xs"
          style={{
            backgroundColor: `${palette.accent}18`,
            color: palette.accent,
            border: `1px solid ${palette.accent}30`,
          }}
        >
          {kindLabel}
        </span>
        <span
          className="font-mono text-[9px] font-bold"
          style={{ color: palette.inkFaint }}
        >
          01
        </span>
      </div>

      {/* Center content: Main Title & Subtitle */}
      <div className="relative z-10 my-auto flex flex-col items-center text-center px-1">
        <h4
          className="text-xs sm:text-sm font-black tracking-tight leading-snug line-clamp-2"
          style={{ color: palette.ink }}
        >
          {title}
        </h4>
        {subtitle ? (
          <p
            className="mt-1 text-[10px] leading-tight line-clamp-1 font-medium"
            style={{ color: palette.inkSoft }}
          >
            {subtitle}
          </p>
        ) : null}
        <div
          className="my-1.5 h-0.5 w-8 rounded-full"
          style={{ backgroundColor: `${palette.accent}50` }}
        />
      </div>

      {/* Bottom: Bullets / Key Points as miniature sunken cards */}
      {bullets.length > 0 ? (
        <div className="relative z-10 space-y-1">
          {bullets.slice(0, 2).map((bullet, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 border shadow-2xs text-[9px] font-medium leading-none"
              style={{
                backgroundColor: palette.bgSunk,
                borderColor: `${palette.rule}90`,
                color: palette.ink,
              }}
            >
              <span
                className="font-mono font-bold text-[8px] shrink-0"
                style={{ color: palette.accent }}
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span className="truncate">{bullet}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="relative z-10 flex items-center justify-between text-[9px]">
          <span className="font-semibold truncate max-w-[80%]" style={{ color: palette.inkSoft }}>
            {course.subject} {course.grade ? `· ${course.grade}` : ""}
          </span>
          <span className="font-mono text-[8px]" style={{ color: palette.inkFaint }}>
            EdusGPT
          </span>
        </div>
      )}
    </div>
  );
}

/** Server-backed course library — survives a browser reinstall. */
export function LibraryPanel() {
  const lang = useLang();
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
  const [settingsCourse, setSettingsCourse] = useState<CourseSummary | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingTagCourse, setEditingTagCourse] = useState<CourseSummary | null>(null);
  const [isManageTagsOpen, setIsManageTagsOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [subjectTags, setSubjectTags] = useState<SubjectTag[]>(DEFAULT_SUBJECT_TAGS);
  const [tagToast, setTagToast] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [studentProfile, setStudentProfile] = useState<ReturnType<typeof getStudentProfile>>(getStudentProfile());

  useEffect(() => {
    setMounted(true);
    setStudentProfile(getStudentProfile());
    setSubjectTags(loadSavedSubjectTags());
  }, []);

  // Close card context dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".course-menu-container")) {
        setActiveMenuId(null);
      }
    };
    if (activeMenuId) {
      window.addEventListener("click", handleOutsideClick);
    }
    return () => window.removeEventListener("click", handleOutsideClick);
  }, [activeMenuId]);

  const activeLessonId = typeof window !== "undefined" ? getActiveLessonId() : null;
  const continueCourse =
    (activeLessonId ? courses.find((c) => c.id === activeLessonId) : null) ||
    courses[0] ||
    null;
  const continueTheme = continueCourse ? getSubjectTheme(continueCourse.subject) : null;
  const continueProgress =
    (continueCourse && studentProfile.lessonProgress[continueCourse.id]?.percent) || 0;

  const completedCount = studentProfile.completedLessons.length;
  const totalDurationMinutes = Math.round(
    courses.reduce((acc, c) => acc + (c.duration || 0), 0) / 60
  );

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
    setActiveMenuId(null);
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

  const openSettings = useCallback((course: CourseSummary) => {
    setSettingsCourse(course);
    setIsSettingsOpen(true);
    setActiveMenuId(null);
  }, []);

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
    setSettingsCourse(null);
  }, []);

  const handleSaveTags = useCallback((newTags: SubjectTag[]) => {
    setSubjectTags(newTags);
    saveSubjectTags(newTags);
  }, []);

  const handleCourseUpdated = useCallback(
    (updated: { id: string; subject: string; grade?: string }) => {
      setCourses((prev) =>
        prev.map((c) =>
          c.id === updated.id
            ? { ...c, subject: updated.subject, grade: updated.grade ?? c.grade }
            : c,
        ),
      );
      setTagToast(
        lang === "vi"
          ? `Đã cập nhật thẻ môn học thành "${updated.subject}"!`
          : `Updated subject tag to "${updated.subject}"!`,
      );
      setTimeout(() => setTagToast(null), 3500);
    },
    [lang],
  );

  return (
    <div className="space-y-6">
      {/* LMS Learning Portal Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-ink-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-mist-50">
            {t.pageTitle}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-mist-400">
            {t.pageSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void load(page)}
            className="btn-ghost"
            title={t.libraryRefresh}
          >
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin text-mist-300" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{t.libraryRefresh}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsTrashOpen(true)}
            className="btn-ghost text-gold-400 hover:text-gold-300 hover:bg-gold-500/10"
            title={t.libraryTrashTitle}
          >
            <Archive className="h-4 w-4" />
            <span className="hidden sm:inline">{t.libraryTrash}</span>
          </button>

          {totalCourses > 0 ? (
            <button
              type="button"
              onClick={() => void removeAll()}
              disabled={clearing || loading}
              className="btn-ghost text-red-500 hover:text-red-600"
              title={t.libraryDeleteAllTitle}
            >
              {clearing ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{t.libraryDeleteAll}</span>
            </button>
          ) : null}

          <Link
            href="/studio"
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs font-bold shadow-md shadow-white/10"
          >
            <Sparkles className="h-4 w-4" />
            <span>{t.libraryNewLesson}</span>
          </Link>
        </div>
      </div>

      {/* Ongoing Drafts */}
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

      {/* Quick LMS Metrics Ribbon */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-900/60 p-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-brand-500/30 bg-brand-500/10 text-brand-400">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-mist-400">{t.metricLessons}</p>
            <p className="text-base font-bold text-mist-100">{totalCourses} {t.metricLessonsUnit}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-900/60 p-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <Target className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-mist-400">{t.metricCompleted}</p>
            <p className="text-base font-bold text-mist-100" suppressHydrationWarning>
              {mounted ? completedCount : 0} {t.metricLessonsUnit}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-900/60 p-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-400">
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-mist-400">{t.metricDuration}</p>
            <p className="text-base font-bold text-mist-100">{totalDurationMinutes} {t.metricMinutesUnit}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-900/60 p-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <Flame className="h-5 w-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-mist-400">{t.metricStreak}</p>
            <p className="text-base font-bold text-mist-100" suppressHydrationWarning>
              {mounted ? studentProfile.streak : 1} {t.metricDaysUnit}
            </p>
          </div>
        </div>
      </div>

      {/* Continue Learning Hero Card (Coursera / Netflix style) */}
      {continueCourse && !searchQuery.trim() && page === 1 && continueTheme ? (
        <div className="relative overflow-hidden rounded-2xl border border-ink-800 bg-gradient-to-r from-ink-900 via-ink-850 to-ink-900 p-5 sm:p-6 shadow-md">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
            {/* Left: Slide 1 Miniature Preview */}
            <Link
              href={`/lesson?c=${encodeURIComponent(continueCourse.id)}`}
              className="group relative block w-full sm:w-60 md:w-56 shrink-0 aspect-video rounded-xl overflow-hidden shadow-md ring-1 ring-ink-700/60 transition-transform hover:scale-[1.02]"
              title={t.continueAction}
            >
              <Slide1Thumbnail course={continueCourse} lang={lang} />

              {/* Hover Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity duration-200 group-hover:opacity-100 z-20">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30 transform transition-transform group-hover:scale-110">
                  <Play className="h-5 w-5 fill-current ml-0.5" />
                </div>
              </div>
            </Link>

            {/* Middle: Course Info & Progress */}
            <div className="space-y-3 flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/15 px-2.5 py-0.5 text-xs font-bold text-red-500 dark:text-red-400">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  {t.continueLearning}
                </span>
                <span className="rounded-full border border-ink-700 bg-ink-800/80 px-2.5 py-0.5 text-xs font-medium text-mist-300">
                  {continueCourse.subject} {continueCourse.grade ? `· ${continueCourse.grade}` : ""}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-extrabold text-mist-50 tracking-tight line-clamp-2">
                {continueCourse.title}
              </h2>

              {/* Progress bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs font-medium text-mist-300">
                  <span>{t.continueProgress}</span>
                  <span className="font-mono text-brand-500 dark:text-brand-300 font-bold">{continueProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-ink-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-amber-400 transition-all duration-500"
                    style={{ width: `${Math.max(5, continueProgress)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                href={`/lesson?c=${encodeURIComponent(continueCourse.id)}`}
                className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold shadow-lg shadow-white/10 hover:scale-105 active:scale-95"
              >
                <Play className="h-4 w-4 fill-current" />
                {t.continueAction}
              </Link>
              <Link
                href={`/quiz?c=${encodeURIComponent(continueCourse.id)}`}
                className="btn-ghost inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold"
              >
                <HelpCircle className="h-4 w-4 text-gold-500" />
                {t.continueQuizAction}
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* Search Bar & Clean Subject Filters */}
      <div data-tour="library-filter" className="space-y-3">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t.librarySearchPlaceholder}
            className="w-full rounded-xl border border-ink-800 bg-ink-900/80 px-4 py-3 pl-11 pr-10 text-xs sm:text-sm text-mist-100 placeholder:text-mist-500 focus:border-brand-500 focus:bg-ink-900 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all shadow-inner"
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

        {/* Clean Subject Filter Tabs with SVG Icons and Add/Manage actions */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {subjectTags.map((tag) => {
            const isSelected =
              (!tag.query && !searchQuery.trim()) ||
              (tag.query && searchQuery.toLowerCase().includes(tag.query.toLowerCase()));
            const TagIcon = getTagIconComponent(tag.iconName);
            const colorCfg = getTagColorConfig(tag.color);
            const label = lang === "vi" ? tag.label : tag.labelEn || tag.label;
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleSearchChange(tag.query)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
                  isSelected
                    ? `${colorCfg.activePillClass}`
                    : "border border-ink-800 bg-ink-900/60 text-mist-300 hover:border-ink-700 hover:bg-ink-850 hover:text-mist-100"
                }`}
              >
                <TagIcon
                  className={`h-3.5 w-3.5 transition-colors ${
                    isSelected ? "text-white" : colorCfg.accentClass
                  }`}
                />
                <span>{label}</span>
              </button>
            );
          })}

          {/* Quick Action: Thêm thẻ mới */}
          <button
            type="button"
            onClick={() => setIsManageTagsOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-ink-700 bg-ink-900/40 px-3 py-1.5 text-xs font-semibold text-brand-400 hover:border-brand-500 hover:bg-brand-500/10 hover:text-brand-300 transition-all"
            title={lang === "vi" ? "Thêm thẻ môn học mới" : "Add new subject tag"}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{lang === "vi" ? "Thêm thẻ" : "Add Tag"}</span>
          </button>

          {/* Quick Action: Quản lý thẻ */}
          <button
            type="button"
            onClick={() => setIsManageTagsOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-ink-800 bg-ink-900/40 px-2.5 py-1.5 text-xs font-medium text-mist-400 hover:border-ink-700 hover:bg-ink-850 hover:text-mist-200 transition-all"
            title={lang === "vi" ? "Quản lý / Xóa thẻ môn học" : "Manage / Delete subject tags"}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{lang === "vi" ? "Quản lý thẻ" : "Manage"}</span>
          </button>
        </div>
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
            className="text-brand-500 hover:underline font-medium"
          >
            {t.libraryResetSearch}
          </button>
        </div>
      ) : null}

      {/* Main Content Area */}
      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-64 rounded-2xl border border-ink-800 bg-ink-900/40 animate-pulse p-4 flex flex-col justify-between"
            >
              <div className="h-32 rounded-xl bg-ink-800/60" />
              <div className="space-y-2">
                <div className="h-4 w-3/4 rounded bg-ink-800/60" />
                <div className="h-3 w-1/2 rounded bg-ink-800/40" />
              </div>
              <div className="h-9 rounded-xl bg-ink-800/50" />
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        totalCourses === 0 && !searchQuery.trim() ? (
          /* Clean empty library box */
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-800 bg-ink-900/30 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-ink-700 bg-ink-800/60 text-mist-300 shadow-inner">
              <BookOpen className="h-7 w-7 text-mist-300" />
            </div>
            <h3 className="mt-4 text-base sm:text-lg font-bold text-mist-100">
              {t.emptyNoCoursesTitle}
            </h3>
            <p className="mt-1.5 max-w-md text-xs sm:text-sm text-mist-400 leading-relaxed">
              {t.emptyNoCoursesDesc}
            </p>
            <Link
              href="/studio"
              className="btn-primary mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold shadow-md shadow-white/10 hover:scale-105 active:scale-95 transition-all"
            >
              <Sparkles className="h-4 w-4" />
              <span>{t.emptyNoCoursesAction}</span>
            </Link>
          </div>
        ) : (
          /* Empty search results */
          <div className="panel p-10 text-center">
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
        )
      ) : (
        <>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => {
                const theme = getSubjectTheme(course.subject);
                const ThemeIcon = theme.Icon;
                const progress = studentProfile.lessonProgress[course.id]?.percent || 0;
                const isMenuOpen = activeMenuId === course.id;

                return (
                  <li
                    key={course.id}
                    className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-800 bg-ink-900/70 transition-all duration-200 hover:border-ink-700 hover:bg-ink-900 hover:shadow-xl hover:-translate-y-0.5"
                  >
                    {/* Top Thumbnail Header (16:9 Coursera/YouTube aspect ratio) */}
                    <Link
                      href={`/lesson?c=${encodeURIComponent(course.id)}`}
                      className="group relative block h-44 w-full overflow-hidden border-b border-ink-800"
                    >
                      <Slide1Thumbnail course={course} lang={lang} />

                      {/* Floating pill badges on top */}
                      <div className="absolute top-2.5 inset-x-2.5 z-20 flex items-center justify-between gap-1.5 pointer-events-none">
                        <span className="rounded-md border border-ink-700/80 bg-ink-950/85 px-2 py-0.5 text-[10px] font-semibold text-mist-200 backdrop-blur-md shadow-sm">
                          {course.source === "gemini" ? "AI Lesson" : t.librarySample}
                        </span>
                        <span className="flex items-center gap-1 rounded-md border border-ink-700/80 bg-ink-950/85 px-2 py-0.5 text-[10px] font-mono text-mist-200 backdrop-blur-md shadow-sm">
                          <Clock className="h-3 w-3 text-mist-400" />
                          {formatClock(course.duration)}
                        </span>
                      </div>

                      {/* Hover Play Button Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity duration-200 group-hover:opacity-100 backdrop-blur-[1px] z-20">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30 transform transition-transform group-hover:scale-110">
                          <Play className="h-5 w-5 fill-current ml-0.5" />
                        </div>
                      </div>
                    </Link>

                    {/* Card Body */}
                    <div className="flex flex-1 flex-col p-4">
                      {/* Subject & Grade Tag - Clickable to quickly edit subject tag */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingTagCourse(course);
                          }}
                          className={`group/tag inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold ${theme.badge} hover:ring-1 hover:ring-brand-500/50 hover:scale-[1.02] transition-all cursor-pointer`}
                          title={lang === "vi" ? "Bấm để đổi thẻ môn học" : "Click to edit subject tag"}
                        >
                          <ThemeIcon className="h-3 w-3" />
                          <span>{course.subject}</span>
                          <Edit3 className="h-2.5 w-2.5 opacity-60 group-hover/tag:opacity-100 transition-opacity ml-0.5 text-mist-400" />
                        </button>
                        {course.grade ? (
                          <span className="text-xs font-medium text-mist-400">
                            Khối {course.grade}
                          </span>
                        ) : null}
                      </div>

                      {/* Course Title */}
                      <h3 className="mt-2 text-sm font-bold text-mist-50 transition-colors group-hover:text-brand-500 line-clamp-2 leading-snug">
                        <Link href={`/lesson?c=${encodeURIComponent(course.id)}`}>
                          {course.title}
                        </Link>
                      </h3>

                      {/* Meta info */}
                      <p className="mt-1 text-xs text-mist-400">
                        {course.sceneCount} {t.libraryScenes} · {relative(course.updatedAt, t)}
                      </p>

                      {/* Progress Bar (if started) */}
                      {progress > 0 ? (
                        <div className="mt-3 space-y-1">
                          <div className="flex justify-between text-[11px] font-medium text-mist-400">
                            <span>{t.continueProgress}</span>
                            <span className="font-mono text-brand-500 font-bold">{progress}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
                            <div
                              className="h-full rounded-full bg-brand-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 h-1.5" />
                      )}

                      {/* Card Footer: Clean, 2 Action Items + Context Menu */}
                      <div className="mt-auto flex items-center gap-2 pt-3 border-t border-ink-800">
                        <Link
                          href={`/lesson?c=${encodeURIComponent(course.id)}`}
                          className="btn-primary flex-1 justify-center py-2 text-xs font-semibold shadow-sm"
                          title={t.libraryOpen}
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>{t.libraryOpen}</span>
                        </Link>

                        <Link
                          href={`/quiz?c=${encodeURIComponent(course.id)}`}
                          className="btn-ghost py-2 text-xs font-semibold"
                          title={t.libraryQuizTitle}
                        >
                          <HelpCircle className="h-3.5 w-3.5 text-gold-500" />
                          <span>{t.libraryQuiz}</span>
                        </Link>

                        {/* 3-dots Context Menu Container */}
                        <div className="course-menu-container relative">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveMenuId(isMenuOpen ? null : course.id)
                            }
                            className="btn-icon h-8 w-8 text-mist-400 hover:text-mist-100"
                            title={t.moreOptions}
                            aria-label={t.moreOptions}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {/* Floating Context Popover Menu */}
                          {isMenuOpen ? (
                            <div className="absolute right-0 bottom-full mb-1.5 z-30 w-48 rounded-xl border border-ink-700 bg-ink-950 p-1.5 shadow-2xl animate-fade-in">
                              <Link
                                href={`/flashcard?c=${encodeURIComponent(course.id)}`}
                                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-mist-200 hover:bg-ink-800 hover:text-mist-50"
                                onClick={() => setActiveMenuId(null)}
                              >
                                <Sparkles className="h-3.5 w-3.5 text-brand-400" />
                                <span>{t.libraryFlashcard}</span>
                              </Link>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTagCourse(course);
                                  setActiveMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-mist-200 hover:bg-ink-800 hover:text-mist-50"
                              >
                                <Tag className="h-3.5 w-3.5 text-brand-400" />
                                <span>{lang === "vi" ? "Đổi thẻ môn học" : "Change Subject Tag"}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => openSettings(course)}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-mist-200 hover:bg-ink-800 hover:text-mist-50"
                              >
                                <Settings className="h-3.5 w-3.5 text-mist-400" />
                                <span>{t.librarySettings}</span>
                              </button>

                              <div className="my-1 border-t border-ink-800" />

                              <button
                                type="button"
                                onClick={() => void remove(course.id)}
                                disabled={busyId === course.id}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-red-500 hover:bg-red-500/10 hover:text-red-600"
                              >
                                {busyId === course.id ? (
                                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                <span>{t.libraryDelete}</span>
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

          {/* Pagination */}
          {totalPages > 1 ? (
            <nav
              aria-label="Pagination"
              className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-800 pt-4"
            >
              <div className="text-xs text-mist-400">
                {t.libraryShowing
                  .replace("{from}", String((page - 1) * 9 + 1))
                  .replace("{to}", String(Math.min(page * 9, totalCourses)))
                  .replace("{count}", String(totalCourses))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const prev = Math.max(1, page - 1);
                    setPage(prev);
                    void load(prev, searchQuery);
                  }}
                  disabled={page <= 1 || loading}
                  className="btn-ghost px-2.5 py-1.5 text-xs"
                  aria-label={t.libraryPrevious}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-mono text-xs text-mist-300">
                  {t.libraryPageOf
                    .replace("{page}", String(page))
                    .replace("{total}", String(totalPages))}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.min(totalPages, page + 1);
                    setPage(next);
                    void load(next, searchQuery);
                  }}
                  disabled={page >= totalPages || loading}
                  className="btn-ghost px-2.5 py-1.5 text-xs"
                  aria-label={t.libraryNext}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </nav>
          ) : null}
        </>
      )}

      {/* Cài đặt bài giảng (Modal) */}
      {isSettingsOpen && settingsCourse ? (
        <CourseSettingsModal
          course={settingsCourse as any}
          isOpen={isSettingsOpen}
          onClose={closeSettings}
          onRefresh={() => {
            closeSettings();
            void load(page, searchQuery, true);
          }}
        />
      ) : null}

      {/* Chỉnh sửa thẻ môn học bài giảng (Modal) */}
      {editingTagCourse ? (
        <EditCourseTagModal
          course={editingTagCourse}
          isOpen={Boolean(editingTagCourse)}
          onClose={() => setEditingTagCourse(null)}
          availableTags={subjectTags}
          onCourseUpdated={handleCourseUpdated}
          lang={lang}
        />
      ) : null}

      {/* Quản lý danh sách thẻ lọc môn học (Modal) */}
      <ManageTagsModal
        isOpen={isManageTagsOpen}
        onClose={() => setIsManageTagsOpen(false)}
        tags={subjectTags}
        onSaveTags={handleSaveTags}
        lang={lang}
      />

      {/* Thùng rác & khôi phục bài giảng (Modal) */}
      <TrashModal
        isOpen={isTrashOpen}
        onClose={() => setIsTrashOpen(false)}
        onRestored={() => void load(page, searchQuery, true)}
      />

      {/* Notification Toast */}
      {tagToast ? (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-brand-500/40 bg-ink-950 px-4 py-3 text-xs font-bold text-mist-50 shadow-2xl animate-fade-in">
          <Sparkles className="h-4 w-4 text-brand-400" />
          <span>{tagToast}</span>
        </div>
      ) : null}
    </div>
  );
}
