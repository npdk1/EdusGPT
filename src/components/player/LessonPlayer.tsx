"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleCheck,
  TriangleAlert,
  Download,
  FileJson,
  LoaderCircle,
  Volume2,
} from "lucide-react";
import { useTimebase, type LoopRange } from "@/hooks/useTimebase";
import { chapterIndexAt, sceneIndexAt, type Lesson } from "@/lib/lesson/types";
import { LESSONS_CHANGED_EVENT, loadStoredLessons } from "@/lib/lesson/storage";
import { slugify } from "@/lib/format";
import { GsapSlideStage } from "./GsapSlideStage";
import { FullscreenControls } from "./FullscreenControls";
import { ScrubBar } from "./ScrubBar";
import { TransportBar } from "./TransportBar";
import { ChapterList } from "./ChapterList";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { TeacherVoice, type VoiceState } from "./TeacherVoice";
import { createNarrationChannel } from "@/lib/karaoke";
import { ClassroomAgentChat } from "./ClassroomAgentChat";

interface LessonPlayerProps {
  initialLesson: Lesson;
  samples: Lesson[];
}

export function LessonPlayer({ initialLesson, samples }: LessonPlayerProps) {
  const [lesson, setLesson] = useState<Lesson>(initialLesson);
  const [stored, setStored] = useState<Lesson[]>([]);
  const [loop, setLoop] = useState<LoopRange>({ enabled: false, a: 0, b: 0 });
  const [helpOpen, setHelpOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  /** Where the exported file went, so a silent save never looks like a dud. */
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [activeScene, setActiveScene] = useState(0);
  const [voiceState, setVoiceState] = useState<VoiceState>({
    status: "idle", sceneIndex: null, sceneTitle: "", voice: "",
  });
  const [activeChapter, setActiveChapter] = useState(0);
  const [exporting, setExporting] = useState<"html" | "json" | null>(null);
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

  // --- stored (AI generated) lessons --------------------------------------
  useEffect(() => {
    const sync = () => setStored(loadStoredLessons());
    sync();
    window.addEventListener(LESSONS_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LESSONS_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
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

  // --- cheap React state: only changes when the scene actually changes -----
  // `subscribe` is a stable callback; the `timebase` object itself is fresh on
  // every render, so depending on it re-attached this subscription (and its
  // synchronous setState) on every render — the "Maximum update depth" loop.
  const subscribeTime = timebase.subscribe;
  useEffect(() => {
    return subscribeTime((time) => {
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

  const clearLoop = useCallback(() => setLoop({ enabled: false, a: 0, b: 0 }), []);

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

  // --- standalone export (one self-contained HTML file) ---------------------
  const exportLesson = useCallback(
    async (kind: "html" | "json") => {
      const filename = `${slugify(lesson.title) || "bai-giang"}.${
        kind === "html" ? "html" : "lesson.json"
      }`;
      setExporting(kind);
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
                description:
                  kind === "html" ? "Trang HTML tự chạy" : "Dữ liệu bài giảng",
                accept: {
                  [kind === "html" ? "text/html" : "application/json"]: [
                    kind === "html" ? ".html" : ".json",
                  ],
                },
              },
            ],
          });
          writable = await handle.createWritable();
        }
      } catch (error) {
        // Cancelling the dialogue is a decision, not a failure.
        if (error instanceof DOMException && error.name === "AbortError") {
          setExporting(null);
          return;
        }
        // No picker, or the browser refused one: fall through to the plain
        // download below rather than failing the export.
        writable = null;
      }
      try {
        const response = await fetch(`/api/export/${kind}`, {
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
          setExportNotice(`Đã lưu "${filename}" vào nơi bạn chọn.`);
        } else {
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
          setExportNotice(
            `Trình duyệt không cho chọn nơi lưu — file "${filename}" nằm trong thư mục Tải xuống.`,
          );
        }
      } catch (error) {
        if (writable) await writable.abort().catch(() => null);
        setExportError(
          error instanceof Error ? error.message : "Không xuất được file",
        );
      } finally {
        setExporting(null);
      }
    },
    [lesson],
  );

  return (
    <>
      {/* min-w-0 on both children: without it a wide descendant (a long chip, a
          figure, a chart) refuses to shrink and pushes the second column off
          the screen instead of scrolling inside its own column. */}
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          {/* toolbar */}
          <div className="panel flex flex-wrap items-center gap-2.5 p-3">
            <label className="flex items-center gap-2">
              <span className="sr-only">Chọn bài giảng</span>
              <select
                value={lesson.id}
                onChange={(event) => {
                  const next = library.find((item) => item.id === event.target.value);
                  if (!next) return;
                  clearLoop();
                  setLesson(next);
                }}
                className="max-w-[16rem] rounded-lg border border-ink-700 bg-ink-900/80 px-2.5 py-2 text-sm text-mist-100"
              >
                {library.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.source === "gemini" ? "🤖 " : "📘 "}
                    {item.title}
                  </option>
                ))}
              </select>
            </label>

            <span className="chip">
              {lesson.subject}
              {lesson.grade ? ` · ${lesson.grade}` : ""}
            </span>
            <TeacherVoice
              lesson={lesson}
              timebase={timebase}
              activeSceneIndex={activeScene}
              onVoiceState={setVoiceState}
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
                {voiceState.status === "preparing" ? "Đang tạo giọng" : "Đang đọc"} slide{" "}
                {voiceState.sceneIndex + 1}/{lesson.scenes.length}
              </span>
            ) : null}

            {/* ml-auto alone leaves this group at its max-content width, which
                overflows the toolbar once the chips above wrap onto two rows. */}
            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => exportLesson("html")}
                disabled={exporting !== null}
                className="btn-ghost"
                title="Xuất một file HTML tự chạy được, không cần server"
              >
                {exporting === "html" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Xuất HTML
              </button>
              <button
                type="button"
                onClick={() => exportLesson("json")}
                disabled={exporting !== null}
                className="btn-ghost"
                title="Tải nội dung bài giảng dạng JSON"
              >
                {exporting === "json" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <FileJson className="h-4 w-4" />
                )}
                JSON
              </button>
            </div>
          </div>

          {exportError ? (
            <p className="flex items-start gap-2 rounded-xl border border-ember-500/40 bg-ember-500/10 px-3.5 py-2.5 text-sm text-mist-100">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-ember-400" />
              {exportError}
            </p>
          ) : exportNotice ? (
            <p className="flex items-start gap-2 rounded-xl border border-brand-600/50 bg-brand-500/10 px-3.5 py-2.5 text-sm text-mist-100">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
              {exportNotice}
            </p>
          ) : null}

          {/* The stage. `stage-fullscreen` is what turns this element
              into a letterboxed fullscreen player: the slide keeps its 16:9
              shape and is centred instead of stretching to the window. */}
          <div ref={stageWrapRef} className="stage-fullscreen relative">
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

          <div className="flex flex-wrap items-center gap-2">
            <span className="ml-auto font-mono text-[11px] text-mist-500">
              {lesson.fps} fps · bước khung hình {(1 / lesson.fps).toFixed(3)}s
            </span>
          </div>

          {/* transport + timeline */}
          <div className="panel space-y-3 p-4">
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
        <div className="min-w-0 space-y-4">

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
    </>
  );
}
