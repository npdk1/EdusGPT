"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CircleCheck,
  TriangleAlert,
  FileJson,
  FileText,
  Globe,
  HelpCircle,
  LoaderCircle,
  Search,
  Volume2,
  Sparkles,
  X,
} from "lucide-react";
import { useTimebase, type LoopRange } from "@/hooks/useTimebase";
import { chapterIndexAt, sceneIndexAt, type Lesson } from "@/lib/lesson/types";
import { LESSONS_CHANGED_EVENT, loadStoredLessons } from "@/lib/lesson/storage";
import { normalizeVietnameseSearch, slugify } from "@/lib/format";
import { GsapSlideStage } from "./GsapSlideStage";
import { FullscreenControls } from "./FullscreenControls";
import { ScrubBar } from "./ScrubBar";
import { TransportBar } from "./TransportBar";
import { ChapterList } from "./ChapterList";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { FlashcardModal } from "./FlashcardModal";
import { QuizModal } from "./QuizModal";
import { TeacherVoice, type VoiceState } from "./TeacherVoice";
import { createNarrationChannel } from "@/lib/karaoke";
import { ClassroomAgentChat } from "./ClassroomAgentChat";
import { useCopy } from "@/i18n/provider";

const COPY = {
  en: {
    playerLessonLabel: "Choose a lesson",
    playerSearchPlaceholder: "Search lessons (title, subject)...",
    playerSearchEmpty: "No matching lessons",
    playerVoicePreparing: "Building voice",
    playerVoiceSpeaking: "Reading",
    playerExportHtml: "Export HTML",
    playerExportHtmlTitle: "Export as a self-contained offline interactive HTML player",
    exportHtmlKind: "Standalone HTML Lesson",
    playerExportJson: "JSON",
    playerExportSrt: "SRT",
    playerQuiz: "Quiz",
    playerQuizTitle: "Open interactive quiz practice mode",
    playerFlashcards: "Flashcards",
    playerFlashcardsTitle: "Open interactive flashcard revision mode",
    playerExportJsonTitle: "Download the lesson content as JSON",
    playerExportSrtTitle: "Download lesson subtitles as a standard .srt file",
    exportJsonKind: "Lesson data",
    exportSrtKind: "Subtitles (.srt)",
    exportSaved: 'Saved "{file}" to the folder you picked.',
    exportDownloaded:
      'The browser would not ask where to save — "{file}" is in your Downloads folder.',
    exportFailed: "Export failed",
    playerLibrarySection: "Saved in library",
    playerSamplesSection: "Sample lessons",
    playerViewLibrary: "Manage all in Library →",
    playerPlaying: "Playing",
    playerLessonsCount: "lessons",
  },
  vi: {
    playerLessonLabel: "Chọn bài giảng",
    playerSearchPlaceholder: "Tìm bài giảng (tiêu đề, môn học)...",
    playerSearchEmpty: "Không có bài học phù hợp",
    playerVoicePreparing: "Đang tạo giọng",
    playerVoiceSpeaking: "Đang đọc",
    playerExportHtml: "Xuất HTML",
    playerExportHtmlTitle: "Xuất bài giảng thành file HTML tự chạy offline không cần mạng",
    exportHtmlKind: "Bài giảng HTML độc lập",
    playerExportJson: "JSON",
    playerExportSrt: "SRT",
    playerQuiz: "Trắc nghiệm",
    playerQuizTitle: "Mở chế độ luyện trắc nghiệm tương tác",
    playerFlashcards: "Thẻ ghi nhớ",
    playerFlashcardsTitle: "Mở chế độ thẻ ghi nhớ ôn tập nhanh bài học",
    playerExportJsonTitle: "Tải nội dung bài giảng dạng JSON",
    playerExportSrtTitle: "Tải phụ đề bài giảng dạng tệp .srt chuẩn",
    exportJsonKind: "Dữ liệu bài giảng",
    exportSrtKind: "Phụ đề (.srt)",
    exportSaved: 'Đã lưu "{file}" vào nơi bạn chọn.',
    exportDownloaded:
      'Trình duyệt không cho chọn nơi lưu — file "{file}" nằm trong thư mục Tải xuống.',
    exportFailed: "Không xuất được file",
    playerLibrarySection: "Đã lưu trong thư viện",
    playerSamplesSection: "Bài học mẫu",
    playerViewLibrary: "Quản lý trong Thư viện →",
    playerPlaying: "Đang phát",
    playerLessonsCount: "bài học",
  },
};

/** Fills the one `{file}` slot in an export message. */
function withFile(copy: string, filename: string): string {
  return copy.replace("{file}", filename);
}

/** Saves a finished export through the browser's download path. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking in the same tick cancels the download on some browsers:
  // give it a moment to start before the URL dies.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

interface LessonPlayerProps {
  initialLesson: Lesson;
  samples: Lesson[];
  initialMode?: "quiz" | "flashcard" | null;
}

export function LessonPlayer({ initialLesson, samples, initialMode }: LessonPlayerProps) {
  const t = useCopy(COPY);
  const [lesson, setLesson] = useState<Lesson>(initialLesson);
  const [stored, setStored] = useState<Lesson[]>([]);
  const [loop, setLoop] = useState<LoopRange>({ enabled: false, a: 0, b: 0 });
  const [helpOpen, setHelpOpen] = useState(false);
  const [flashcardsOpen, setFlashcardsOpen] = useState(initialMode === "flashcard");
  const [quizOpen, setQuizOpen] = useState(initialMode === "quiz");
  const [exportError, setExportError] = useState<string | null>(null);
  /** Where the exported file went, so a silent save never looks like a dud. */
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [activeScene, setActiveScene] = useState(0);
  const [voiceState, setVoiceState] = useState<VoiceState>({
    status: "idle", sceneIndex: null, sceneTitle: "", voice: "",
  });
  const [activeChapter, setActiveChapter] = useState(0);
  const [exporting, setExporting] = useState(false);
  /**
   * Whether the stage owns the whole screen.
   *
   * Tracked rather than read from `document.fullscreenElement` on every render:
   * the overlay is mounted and unmounted on this flag, and the browser's own
   * event is the only trustworthy source of the truth — pressing Escape leaves
   * fullscreen without ever calling our toggle.
   */
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
    } else {
      void stageWrapRef.current?.requestFullscreen?.().catch(() => undefined);
    }
  }, []);

  const stageWrapRef = useRef<HTMLDivElement>(null);
  /**
   * Where the voice publishes, and where every slide's subtitle reads.
   *
   * A plain object rather than state: the voice writes here on every animation
   * frame, and a state update would re-render the whole player — WebGL scene,
   * quiz, chapter list and all — sixty times a second.
   */
  const narration = useRef(createNarrationChannel()).current;

  const timebase = useTimebase({
    duration: lesson.duration,
    fps: lesson.fps,
    loop,
  });

  // Stable handles out of the per-render `timebase` object, so the keyboard
  // listener below is attached once instead of on every render.
  const {
    seek: tbSeek,
    seekBy: tbSeekBy,
    toggle: tbToggle,
    play: tbPlay,
    pause: tbPause,
    stepFrames: tbStepFrames,
    setRate: tbSetRate,
    toggleMute: tbToggleMute,
    duration: tbDuration,
    rate: tbRate,
  } = timebase;

  // Escape and the browser's own fullscreen button both leave fullscreen without
  // routing through `toggleFullscreen`, so the flag follows the document.
  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement === stageWrapRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const library = useMemo(() => {
    // The playing lesson leads: it may come from the server (`?c=`) and exist
    // in neither list, and the select must show what is actually playing —
    // never a stale sample title.
    const byId = new Map<string, Lesson>();
    byId.set(lesson.id, lesson);
    [...samples, ...stored].forEach((item) => {
      if (!byId.has(item.id)) byId.set(item.id, item);
    });
    return Array.from(byId.values());
  }, [lesson, samples, stored]);

  const [serverCourses, setServerCourses] = useState<
    Array<{
      id: string;
      title: string;
      subject: string;
      grade?: string;
      source: "sample" | "gemini";
      sceneCount?: number;
      duration?: number;
    }>
  >([]);
  const [lessonSearch, setLessonSearch] = useState("");
  const [lessonSearchOpen, setLessonSearchOpen] = useState(false);

  const refreshServerCourses = useCallback(() => {
    fetch("/api/courses?all=true", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.courses && Array.isArray(data.courses)) {
          setServerCourses(data.courses);
        }
      })
      .catch(() => {});
  }, []);

  // --- stored & server-saved lessons synchronization -----------------------
  useEffect(() => {
    const sync = () => {
      setStored(loadStoredLessons());
      refreshServerCourses();
    };
    sync();
    window.addEventListener(LESSONS_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LESSONS_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [refreshServerCourses]);

  const allAvailableCourses = useMemo(() => {
    const byId = new Map<
      string,
      {
        id: string;
        title: string;
        subject: string;
        grade?: string;
        source: "sample" | "gemini";
        isServer?: boolean;
        sceneCount?: number;
        duration?: number;
      }
    >();

    // 1. Currently active lesson
    byId.set(lesson.id, {
      id: lesson.id,
      title: lesson.title,
      subject: lesson.subject,
      grade: lesson.grade,
      source: lesson.source,
      sceneCount: lesson.scenes?.length,
      duration: lesson.duration,
      isServer: lesson.source === "gemini",
    });

    // 2. Server courses from data/courses/ (user's library)
    serverCourses.forEach((item) => {
      if (!byId.has(item.id)) {
        byId.set(item.id, {
          ...item,
          isServer: true,
        });
      }
    });

    // 3. Local/bundled sample lessons
    library.forEach((item) => {
      if (!byId.has(item.id)) {
        byId.set(item.id, {
          id: item.id,
          title: item.title,
          subject: item.subject,
          grade: item.grade,
          source: item.source,
          sceneCount: item.scenes?.length,
          duration: item.duration,
          isServer: item.source === "gemini",
        });
      }
    });

    return Array.from(byId.values());
  }, [lesson, library, serverCourses]);

  const filteredLessons = useMemo(() => {
    const q = normalizeVietnameseSearch(lessonSearch);
    if (!q) return allAvailableCourses;
    return allAvailableCourses.filter((item) => {
      const t = normalizeVietnameseSearch(item.title);
      const s = normalizeVietnameseSearch(item.subject || "");
      const g = normalizeVietnameseSearch(item.grade || "");
      const id = normalizeVietnameseSearch(item.id);
      return t.includes(q) || s.includes(q) || g.includes(q) || id.includes(q);
    });
  }, [allAvailableCourses, lessonSearch]);

  const clearLoop = useCallback(() => setLoop({ enabled: false, a: 0, b: 0 }), []);

  const selectLessonById = useCallback(
    async (selectedId: string) => {
      setLessonSearchOpen(false);
      setLessonSearch("");
      if (selectedId === lesson.id) return;

      tbPause();
      tbSeek(0);
      clearLoop();

      const next = library.find((item) => item.id === selectedId);
      if (next) {
        setLesson(next);
        window.history.pushState(null, "", `/lesson?c=${encodeURIComponent(selectedId)}`);
        return;
      }
      try {
        const res = await fetch(`/api/courses?id=${encodeURIComponent(selectedId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.lesson) {
            setLesson(data.lesson);
            window.history.pushState(null, "", `/lesson?c=${encodeURIComponent(selectedId)}`);
          }
        }
      } catch {}
    },
    [clearLoop, lesson.id, library, tbPause, tbSeek],
  );

  // --- cheap React state: only changes when the scene actually changes -----
  // `subscribe` is a stable callback; the `timebase` object itself is fresh on
  // every render, so depending on it re-attached this subscription (and its
  // synchronous setState) on every render — the "Maximum update depth" loop.
  const subscribeTime = timebase.subscribe;
  useEffect(() => {
    return subscribeTime((time, meta) => {
      const scene = sceneIndexAt(lesson, time);
      const chapter = chapterIndexAt(lesson, time);
      setActiveScene((current) => (current === scene ? current : scene));
      setActiveChapter((current) => (current === chapter ? current : chapter));
    });
  }, [subscribeTime, lesson]);

  // --- A→B loop helpers ----------------------------------------------------
  // `timeRef` is the same ref object for the life of the hook, so this stays
  // stable while `timebase` itself is rebuilt every render.
  const playheadRef = timebase.timeRef;
  const setLoopPoint = useCallback(
    (point: "a" | "b") => {
      const time = Number(playheadRef.current.toFixed(3));
      setLoop((current) => {
        const next = { ...current };
        if (point === "a") next.a = time;
        else next.b = time;
        if (next.a > next.b) {
          if (point === "a") next.b = next.a + 2;
          else next.a = Math.max(0, next.b - 2);
        }
        return { ...next, enabled: next.b > next.a };
      });
    },
    [playheadRef],
  );

  // --- keyboard: every way to jump around the lecture ----------------------
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = event.key;
      const shift = event.shiftKey;

      if (/^[0-9]$/.test(key)) {
        event.preventDefault();
        tbSeek((Number(key) / 10) * tbDuration);
        return;
      }

      switch (key) {
        case " ":
        case "k":
        case "K":
          event.preventDefault();
          tbToggle();
          break;
        case "ArrowLeft":
          event.preventDefault();
          tbSeekBy(shift ? -1 : -5);
          break;
        case "ArrowRight":
          event.preventDefault();
          tbSeekBy(shift ? 1 : 5);
          break;
        case "j":
        case "J":
          event.preventDefault();
          tbSeekBy(-10);
          break;
        case "l":
        case "L":
          event.preventDefault();
          tbSeekBy(10);
          break;
        case ",":
          event.preventDefault();
          tbStepFrames(-1);
          break;
        case ".":
          event.preventDefault();
          tbStepFrames(1);
          break;
        case "Home":
          event.preventDefault();
          tbSeek(0);
          break;
        case "End":
          event.preventDefault();
          tbSeek(tbDuration);
          break;
        case "m":
        case "M":
          tbToggleMute();
          break;
        case "f":
        case "F":
          event.preventDefault();
          toggleFullscreen();
          break;
        case "[":
          setLoopPoint("a");
          break;
        case "]":
          setLoopPoint("b");
          break;
        case "\\":
          setLoop((current) => ({ ...current, enabled: !current.enabled }));
          break;
        case "?":
          setHelpOpen(true);
          break;
        case "+":
        case "=":
          tbSetRate(Math.min(tbRate + 0.25, 3));
          break;
        case "-":
          tbSetRate(Math.max(tbRate - 0.25, 0.25));
          break;
        case "Escape":
          setHelpOpen(false);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tbSeek, tbSeekBy, tbToggle, tbStepFrames, tbSetRate, tbToggleMute, tbDuration, tbRate, setLoopPoint]);

  // --- JSON export (the lesson content, for backups and imports) ------------
  const exportLesson = useCallback(async () => {
    const filename = `${slugify(lesson.title) || "bai-giang"}.lesson.json`;
    setExporting(true);
    setExportError(null);
    setExportNotice(null);
    /**
     * Ask where the file goes, the way every other program does.
     *
     * A blob download has no dialogue at all: the file lands in the
     * Downloads folder under a name nobody chose, which is what made this
     * button feel broken. Where the browser offers the picker we open it
     * first — before the (slow) export request, because a picker asked for
     * after an await is outside the click gesture and gets refused — then
     * write the finished bytes into the file the teacher picked.
     */
    let writable: FileSystemWritableFileStream | null = null;
    try {
      if (typeof window.showSaveFilePicker === "function") {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: t.exportJsonKind,
              accept: { "application/json": [".json"] },
            },
          ],
        });
        writable = await handle.createWritable();
      }
    } catch (error) {
      // Cancelling the dialogue is a decision, not a failure.
      if (error instanceof DOMException && error.name === "AbortError") {
        setExporting(false);
        return;
      }
      // No picker, or the browser refused one: fall through to the plain
      // download below rather than failing the export.
      writable = null;
    }
    try {
      const response = await fetch("/api/export/json", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lesson }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? `HTTP ${response.status}`);
      }
      const blob = await response.blob();
      if (writable) {
        await writable.write(blob);
        await writable.close();
        setExportNotice(withFile(t.exportSaved, filename));
      } else {
        downloadBlob(blob, filename);
        setExportNotice(withFile(t.exportDownloaded, filename));
      }
    } catch (error) {
      if (writable) await writable.abort().catch(() => null);
      setExportError(
        error instanceof Error ? error.message : t.exportFailed,
      );
    } finally {
      setExporting(false);
    }
  }, [lesson, t]);

  // --- SRT export (the subtitles, for players and video editors) ------------
  const exportSrt = useCallback(async () => {
    const filename = `${slugify(lesson.title) || "bai-giang"}.srt`;
    setExporting(true);
    setExportError(null);
    setExportNotice(null);
    let writable: FileSystemWritableFileStream | null = null;
    try {
      if (typeof window.showSaveFilePicker === "function") {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: t.exportSrtKind,
              accept: { "text/plain": [".srt"] },
            },
          ],
        });
        writable = await handle.createWritable();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setExporting(false);
        return;
      }
      writable = null;
    }
    try {
      const response = await fetch("/api/export/srt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lesson }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? `HTTP ${response.status}`);
      }
      const blob = await response.blob();
      if (writable) {
        await writable.write(blob);
        await writable.close();
        setExportNotice(withFile(t.exportSaved, filename));
      } else {
        downloadBlob(blob, filename);
        setExportNotice(withFile(t.exportDownloaded, filename));
      }
    } catch (error) {
      if (writable) await writable.abort().catch(() => null);
      setExportError(
        error instanceof Error ? error.message : t.exportFailed,
      );
    } finally {
      setExporting(false);
    }
  }, [lesson, t]);

  // --- Standalone HTML export (100% self-contained offline player) ----------
  const exportHtml = useCallback(async () => {
    const filename = `${slugify(lesson.title) || "bai-giang"}.html`;
    setExporting(true);
    setExportError(null);
    setExportNotice(null);
    let writable: FileSystemWritableFileStream | null = null;
    try {
      if (typeof window.showSaveFilePicker === "function") {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: t.exportHtmlKind,
              accept: { "text/html": [".html"] },
            },
          ],
        });
        writable = await handle.createWritable();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setExporting(false);
        return;
      }
      writable = null;
    }
    try {
      const response = await fetch("/api/export/html", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lesson }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? `HTTP ${response.status}`);
      }
      const blob = await response.blob();
      if (writable) {
        await writable.write(blob);
        await writable.close();
        setExportNotice(withFile(t.exportSaved, filename));
      } else {
        downloadBlob(blob, filename);
        setExportNotice(withFile(t.exportDownloaded, filename));
      }
    } catch (error) {
      if (writable) await writable.abort().catch(() => null);
      setExportError(
        error instanceof Error ? error.message : t.exportFailed,
      );
    } finally {
      setExporting(false);
    }
  }, [lesson, t]);

  return (
    <>
      {/* min-w-0 on both children: without it a wide descendant (a long chip, a
          figure, a chart) refuses to shrink and pushes the second column off
          the screen instead of scrolling inside its own column. */}
      <div className="grid min-w-0 gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[minmax(0,1fr)] lg:gap-4">
        {/*
          One row on a desktop, wrapping only on a phone: every wrapped row
          costs the stage ~40px of height, and two wrapped bars were what pushed
          the timeline below the fold. Nothing is removed — the row scrolls
          sideways on a narrow window instead of growing taller.
        */}
        <div className="flex min-w-0 flex-col space-y-4 lg:min-h-0 lg:gap-3 lg:space-y-0 lg:overflow-y-auto">
          {/* toolbar */}
          <div className="panel relative z-30 flex flex-wrap items-center gap-2.5 p-3 lg:flex-nowrap lg:gap-2 lg:p-2 lg:[&>*]:shrink-0">
            {/* Thanh tìm kiếm & chọn bài giảng thông minh */}
            <div
              className="relative z-40 min-w-[14rem] max-w-[20rem] flex-1"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setLessonSearchOpen(false);
                }
              }}
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist-400" />
                <input
                  type="text"
                  value={lessonSearchOpen ? lessonSearch : `${lesson.source === "gemini" ? "🤖 " : "📘 "}${lesson.title}`}
                  onChange={(e) => {
                    setLessonSearch(e.target.value);
                    setLessonSearchOpen(true);
                  }}
                  onFocus={() => {
                    setLessonSearch("");
                    setLessonSearchOpen(true);
                    refreshServerCourses();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setLessonSearchOpen(false);
                    }
                  }}
                  placeholder={t.playerSearchPlaceholder}
                  className="w-full rounded-xl border border-ink-700 bg-ink-900/90 py-1.5 pl-8 pr-7 text-xs text-mist-100 placeholder:text-mist-500 focus:border-brand-500 focus:outline-none transition-colors truncate shadow-inner"
                />
                {lessonSearchOpen && lessonSearch ? (
                  <button
                    type="button"
                    onClick={() => setLessonSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-mist-400 hover:text-mist-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </div>

              {lessonSearchOpen ? (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute left-0 top-full z-50 mt-1.5 flex max-h-80 w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-900/98 shadow-2xl backdrop-blur-xl"
                >
                  <div className="flex items-center justify-between border-b border-ink-800/80 px-3 py-2 text-[11px] text-mist-400">
                    <span>
                      {filteredLessons.length > 0
                        ? `${filteredLessons.length} ${t.playerLessonsCount}`
                        : t.playerSearchEmpty}
                    </span>
                    <span className="text-[10px] text-mist-500">Esc để đóng</span>
                  </div>

                  <ul className="max-h-64 overflow-y-auto py-1 divide-y divide-ink-800/40">
                    {filteredLessons.length === 0 ? (
                      <li className="px-3 py-4 text-center text-xs text-mist-400">
                        <p>{t.playerSearchEmpty}</p>
                        <p className="mt-1 text-[11px] text-mist-500">
                          Thử tìm bằng tiêu đề, môn học hoặc từ khoá khác.
                        </p>
                      </li>
                    ) : (
                      filteredLessons.map((item) => {
                        const isCurrent = item.id === lesson.id;
                        const isLibrary = item.isServer || item.source === "gemini";
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => void selectLessonById(item.id)}
                              className={`flex w-full items-start gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                                isCurrent
                                  ? "bg-brand-500/15 text-mist-50 font-semibold"
                                  : "text-mist-300 hover:bg-ink-800/70 hover:text-mist-50"
                              }`}
                            >
                              <span className="mt-0.5 shrink-0 text-base">
                                {isLibrary ? "🤖" : "📘"}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="truncate font-medium text-mist-100 flex-1">
                                    {item.title}
                                  </p>
                                  {isCurrent ? (
                                    <span className="shrink-0 rounded bg-brand-500/20 px-1.5 py-0.5 text-[9px] font-medium text-brand-300">
                                      {t.playerPlaying}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-mist-400">
                                  <span className="truncate">
                                    {item.subject} {item.grade ? `· ${item.grade}` : ""}
                                  </span>
                                  {item.sceneCount ? (
                                    <>
                                      <span>•</span>
                                      <span className="shrink-0 text-mist-500">
                                        {item.sceneCount} cảnh
                                      </span>
                                    </>
                                  ) : null}
                                  <span
                                    className={`ml-auto shrink-0 rounded px-1 text-[9px] font-medium ${
                                      isLibrary
                                        ? "bg-emerald-500/15 text-emerald-400"
                                        : "bg-ink-800 text-mist-400"
                                    }`}
                                  >
                                    {isLibrary ? "Thư viện" : "Mẫu"}
                                  </span>
                                </div>
                              </div>
                            </button>
                          </li>
                        );
                      })
                    )}
                  </ul>

                  <div className="border-t border-ink-800/80 bg-ink-950/60 p-2 text-center">
                    <Link
                      href="/library"
                      className="flex items-center justify-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors"
                      onClick={() => setLessonSearchOpen(false)}
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>{t.playerViewLibrary}</span>
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>

            <span className="chip">
              {lesson.subject}
              {lesson.grade ? ` · ${lesson.grade}` : ""}
            </span>
            <TeacherVoice
              lesson={lesson}
              timebase={timebase}
              activeSceneIndex={activeScene}
              loopEnabled={loop.enabled}
              onVoiceState={setVoiceState}
              onVoiceChange={(nextVoice) => {
                setLesson((prev) => {
                  const updated = { ...prev, voice: nextVoice };
                  if (prev.source === "gemini") {
                    void fetch("/api/courses", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ lesson: updated }),
                    });
                  }
                  return updated;
                });
              }}
              onNarration={(update) => {
                // Written straight onto the channel; see the note where it is
                // declared for why this is never state.
                if (update.type === "position") {
                  narration.live = { sceneIndex: update.sceneIndex, time: update.time };
                } else if (update.type === "words") {
                  narration.words.set(update.sceneIndex, update.words);
                } else {
                  narration.live = null;
                }
              }}
            />

            {/* Which slide the voice is on, so a silent gap reads as "loading",
                not "broken". */}
            {voiceState.status !== "idle" && voiceState.sceneIndex !== null ? (
              <span
                className={`chip ${
                  voiceState.status === "preparing"
                    ? "border-gold-500/60 bg-gold-500/10 text-gold-600"
                    : "border-brand-500/60 bg-brand-500/10 text-brand-300"
                }`}
                title={voiceState.sceneTitle}
              >
                {voiceState.status === "preparing" ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
                {voiceState.status === "preparing" ? t.playerVoicePreparing : t.playerVoiceSpeaking}{" "}
                slide{" "}
                {voiceState.sceneIndex + 1}/{lesson.scenes.length}
              </span>
            ) : null}

            {/* ml-auto alone leaves this group at its max-content width, which
                overflows the toolbar once the chips above wrap onto two rows. */}
            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
              {/* One pill, not two bordered buttons: exporting is a single
                  action ("get this lesson out") with two formats, and two
                  equal-weight buttons in the corner read as two competing
                  actions. A dropdown menu would hide the second format and
                  the toolbar scrolls sideways on narrow windows, which clips
                  an absolutely-positioned panel — so both segments stay
                  visible and share one border. */}
              <div className="inline-flex items-stretch overflow-hidden rounded-xl border border-ink-600 bg-ink-900/60 shadow-sm">
                <button
                  type="button"
                  onClick={() => void exportHtml()}
                  disabled={exporting}
                  className="btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold"
                  title={t.playerExportHtmlTitle}
                >
                  {exporting ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Globe className="h-3.5 w-3.5" />
                  )}
                  {t.playerExportHtml}
                </button>
                <button
                  type="button"
                  onClick={() => void exportLesson()}
                  disabled={exporting}
                  className="inline-flex items-center gap-1.5 border-l border-ink-600 px-3 py-2 text-xs font-semibold text-mist-200 transition-colors hover:bg-ink-800 hover:text-mist-50 disabled:pointer-events-none disabled:opacity-60"
                  title={t.playerExportJsonTitle}
                >
                  <FileJson className="h-3.5 w-3.5" />
                  {t.playerExportJson}
                </button>
                <button
                  type="button"
                  onClick={() => void exportSrt()}
                  disabled={exporting}
                  className="inline-flex items-center gap-1.5 border-l border-ink-600 px-3 py-2 text-xs font-semibold text-mist-200 transition-colors hover:bg-ink-800 hover:text-mist-50 disabled:pointer-events-none disabled:opacity-60"
                  title={t.playerExportSrtTitle}
                >
                  <FileText className="h-3.5 w-3.5" />
                  {t.playerExportSrt}
                </button>
              </div>

              <Link
                href={`/quiz?c=${encodeURIComponent(lesson.id)}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gold-500/40 bg-gold-500/10 px-3 py-2 text-xs font-semibold text-gold-300 transition-colors hover:bg-gold-500/20"
                title={t.playerQuizTitle}
              >
                <HelpCircle className="h-3.5 w-3.5 text-gold-400" />
                {t.playerQuiz}
              </Link>

              <Link
                href={`/flashcard?c=${encodeURIComponent(lesson.id)}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand-500/40 bg-brand-500/10 px-3 py-2 text-xs font-semibold text-brand-200 transition-colors hover:bg-brand-500/20"
                title={t.playerFlashcardsTitle}
              >
                <Sparkles className="h-3.5 w-3.5 text-brand-300" />
                {t.playerFlashcards}
              </Link>
            </div>
          </div>

          {exportError ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-ember-500/40 bg-ember-500/10 px-3.5 py-2.5 text-sm text-mist-100"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-ember-400" />
              {exportError}
            </p>
          ) : exportNotice ? (
            <p
              role="status"
              className="flex items-start gap-2 rounded-xl border border-brand-600/50 bg-brand-500/10 px-3.5 py-2.5 text-sm text-mist-100"
            >
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
              {exportNotice}
            </p>
          ) : null}

          {/* The stage. `stage-fullscreen` is what turns this element
              into a letterboxed fullscreen player: the slide keeps its 16:9
              shape and is centred instead of stretching to the window. */}
          <div ref={stageWrapRef} className="stage-fullscreen stage-fills relative lg:min-h-[16rem] lg:flex-1 lg:[container-type:size]">
            <GsapSlideStage
              lesson={lesson}
              timebase={timebase}
              activeScene={activeScene}
              narration={narration}
              playing={timebase.playing}
            />

            {isFullscreen && lesson.scenes[activeScene] ? (
              <FullscreenControls
                timebase={timebase}
                activeScene={lesson.scenes[activeScene]}
                onExit={toggleFullscreen}
              />
            ) : null}
          </div>

          {/* transport + timeline */}
          <div className="panel space-y-3 p-4 md:space-y-2 md:p-3">
            <TransportBar
              timebase={timebase}
              loop={loop}
              muted={timebase.muted}
              onToggleLoop={() => {
                setLoop((current) => {
                  if (current.enabled) return { ...current, enabled: false };
                  if (current.b > current.a) return { ...current, enabled: true };
                  const now = timebase.timeRef.current;
                  const a = Math.max(0, now - 3);
                  const b = Math.min(tbDuration, now + 5);
                  return { a, b, enabled: b > a };
                });
              }}
              onSetPoint={setLoopPoint}
              onClearLoop={clearLoop}
              onToggleMute={timebase.toggleMute}
              onFullscreen={toggleFullscreen}
              onToggleHelp={() => setHelpOpen((value) => !value)}
            />
            <div className="hairline" />
            <ScrubBar lesson={lesson} timebase={timebase} loop={loop} />
          </div>
        </div>

        {/* right column */}
        <div className="min-w-0 space-y-4 lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:pr-1">

          <ChapterList
            lesson={lesson}
            timebase={timebase}
            activeScene={activeScene}
            activeChapter={activeChapter}
          />

          <ClassroomAgentChat
            currentScene={lesson.scenes[activeScene]}
            lessonTitle={lesson.title}
          />
        </div>
      </div>

      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <FlashcardModal open={flashcardsOpen} lesson={lesson} onClose={() => setFlashcardsOpen(false)} />
      <QuizModal open={quizOpen} lesson={lesson} onClose={() => setQuizOpen(false)} />
    </>
  );
}
