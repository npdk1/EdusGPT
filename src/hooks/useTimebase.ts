"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clampTime } from "@/lib/lesson/types";

export interface LoopRange {
  enabled: boolean;
  a: number;
  b: number;
}

export interface TimeMeta {
  playing: boolean;
  duration: number;
  rate: number;
}

export type TimeListener = (time: number, meta: TimeMeta) => void;

export interface TimebaseOptions {
  /** The GSAP master timeline length — the deck's own duration. */
  duration: number;
  fps?: number;
  loop?: LoopRange;
}

/**
 * One playhead for the whole player: a single number that "tua tới" (fast-forward)
 * and "tua lui" (rewind) both go through, exposed to the timeline as frame-level
 * callbacks that consumers use with `gsap.set()` on DOM nodes.
 *
 * The deck's own timeline is the only clock. There is no video element to
 * reconcile against, so there is nothing that can drift out of step with the
 * slides and no second source of truth to keep honest.
 *
 * The hot path never re-renders React: `subscribe` hands out callbacks that
 * consumers use to write straight to the DOM.
 */
export function useTimebase({
  duration,
  fps = 30,
  loop,
}: TimebaseOptions) {
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);
  /**
   * Loudness, 0 to 1.
   *
   * Lives here rather than in the player because there are two things to be
   * loud or quiet — the deck and the synthesised narration — and a volume
   * control that silences only one of them is worse than none. The narrator
   * reads this through the same timebase the transport bar does.
   */
  const [volume, setVolumeState] = useState(1);

  const timeRef = useRef(0);
  const listenersRef = useRef(new Set<TimeListener>());
  const durationRef = useRef(duration);
  const playingRef = useRef(playing);
  const rateRef = useRef(rate);
  const loopRef = useRef<LoopRange | undefined>(loop);
  const fpsRef = useRef(fps);
  /**
   * A point the playhead may not cross, or `null` for no hold.
   *
   * Written by whoever owns the gate, read here: the tick is the only thing in
   * the player that carries the playhead forward, so a consumer that needs the
   * deck to stop somewhere cannot do it any other way. `null` is the ordinary
   * case, and the check costs one comparison on a ref the hot path already
   * reads.
   */
  const holdRef = useRef<number | null>(null);

  durationRef.current = duration;
  playingRef.current = playing;
  rateRef.current = rate;
  loopRef.current = loop;
  fpsRef.current = fps;

  const notify = useCallback(() => {
    const meta: TimeMeta = {
      playing: playingRef.current,
      duration: durationRef.current,
      rate: rateRef.current,
    };
    for (const listener of listenersRef.current) listener(timeRef.current, meta);
  }, []);

  const subscribe = useCallback((listener: TimeListener) => {
    listenersRef.current.add(listener);
    listener(timeRef.current, {
      playing: playingRef.current,
      duration: durationRef.current,
      rate: rateRef.current,
    });
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const seek = useCallback(
    (time: number) => {
      const next = clampTime(time, durationRef.current || Number.MAX_SAFE_INTEGER);
      timeRef.current = next;
      notify();
    },
    [notify],
  );

  const seekBy = useCallback((delta: number) => seek(timeRef.current + delta), [seek]);

  const stepFrames = useCallback(
    (frames: number) => {
      setPlaying(false);
      const step = 1 / (fpsRef.current || 30);
      const target = Math.round((timeRef.current + frames * step) / step) * step;
      seek(Number(target.toFixed(4)));
    },
    [seek],
  );

  const play = useCallback(() => {
    if (durationRef.current <= 0) return;
    if (timeRef.current >= durationRef.current - 0.05) timeRef.current = 0;
    setPlaying(true);
  }, []);

  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => setPlaying((value) => !value), []);
  const setRate = useCallback((next: number) => {
    setRateState(Math.min(Math.max(next, 0.25), 3));
  }, []);

  const setVolume = useCallback((next: number) => {
    setVolumeState(Math.min(Math.max(next, 0), 1));
  }, []);

  /**
   * Mute remembers where the slider was.
   *
   * Toggling straight between 0 and 1 would throw away the level the presenter
   * chose, which is the one thing a volume slider is for. So mute parks the
   * slider where it was and unmute puts it back, exactly as a player does.
   */
  const mutedBeforeRef = useRef(1);
  const toggleMute = useCallback(() => {
    setVolumeState((current) => {
      if (current > 0) {
        mutedBeforeRef.current = current;
        return 0;
      }
      return mutedBeforeRef.current;
    });
  }, []);

  const muted = volume === 0;

  // --- the playhead: rAF loop while playing --------------------------------
  useEffect(() => {
    if (!playing) {
      notify();
      return;
    }

    let frame = 0;
    let previous = timeRef.current;
    let last = performance.now();

    const tick = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.25);
      last = now;

      let time = timeRef.current + delta * rateRef.current;

      // A gate: stop at the hold rather than crossing it. Playback ends here
      // instead of freezing mid-frame, so the transport reads paused and the
      // narrator stops with it rather than talking over a deck that is not
      // moving.
      const hold = holdRef.current;
      if (hold !== null && time >= hold) {
        timeRef.current = hold;
        setPlaying(false);
        notify();
        return;
      }

      // A→B repeat: only fires when playback crosses B going forward, so dragging
      // the playhead anywhere else is never fought by the loop.
      const bounds = loopRef.current;
      const looping = Boolean(bounds?.enabled && bounds.b > bounds.a);
      if (durationRef.current > 0 && time >= durationRef.current) {
        if (looping) {
          time = bounds!.a;
        } else {
          timeRef.current = durationRef.current;
          setPlaying(false);
          notify();
          return;
        }
      } else if (looping) {
        const crossed = previous < bounds!.b && time >= bounds!.b;
        if (crossed || time > bounds!.b + 0.35) time = bounds!.a;
      }

      previous = time;
      timeRef.current = time;
      notify();
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, notify]);

  return {
    timeRef,
    duration,
    playing,
    /** Set a number to stop the deck there; `null` to let it run. */
    holdRef,
    rate,
    volume,
    muted,
    play,
    pause,
    toggle,
    seek,
    seekBy,
    stepFrames,
    setRate,
    setVolume,
    toggleMute,
    subscribe,
    notify,
  };
}

/** The single playhead every part of the player reads from and seeks through. */
export type Timebase = ReturnType<typeof useTimebase>;

