"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Timebase, LoopRange } from "@/hooks/useTimebase";
import type { Lesson } from "@/lib/lesson/types";
import { clamp, formatClock } from "@/lib/format";

interface ScrubBarProps {
  lesson: Lesson;
  timebase: Timebase;
  loop: LoopRange;
}

/**
 * The scrub bar. Supports click-to-seek, press-and-drag scrubbing (pointer
 * capture), chapter bands, and the A→B loop region — i.e. every way a learner
 * expects to "tua đi tua lại".
 */
export function ScrubBar({ lesson, timebase, loop }: ScrubBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<HTMLDivElement>(null);
  /** Chapter band nodes, so the playhead can mark the ones already behind it. */
  const chapterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const pendingRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const duration = timebase.duration || lesson.duration || 1;
  // Stable handles: the `timebase` object is fresh every render, these never are.
  const seekStable = timebase.seek;
  const subscribeScrub = timebase.subscribe;

  const ratioFromEvent = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    return clamp((clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
  }, []);

  /** Coalesce drag seeks to one per frame so scrubbing never floods the timebase. */
  const queueSeek = useCallback(
    (time: number) => {
      pendingRef.current = time;
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingRef.current !== null) seekStable(pendingRef.current);
      });
    },
    [seekStable],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // --- playhead / aria, without a single React render ------------------------
  useEffect(() => {
    return subscribeScrub((time, meta) => {
      const total = meta.duration || duration;
      const percent = clamp((time / (total || 1)) * 100, 0, 100);
      if (progressRef.current) progressRef.current.style.width = `${percent}%`;
      if (handleRef.current) handleRef.current.style.left = `${percent}%`;
      if (trackRef.current) {
        trackRef.current.setAttribute("aria-valuenow", time.toFixed(2));
        trackRef.current.setAttribute(
          "aria-valuetext",
          `${formatClock(time, false)} trên ${formatClock(total, false)}`,
        );
      }

      // Which chapters are behind the playhead.
      //
      // The rail alone answers "how far", but a deck read at 2× with chapters
      // three and nine minutes long leaves the reader with no way to tell that
      // whole sections are already done. The bands are the only place that
      // structure is shown, so it is the only place it can be marked — and it is
      // written straight onto the nodes here for the same reason the playhead is.
      for (let index = 0; index < chapterRefs.current.length; index += 1) {
        const node = chapterRefs.current[index];
        const chapter = lesson.chapters[index];
        if (!node || !chapter) continue;
        const passed = time >= chapter.end;
        const current = time >= chapter.start && time < chapter.end;
        const state = passed ? "passed" : current ? "current" : "todo";
        if (node.dataset.state !== state) node.dataset.state = state;
      }
    });
  }, [subscribeScrub, duration, lesson.chapters]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track) return;
    track.setPointerCapture(event.pointerId);
    setDragging(true);
    track.focus({ preventScroll: true });
    timebase.seek(ratioFromEvent(event.clientX) * duration);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const ratio = ratioFromEvent(event.clientX);
    const time = ratio * duration;
    const track = trackRef.current;

    if (track) {
      const rect = track.getBoundingClientRect();
      const offset = clamp(event.clientX - rect.left, 52, Math.max(rect.width - 52, 52));

      const host = hoverRef.current;
      if (host) {
        host.style.transform = `translateX(${offset}px)`;
        host.dataset.visible = "true";
        host.textContent = formatClock(time, true, lesson.fps);
      }
    }

    if (dragging) queueSeek(time);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    track?.releasePointerCapture?.(event.pointerId);
    setDragging(false);
  };

  const onPointerLeave = () => {
    if (hoverRef.current) hoverRef.current.dataset.visible = "false";
  };

  return (
    <div className="space-y-2">
      <div className="relative pt-7">
        <div
          ref={hoverRef}
          data-visible="false"
          className="pointer-events-none absolute top-0 left-0 -translate-x-1/2 rounded-md border border-ink-600 bg-ink-900/95 px-2 py-0.5 font-mono text-[11px] tabular-nums text-mist-100 opacity-0 transition-opacity duration-100 data-[visible=true]:opacity-100"
        />

        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Timeline bài giảng. Kéo để tua, phím mũi tên để tua từng bước"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={0}
          aria-valuetext="0 giây"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={onPointerLeave}
          className={`group relative h-12 w-full touch-none select-none ${
            dragging ? "cursor-grabbing" : "cursor-pointer"
          }`}
        >
          {/* Chapter bands.

              No `text-*` utility on these spans on purpose. A Tailwind utility
              lives in the `utilities` cascade layer, which outranks the
              `@layer components` block the three `data-state` colours are
              written in, so one utility class would pin every chapter to the
              same colour and the read/unread distinction would never show. The
              base `.scrub-chapter` rule owns the colour; `data-state` varies it. */}
          <div className="absolute inset-x-0 top-0 h-4">
            {lesson.chapters.map((chapter, index) => {
              const left = clamp((chapter.start / duration) * 100, 0, 100);
              const width = clamp(
                ((chapter.end - chapter.start) / duration) * 100,
                0.8,
                100 - left,
              );
              return (
                <span
                  key={chapter.id}
                  ref={(node) => {
                    chapterRefs.current[index] = node;
                  }}
                  title={chapter.title}
                  data-state="todo"
                  style={{ left: `${left}%`, width: `${width}%` }}
                  className="scrub-chapter absolute top-0 h-4 truncate border-l border-brand-700/70 pl-1.5 text-[10px] font-medium uppercase tracking-wide"
                >
                  {chapter.title}
                </span>
              );
            })}
          </div>

          {/* rail */}
          <div className="absolute inset-x-0 bottom-3 h-2.5 overflow-hidden rounded-full bg-ink-800 ring-1 ring-ink-700">
            <div
              ref={progressRef}
              className="absolute inset-y-0 left-0 w-0 bg-gradient-to-r from-brand-500 to-brand-300"
            />
          </div>

          {/* A→B loop region */}
          {loop.b > loop.a ? (
            <div
              aria-hidden="true"
              style={{
                left: `${clamp((loop.a / duration) * 100, 0, 100)}%`,
                width: `${clamp(((loop.b - loop.a) / duration) * 100, 0.6, 100)}%`,
              }}
              className={`absolute bottom-2.5 h-3.5 rounded-sm border-x-2 ${
                loop.enabled
                  ? "border-gold-300 bg-gold-400/30"
                  : "border-mist-500 bg-mist-500/15"
              }`}
              title={`Vùng lặp ${formatClock(loop.a, false)} → ${formatClock(loop.b, false)}`}
            />
          ) : null}

          {/* scene boundaries */}
          {lesson.scenes.slice(1).map((scene) => (
            <span
              key={scene.id}
              aria-hidden="true"
              style={{ left: `${clamp((scene.start / duration) * 100, 0, 100)}%` }}
              className="absolute bottom-3 h-2.5 w-px bg-ink-950/90"
            />
          ))}

          {/* handle */}
          <div
            ref={handleRef}
            style={{ left: "0%" }}
            className={`absolute bottom-1.5 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-ink-950 bg-brand-300 shadow-lg transition-transform ${
              dragging ? "scale-125" : "group-hover:scale-110"
            }`}
          >
            <span className="sr-only">Vị trí hiện tại</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-mist-500">
        <span>
          {lesson.scenes.length} cảnh · {lesson.chapters.length} chương
        </span>
        <span aria-live="polite">
          {dragging
            ? "đang tua… thả chuột để dừng ở vị trí này"
            : "← / → tua 5s · Shift + ←/→ tua 1s · , / . từng khung hình"}
        </span>
      </div>
    </div>
  );
}
