"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CircleCheck,
  LoaderCircle,
  Play,
  TriangleAlert,
  Volume2,
} from "lucide-react";
import {
  useGenerationStream,
  type LiveScene,
  type RunLogEntry,
} from "@/components/studio/GenerationTimeline";
import { PremierePlayer } from "@/components/studio/Premiere";
import { SceneLoader3D } from "@/components/three/SceneLoader3D";

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
  const { progress, running } = useGenerationStream();
  const [voice, setVoice] = useState("");
  const [speaking, setSpeaking] = useState<LiveScene | null>(null);
  const [draft, setDraft] = useState<DraftInfo | null>(null);

  useEffect(() => {
    try {
      setVoice(localStorage.getItem("edusgpt.classroom-voice.v1") ?? "");
    } catch {
      /* default voice */
    }
  }, []);

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

  if (!sessionId) {
    return (
      <Shell title="Thiếu buổi học">
        <p className="text-sm text-mist-300">
          Trang này cần id của bài đang tạo — hãy bấm “Tạo bài giảng” ở studio,
          trang sẽ tự đưa bạn vào đây.
        </p>
        <Link href="/studio" className="btn-primary mt-4">
          Về studio
        </Link>
      </Shell>
    );
  }

  // Finished deck: hand over to the full player with seeking and karaoke.
  if (progress.done && progress.lesson) {
    return (
      <Shell title={progress.lesson.title} counter={`${progress.lesson.scenes.length} cảnh`}>
        <div className="mx-auto w-full max-w-2xl rounded-2xl border border-ink-700 bg-ink-900/70 p-8 text-center">
          <CircleCheck className="mx-auto h-10 w-10 text-brand-300" />
          <p className="mt-3 text-lg font-semibold text-mist-50">
            Bài đã viết xong — vào lớp học đầy đủ
          </p>
          <p className="mt-1 text-sm text-mist-400">
            Trình phát có tua từng giây, phụ đề theo giọng và đầy đủ {progress.lesson.scenes.length} cảnh.
          </p>
          <Link
            href={`/lesson?c=${encodeURIComponent(progress.lesson.id)}`}
            className="btn-primary mt-5"
          >
            <Play className="h-4 w-4" /> Mở trình phát
          </Link>
        </div>
      </Shell>
    );
  }

  if (progress.error && !mine && !draft) {
    return (
      <Shell title="Buổi học gặp sự cố">
        <div className="mx-auto max-w-xl rounded-2xl border border-ember-500/50 bg-ember-500/10 p-6 text-center">
          <TriangleAlert className="mx-auto h-8 w-8 text-ember-400" />
          <p className="mt-2 text-sm text-mist-100">{progress.error}</p>
          <Link href="/studio" className="btn-primary mt-4">
            Về studio tạo lại
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
      ? `Đang viết cảnh ${scenes.length + 1}…`
      : "Đang dựng đề cương bài học"
    : (draft?.message ?? "Đang dựng đề cương bài học");

  return (
    <div className="min-h-screen bg-[#060a14] text-mist-50">
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-mist-300 hover:text-mist-50"
        >
          <ArrowLeft className="h-4 w-4" /> Về trang chủ
        </Link>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold">
          {speaking ? (
            <>
              <span className="mr-2 font-mono text-[11px] font-normal uppercase tracking-widest text-brand-300">
                Cảnh hiện tại
              </span>
              {speaking.title}
            </>
          ) : (
            <span className="font-normal text-mist-400">Lớp học đang chuẩn bị…</span>
          )}
        </p>
        <span className="w-24 shrink-0 text-right font-mono text-sm text-mist-400">
          {scenes.length > 0 && speaking
            ? String(speaking.index + 1).padStart(2, "0")
            : ""}
        </span>
      </header>

      <div className="flex w-full flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:px-8">
        {/* Left rail: the deck list, with unwritten scenes marked. */}
        <aside className="w-full shrink-0 space-y-2 lg:w-72 xl:w-80">
          <p className="font-mono text-[11px] uppercase tracking-widest text-mist-500">
            Cảnh hiện tại
          </p>
          {progress.steps.length > 0 ? (
            <ol className="space-y-1.5">
              {progress.steps.map((step, i) => {
                const landed = scenes.some((s) => s.index === i);
                const isCurrent = speaking?.index === i;
                return (
                  <li
                    key={step.id}
                    className={`rounded-xl border px-3 py-2 text-xs ${
                      isCurrent
                        ? "border-brand-500/60 bg-brand-500/10 text-mist-50"
                        : landed
                          ? "border-white/10 bg-white/[0.03] text-mist-200"
                          : "border-white/5 bg-white/[0.01] text-mist-500"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {step.state === "done" || landed ? (
                        <CircleCheck className="h-3.5 w-3.5 shrink-0 text-brand-300" />
                      ) : step.state === "active" ? (
                        <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin text-gold-300" />
                      ) : (
                        <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-mist-600" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{step.title}</span>
                    </span>
                    {!landed && step.state !== "done" ? (
                      <span className="mt-1 block pl-5 text-[11px] text-mist-500">
                        Đang tạo…
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-mist-500">
              {draft
                ? `Đang tạo ${draft.done}/${draft.total} cảnh`
                : "Đang chờ dàn ý…"}
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
              onSceneChange={handleSceneChange}
            />
          ) : waiting ? (
            <WaitingHero
              loaderLabel={waitLabel}
              title={
                mine && !progress.outlineReady
                  ? "Đang dựng đề cương bài học"
                  : "Đang viết từng cảnh"
              }
              subtitle={
                mine && !progress.outlineReady
                  ? "Đang sắp xếp lộ trình học…"
                  : "Xong cảnh nào, lớp học chiếu ngay cảnh đó kèm giọng đọc."
              }
              message={mine ? progress.message : (draft?.message ?? progress.message)}
              percent={progress.percent}
              done={progress.steps.filter((s) => s.state === "done").length}
              total={progress.steps.length || draft?.total || 0}
              log={progress.log}
            />
          ) : (
            <div className="mx-auto w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <p className="text-sm text-mist-300">
                Không thấy buổi tạo bài này — có thể trang đã tải lại sau khi
                luồng tạo dừng. Bấm tạo lại ở studio để vào lớp mới.
              </p>
              <Link href="/studio" className="btn-primary mt-4">
                Về studio
              </Link>
            </div>
          )}

          {/* Bottom narration bar, like the classroom's teacher line. */}
          {speaking ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500/20">
                <Volume2 className="h-5 w-5 text-brand-200" />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-widest text-brand-300">
                  Đang giảng · cảnh {speaking.index + 1}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-mist-100">
                  {speaking.narration}
                </p>
              </div>
            </div>
          ) : null}

          <p className="mt-6 text-center font-mono text-[11px] uppercase tracking-widest text-mist-600">
            Các tác nhân AI đang làm việc…
          </p>
        </main>
      </div>
    </div>
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
      <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-mist-500">Trạng thái</span>
          <span className="min-w-0 flex-1 truncate text-right text-mist-100">
            {message || "Đang chuẩn bị…"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="shrink-0 text-mist-500">Tiến độ</span>
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
          <span className="text-mist-500">Cảnh</span>
          <span className="font-mono text-xs tabular-nums text-mist-100">
            {total > 0 ? `${done}/${total} đã xong` : "đang chờ dàn ý…"}
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
          <ol className="space-y-1 border-t border-white/5 pt-2">
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
  return (
    <div className="min-h-screen bg-[#060a14] text-mist-50">
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-mist-300 hover:text-mist-50"
        >
          <ArrowLeft className="h-4 w-4" /> Về trang chủ
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
