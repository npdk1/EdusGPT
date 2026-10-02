"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleCheck, Circle, LoaderCircle } from "lucide-react";
import type { Lesson } from "@/lib/lesson/types";

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
}

export interface RunLogEntry {
  /** Client clock when the event arrived, HH:MM:SS. */
  at: string;
  stage?: string;
  message: string;
  provider?: string;
  model?: string;
  elapsedMs?: number;
  kind: "stage" | "scene" | "done" | "error";
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
  /** True when the provider ran out of quota — waiting is the only fix. */
  quota?: boolean;
  provider?: string;
  model?: string;
  elapsedMs?: number;
}

const EMPTY: GenerationProgress = {
  percent: 0,
  message: "",
  outlineReady: false,
  steps: [],
  done: false,
  log: [],
};

/**
 * Drives the SSE endpoint and turns it into a watchable checklist.
 *
 * The point is honesty about latency: one opaque 30-180s call looks broken, so
 * every stage boundary is reported and the finished outline appears within a
 * few seconds instead of after everything.
 */
export function useGenerationStream() {
  const [progress, setProgress] = useState<GenerationProgress>(EMPTY);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const stepsRef = useRef<OutlineStep[]>([]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stepsRef.current = [];
    setRunning(false);
    setProgress(EMPTY);
  }, []);

  const applyEvent = useCallback((event: StreamEvent) => {
    // One row per SSE event, stamped with the client clock. The log is the
    // honest answer to "where is the model call": every row is one finished
    // call (or one wait), with the model that answered and how long it took.
    const entry: RunLogEntry = {
      at: new Date().toLocaleTimeString("vi-VN", { hour12: false }),
      stage: event.stage,
      message: event.type === "error" ? (event.error ?? event.message) : event.message,
      provider: event.provider,
      model: event.model,
      elapsedMs: event.elapsedMs,
      kind: event.type,
    };
    setProgress((current) => {
      const percent = Math.max(current.percent, event.progress ?? current.percent);
      const log = [...current.log, entry];

      if (event.type === "error") {
        return {
          ...current,
          percent,
          message: event.message,
          error: event.error ?? event.message,
          log,
        };
      }

      if (event.type === "done") {
        stepsRef.current = stepsRef.current.map((step) => ({ ...step, state: "done" }));
        return {
          percent: 100,
          message: event.message,
          outlineReady: true,
          steps: stepsRef.current,
          done: true,
          lesson: (event.lesson as Lesson) ?? null,
          error: null,
          log,
        };
      }

      // The outline arrives once, with the full scene list.
      if (event.outline?.scenes) {
        stepsRef.current = event.outline.scenes;
        return {
          ...current,
          percent,
          message: event.message,
          outlineReady: true,
          steps: event.outline.scenes,
          log,
        };
      }

      if (event.type === "scene" && event.scene) {
        const scene = event.scene as { title?: string; bullets?: unknown[] };
        const steps = stepsRef.current.map((step) =>
          step.state === "active"
            ? {
                ...step,
                state: "done" as const,
                bullets: Array.isArray(scene.bullets) ? scene.bullets.length : step.bullets,
              }
            : step,
        );
        // Promote the next pending scene so the list shows work moving.
        const nextPending = steps.findIndex((step) => step.state === "pending");
        if (nextPending >= 0) {
          steps[nextPending] = { ...steps[nextPending], state: "active" };
        }
        stepsRef.current = steps;
        return { ...current, percent, message: event.message, outlineReady: true, steps, log };
      }

      return { ...current, percent, message: event.message, log };
    });
  }, []);

  // __PART2__

  const start = useCallback(
    async (body: Record<string, unknown>) => {
      abortRef.current?.abort();
      stepsRef.current = [];
      setRunning(true);
      setProgress(EMPTY);

      const controller = new AbortController();
      abortRef.current = controller;

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
          throw new Error(payload?.error ?? `Máy chủ trả lỗi ${response.status}.`);
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
              if (event.stage === "outline") {
                stepsRef.current = [];
              }
              applyEvent(event);
            } catch {
              // A truncated frame is not worth failing the run over.
            }
          }
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setProgress((current) => ({
          ...current,
          message: error instanceof Error ? error.message : "Lỗi mạng.",
          error: error instanceof Error ? error.message : "Lỗi mạng.",
        }));
      } finally {
        if (!controller.signal.aborted) setRunning(false);
      }
    },
    [applyEvent],
  );

  return { progress, running, start, reset };
}

/** Checklist rendered under the form while a lesson is being generated. */
export function GenerationTimeline({ progress }: { progress: GenerationProgress }) {
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
          {progress.message || "Đang chuẩn bị…"}
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
          title="1. Lên dàn ý (nhanh)"
          state={progress.outlineReady ? "done" : "active"}
        />
        <Phase
          title="2. Viết chi tiết từng cảnh"
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
                  <span className="ml-1 text-mist-400">({step.bullets} ý)</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const STAGE_LABEL: Record<string, string> = {
  outline: "Lên dàn ý",
  "outline-done": "Dàn ý xong",
  scene: "Viết cảnh",
  "scene-retry": "Thử lại",
  "scene-fallback": "Tạm thay",
};

function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}p${Math.round(seconds % 60)}s`;
}

/**
 * One row per model call, rendered below the script. The providers answer a
 * whole call at once and never stream tokens, so there is no live "thinking"
 * to show — this table is the closest honest thing: which call ran, which
 * model answered it, and how long it took, in order.
 */
export function RunLog({ log }: { log: RunLogEntry[] }) {
  if (log.length === 0) return null;
  return (
    <div className="mt-4 rounded-xl border border-ink-700/70 bg-ink-950/50 p-3.5">
      <p className="text-sm font-semibold text-mist-100">Nhật ký gọi model</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-mist-500">
        Mỗi dòng là một lần gọi model đã xong: model nào trả lời, mất bao lâu.
        Nhà cung cấp không gửi từng chữ đang nghĩ nên không xem trực tiếp được
        quá trình đó — bảng này cho biết cuộc gọi đang ở bước nào.
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-xs">
          <thead>
            <tr className="text-left font-mono text-[11px] uppercase tracking-wide text-mist-500">
              <th className="border-b border-ink-700 py-1.5 pr-3 font-medium">Giờ</th>
              <th className="border-b border-ink-700 py-1.5 pr-3 font-medium">Bước</th>
              <th className="border-b border-ink-700 py-1.5 pr-3 font-medium">Model</th>
              <th className="border-b border-ink-700 py-1.5 pr-3 text-right font-medium">
                Thời gian
              </th>
              <th className="border-b border-ink-700 py-1.5 font-medium">Chi tiết</th>
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
                    ? "Hoàn tất"
                    : entry.kind === "error"
                      ? "Lỗi"
                      : (entry.stage && STAGE_LABEL[entry.stage]) || "Đang chạy"}
                </td>
                <td
                  className="max-w-[220px] break-all py-1.5 pr-3 font-mono text-[11px] text-brand-200"
                  title={entry.model ?? entry.provider ?? ""}
                >
                  {entry.model ?? entry.provider ?? "—"}
                </td>
                <td className="whitespace-nowrap py-1.5 pr-3 text-right font-mono text-[11px] tabular-nums text-mist-300">
                  {entry.elapsedMs == null ? "—" : formatElapsed(entry.elapsedMs)}
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
