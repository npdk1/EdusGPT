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
import { useCopy } from "@/i18n/provider";

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

const COPY = {
  en: {
    transportToStart: "Go to start",
    transportToStartTitle: "Go to start (Home)",
    transportBack10: "Back 10 seconds",
    transportBack10Title: "Back 10 seconds (J)",
    transportStepBack: "Back one frame",
    transportStepBackTitle: "Back 1 frame (,)",
    transportPlay: "Play",
    transportPlayTitle: "Play (Space)",
    transportPause: "Pause",
    transportPauseTitle: "Pause (Space)",
    transportStepForward: "Forward one frame",
    transportStepForwardTitle: "Forward 1 frame (.)",
    transportForward10: "Forward 10 seconds",
    transportForward10Title: "Forward 10 seconds (L)",
    transportToEnd: "Go to end",
    transportToEndTitle: "Go to end (End)",
    transportLoopTitle: "Turn the A→B loop on/off (\\)",
    transportMarkATitle: "Set marker A at the current position ([)",
    transportMarkBTitle: "Set marker B at the current position (])",
    transportClearLoop: "Clear",
    transportClearLoopTitle: "Clear the loop",
    transportSpeed: "Playback speed",
    transportSpeedTitle: "Playback speed (− / + to change it fast)",
    transportMute: "Mute or unmute",
    transportMuteTitle: "Mute/unmute (M)",
    transportVolume: "Volume",
    transportShortcuts: "Keyboard shortcuts",
    transportShortcutsTitle: "Keyboard shortcuts (?)",
    transportFullscreen: "Fullscreen",
    transportFullscreenTitle: "Fullscreen (F)",
  },
  vi: {
    transportToStart: "Về đầu",
    transportToStartTitle: "Về đầu (Home)",
    transportBack10: "Tua lui 10 giây",
    transportBack10Title: "Tua lui 10 giây (J)",
    transportStepBack: "Lùi một khung hình",
    transportStepBackTitle: "Lùi 1 khung hình (,)",
    transportPlay: "Phát",
    transportPlayTitle: "Phát (Space)",
    transportPause: "Tạm dừng",
    transportPauseTitle: "Tạm dừng (Space)",
    transportStepForward: "Tiến một khung hình",
    transportStepForwardTitle: "Tiến 1 khung hình (.)",
    transportForward10: "Tua tới 10 giây",
    transportForward10Title: "Tua tới 10 giây (L)",
    transportToEnd: "Tới cuối",
    transportToEndTitle: "Tới cuối (End)",
    transportLoopTitle: "Bật/tắt lặp trong khoảng A→B (\\)",
    transportMarkATitle: "Đặt mốc A tại vị trí hiện tại ([)",
    transportMarkBTitle: "Đặt mốc B tại vị trí hiện tại (])",
    transportClearLoop: "xoá",
    transportClearLoopTitle: "Xoá khoảng lặp",
    transportSpeed: "Tốc độ phát",
    transportSpeedTitle: "Tốc độ phát (− / + để đổi nhanh)",
    transportMute: "Tắt hoặc bật tiếng",
    transportMuteTitle: "Tắt/bật tiếng (M)",
    transportVolume: "Âm lượng",
    transportShortcuts: "Danh sách phím tắt",
    transportShortcutsTitle: "Danh sách phím tắt (?)",
    transportFullscreen: "Toàn màn hình",
    transportFullscreenTitle: "Toàn màn hình (F)",
  },
};

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
  const t = useCopy(COPY);
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
    // One row on a desktop for the same reason as the toolbar above: a wrapped
    // transport bar cost the slide half its height. Sideways scroll, not taller.
    <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:overflow-x-auto lg:[&>*]:shrink-0">
      <button
        type="button"
        onClick={() => timebase.seek(0)}
        className="btn-icon"
        title={t.transportToStartTitle}
        aria-label={t.transportToStart}
      >
        <SkipBack className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => timebase.seekBy(-10)}
        className="btn-icon"
        title={t.transportBack10Title}
        aria-label={t.transportBack10}
      >
        <Rewind className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => timebase.stepFrames(-1)}
        className="btn-icon"
        title={t.transportStepBackTitle}
        aria-label={t.transportStepBack}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={timebase.toggle}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-400 text-ink-950 transition-colors hover:bg-brand-300"
        title={timebase.playing ? t.transportPauseTitle : t.transportPlayTitle}
        aria-label={timebase.playing ? t.transportPause : t.transportPlay}
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
        title={t.transportStepForwardTitle}
        aria-label={t.transportStepForward}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => timebase.seekBy(10)}
        className="btn-icon"
        title={t.transportForward10Title}
        aria-label={t.transportForward10}
      >
        <FastForward className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => timebase.seek(timebase.duration)}
        className="btn-icon"
        title={t.transportToEndTitle}
        aria-label={t.transportToEnd}
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
          title={t.transportLoopTitle}
          aria-pressed={loop.enabled}
        >
          <Repeat className="h-3.5 w-3.5" /> A→B
        </button>
        <button
          type="button"
          onClick={() => onSetPoint("a")}
          className="inline-flex h-7 items-center rounded-lg px-2 font-mono text-xs text-mist-200 hover:bg-ink-800"
          title={t.transportMarkATitle}
        >
          A {formatClock(loop.a, false)}
        </button>
        <button
          type="button"
          onClick={() => onSetPoint("b")}
          className="inline-flex h-7 items-center rounded-lg px-2 font-mono text-xs text-mist-200 hover:bg-ink-800"
          title={t.transportMarkBTitle}
        >
          B {formatClock(loop.b, false)}
        </button>
        <button
          type="button"
          onClick={onClearLoop}
          className="inline-flex h-7 items-center rounded-lg px-2 text-xs text-mist-400 hover:bg-ink-800 hover:text-ember-400"
          title={t.transportClearLoopTitle}
        >
          {t.transportClearLoop}
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-mist-400">
        <span className="sr-only">{t.transportSpeed}</span>
        <select
          value={timebase.rate}
          onChange={(event) => timebase.setRate(Number(event.target.value))}
          className="rounded-lg border border-ink-700 bg-ink-900/80 px-2 py-1.5 font-mono text-xs text-mist-100"
          title={t.transportSpeedTitle}
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
            title={t.transportMuteTitle}
            aria-label={t.transportMute}
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
            aria-label={t.transportVolume}
            title={`${t.transportVolume} ${Math.round(timebase.volume * 100)}%`}
            className="player-range w-20"
          />
        </div>
        <button
          type="button"
          onClick={onToggleHelp}
          className="btn-icon"
          title={t.transportShortcutsTitle}
          aria-label={t.transportShortcuts}
        >
          <Keyboard className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onFullscreen}
          className="btn-icon"
          title={t.transportFullscreenTitle}
          aria-label={t.transportFullscreen}
        >
          <Maximize className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
