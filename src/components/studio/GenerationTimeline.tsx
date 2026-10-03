"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleCheck, Circle, LoaderCircle } from "lucide-react";
import type { Lesson } from "@/lib/lesson/types";
import type { RunLogEntry } from "@/lib/lesson/run-log";
import { DEFAULT_LANG, LANG_KEY, useCopy, useLang, type Lang } from "@/i18n/provider";

const COPY = {
  en: {
    preparing: "Preparing…",
    phaseOutline: "1. Outline (fast)",
    phaseScenes: "2. Write out each scene",
    sceneWord: "Scene",
    stepPoints: "points",
    minutesUnit: "m",
    logTitle: "Model call log",
    logNote:
      "Each row is one finished model call: which model answered, and how long it took. Providers do not stream the thinking behind an answer, so that part cannot be watched live — this table says which step the current call is at.",
    colTime: "Time",
    colStep: "Step",
    colDuration: "Duration",
    colDetail: "Detail",
    logCompleted: "Complete",
    logError: "Error",
    logRunning: "Running",
    streamStopped: "The page reloaded, so the generation stream stopped. Press generate again to carry on.",
    serverError: "The server returned an error",
    networkError: "Network error.",
    clockLocale: "en-GB",
  },
  vi: {
    preparing: "Đang chuẩn bị…",
    phaseOutline: "1. Lên dàn ý (nhanh)",
    phaseScenes: "2. Viết chi tiết từng cảnh",
    sceneWord: "Cảnh",
    stepPoints: "ý",
    minutesUnit: "p",
    logTitle: "Nhật ký gọi model",
    logNote:
      "Mỗi dòng là một lần gọi model đã xong: model nào trả lời, mất bao lâu. Nhà cung cấp không gửi từng chữ đang nghĩ nên không xem trực tiếp được quá trình đó — bảng này cho biết cuộc gọi đang ở bước nào.",
    colTime: "Giờ",
    colStep: "Bước",
    colDuration: "Thời gian",
    colDetail: "Chi tiết",
    logCompleted: "Hoàn tất",
    logError: "Lỗi",
    logRunning: "Đang chạy",
    streamStopped:
      "Trang đã tải lại nên luồng tạo bài bị dừng. Bấm tạo lại để chạy tiếp.",
    serverError: "Máy chủ trả lời lỗi",
    networkError: "Lỗi mạng.",
    clockLocale: "vi-VN",
  },
};

const STAGE_LABEL: Record<Lang, Record<string, string>> = {
  en: {
    outline: "Outline",
    "outline-done": "Outline done",
    scene: "Writing scene",
    "scene-retry": "Retry",
    "scene-fallback": "Placeholder",
  },
  vi: {
    outline: "Lên dàn ý",
    "outline-done": "Dàn ý xong",
    scene: "Viết cảnh",
    "scene-retry": "Thử lại",
    "scene-fallback": "Tạm thay",
  },
};

/**
 * The dictionary for the code that runs outside React.
 *
 * `pumpRun` and `reduceProgress` are module-level functions, so they cannot call
 * `useCopy`. They read the language from the one place the provider keeps it —
 * `localStorage` — rather than from a second store that would have to be kept in
 * step with the first.
 */
function copy(): typeof COPY.en {
  let lang: Lang = DEFAULT_LANG;
  try {
    lang = localStorage.getItem(LANG_KEY) === "vi" ? "vi" : DEFAULT_LANG;
  } catch {
    /* storage blocked: the default language stands */
  }
  return COPY[lang];
}

export type { RunLogEntry };

export interface OutlineStep {
  id: string;
  title: string;
  kind: string;
  duration: number;
  state: "pending" | "active" | "done";
  bullets?: number;
}

export interface GenerationProgress {
  percent: number;
  message: string;
  outlineReady: boolean;
  steps: OutlineStep[];
  done: boolean;
  /** Present once the server has assembled the final lesson. */
  lesson?: Lesson | null;
  error?: string | null;
  /** Every SSE event of this run, in order — the run log below the script. */
  log: RunLogEntry[];
  /**
   * Scenes finished so far, ordered by deck position. The server reports each
   * scene the moment its own call lands, so the studio can show the slide
   * and read its voice-over straight away instead of waiting for the whole
   * deck.
   */
  liveScenes: LiveScene[];
  /**
   * The deck's stable id, sent on the first event. The studio routes to the
   * classroom session with it the moment it arrives.
   */
  lessonId?: string | null;
}

/** One finished scene, as far as the classroom needs to show it. */
export interface LiveScene {
  index: number;
  title: string;
  subtitle: string;
  bullets: string[];
  narration: string;
  kind: string;
  imagePrompt?: string;
  imageQuery?: string;
  /** How the slide arranges itself; see `SLIDE_LAYOUTS`. */
  layout?: string;
}

export interface StreamEvent {
  type: "stage" | "scene" | "done" | "error";
  stage?: string;
  message: string;
  progress?: number;
  scene?: unknown;
  outline?: { title: string; scenes: OutlineStep[] } | null;
  lesson?: unknown;
  error?: string;
  /** Zero-based deck position of `scene` — batches finish out of order. */
  sceneIndex?: number;
  /** True when the provider ran out of quota — waiting is the only fix. */
  quota?: boolean;
  provider?: string;
  model?: string;
  elapsedMs?: number;
  lessonId?: string;
}

const EMPTY: GenerationProgress = {
  percent: 0,
  message: "",
  outlineReady: false,
  steps: [],
  done: false,
  log: [],
  liveScenes: [],
};

/**
 * Drives the SSE endpoint and turns it into a watchable checklist.
 *
 * The point is honesty about latency: one opaque 30-180s call looks broken, so
 * every stage boundary is reported and the finished outline appears within a
 * few seconds instead of after everything.
 *
 * The reader lives in a module-level singleton, not in the component: leaving
 * /studio for another page unmounts the panel, and the old code aborted the
 * fetch on unmount — so a 10-minute lesson died silently whenever the teacher
 * looked elsewhere. Now navigation only detaches the view; the run continues,
 * every event is snapshotted to localStorage, and remounting reattaches to the
 * live run (or to the snapshot after a full reload). Only an explicit reset, a
 * new run, or closing the tab itself stops the stream.
 */
const SNAPSHOT_KEY = "edusgpt.generation.v1";

function readSnapshot(): { progress: GenerationProgress; running: boolean } | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      progress?: GenerationProgress;
      running?: boolean;
    };
    if (!parsed || typeof parsed !== "object" || !parsed.progress) return null;
    return { progress: parsed.progress, running: parsed.running === true };
  } catch {
    return null;
  }
}

function writeSnapshot(progress: GenerationProgress, running: boolean): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ progress, running }));
  } catch {
    // A long deck can outgrow localStorage; keep the timeline without the
    // finished lesson rather than losing the whole snapshot.
    try {
      const { lesson: _dropped, ...rest } = progress;
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ progress: rest, running }));
    } catch {
      /* leave the previous snapshot alone */
    }
  }
}

function clearSnapshot(): void {
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    /* ignore */
  }
}

interface ActiveRun {
  controller: AbortController;
  steps: OutlineStep[];
  progress: GenerationProgress;
  running: boolean;
  saveAttempted: boolean;
}

let activeRun: ActiveRun | null = null;

type RunListener = (progress: GenerationProgress, running: boolean) => void;
const runListeners = new Set<RunListener>();

function broadcast(): void {
  if (!activeRun) return;
  writeSnapshot(activeRun.progress, activeRun.running);
  for (const listener of runListeners) {
    listener(activeRun.progress, activeRun.running);
  }
}

/** The finished lesson must reach the server library even if nobody is
 * watching: without this, a run that completes while the user is on another
 * page would vanish — the exact loss this singleton exists to prevent. The
 * POST is idempotent per lesson id, so the panel saving again on reattach is
 * harmless. The run log travels along so the library can show it later. */
function saveRunToLibrary(lesson: Lesson, log: RunLogEntry[]): void {
  void fetch("/api/courses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lesson, log }),
  }).catch(() => {
    /* the panel retries on reattach; a silent run keeps its snapshot */
  });
}

function reduceProgress(
  current: GenerationProgress,
  steps: OutlineStep[],
  event: StreamEvent,
): { progress: GenerationProgress; steps: OutlineStep[] } {
  // One row per SSE event, stamped with the client clock. The log is the
  // honest answer to "where is the model call": every row is one finished
  // call (or one wait), with the model that answered and how long it took.
  const entry: RunLogEntry = {
    at: new Date().toLocaleTimeString(copy().clockLocale, { hour12: false }),
    stage: event.stage,
    message: event.type === "error" ? (event.error ?? event.message) : event.message,
    provider: event.provider,
    model: event.model,
    elapsedMs: event.elapsedMs,
    kind: event.type,
  };
  const percent = Math.max(current.percent, event.progress ?? current.percent);
  const log = [...current.log, entry];

  if (event.type === "error") {
    return {
      progress: {
        ...current,
        percent,
        message: event.message,
        error: event.error ?? event.message,
        log,
      },
      steps,
    };
  }

  if (event.type === "done") {
    const doneSteps = steps.map((step) => ({ ...step, state: "done" as const }));
    return {
      progress: {
        percent: 100,
        message: event.message,
        outlineReady: true,
        steps: doneSteps,
        done: true,
        lesson: (event.lesson as Lesson) ?? null,
        error: null,
        log,
        liveScenes: current.liveScenes,
        lessonId: event.lessonId ?? current.lessonId ?? null,
      },
      steps: doneSteps,
    };
  }

  // The outline arrives once, with the full scene list.
  if (event.outline?.scenes) {
    return {
      progress: {
        ...current,
        percent,
        message: event.message,
        outlineReady: true,
        steps: event.outline.scenes,
        log,
        lessonId: event.lessonId ?? current.lessonId ?? null,
      },
      steps: event.outline.scenes,
    };
  }

  if (event.type === "scene" && event.scene) {
    const scene = event.scene as {
      title?: string;
      subtitle?: unknown;
      bullets?: unknown[];
      narration?: unknown;
      kind?: unknown;
      imagePrompt?: unknown;
      imageQuery?: unknown;
      layout?: unknown;
    };
    const next = steps.map((step) =>
      step.state === "active"
        ? {
            ...step,
            state: "done" as const,
            bullets: Array.isArray(scene.bullets) ? scene.bullets.length : step.bullets,
          }
        : step,
    );
    // Promote the next pending scene so the list shows work moving.
    const nextPending = next.findIndex((step) => step.state === "pending");
    if (nextPending >= 0) {
      next[nextPending] = { ...next[nextPending], state: "active" };
    }
    // The progressive script: keep every finished scene, ordered by deck
    // position. Narration is what the voice reads straight away.
    const live: LiveScene = {
      index: typeof event.sceneIndex === "number" ? event.sceneIndex : current.liveScenes.length,
      title:
        typeof scene.title === "string" && scene.title.trim()
          ? scene.title.trim().slice(0, 200)
          : `${copy().sceneWord} ${current.liveScenes.length + 1}`,
      subtitle: typeof scene.subtitle === "string" ? scene.subtitle.slice(0, 300) : "",
      bullets: Array.isArray(scene.bullets)
        ? scene.bullets.filter((b): b is string => typeof b === "string").slice(0, 12).map((b) => b.slice(0, 300))
        : [],
      narration:
        typeof scene.narration === "string" ? scene.narration.slice(0, 4000) : "",
      kind: typeof scene.kind === "string" ? scene.kind : "concept",
      imagePrompt:
        typeof scene.imagePrompt === "string" && scene.imagePrompt.trim()
          ? scene.imagePrompt.trim().slice(0, 500)
          : undefined,
      imageQuery:
        typeof scene.imageQuery === "string" && scene.imageQuery.trim()
          ? scene.imageQuery.trim().slice(0, 200)
          : undefined,
      layout: typeof scene.layout === "string" ? scene.layout.slice(0, 20) : undefined,
    };
    const liveScenes = [...current.liveScenes, live].sort((a, b) => a.index - b.index);
    return {
      progress: { ...current, percent, message: event.message, outlineReady: true, steps: next, log, liveScenes, lessonId: event.lessonId ?? current.lessonId ?? null },
      steps: next,
    };
  }

  return { progress: { ...current, percent, message: event.message, log, lessonId: event.lessonId ?? current.lessonId ?? null }, steps };
}

async function pumpRun(run: ActiveRun, body: Record<string, unknown>): Promise<void> {
  const controller = run.controller;
  try {
    const response = await fetch("/api/gemini/lesson", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(payload?.error ?? `${copy().serverError} ${response.status}.`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames end with a blank line; the tail may be partial.
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const line = frame.split("\n").find((item) => item.startsWith("data:"));
        if (!line) continue;
        try {
          const event = JSON.parse(line.slice(5).trim()) as StreamEvent;
          if (activeRun !== run) return;
          if (event.stage === "outline") {
            run.steps = [];
          }
          const reduced = reduceProgress(run.progress, run.steps, event);
          run.progress = reduced.progress;
          run.steps = reduced.steps;
          if (event.type === "done" && reduced.progress.lesson && !run.saveAttempted) {
            run.saveAttempted = true;
            saveRunToLibrary(reduced.progress.lesson, reduced.progress.log);
          }
          broadcast();
        } catch {
          // A truncated frame is not worth failing the run over.
        }
      }
    }
  } catch (error) {
    if (controller.signal.aborted || activeRun !== run) return;
    const message = error instanceof Error ? error.message : copy().networkError;
    run.progress = { ...run.progress, message, error: message };
    broadcast();
  } finally {
    if (activeRun === run && !controller.signal.aborted) {
      run.running = false;
      broadcast();
    }
  }
}

export function useGenerationStream() {
  const t = useCopy(COPY);
  // Initial state is always EMPTY so the first client render matches the
  // server HTML: reading localStorage or the singleton here renders
  // different output than SSR and breaks hydration. The effect below
  // reattaches to the live run or the snapshot right after mount.
  const [progress, setProgress] = useState<GenerationProgress>(EMPTY);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const listener: RunListener = (next, isRunning) => {
      setProgress(next);
      setRunning(isRunning);
    };
    runListeners.add(listener);
    // Pick up whatever the singleton holds — a live run keeps streaming into
    // this view; a finished one shows its result straight away.
    if (activeRun) {
      setProgress(activeRun.progress);
      setRunning(activeRun.running);
    } else {
      const snapshot = readSnapshot();
      if (snapshot && snapshot.running && !snapshot.progress.done && !snapshot.progress.error) {
        const interrupted: GenerationProgress = {
          ...snapshot.progress,
          error: t.streamStopped,
        };
        setProgress(interrupted);
        writeSnapshot(interrupted, false);
      }
    }
    // Detaching only unsubscribes. The run keeps going without its viewer —
    // that is the whole point of the singleton.
    return () => {
      runListeners.delete(listener);
    };
  }, [t]);

  const reset = useCallback(() => {
    activeRun?.controller.abort();
    activeRun = null;
    clearSnapshot();
    setRunning(false);
    setProgress(EMPTY);
    for (const listener of runListeners) {
      listener(EMPTY, false);
    }
  }, []);

  // __PART2__

  const start = useCallback(
    async (body: Record<string, unknown>) => {
      activeRun?.controller.abort();
      const run: ActiveRun = {
        controller: new AbortController(),
        steps: [],
        progress: EMPTY,
        running: true,
        saveAttempted: false,
      };
      activeRun = run;
      broadcast();
      await pumpRun(run, body);
    },
    [],
  );

  return { progress, running, start, reset };
}

/** Checklist rendered under the form while a lesson is being generated. */
export function GenerationTimeline({ progress }: { progress: GenerationProgress }) {
  const t = useCopy(COPY);
  const busy = !progress.done && progress.message !== "";

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-brand-700/50 bg-brand-500/[0.07] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-100">
          {progress.done ? (
            <CircleCheck className="h-4 w-4 text-brand-300" />
          ) : busy ? (
            <LoaderCircle className="h-4 w-4 animate-spin text-brand-300" />
          ) : (
            <Circle className="h-4 w-4 text-mist-500" />
          )}
          {progress.message || t.preparing}
        </p>
        <span className="font-mono text-xs tabular-nums text-brand-200">
          {Math.round(progress.percent)}%
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-400 to-gold-400 transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(2, progress.percent)}%` }}
        />
      </div>

      <ol className="grid gap-1.5 sm:grid-cols-2">
        <Phase
          title={t.phaseOutline}
          state={progress.outlineReady ? "done" : "active"}
        />
        <Phase
          title={t.phaseScenes}
          state={progress.done ? "done" : progress.outlineReady ? "active" : "pending"}
        />
      </ol>

      {progress.steps.length > 0 ? (
        <ul className="space-y-1.5 border-t border-brand-800/60 pt-3">
          {progress.steps.map((step, index) => (
            <li key={step.id} className="flex items-start gap-2 text-xs">
              {step.state === "done" ? (
                <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-300" />
              ) : step.state === "active" ? (
                <LoaderCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-gold-300" />
              ) : (
                <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mist-500" />
              )}
              <span className={step.state === "pending" ? "text-mist-500" : "text-mist-200"}>
                <span className="font-mono text-mist-500">
                  {String(index + 1).padStart(2, "0")}
                </span>{" "}
                {step.title}
                {step.bullets ? (
                  <span className="ml-1 text-mist-400">({step.bullets} {t.stepPoints})</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** "5m03s" in English, "5p03s" in Vietnamese — the unit is part of the copy. */
function formatElapsed(ms: number, minutesUnit: string): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}${minutesUnit}${Math.round(seconds % 60)}s`;
}

/**
 * One row per model call, rendered below the script. The providers answer a
 * whole call at once and never stream tokens, so there is no live "thinking"
 * to show — this table is the closest honest thing: which call ran, which
 * model answered it, and how long it took, in order.
 */
export function RunLog({ log }: { log: RunLogEntry[] }) {
  const t = useCopy(COPY);
  const lang = useLang();
  if (log.length === 0) return null;
  return (
    <div className="mt-4 rounded-xl border border-ink-700/70 bg-ink-950/50 p-3.5">
      <p className="text-sm font-semibold text-mist-100">{t.logTitle}</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-mist-500">{t.logNote}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-xs">
          <thead>
            <tr className="text-left font-mono text-[11px] uppercase tracking-wide text-mist-500">
              <th className="border-b border-ink-700 py-1.5 pr-3 font-medium">{t.colTime}</th>
              <th className="border-b border-ink-700 py-1.5 pr-3 font-medium">{t.colStep}</th>
              <th className="border-b border-ink-700 py-1.5 pr-3 font-medium">Model</th>
              <th className="border-b border-ink-700 py-1.5 pr-3 text-right font-medium">
                {t.colDuration}
              </th>
              <th className="border-b border-ink-700 py-1.5 font-medium">{t.colDetail}</th>
            </tr>
          </thead>
          <tbody>
            {log.map((entry, index) => (
              <tr key={`${entry.at}-${index}`} className="align-top">
                <td className="whitespace-nowrap py-1.5 pr-3 font-mono text-[11px] text-mist-500">
                  {entry.at}
                </td>
                <td className="whitespace-nowrap py-1.5 pr-3 text-mist-200">
                  {entry.kind === "done"
                    ? t.logCompleted
                    : entry.kind === "error"
                      ? t.logError
                      : (entry.stage && STAGE_LABEL[lang][entry.stage]) || t.logRunning}
                </td>
                <td
                  className="max-w-[220px] break-all py-1.5 pr-3 font-mono text-[11px] text-brand-200"
                  title={entry.model ?? entry.provider ?? ""}
                >
                  {entry.model ?? entry.provider ?? "—"}
                </td>
                <td className="whitespace-nowrap py-1.5 pr-3 text-right font-mono text-[11px] tabular-nums text-mist-300">
                  {entry.elapsedMs == null ? "—" : formatElapsed(entry.elapsedMs, t.minutesUnit)}
                </td>
                <td className="min-w-0 py-1.5 text-mist-300">{entry.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Phase({  title,
  state,
}: {
  title: string;
  state: "pending" | "active" | "done";
}) {
  return (
    <li
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
        state === "done"
          ? "border-brand-600/60 bg-brand-500/10 text-brand-100"
          : state === "active"
            ? "border-gold-500/50 bg-gold-500/10 text-gold-100"
            : "border-ink-700 bg-ink-900/50 text-mist-500"
      }`}
    >
      {state === "done" ? (
        <CircleCheck className="h-3.5 w-3.5" />
      ) : state === "active" ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Circle className="h-3.5 w-3.5" />
      )}
      {title}
    </li>
  );
}
