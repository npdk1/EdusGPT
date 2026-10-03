"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FastForward,
  Minimize,
  Pause,
  Play,
  Rewind,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { Timebase } from "@/hooks/useTimebase";
import type { LessonScene } from "@/lib/lesson/types";
import { formatClock, clamp } from "@/lib/format";
import { useCopy } from "@/i18n/provider";

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

const COPY = {
  en: {
    fullscreenBack5: "Back 5 seconds",
    fullscreenBack5Title: "Back 5 seconds (←)",
    fullscreenPlay: "Play",
    fullscreenPlayTitle: "Play (Space)",
    fullscreenPause: "Pause",
    fullscreenPauseTitle: "Pause (Space)",
    fullscreenForward5: "Forward 5 seconds",
    fullscreenForward5Title: "Forward 5 seconds (→)",
    fullscreenVolume: "Volume",
    fullscreenSpeedTitle: "Playback speed",
    fullscreenSpeedNow: "Playback speed, currently",
    fullscreenExit: "Exit fullscreen",
    fullscreenExitTitle: "Exit fullscreen (F or Esc)",
    fullscreenProgress: "Lesson progress bar",
  },
  vi: {
    fullscreenBack5: "Tua lui 5 giây",
    fullscreenBack5Title: "Tua lui 5 giây (←)",
    fullscreenPlay: "Phát",
    fullscreenPlayTitle: "Phát (Space)",
    fullscreenPause: "Tạm dừng",
    fullscreenPauseTitle: "Tạm dừng (Space)",
    fullscreenForward5: "Tua tới 5 giây",
    fullscreenForward5Title: "Tua tới 5 giây (→)",
    fullscreenVolume: "Âm lượng",
    fullscreenSpeedTitle: "Tốc độ phát",
    fullscreenSpeedNow: "Tốc độ phát, hiện tại",
    fullscreenExit: "Thoát toàn màn hình",
    fullscreenExitTitle: "Thoát toàn màn hình (F hoặc Esc)",
    fullscreenProgress: "Thanh tiến trình bài giảng",
  },
};

/**
 * The controls that appear over a fullscreen slide, in the style of a media
 * player.
 *
 * The transport bar below the stage is unreachable once the stage is fullscreen
 * — the browser owns the whole screen — so a presenter who presses F can no
 * longer pause, rewind or change speed. The keyboard still works, which is not a
 * fair answer to "there is no play button".
 *
 * Everything here drives the same timebase as the bar below, so the overlay and
 * the bar are two views of one state rather than two players.
 *
 * Laid out the way a player lays one out, because that is the layout a viewer
 * reaches for without reading: the scrubber spans the full width directly above
 * the buttons, the clock sits at the end of that same row, and volume and speed
 * are popovers rather than permanent widgets. A row of evenly spaced buttons in
 * a black strip is a toolbar, and a toolbar spends the width that a player
 * spends on the one control people actually reach for.
 */
export function FullscreenControls({
  timebase,
  activeScene,
  onExit,
}: {
  timebase: Timebase;
  activeScene: LessonScene;
  onExit: () => void;
}) {
  const t = useCopy(COPY);
  const [visible, setVisible] = useState(true);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  /** Restarts the idle countdown that hides the overlay. */
  const wake = useCallback(() => {
    setVisible(true);
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      setSpeedOpen(false);
      setVolumeOpen(false);
    }, 2600);
  }, []);

  useEffect(() => {
    wake();
    return () => {
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    };
  }, [wake]);

  // A paused deck is a deck being read, and it gets read for a long time — so
  // the overlay stays up while paused instead of fading out over it.
  useEffect(() => {
    if (!timebase.playing) setVisible(true);
  }, [timebase.playing]);

  // Opening one popover closes the other, so the two cannot stack on a phone.
  const openSpeed = useCallback(() => {
    setVolumeOpen(false);
    setSpeedOpen((open) => !open);
    wake();
  }, [wake]);
  const openVolume = useCallback(() => {
    setSpeedOpen(false);
    setVolumeOpen((open) => !open);
    wake();
  }, [wake]);

  const VolumeIcon = timebase.muted ? VolumeX : timebase.volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-30"
      onMouseMove={wake}
      onPointerDown={wake}
    >
      {/* One dark sheet for the whole player. The old layout put a mostly
          transparent `to top` gradient behind a row of buttons, so whatever the
          slide happened to be showing bled through and washed the controls out
          to unreadable — which is the "trắng trắng" on a pale slide. */}
      <div
        className={`pointer-events-auto bg-gradient-to-t from-black/92 via-black/72 to-black/25 pb-2.5 pt-8 transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <ScrubLine timebase={timebase} />
        {/* The same inset as the scrub row above. Without it the buttons sit flush
            against the screen edge while the bar above is inset, which reads as a
            mis-clipped toolbar rather than a player. */}
        <div className="flex items-center gap-2 px-3 pb-0.5 sm:px-5">
        <span className="hidden min-w-0 flex-1 truncate text-xs text-white/70 sm:block">
          <span className="font-mono text-white/50">
            {Math.round(activeScene.start)}s · {activeScene.title}
          </span>
        </span>
        <span className="flex-1 sm:hidden" />

        <OverlayButton
          onClick={() => timebase.seekBy(-5)}
          title={t.fullscreenBack5Title}
          label={t.fullscreenBack5}
        >
          <Rewind className="h-4 w-4" />
        </OverlayButton>

        <button
          type="button"
          onClick={timebase.toggle}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-black transition-transform hover:scale-105"
          title={timebase.playing ? t.fullscreenPauseTitle : t.fullscreenPlayTitle}
          aria-label={timebase.playing ? t.fullscreenPause : t.fullscreenPlay}
        >
          {timebase.playing ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 translate-x-[1px]" />
          )}
        </button>

        <OverlayButton
          onClick={() => timebase.seekBy(5)}
          title={t.fullscreenForward5Title}
          label={t.fullscreenForward5}
        >
          <FastForward className="h-4 w-4" />
        </OverlayButton>

        {/* Volume is a slider behind a button, not a mute toggle. On a deck whose
            voice is synthesised per slide, the voice is the sound — and a toggle
            gives a viewer no way to turn it up. */}
        <div className="relative flex shrink-0 items-center">
          <OverlayButton onClick={openVolume} title={t.fullscreenVolume} label={t.fullscreenVolume}>
            <VolumeIcon className="h-[18px] w-[18px]" />
          </OverlayButton>
          {volumeOpen ? (
            <div className="absolute bottom-11 right-0 z-40 flex h-11 w-44 items-center gap-2.5 rounded-xl border border-white/15 bg-black/92 px-3 shadow-2xl backdrop-blur">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={timebase.volume}
                onChange={(event) => timebase.setVolume(Number(event.target.value))}
                onPointerDown={wake}
                aria-label={t.fullscreenVolume}
                className="player-range w-full"
              />
              <span className="w-8 shrink-0 text-right font-mono text-[11px] tabular-nums text-white/70">
                {Math.round(timebase.volume * 100)}
              </span>
            </div>
          ) : null}
        </div>

        <div className="relative flex items-center">
          <button
            type="button"
            onClick={openSpeed}
            className="flex h-9 min-w-[3.25rem] items-center justify-center rounded-lg px-2 font-mono text-xs font-semibold text-white/90 transition-colors hover:bg-white/15"
            title={t.fullscreenSpeedTitle}
            aria-expanded={speedOpen}
            aria-label={`${t.fullscreenSpeedNow} ${timebase.rate}×`}
          >
            {timebase.rate}×
          </button>
          {speedOpen ? (
            <div className="absolute bottom-11 left-1/2 z-40 -translate-x-1/2 overflow-hidden rounded-xl border border-white/15 bg-black/90 py-1 shadow-2xl backdrop-blur">
              {RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => {
                    timebase.setRate(rate);
                    setSpeedOpen(false);
                    wake();
                  }}
                  className={`block w-full px-5 py-1.5 text-left font-mono text-xs transition-colors hover:bg-white/15 ${
                    rate === timebase.rate ? "text-brand-300" : "text-white/80"
                  }`}
                >
                  {rate}×
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <OverlayButton
          onClick={onExit}
          title={t.fullscreenExitTitle}
          label={t.fullscreenExit}
        >
          <Minimize className="h-4 w-4" />
        </OverlayButton>
        </div>
      </div>
    </div>
  );
}

function OverlayButton({
  onClick,
  title,
  label,
  children,
}: {
  onClick: () => void;
  title: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/15"
      title={title}
      aria-label={label}
    >
      {children}
    </button>
  );
}

/**
 * The fullscreen progress bar.
 *
 * Written with refs and a timebase subscription rather than state, for the same
 * reason the subtitle is: this updates every frame, and a state update would
 * re-render the overlay — and the buttons under the cursor — sixty times a
 * second.
 */
function ScrubLine({ timebase }: { timebase: Timebase }) {
  const t = useCopy(COPY);
  const fillRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const draggingRef = useRef(false);

  const fsSubscribe = timebase.subscribe;
  useEffect(() => {
    return fsSubscribe((time, meta) => {
      const ratio = meta.duration > 0 ? clamp(time / meta.duration, 0, 1) : 0;
      // Written as `scale`, not `transform`.
      //
      // Tailwind v4 compiles `scale-x-0` to the standalone `scale: 0 1` property
      // rather than `transform: scaleX(0)`, and the two are applied in sequence —
      // the class kept pinning the fill to zero width no matter what
      // `style.transform` said, so the bar showed no progress at all. Driving the
      // same property the class sets keeps one source of truth.
      if (fillRef.current) fillRef.current.style.scale = `${ratio} 1`;
      if (clockRef.current) {
        clockRef.current.textContent = `${formatClock(time, true, 30)} / ${formatClock(
          meta.duration,
          true,
          30,
        )}`;
      }
    });
  }, [fsSubscribe]);

  // Dragging must not be fought by the playhead, so the fill follows the cursor
  // and the seek happens on release.
  const seekFrom = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.width === 0) return;
    timebase.seek(((clientX - rect.left) / rect.width) * timebase.duration);
  };

  return (
    <div className="pointer-events-auto flex h-3 items-center gap-3 px-3 pb-1 sm:px-5">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={t.fullscreenProgress}
        aria-valuemin={0}
        aria-valuemax={Math.round(timebase.duration)}
        className="relative h-1 w-full cursor-pointer rounded-full bg-white/25 transition-all hover:h-1.5"
        onPointerDown={(event) => {
          draggingRef.current = true;
          // Not every pointer id can be captured — a synthetic event, or a
          // touch that ended between down and capture. Losing the capture is
          // survivable; losing the seek with it is not, so the flag is what
          // actually drives the drag and capture is only an optimisation.
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            /* fall back to plain move events */
          }
          seekFrom(event.clientX);
        }}
        onPointerMove={(event) => {
          if (draggingRef.current) seekFrom(event.clientX);
        }}
        onPointerUp={() => {
          draggingRef.current = false;
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
      >
        <div
          ref={fillRef}
          className="absolute inset-0 origin-left rounded-full bg-brand-400"
          style={{ scale: "0 1" }}
        />
      </div>
      <span
        ref={clockRef}
        className="hidden shrink-0 font-mono text-[11px] text-white/70 sm:inline"
      />
    </div>
  );
}