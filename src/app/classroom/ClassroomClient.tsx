"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CircleCheck,
  LoaderCircle,
  Play,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  useGenerationStream,
  type LiveScene,
  type RunLogEntry,
} from "@/components/studio/GenerationTimeline";
import { PremierePlayer } from "@/components/studio/Premiere";
import { SlideSurface } from "@/components/player/SlideSurface";
import { pollinationsImageUrl } from "@/lib/lesson/pollinations";
import type { Lesson } from "@/lib/lesson/types";
import { SceneLoader3D } from "@/components/three/SceneLoader3D";
import { useCopy } from "@/i18n/provider";

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
 * finished deck offers the full player instead.
 */
export default function ClassroomClient({ sessionId }: { sessionId: string | null }) {
  const t = useCopy(COPY);
  const { progress, running } = useGenerationStream();
  const [voice, setVoice] = useState("");
  const [speaking, setSpeaking] = useState<LiveScene | null>(null);
  const [draft, setDraft] = useState<DraftInfo | null>(null);
  /**
   * The slide the teacher asked to look at, and the request to play one.
   *
   * A finished slide used to leave the screen the moment its voice ended, with
   * nothing to click to bring it back — the room now keeps a list of every
   * slide written so far, and one click opens it.
   */
  const [preview, setPreview] = useState<LiveScene | null>(null);
  const [jump, setJump] = useState<{ index: number; seq: number } | null>(null);

  useEffect(() => {
    try {
      setVoice(localStorage.getItem("edusgpt.classroom-voice.v1") ?? "");
    } catch {
      /* default voice */
    }
  }, []);

  // Escape leaves the preview, the way it leaves the zoomed picture.
  useEffect(() => {
    if (!preview) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  const mine =
    !!sessionId && (progress.lessonId ?? null) === sessionId;

  // No live run for this id (fresh visit, reload after death): watch the
  // library draft so the waiting card still shows real progress.
  const needDraft =
    !!sessionId && !mine && !progress.lesson && progress.liveScenes.length === 0;
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
        setDraft((payload.drafts ?? []).find((d) => d.id === sessionId) ?? null);
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

  const handleSceneChange = useCallback((scene: LiveScene | null) => {
    setSpeaking(scene);
  }, []);

  /** "Play this one now" from the slide list — the player owns the audio. */
  const playScene = useCallback((index: number) => {
    setJump((prev) => ({ index, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

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

  // Finished deck: hand over to the full player with seeking and karaoke.
  if (progress.done && progress.lesson) {
    return (
      <Shell
        title={progress.lesson.title}
        counter={`${progress.lesson.scenes.length} ${t.classroomScenes}`}
      >
        <div className="mx-auto w-full max-w-2xl rounded-2xl border border-ink-700 bg-ink-900/70 p-8 text-center">
          <CircleCheck className="mx-auto h-10 w-10 text-brand-300" />
          <p className="mt-3 text-lg font-semibold text-mist-50">
            {t.classroomDeckDone}
          </p>
          <p className="mt-1 text-sm text-mist-400">
            {t.classroomDeckDoneHint} {progress.lesson.scenes.length}{" "}
            {t.classroomScenes}.
          </p>
          <Link
            href={`/lesson?c=${encodeURIComponent(progress.lesson.id)}`}
            className="btn-primary mt-5"
          >
            <Play className="h-4 w-4" /> {t.classroomOpenPlayer}
          </Link>
        </div>
      </Shell>
    );
  }

  if (progress.error && !mine && !draft) {
    return (
      <Shell title={t.classroomFailedTitle}>
        <div className="mx-auto max-w-xl rounded-2xl border border-ember-500/50 bg-ember-500/10 p-6 text-center">
          <TriangleAlert className="mx-auto h-8 w-8 text-ember-400" />
          <p className="mt-2 text-sm text-mist-100">{progress.error}</p>
          <Link href="/studio" className="btn-primary mt-4">
            {t.classroomRetryStudio}
          </Link>
        </div>
      </Shell>
    );
  }

  const scenes = mine ? progress.liveScenes : [];
  const waiting =
    scenes.length === 0 && (mine ? running && !progress.error : !!draft || needDraft);
  const waitLabel = mine
    ? progress.outlineReady
      ? `${t.classroomWritingScene} ${scenes.length + 1}…`
      : t.classroomOutline
    : (draft?.message ?? t.classroomOutline);

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
        {/* Left rail: the deck list, with unwritten scenes marked. Every slide
            that has landed is a button — one click opens it, picture and all. */}
        <aside className="w-full shrink-0 space-y-2 lg:w-72 xl:w-80">
          <p className="font-mono text-[11px] uppercase tracking-widest text-mist-500">
            {t.classroomSlideList}
          </p>
          {progress.steps.length > 0 ? (
            <ol className="max-h-[64vh] space-y-1.5 overflow-y-auto pr-1">
              {progress.steps.map((step, i) => {
                const scene = scenes.find((s) => s.index === i) ?? null;
                const isCurrent = speaking?.index === i;
                const row = `flex w-full items-center gap-2.5 rounded-xl border px-2 py-2 text-left text-xs transition-colors ${
                  isCurrent
                    ? "border-brand-500/60 bg-brand-500/10"
                    : scene
                      ? "border-ink-600 bg-ink-950 hover:border-brand-400 hover:bg-brand-900/40"
                      : "border-ink-600 bg-ink-900"
                }`;
                return (
                  <li key={step.id}>
                    {scene ? (
                      <button
                        type="button"
                        onClick={() => setPreview(scene)}
                        className={`${row} cursor-pointer`}
                        title={t.classroomPreviewOf.replace("{title}", step.title)}
                      >
                        <SceneThumb lessonId={sessionId ?? ""} scene={scene} />
                        <span className="flex min-w-0 flex-1 items-center gap-2">
                          {isCurrent ? (
                            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-ember-500" />
                          ) : (
                            <CircleCheck className="h-3.5 w-3.5 shrink-0 text-brand-400" />
                          )}
                          <span
                            className={`min-w-0 flex-1 truncate ${
                              isCurrent ? "text-mist-50" : "text-mist-200"
                            }`}
                          >
                            {step.title}
                          </span>
                        </span>
                      </button>
                    ) : (
                      <div className={`${row} text-mist-500`}>
                        <span className="flex aspect-[4/3] w-14 shrink-0 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 font-mono text-[11px]">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="flex min-w-0 flex-1 items-center gap-2">
                          {step.state === "active" ? (
                            <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin text-gold-400" />
                          ) : (
                            <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-mist-500" />
                          )}
                          <span className="min-w-0 flex-1 truncate">{step.title}</span>
                        </span>
                        <span className="shrink-0 text-[11px]">{t.classroomCreating}…</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-xs text-mist-500">
              {draft
                ? `${t.classroomCreating} ${draft.done}/${draft.total} ${t.classroomScenes}`
                : t.classroomWaitingOutline}
            </p>
          )}
        </aside>

        {/* Center: the premiere, or the waiting card before scene one. */}
        <main className="min-w-0 flex-1">
          {scenes.length > 0 ? (
            <PremierePlayer
              scenes={scenes}
              voice={voice}
              running={running}
              done={progress.done}
              progress={progress.percent}
              lessonId={sessionId ?? ""}
              jumpTo={jump}
              showIndex={false}
              onSceneChange={handleSceneChange}
            />
          ) : waiting ? (
            <WaitingHero
              loaderLabel={waitLabel}
              title={
                mine && !progress.outlineReady
                  ? t.classroomOutline
                  : t.classroomWritingScenes
              }
              subtitle={
                mine && !progress.outlineReady
                  ? t.classroomOutlineHint
                  : t.classroomWritingHint
              }
              message={mine ? progress.message : (draft?.message ?? progress.message)}
              percent={progress.percent}
              done={progress.steps.filter((s) => s.state === "done").length}
              total={progress.steps.length || draft?.total || 0}
              log={progress.log}
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

          {/* The narration reads itself on the caption band under the slide —
              a second copy of the same paragraph below only repeated it. */}
        </main>
      </div>

      {preview ? (
        <SlidePreview
          lessonId={sessionId ?? ""}
          scene={preview}
          onClose={() => setPreview(null)}
          onPlay={() => {
            playScene(preview.index);
            setPreview(null);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * A finished slide, opened from the list.
 *
 * It is the same slide the room is playing — same component, same paper, same
 * page number — because a preview that looked different from the real thing
 * would not be a preview. The only thing added is the way back: play this one
 * now, or close and go back to the lesson.
 */
function SlidePreview({
  lessonId,
  scene,
  onClose,
  onPlay,
}: {
  lessonId: string;
  scene: LiveScene;
  onClose: () => void;
  onPlay: () => void;
}) {
  const t = useCopy(COPY);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={t.previewAriaLabel.replace("{n}", String(scene.index + 1))}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl border border-ink-600 bg-ink-950 p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] uppercase tracking-widest text-brand-400">
            {t.previewHeading} {String(scene.index + 1).padStart(2, "0")}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onPlay} className="btn-primary px-3 py-1.5 text-xs">
              <Play className="h-3.5 w-3.5" /> {t.previewPlay}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.previewClose}
              className="rounded-full border border-ink-600 p-1.5 text-mist-400 hover:border-brand-500 hover:text-mist-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <SlideSurface scene={liveSceneToSlide(scene)} index={scene.index} lessonId={lessonId} />
      </div>
    </div>
  );
}

/**
 * A slide written mid-run, in the shape the slide components expect.
 *
 * The id is the one the saved lesson will carry (`ai-<n>`), so the picture seed
 * and any dismissed-picture memory match the finished course.
 */
function liveSceneToSlide(scene: LiveScene): Lesson["scenes"][number] {
  return {
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
    start: 0,
    duration: 0,
  };
}

/**
 * The slide's own picture, small.
 *
 * Only when the slide actually has one. The fallback chain ends at a seeded
 * random photo, which is fine on a full slide where it is labelled as filler —
 * but a list of thumbnails full of stock faces told the teacher nothing about
 * their own lesson, so a slide with no picture gets its number instead.
 */
function SceneThumb({ lessonId, scene }: { lessonId: string; scene: LiveScene }) {
  const prompt = (scene.imagePrompt ?? "").trim();
  // Only a generated picture has a URL that costs nothing to ask for: it is
  // arithmetic on the lesson and the prompt. An archive search would mean one
  // request per row in the list, so those slides show their number instead.
  const hasImage = prompt.length >= 3;
  if (!hasImage) {
    return (
      <span className="flex aspect-[4/3] w-14 shrink-0 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 font-mono text-[11px] text-mist-400">
        {String(scene.index + 1).padStart(2, "0")}
      </span>
    );
  }
  const src = pollinationsImageUrl(lessonId, `ai-${scene.index + 1}`, prompt);
  return (
    <span className="relative block aspect-[4/3] w-14 shrink-0 overflow-hidden rounded-lg border border-ink-600 bg-ink-800">
      {/* Remote picture: next/image cannot optimise it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover"
      />
      <span className="absolute inset-x-0 bottom-0 bg-ink-950/80 py-px text-center font-mono text-[10px] text-mist-300">
        {String(scene.index + 1).padStart(2, "0")}
      </span>
    </span>
  );
}

/**
 * The waiting room: the robot on a tall center stage, the deck's live status
 * under it, and the last model calls as a feed — so "loading" always answers
 * what is happening, how far along it is, and what just finished.
 */
function WaitingHero({
  loaderLabel,
  title,
  subtitle,
  message,
  percent,
  done,
  total,
  log,
}: {
  loaderLabel: string;
  title: string;
  subtitle: string;
  message: string;
  percent: number;
  done: number;
  total: number;
  log: RunLogEntry[];
}) {
  const t = useCopy(COPY);
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const model = [...log].reverse().find((entry) => entry.model)?.model ?? null;
  const feed = log.slice(-3).reverse();
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-8 rounded-[2rem] bg-[radial-gradient(closest-side,rgba(36,189,172,0.14),transparent)]"
        />
        <SceneLoader3D label={loaderLabel} progress={percent} height={300} />
      </div>
      <h2 className="mt-4 text-center text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-center text-sm text-mist-400">{subtitle}</p>
      <div className="mt-4 space-y-2 rounded-2xl border border-ink-700 bg-ink-950 p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-mist-500">{t.classroomStatus}</span>
          <span className="min-w-0 flex-1 truncate text-right text-mist-100">
            {message || t.classroomStatusPending}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="shrink-0 text-mist-500">{t.classroomProgress}</span>
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-400 to-gold-400 transition-[width] duration-500"
              style={{ width: `${Math.max(2, clamped)}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums text-mist-200">
            {clamped}%
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-mist-500">{t.classroomScenesLabel}</span>
          <span className="font-mono text-xs tabular-nums text-mist-100">
            {total > 0
              ? `${done}/${total} ${t.classroomDone}`
              : t.classroomWaitingOutline}
          </span>
        </div>
        {model ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-mist-500">Model</span>
            <span
              className="min-w-0 flex-1 truncate text-right font-mono text-xs text-brand-200"
              title={model}
            >
              {model}
            </span>
          </div>
        ) : null}
        {feed.length > 0 ? (
          <ol className="space-y-1 border-t border-ink-700 pt-2">
            {feed.map((entry, i) => (
              <li key={`${entry.at}-${i}`} className="flex items-baseline gap-2 text-xs">
                <span className="shrink-0 font-mono text-[11px] text-mist-500">
                  {entry.at ?? ""}
                </span>
                <span className="min-w-0 flex-1 truncate text-mist-300">
                  {entry.message}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
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
