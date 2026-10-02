"use client";

import { useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FastForward,
  Keyboard,
  Maximize,
  Pause,
  Play,
  Repeat,
  Rewind,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { LoopRange, Timebase } from "@/hooks/useTimebase";
import { formatClock } from "@/lib/format";

interface TransportBarProps {
  timebase: Timebase;
  loop: LoopRange;
  muted: boolean;
  onToggleLoop: () => void;
  onSetPoint: (point: "a" | "b") => void;
  onClearLoop: () => void;
  onToggleMute: () => void;
  onFullscreen: () => void;
  onToggleHelp: () => void;
}

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** Play/pause, rewind, fast-forward, frame stepping, speed and the A→B loop. */
export function TransportBar({
  timebase,
  loop,
  muted,
  onToggleLoop,
  onSetPoint,
  onClearLoop,
  onToggleMute,
  onFullscreen,
  onToggleHelp,
}: TransportBarProps) {
  const clockRef = useRef<HTMLSpanElement>(null);

  const subscribeClock = timebase.subscribe;
  useEffect(() => {
    return subscribeClock((time, meta) => {
      if (clockRef.current) {
        clockRef.current.textContent = `${formatClock(time, true, 30)} / ${formatClock(
          meta.duration,
          true,
          30,
        )}`;
      }
    });
  }, [subscribeClock]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => timebase.seek(0)}
        className="btn-icon"
        title="Về đầu (Home)"
        aria-label="Về đầu"
      >
        <SkipBack className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => timebase.seekBy(-10)}
        className="btn-icon"
        title="Tua lui 10 giây (J)"
        aria-label="Tua lui 10 giây"
      >
        <Rewind className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => timebase.stepFrames(-1)}
        className="btn-icon"
        title="Lùi 1 khung hình (,)"
        aria-label="Lùi một khung hình"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={timebase.toggle}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-400 text-ink-950 transition-colors hover:bg-brand-300"
        title={timebase.playing ? "Tạm dừng (Space)" : "Phát (Space)"}
        aria-label={timebase.playing ? "Tạm dừng" : "Phát"}
      >
        {timebase.playing ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5 translate-x-[1px]" />
        )}
      </button>

      <button
        type="button"
        onClick={() => timebase.stepFrames(1)}
        className="btn-icon"
        title="Tiến 1 khung hình (.)"
        aria-label="Tiến một khung hình"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => timebase.seekBy(10)}
        className="btn-icon"
        title="Tua tới 10 giây (L)"
        aria-label="Tua tới 10 giây"
      >
        <FastForward className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => timebase.seek(timebase.duration)}
        className="btn-icon"
        title="Tới cuối (End)"
        aria-label="Tới cuối"
      >
        <SkipForward className="h-4 w-4" />
      </button>

      <span
        ref={clockRef}
        className="ml-1 rounded-lg border border-ink-700 bg-ink-900/80 px-2.5 py-1.5 font-mono text-xs tabular-nums text-brand-200"
      >
        00:00:00.00 / 00:00:00.00
      </span>

      <div className="mx-1 h-8 w-px bg-ink-700" aria-hidden="true" />

      {/* A→B loop — the "tua đi tua lại" region */}
      <div className="flex items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-900/70 p-1">
        <button
          type="button"
          onClick={onToggleLoop}
          className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors ${
            loop.enabled
              ? "bg-gold-400 text-ink-950"
              : "text-mist-300 hover:bg-ink-800 hover:text-mist-100"
          }`}
          title="Bật/tắt lặp trong khoảng A→B (\)"
          aria-pressed={loop.enabled}
        >
          <Repeat className="h-3.5 w-3.5" /> A→B
        </button>
        <button
          type="button"
          onClick={() => onSetPoint("a")}
          className="inline-flex h-7 items-center rounded-lg px-2 font-mono text-xs text-mist-200 hover:bg-ink-800"
          title="Đặt mốc A tại vị trí hiện tại ([)"
        >
          A {formatClock(loop.a, false)}
        </button>
        <button
          type="button"
          onClick={() => onSetPoint("b")}
          className="inline-flex h-7 items-center rounded-lg px-2 font-mono text-xs text-mist-200 hover:bg-ink-800"
          title="Đặt mốc B tại vị trí hiện tại (])"
        >
          B {formatClock(loop.b, false)}
        </button>
        <button
          type="button"
          onClick={onClearLoop}
          className="inline-flex h-7 items-center rounded-lg px-2 text-xs text-mist-400 hover:bg-ink-800 hover:text-ember-400"
          title="Xoá khoảng lặp"
        >
          xoá
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-mist-400">
        <span className="sr-only">Tốc độ phát</span>
        <select
          value={timebase.rate}
          onChange={(event) => timebase.setRate(Number(event.target.value))}
          className="rounded-lg border border-ink-700 bg-ink-900/80 px-2 py-1.5 font-mono text-xs text-mist-100"
          title="Tốc độ phát (− / + để đổi nhanh)"
        >
          {RATES.map((rate) => (
            <option key={rate} value={rate}>
              {rate === 1 ? "1×" : `${rate}×`}
            </option>
          ))}
        </select>
      </label>

      <div className="ml-auto flex items-center gap-2">
        {/* A mute toggle on its own was the only loudness control, which is not a
            control: it says nothing about how loud the deck is and gives a
            presenter no way to turn the narration up. The slider sits beside it
            and both write to the same timebase value, so the deck and the
            synthesised voice follow together. */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleMute}
            className="btn-icon"
            title="Tắt/bật tiếng (M)"
            aria-label="Tắt hoặc bật tiếng"
          >
            {timebase.muted ? (
              <VolumeX className="h-4 w-4" />
            ) : timebase.volume < 0.5 ? (
              <Volume1 className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={timebase.volume}
            onChange={(event) => timebase.setVolume(Number(event.target.value))}
            aria-label="Âm lượng"
            title={`Âm lượng ${Math.round(timebase.volume * 100)}%`}
            className="player-range w-20"
          />
        </div>
        <button
          type="button"
          onClick={onToggleHelp}
          className="btn-icon"
          title="Danh sách phím tắt (?)"
          aria-label="Danh sách phím tắt"
        >
          <Keyboard className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onFullscreen}
          className="btn-icon"
          title="Toàn màn hình (F)"
          aria-label="Toàn màn hình"
        >
          <Maximize className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
