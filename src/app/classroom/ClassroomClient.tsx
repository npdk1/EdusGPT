"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CircleCheck,
  Globe,
  LoaderCircle,
  Play,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  useGenerationStream,
  liveSceneFrom,
  type LiveScene,
  type RunLogEntry,
} from "@/components/studio/GenerationTimeline";
import { PremierePlayer } from "@/components/studio/Premiere";
import { SlideSurface } from "@/components/player/SlideSurface";
import { pollinationsImageUrl } from "@/lib/lesson/pollinations";
import type { Lesson } from "@/lib/lesson/types";
import { SceneLoader3D } from "@/components/three/SceneLoader3D";
import { useCopy } from "@/i18n/provider";
import { pickVoice, DEFAULT_VOICE } from "@/lib/lesson/voices";

/**
 * The room's own sentences, in both languages.
 *
 * The outline titles, the status message and the model log come from the server
 * stream, so they are passed through untouched — only the words this file owns
 * are translated here.
 */
const COPY = {
  en: {
    classroomMissingSession: "No lesson",
    classroomMissingSessionHint:
      "This page needs the id of the lesson being generated — press “Create lesson” in the studio and it will take you here.",
    classroomBackToStudio: "Back to the studio",
    classroomFailedTitle: "The session hit a problem",
    classroomRetryStudio: "Back to the studio to try again",
    classroomScenes: "scenes",
    classroomDeckDone: "The lesson is written — open the full classroom",
    classroomDeckDoneHint:
      "The player seeks second by second, has captions that follow the narration and holds all",
    classroomOpenPlayer: "Open the player",
    classroomWritingScene: "Writing scene",
    classroomOutline: "Building the lesson outline",
    classroomWritingScenes: "Writing the scenes",
    classroomOutlineHint: "Laying out the learning path…",
    classroomWritingHint:
      "Each scene goes on screen with its narration as soon as it is ready.",
    classroomBackHome: "Back to home",
    classroomScene: "Scene",
    classroomPreparing: "The classroom is getting ready…",
    classroomSlideList: "Slide list",
    classroomPreviewOf: "Preview: {title}",
    classroomCreating: "Creating",
    classroomWaitingOutline: "Waiting for the outline…",
    classroomNoRunHint:
      "This generation session is not found — the page may have reloaded after the stream stopped. Start another one in the studio to open a new classroom.",
    classroomStatus: "Status",
    classroomStatusPending: "Getting ready…",
    classroomProgress: "Progress",
    classroomScenesLabel: "Scenes",
    classroomDone: "done",
    previewHeading: "Preview · slide",
    previewPlay: "Play this slide",
    previewClose: "Close",
    previewAriaLabel: "Preview slide {n}",
    loadingTitle: "Creating page content",
    loadingSubtitle: "Generating slides, quizzes and interactive elements...",
    loadingAiWorking: "AI AGENTS AT WORK...",
    loadingVoicePrep: "Preparing voice-over: {voice}...",
    creatingBadge: "Creating...",
  },
  vi: {
    classroomMissingSession: "Thiếu buổi học",
    classroomMissingSessionHint:
      "Trang này cần id của bài đang tạo — hãy bấm “Tạo bài giảng” ở studio, trang sẽ tự đưa bạn vào đây.",
    classroomBackToStudio: "Về studio",
    classroomFailedTitle: "Buổi học gặp sự cố",
    classroomRetryStudio: "Về studio tạo lại",
    classroomScenes: "cảnh",
    classroomDeckDone: "Bài đã viết xong — vào lớp học đầy đủ",
    classroomDeckDoneHint:
      "Trình phát có tua từng giây, phụ đề theo giọng và đầy đủ",
    classroomOpenPlayer: "Mở trình phát",
    classroomWritingScene: "Đang viết cảnh",
    classroomOutline: "Đang dựng đề cương bài học",
    classroomWritingScenes: "Đang viết từng cảnh",
    classroomOutlineHint: "Đang sắp xếp lộ trình học…",
    classroomWritingHint:
      "Xong cảnh nào, lớp học chiếu ngay cảnh đó kèm giọng đọc.",
    classroomBackHome: "Về trang chủ",
    classroomScene: "Cảnh",
    classroomPreparing: "Lớp học đang chuẩn bị…",
    classroomSlideList: "Mục lục slide",
    classroomPreviewOf: "Xem trước: {title}",
    classroomCreating: "Đang tạo",
    classroomWaitingOutline: "Đang chờ dàn ý…",
    classroomNoRunHint:
      "Không thấy buổi tạo bài này — có thể trang đã tải lại sau khi luồng tạo dừng. Bấm tạo lại ở studio để vào lớp mới.",
    classroomStatus: "Trạng thái",
    classroomStatusPending: "Đang chuẩn bị…",
    classroomProgress: "Tiến độ",
    classroomScenesLabel: "Cảnh",
    classroomDone: "đã xong",
    previewHeading: "Xem trước · slide",
    previewPlay: "Phát slide này",
    previewClose: "Đóng",
    previewAriaLabel: "Xem trước slide {n}",
    loadingTitle: "Đang tạo nội dung từng trang",
    loadingSubtitle: "Đang tạo slide, câu đố và phần tương tác...",
    loadingAiWorking: "CÁC TÁC NHÂN AI ĐANG LÀM VIỆC...",
    loadingVoicePrep: "Đang chuẩn bị giọng đọc: {voice}...",
    creatingBadge: "Đang tạo...",
  },
} satisfies Record<string, Record<string, string>>;

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
  /** Finished scene bodies in deck order — the server ships them now. */
  scenes?: unknown[];
}

/**
 * The classroom session: routing here is the first thing the studio does
 * once the server hands over the deck id, so the teacher lands straight in
 * the room while the lesson is still being written — slides appear one by
 * one with their voice-over, and a waiting card covers the gaps.
 *
 * Data comes from the same singleton the studio writes: no second stream, no
 * refetch of scenes. A full reload mid-run reattaches to the snapshot; a
 * visit with no live run falls back to the library draft (polled), and a
 * reload after `done` finds the saved course and offers the player. A live
 * run is never evicted at the end: the deck plays through the closing quiz
 * and summary, with the full player one click away above it.
 */
export default function ClassroomClient({
  sessionId,
  initialVoice,
}: {
  sessionId: string | null;
  initialVoice?: string | null;
}) {
  const t = useCopy(COPY);
  const { progress, running } = useGenerationStream();
  const [voice, setVoice] = useState(
    initialVoice ||
      (typeof window !== "undefined"
        ? localStorage.getItem("edusgpt.classroom-voice.v1") ?? ""
        : ""),
  );
  const [speaking, setSpeaking] = useState<LiveScene | null>(null);
  const [draft, setDraft] = useState<DraftInfo | null>(null);
  /**
   * The saved course, when the live run is gone.
   *
   * A reload after `done` used to hang on "Đang chờ dàn ý…" forever: the
   * snapshot is ignored once finished and the draft was deleted at `done`, so
   * nothing could ever arrive. One lookup in the library turns that dead end
   * into the same "open the player" card the run used to end on.
   */
  const [finished, setFinished] = useState<Lesson | null>(null);
  const [jump, setJump] = useState<{ index: number; seq: number } | null>(null);

  useEffect(() => {
    if (initialVoice) {
      setVoice(initialVoice);
      try {
        localStorage.setItem("edusgpt.classroom-voice.v1", initialVoice);
      } catch {
        /* default voice */
      }
      return;
    }
    try {
      const stored = localStorage.getItem("edusgpt.classroom-voice.v1");
      if (stored) setVoice(stored);
    } catch {
      /* default voice */
    }
  }, [initialVoice]);

  useEffect(() => {
    if (progress.voice) {
      setVoice(progress.voice);
      try {
        localStorage.setItem("edusgpt.classroom-voice.v1", progress.voice);
      } catch {
        /* default voice */
      }
    }
  }, [progress.voice]);

  useEffect(() => {
    if (progress.lesson?.voice) {
      setVoice(progress.lesson.voice);
      try {
        localStorage.setItem("edusgpt.classroom-voice.v1", progress.lesson.voice);
      } catch {
        /* default voice */
      }
    }
  }, [progress.lesson]);

  const mine =
    !!sessionId && (progress.lessonId ?? null) === sessionId;

  const [courseCheck, setCourseCheck] = useState(0);
  const hadScenesRef = useRef(false);
  const draftGoneRef = useRef(false);

  // No live run for this id (fresh visit, reload after death): watch the
  // library draft so the waiting card still shows real progress.
  const needDraft =
    !!sessionId &&
    !mine &&
    !progress.lesson &&
    progress.liveScenes.length === 0 &&
    !finished;
  useEffect(() => {
    if (!needDraft || !sessionId) {
      if (!needDraft) setDraft(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/courses", { cache: "no-store" });
        const payload = (await response.json()) as { drafts?: DraftInfo[] };
        if (cancelled) return;
        const found =
          (payload.drafts ?? []).find((d) => d.id === sessionId) ?? null;
        if (found?.scenes?.length) hadScenesRef.current = true;
        if (found?.voice) {
          setVoice(found.voice);
          try {
            localStorage.setItem("edusgpt.classroom-voice.v1", found.voice);
          } catch {
            /* default voice */
          }
        }
        // The draft is deleted the instant the run finishes, but the deck it
        // fed is already on screen: keep it there and go ask the library for
        // the saved course (once) instead of blanking back to the hero.
        setDraft((prev) => found ?? (prev?.scenes?.length ? prev : null));
        if (!found && hadScenesRef.current && !draftGoneRef.current) {
          draftGoneRef.current = true;
          setCourseCheck((n) => n + 1);
        }
      } catch {
        /* the card keeps its last state */
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [needDraft, sessionId]);

  // The run is over and its stream is gone (reload, another tab): ask the
  // library once for the saved course so the room can offer the player
  // instead of a waiting card that nothing will ever update.
  useEffect(() => {
    if (!sessionId || mine || progress.lesson || progress.error || finished) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/courses?id=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" },
        );
        if (cancelled) return;
        if (!response.ok) {
          // The draft is deleted a beat before the client-filed lesson lands:
          // a couple of delayed retries bridge the gap instead of leaving the
          // reclaimed deck on a card nothing will ever update again.
          if (!cancelled && courseCheck > 0 && courseCheck < 3) {
            window.setTimeout(() => setCourseCheck((n) => n + 1), 3000);
          }
          return;
        }
        const payload = (await response.json()) as { lesson?: Lesson };
        if (payload.lesson) setFinished(payload.lesson);
      } catch {
        /* the waiting card keeps its last state */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, mine, progress.lesson, progress.error, finished, courseCheck]);

  const handleSceneChange = useCallback((scene: LiveScene | null) => {
    setSpeaking(scene);
  }, []);

  /** "Play this one now" from the slide list — the player owns the audio. */
  const playScene = useCallback((index: number) => {
    setJump((prev) => ({ index, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  // At `done` the finished lesson replaces the live list: the closing quiz
  // and summary are appended after the last scene event, so they only exist
  // in the lesson — the room plays them out of the same array. With no live
  // run at all, the same array comes out of the polled draft file instead.
  const scenes = mine
    ? progress.done && progress.lesson
      ? progress.lesson.scenes.map((scene, index) => liveSceneFrom(scene, index))
      : progress.liveScenes
    : finished?.scenes?.length
      ? finished.scenes.map((scene, index) => liveSceneFrom(scene, index))
      : draft?.scenes?.length
        ? draft.scenes.map((scene, index) => liveSceneFrom(scene, index))
        : [];

  const activeError = (mine ? progress.error : progress.error || draft?.error) ?? null;

  // The draft path has no progress channel of its own: its counters feed the
  // bar so the room reads "2/13" instead of a flat zero while slides play.
  const draftPercent =
    draft && draft.total > 0 ? Math.round((draft.done / draft.total) * 100) : 0;

  const isFinished = Boolean(finished || (progress.done && progress.lesson));
  const [firstSceneReady, setFirstSceneReady] = useState(isFinished);

  useEffect(() => {
    if (isFinished) setFirstSceneReady(true);
  }, [isFinished]);

  useEffect(() => {
    if (firstSceneReady || isFinished) return;
    const scene0 = scenes.find((s) => s.index === 0);
    if (!scene0?.narration?.trim()) return;

    let cancelled = false;
    const effectiveVoice =
      voice ||
      (typeof window !== "undefined"
        ? localStorage.getItem("edusgpt.classroom-voice.v1") ?? ""
        : "") ||
      DEFAULT_VOICE;

    // Pre-fetch audio for slide 0 with the chosen voice so it plays immediately with no lag or wrong voice
    fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: scene0.narration.trim().slice(0, 4000),
        voice: pickVoice(effectiveVoice, scene0.narration),
      }),
    })
      .then(() => {
        if (!cancelled) setFirstSceneReady(true);
      })
      .catch(() => {
        if (!cancelled) setFirstSceneReady(true);
      });

    const timer = setTimeout(() => {
      if (!cancelled) setFirstSceneReady(true);
    }, 6000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [scenes, voice, firstSceneReady, isFinished]);

  if (!sessionId) {
    return (
      <Shell title={t.classroomMissingSession}>
        <p className="text-sm text-mist-300">
          {t.classroomMissingSessionHint}
        </p>
        <Link href="/studio" className="btn-primary mt-4">
          {t.classroomBackToStudio}
        </Link>
      </Shell>
    );
  }

  // A finished deck with no live scenes left to play (reload after the run,
  // a second tab): hand over to the full player — that card is the whole page
  // in this case. While the run is still alive the deck stays in the room and
  // the same offer appears as a banner above it instead.
  if (finished && scenes.length === 0) {
    return (
      <Shell
        title={finished.title}
        counter={`${finished.scenes.length} ${t.classroomScenes}`}
      >
        <div className="mx-auto w-full max-w-2xl rounded-2xl border border-ink-700 bg-ink-900/70 p-8 text-center">
          <CircleCheck className="mx-auto h-10 w-10 text-brand-300" />
          <p className="mt-3 text-lg font-semibold text-mist-50">
            {t.classroomDeckDone}
          </p>
          <p className="mt-1 text-sm text-mist-400">
            {t.classroomDeckDoneHint} {finished.scenes.length}{" "}
            {t.classroomScenes}.
          </p>
          <Link
            href={`/lesson?c=${encodeURIComponent(finished.id)}`}
            className="btn-primary mt-5"
          >
            <Play className="h-4 w-4" /> {t.classroomOpenPlayer}
          </Link>
        </div>
      </Shell>
    );
  }

  if (activeError && scenes.length === 0 && !finished) {
    return (
      <Shell title={t.classroomFailedTitle}>
        <div className="mx-auto max-w-xl rounded-2xl border border-ember-500/50 bg-ember-500/10 p-6 text-center">
          <TriangleAlert className="mx-auto h-8 w-8 text-ember-400" />
          <p className="mt-2 text-sm text-mist-100">{activeError}</p>
          <Link href="/studio" className="btn-primary mt-4">
            {t.classroomRetryStudio}
          </Link>
        </div>
      </Shell>
    );
  }

  const showLoading = !firstSceneReady && !activeError;

  if (showLoading) {
    const rawMsg = mine ? progress.message : (draft?.message ?? progress.message);
    const scene0 = scenes.find((s) => s.index === 0);
    const voiceName = voice.includes(":")
      ? voice.split(":").slice(1).join(" ")
      : voice.includes("NamMinh")
        ? "Nam Minh"
        : voice.includes("HoaiMy")
          ? "Hoài My"
          : voice.replace(/^(vi-VN-|en-US-)/, "").replace(/Neural.*$/, "");

    const statusMsg = scene0
      ? t.loadingVoicePrep.replace("{voice}", voiceName || "AI")
      : rawMsg || t.loadingTitle;

    return (
      <div className="flex min-h-screen flex-col bg-ink-950 text-mist-50">
        <header className="flex items-center gap-3 border-b border-ink-700/60 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1.5 text-sm text-mist-400 hover:text-mist-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> {t.classroomBackHome}
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center p-4">
          <GenerationLoadingHero
            title={t.loadingTitle}
            subtitle={t.loadingSubtitle}
            statusMessage={statusMsg}
            percent={mine ? progress.percent : draftPercent}
            voice={voice}
            t={t}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-mist-50">
      <header className="flex items-center gap-3 border-b border-ink-700 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5 text-sm text-mist-400 hover:text-mist-50"
        >
          <ArrowLeft className="h-4 w-4" /> {t.classroomBackHome}
        </Link>
        <span aria-hidden="true" className="h-4 w-px shrink-0 bg-ink-600" />
        {/* What is playing, read from the left of the room beside the list. */}
        <p className="min-w-0 flex-1 truncate text-left text-sm font-semibold">
          {speaking ? (
            <>
              <span className="mr-2 font-mono text-[11px] font-normal uppercase tracking-widest text-brand-400">
                {t.classroomScene} {String(speaking.index + 1).padStart(2, "0")}
              </span>
              {speaking.title}
            </>
          ) : (
            <span className="font-normal text-mist-400">
              {t.classroomPreparing}
            </span>
          )}
        </p>
      </header>

      <div className="flex w-full flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:px-8">
        {/* Left rail: OpenMAIC-style Scene Sidebar */}
        <aside className="w-full shrink-0 space-y-2 lg:w-72 xl:w-80">
          <div className="flex items-center justify-between px-1 mb-1">
            <p className="font-mono text-[11px] uppercase tracking-widest text-mist-400">
              {t.classroomSlideList}
            </p>
            <span className="rounded-full bg-ink-800 px-2 py-0.5 font-mono text-[10px] text-mist-300">
              {scenes.length}/{progress.steps.length > 0 ? progress.steps.length : scenes.length}
            </span>
          </div>

          <div className="max-h-[75vh] space-y-2.5 overflow-y-auto pr-1">
            {(progress.steps.length > 0
              ? progress.steps
              : scenes.map((s, idx) => ({ id: `s-${idx}`, title: s.title, state: "done" as const }))
            ).map((step, i) => {
              const scene = scenes.find((s) => s.index === i) ?? null;
              const isActive = speaking?.index === i;

              if (scene) {
                // Completed scene: bright, thumbnail, clicks immediately to view!
                return (
                  <div
                    key={`scene-${scene.index}`}
                    onClick={() => playScene(scene.index)}
                    className={`group relative flex cursor-pointer flex-col gap-1.5 rounded-xl border p-2 transition-all duration-200 ${
                      isActive
                        ? "border-brand-500/80 bg-brand-500/15 ring-1 ring-brand-400/50 shadow-[0_0_15px_rgba(56,189,248,0.2)]"
                        : "border-ink-700/80 bg-ink-900/60 hover:border-ink-600 hover:bg-ink-800/80"
                    }`}
                  >
                    <div className="flex items-center justify-between px-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                            isActive ? "bg-brand-500 text-white shadow-sm" : "bg-ink-800 text-mist-400"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span
                          className={`truncate text-xs font-bold transition-colors ${
                            isActive ? "text-brand-300" : "text-mist-200 group-hover:text-mist-50"
                          }`}
                        >
                          {scene.title}
                        </span>
                      </div>
                      {isActive ? (
                        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-ember-500" />
                      ) : (
                        <CircleCheck className="h-3.5 w-3.5 shrink-0 text-brand-400" />
                      )}
                    </div>

                    {/* 16:9 Thumbnail preview: actual slide miniature */}
                    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-ink-800 bg-ink-950">
                      <SlideMiniature lessonId={sessionId ?? ""} scene={scene} />
                    </div>
                  </div>
                );
              }

              // Pending scene: dimmed, gentle pulse shimmer, "Đang tạo..."
              return (
                <div
                  key={`pending-${i}`}
                  className="group relative flex flex-col gap-1.5 rounded-xl border border-ink-800/80 bg-ink-950/40 p-2 opacity-60 transition-opacity"
                >
                  <div className="flex items-center justify-between px-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-ink-800/50 font-mono text-[10px] text-mist-500">
                        {i + 1}
                      </span>
                      <span className="truncate text-xs font-medium text-mist-400">
                        {step.title}
                      </span>
                    </div>
                    <span className="shrink-0 rounded border border-gold-500/30 bg-gold-500/10 px-1.5 py-0.5 text-[10px] font-medium text-gold-300">
                      {t.creatingBadge}
                    </span>
                  </div>

                  {/* Skeleton Thumbnail with gentle pulse & shimmer */}
                  <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-ink-800/60 bg-ink-900/60">
                    <div className="h-2 w-3/5 animate-pulse rounded bg-ink-800" />
                    <div className="h-1.5 w-2/5 animate-pulse rounded bg-ink-800/80" />
                    <span className="animate-pulse text-[10px] font-medium text-mist-500">
                      {t.creatingBadge}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Extra appendix scenes (closing quiz, summary) if any */}
            {scenes
              .filter((scene) => scene.index >= progress.steps.length && progress.steps.length > 0)
              .map((scene) => (
                <div
                  key={`appendix-${scene.index}`}
                  onClick={() => playScene(scene.index)}
                  className={`group relative flex cursor-pointer flex-col gap-1.5 rounded-xl border p-2 transition-all duration-200 ${
                    speaking?.index === scene.index
                      ? "border-brand-500/80 bg-brand-500/15 ring-1 ring-brand-400/50 shadow-[0_0_15px_rgba(56,189,248,0.2)]"
                      : "border-ink-700/80 bg-ink-900/60 hover:border-ink-600 hover:bg-ink-800/80"
                  }`}
                >
                  <div className="flex items-center justify-between px-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-ink-800 font-mono text-[10px] text-mist-400">
                        {scene.index + 1}
                      </span>
                      <span className="truncate text-xs font-bold text-mist-200">
                        {scene.title}
                      </span>
                    </div>
                    {speaking?.index === scene.index ? (
                      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-ember-500" />
                    ) : (
                      <CircleCheck className="h-3.5 w-3.5 text-brand-400" />
                    )}
                  </div>
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-ink-800 bg-ink-950">
                    <SlideMiniature lessonId={sessionId ?? ""} scene={scene} />
                  </div>
                </div>
              ))}
          </div>
        </aside>

        {/* Center: the premiere player with floating subtitle */}
        <main className="min-w-0 flex-1">
          {activeError && scenes.length > 0 ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ember-500/50 bg-ember-500/10 px-4 py-2.5">
              <p className="flex items-center gap-2 text-xs text-mist-100">
                <TriangleAlert className="h-4 w-4 shrink-0 text-ember-400" />
                {activeError}
              </p>
              <Link href="/studio" className="btn-primary px-3 py-1.5 text-xs">
                {t.classroomRetryStudio}
              </Link>
            </div>
          ) : null}
          {progress.done && progress.lesson && scenes.length > 0 ? (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-600/50 bg-brand-900/30 px-4 py-2.5">
              <p className="flex items-center gap-2 text-xs text-mist-200">
                <CircleCheck className="h-4 w-4 shrink-0 text-brand-300" />
                {t.classroomDeckDone}
              </p>
              <Link
                href={`/lesson?c=${encodeURIComponent(progress.lesson.id)}`}
                className="btn-primary px-3 py-1.5 text-xs"
              >
                <Play className="h-3.5 w-3.5" /> {t.classroomOpenPlayer}
              </Link>
            </div>
          ) : null}
          {scenes.length > 0 ? (
            <PremierePlayer
              scenes={scenes}
              voice={voice}
              running={mine ? running : !draftGoneRef.current && !draft?.error}
              autostart={mine ? running : !!draft && !draftGoneRef.current}
              done={progress.done}
              progress={mine ? progress.percent : draftPercent}
              lessonId={sessionId ?? ""}
              jumpTo={jump}
              showIndex={false}
              onSceneChange={handleSceneChange}
            />
          ) : (
            <div className="mx-auto w-full max-w-lg rounded-2xl border border-ink-700 bg-ink-950 p-8 text-center">
              <p className="text-sm text-mist-300">
                {t.classroomNoRunHint}
              </p>
              <Link href="/studio" className="btn-primary mt-4">
                {t.classroomBackToStudio}
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/**
 * Real miniature slide representation for the sidebar (like OpenMAIC):
 * Renders the actual slide layout, kicker, title, formulas, and palette scaled down.
 */
function SlideMiniature({
  lessonId,
  scene,
}: {
  lessonId: string;
  scene: LiveScene;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.24);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / 960);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const slideScene: Lesson["scenes"][number] = {
    id: `ai-${scene.index + 1}`,
    kind: (scene.kind as Lesson["scenes"][number]["kind"]) ?? "concept",
    accent: "brand",
    title: scene.title,
    subtitle: scene.subtitle,
    bullets: scene.bullets,
    narration: scene.narration,
    imagePrompt: scene.imagePrompt,
    imageQuery: scene.imageQuery,
    layout: scene.layout as Lesson["scenes"][number]["layout"],
    blocks: scene.blocks,
    steps: scene.steps,
    formula: scene.formula,
    data: scene.data,
    graph: scene.graph,
    table: scene.table,
    quiz: scene.quiz,
    mindmap: scene.mindmap,
    simulation3d: scene.simulation3d,
    icon: scene.icon,
    start: 0,
    duration: 0,
  };

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full overflow-hidden rounded-lg bg-ink-950"
    >
      <div
        className="pointer-events-none absolute left-0 top-0 origin-top-left select-none"
        style={{
          width: "960px",
          height: "540px",
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        <SlideSurface
          scene={slideScene}
          index={scene.index}
          lessonId={lessonId}
        />
      </div>
    </div>
  );
}

/**
 * The loading room (matching Sample Image 2):
 * Displays while the outline and first slide + voice are being created.
 * Once slide 0 and its audio are ready, seamlessly hands over to the presentation.
 */
function GenerationLoadingHero({
  title,
  subtitle,
  statusMessage,
  percent,
  voice,
  t,
}: {
  title: string;
  subtitle: string;
  statusMessage: string;
  percent: number;
  voice: string;
  t: Record<string, string>;
}) {
  const clamped = Math.max(5, Math.min(100, Math.round(percent)));
  const voiceName = voice.includes(":")
    ? voice.split(":").slice(1).join(" ")
    : voice.includes("NamMinh")
      ? "Nam Minh"
      : voice.includes("HoaiMy")
        ? "Hoài My"
        : voice.replace(/^(vi-VN-|en-US-)/, "").replace(/Neural.*$/, "");

  return (
    <div className="relative flex min-h-[75vh] w-full flex-col items-center justify-center px-4 py-8">
      {/* Background ambient radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      >
        <div className="h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.12)_0%,rgba(14,165,233,0.05)_40%,transparent_70%)] blur-2xl" />
      </div>

      {/* Center Glass Card (Matching Sample Image 2) */}
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-ink-700/80 bg-ink-900/90 p-8 shadow-2xl backdrop-blur-xl">
        {/* Top 3 dots/pills indicator */}
        <div className="mb-6 flex items-center justify-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-mist-500/60" />
          <span className="h-1.5 w-7 rounded-full bg-brand-400 shadow-[0_0_10px_rgba(56,189,248,0.7)]" />
          <span className="h-1.5 w-1.5 rounded-full bg-mist-500/60" />
        </div>

        {/* 3D Robot Animated Scene */}
        <div className="relative mx-auto mb-3 flex w-full justify-center">
          <SceneLoader3D label={statusMessage} progress={clamped} height={210} />
        </div>

        {/* Titles */}
        <h2 className="text-center text-xl font-bold tracking-tight text-mist-50">
          {title}
        </h2>
        <p className="mt-1 text-center text-xs text-mist-400">
          {subtitle}
        </p>

        {/* Live Step Progress / Checklist */}
        <div className="mt-4 space-y-2 rounded-2xl border border-ink-700 bg-ink-950/80 p-3.5 text-xs">
          <div className="flex items-center justify-between text-mist-400">
            <span>{t.classroomProgress}</span>
            <span className="font-mono text-mist-200">{clamped}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-400 to-sky-300 transition-[width] duration-300"
              style={{ width: `${clamped}%` }}
            />
          </div>
          <div className="flex items-center gap-2 pt-0.5 text-mist-300">
            <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-400" />
            <span className="truncate">{statusMessage}</span>
          </div>
        </div>

        {/* Voice indication chip if set */}
        {voiceName ? (
          <p className="mt-3 text-center font-mono text-[11px] text-brand-300/80">
            🎙️ {t.loadingVoicePrep.replace("{voice}", voiceName)}
          </p>
        ) : null}
      </div>

      {/* Footer text: AI agents at work */}
      <div className="mt-6 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-widest text-brand-300 animate-pulse">
        <Sparkles className="h-3.5 w-3.5 text-brand-400" />
        <span>{t.loadingAiWorking}</span>
      </div>
    </div>
  );
}

function Shell({
  title,
  counter,
  children,
}: {
  title: string;
  counter?: string;
  children: React.ReactNode;
}) {
  const t = useCopy(COPY);
  return (
    <div className="min-h-screen text-mist-50">
      <header className="flex items-center justify-between gap-3 border-b border-ink-700 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-mist-300 hover:text-mist-50"
        >
          <ArrowLeft className="h-4 w-4" /> {t.classroomBackHome}
        </Link>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold">
          {title}
        </p>
        <span className="w-24 shrink-0 text-right font-mono text-sm text-mist-400">
          {counter ?? ""}
        </span>
      </header>
      <div className="px-4 py-10 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}
