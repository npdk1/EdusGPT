"use client";

import { useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FastForward,
  Gauge,
  Keyboard,
  Maximize,
  Pause,
  Play,
  Repeat,
  Rewind,
  SkipBack,
  SkipForward,
  Sparkles,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { LoopRange, Timebase } from "@/hooks/useTimebase";
import { formatClock } from "@/lib/format";
import { useCopy } from "@/i18n/provider";
import { InlineText } from "./InlineText";

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
  onToggleAi?: () => void;
  aiOpen?: boolean;
  onNextScene?: () => void;
  currentSceneTitle?: string;
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
    transportNextScene: "Next scene",
    transportNextSceneTitle: "Next scene (N)",
    transportAiTutor: "AI Tutor",
    transportAiTutorTitle: "Toggle AI classroom tutor",
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
    transportNextScene: "Cảnh tiếp theo",
    transportNextSceneTitle: "Cảnh tiếp theo (N)",
    transportAiTutor: "Trợ giảng AI",
    transportAiTutorTitle: "Bật/tắt Trợ giảng AI trực tuyến",
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
  onToggleAi,
  aiOpen,
  onNextScene,
  currentSceneTitle,
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
    <div className="flex flex-wrap items-center justify-between gap-2 lg:flex-nowrap">
      {/* Left controls: Play/Pause, Next Scene, Rewind/Forward, Volume, Time, Scene title */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        <button
          type="button"
          onClick={timebase.toggle}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-blue-600 to-amber-500 text-white shadow-md shadow-brand-500/25 transition-all hover:from-brand-400 hover:to-amber-400 hover:scale-105 active:scale-95 border border-amber-400/30"
          title={timebase.playing ? t.transportPauseTitle : t.transportPlayTitle}
          aria-label={timebase.playing ? t.transportPause : t.transportPlay}
        >
          {timebase.playing ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 translate-x-[1px]" />
          )}
        </button>

        {onNextScene && (
          <button
            type="button"
            onClick={onNextScene}
            className="btn-icon"
            title={t.transportNextSceneTitle}
            aria-label={t.transportNextScene}
          >
            <SkipForward className="h-4 w-4" />
          </button>
        )}

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
          onClick={() => timebase.seekBy(10)}
          className="btn-icon"
          title={t.transportForward10Title}
          aria-label={t.transportForward10}
        >
          <FastForward className="h-4 w-4" />
        </button>

        {/* Volume slider */}
        <div className="flex items-center gap-1 rounded-lg px-1 py-0.5 hover:bg-ink-800/60 transition-colors">
          <button
            type="button"
            onClick={onToggleMute}
            className="btn-icon border-0 bg-transparent h-8 w-8"
            title={t.transportMuteTitle}
            aria-label={t.transportMute}
          >
            {timebase.muted ? (
              <VolumeX className="h-4 w-4 text-mist-400" />
            ) : timebase.volume < 0.5 ? (
              <Volume1 className="h-4 w-4 text-mist-200" />
            ) : (
              <Volume2 className="h-4 w-4 text-mist-200" />
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
            className="player-range w-14 sm:w-20"
          />
        </div>

        {/* Timestamp clock */}
        <span
          ref={clockRef}
          className="font-mono text-xs tabular-nums text-mist-200 ml-1"
        >
          00:00:00.00 / 00:00:00.00
        </span>

        {/* Current scene name */}
        {currentSceneTitle && (
          <span className="hidden xl:inline-block max-w-[200px] truncate text-xs text-mist-400 pl-2 border-l border-ink-700">
            <InlineText text={currentSceneTitle} />
          </span>
        )}
      </div>

      {/* Right controls: A→B Loop, Speed, AI Assistant toggle, Shortcuts, Fullscreen */}
      <div className="flex items-center gap-2">
        {/* A→B Loop */}
        <div className="flex items-center gap-1 rounded-xl border border-ink-700/80 bg-ink-900/70 p-1">
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
            <Repeat className="h-3 w-3" /> A→B
          </button>
          {loop.b > loop.a && (
            <>
              <button
                type="button"
                onClick={() => onSetPoint("a")}
                className="inline-flex h-7 items-center rounded-lg px-1.5 font-mono text-[11px] text-mist-200 hover:bg-ink-800"
                title={t.transportMarkATitle}
              >
                A {formatClock(loop.a, false)}
              </button>
              <button
                type="button"
                onClick={() => onSetPoint("b")}
                className="inline-flex h-7 items-center rounded-lg px-1.5 font-mono text-[11px] text-mist-200 hover:bg-ink-800"
                title={t.transportMarkBTitle}
              >
                B {formatClock(loop.b, false)}
              </button>
              <button
                type="button"
                onClick={onClearLoop}
                className="inline-flex h-7 items-center rounded-lg px-1.5 text-[11px] text-mist-400 hover:bg-ink-800 hover:text-ember-400"
                title={t.transportClearLoopTitle}
              >
                {t.transportClearLoop}
              </button>
            </>
          )}
        </div>

        {/* Speed */}
        <div className="flex items-center gap-1" title={`${t.transportSpeedTitle} (${timebase.rate.toFixed(1)}×)`}>
          <button
            type="button"
            onClick={() => {
              const curIdx = RATES.indexOf(timebase.rate);
              const nextRate = RATES[(curIdx + 1) % RATES.length];
              timebase.setRate(nextRate);
            }}
            className="flex items-center gap-1 rounded-lg border border-ink-700/80 bg-ink-900/70 px-2.5 py-1.5 font-mono text-xs font-semibold text-mist-200 transition-colors hover:bg-ink-800 hover:text-mist-50"
            title={t.transportSpeedTitle}
          >
            <Gauge className="h-3.5 w-3.5 text-mist-400" />
            <span>{timebase.rate === 1 ? "1×" : `${timebase.rate}×`}</span>
          </button>
        </div>

        {/* ✨ Trợ giảng AI button */}
        {onToggleAi && (
          <button
            type="button"
            onClick={onToggleAi}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
              aiOpen
                ? "border-gold-400/80 bg-gold-400/20 text-gold-200 shadow-sm"
                : "border-ink-700 bg-ink-900/80 text-mist-200 hover:border-gold-500/50 hover:text-gold-300"
            }`}
            title={t.transportAiTutorTitle}
            aria-pressed={aiOpen}
          >
            <Sparkles className="h-3.5 w-3.5 text-gold-400" />
            <span className="hidden sm:inline">{t.transportAiTutor}</span>
            {aiOpen ? (
              <span className="h-1.5 w-1.5 rounded-full bg-gold-400 animate-pulse" />
            ) : null}
          </button>
        )}

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
          className="btn-icon text-mist-100 hover:text-brand-300"
          title={t.transportFullscreenTitle}
          aria-label={t.transportFullscreen}
        >
          <Maximize className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
