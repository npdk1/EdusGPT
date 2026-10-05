"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Volume2, VolumeX, LoaderCircle } from "lucide-react";
import type { Timebase } from "@/hooks/useTimebase";
import type { Lesson } from "@/lib/lesson/types";
import { approximateWords, decodeWordMarks, type WordMark } from "@/lib/karaoke";
import { useCopy } from "@/i18n/provider";

const COPY = {
  en: {
    voiceBlocked: "The browser blocked playback. Press again to listen.",
    voiceServerFallback: "The server could not read this. Using the browser voice.",
    voiceTurnOff: "Turn off the AI teacher voice",
    voiceTurnOn: "Turn on the AI teacher voice (TTS)",
    voiceChipLabel: "Vietnamese voice:",
    voicePreparing: "preparing",
    voiceTeaching: "Teaching",
    voiceOn: "On",
    voiceOff: "Off",
    voiceSelectLabel: "Choose the Vietnamese voice",
    voiceSelectTitle: "Vietnamese narration voice",
  },
  vi: {
    voiceBlocked: "Trình duyệt chặn phát. Bấm lại để nghe.",
    voiceServerFallback: "Máy chủ không đọc được. Dùng giọng trình duyệt.",
    voiceTurnOff: "Tắt giọng đọc giáo viên AI",
    voiceTurnOn: "Bật giọng đọc giáo viên AI (TTS)",
    voiceChipLabel: "Giọng Việt:",
    voicePreparing: "đang chuẩn bị",
    voiceTeaching: "Đang giảng bài",
    voiceOn: "Bật",
    voiceOff: "Tắt",
    voiceSelectLabel: "Chọn giọng đọc tiếng Việt",
    voiceSelectTitle: "Giọng đọc tiếng Việt",
  },
};

interface TeacherVoiceProps {
  lesson: Lesson;
  timebase: Timebase;
  activeSceneIndex: number;
  /**
   * Reports which slide is being spoken and whether its audio is still being
   * fetched. A presenter needs to know the voice is one slide behind, not
   * silent — otherwise a gap in the audio looks like a broken app.
   */
  onVoiceState?: (state: VoiceState) => void;
  /**
   * True while the A→B loop is on.
   *
   * The silence skip below must stand down then: the loop owns the playhead
   * inside its region, and jumping to a scene boundary would cut the loop's
   * tail off on every pass.
   */
  loopEnabled?: boolean;
  /**
   * What the voice is doing right now, for the running subtitle: the playback
   * position within the slide it is reading, plus the word timings for a scene.
   *
   * The voice is a separate <audio> element, so the slide's own playhead knows
   * nothing about how far the reading has got. Without this the highlight would
   * have to be guessed from the slide clock, and it drifts the moment the two
   * fall out of step.
   */
  onNarration?: (update: NarrationUpdate) => void;
}

/** One publication on the narration channel. */
export type NarrationUpdate =
  /** The voice is now reading this scene, and is this far into it. */
  | { type: "position"; sceneIndex: number; time: number }
  /** Timings arrived for a scene, fetched or served from cache. */
  | { type: "words"; sceneIndex: number; words: WordMark[] }
  /** Nothing is being read. */
  | { type: "stop" };

/** One slide's narration, as the running subtitle needs to see it. */
export interface NarrationProgress {
  /** Index into `lesson.scenes`. */
  sceneIndex: number;
  /** Seconds into this slide's narration. */
  time: number;
  words: WordMark[];
}

export interface VoiceState {
  status: "idle" | "preparing" | "speaking";
  /** Index into `lesson.scenes`, or null when nothing is being read. */
  sceneIndex: number | null;
  sceneTitle: string;
  voice: string;
}

interface VoiceOption {
  id: string;
  label: string;
}

const FALLBACK_VOICES: VoiceOption[] = [
  { id: "vi-VN-HoaiMyNeural", label: "Hoài My (nữ)" },
  { id: "vi-VN-HoaiMyNeural#cham", label: "Hoài My chậm (nữ)" },
  { id: "vi-VN-HoaiMyNeural#cao", label: "Hoài My cao (nữ)" },
  { id: "vi-VN-NamMinhNeural", label: "Nam Minh (nam)" },
  { id: "vi-VN-NamMinhNeural#tram", label: "Nam Minh trầm (nam)" },
  { id: "vi-VN-NamMinhNeural#cham", label: "Nam Minh chậm (nam)" },
];

/** One slide's synthesised narration, kept so it is never fetched twice. */
interface CachedNarration {
  url: string;
  /** Per-word timings, empty when the server sent no boundaries. */
  words: WordMark[];
}

/**
 * Browser speech is the safety net when the server cannot reach the voice service.
 *
 * The browser reports boundary events but no timings and no total duration, so
 * there is nothing to scale a highlight against. Rather than leave the subtitle
 * dead on this path, the caller is told the scene's length and lays an even
 * sweep over it — approximate, and marked as such at the call site, but a rough
 * guide beats a frozen line.
 */
function speakWithBrowser(
  text: string,
  onDone: () => void,
  onError: () => void,
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onError();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "vi-VN";
  utterance.rate = 1.05;
  const vi = window.speechSynthesis
    .getVoices()
    .find((v) => v.lang.toLowerCase().startsWith("vi"));
  if (vi) utterance.voice = vi;
  utterance.onend = onDone;
  utterance.onerror = onError;
  window.speechSynthesis.speak(utterance);
}

export function TeacherVoice({
  lesson,
  timebase,
  activeSceneIndex,
  onVoiceState,
  loopEnabled = false,
  onNarration,
}: TeacherVoiceProps) {
  const t = useCopy(COPY);
  const [enabled, setEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>(FALLBACK_VOICES);
  // Starts on the voice the studio picked, so a deck opens speaking in the voice
  // its author chose by ear rather than in whatever the component defaults to.
  // The voice list arrives a moment later and replaces the fallback labels; if
  // the stored id is not among them, the server's own default takes over.
  const [voice, setVoice] = useState(lesson.voice ?? FALLBACK_VOICES[0].id);

  const lastSpokenSceneRef = useRef<number | null>(null);
  /**
   * The playhead position seen on the previous frame, and the largest forward
   * step one frame is allowed to account for.
   *
   * The scene index alone cannot tell a forward boundary crossing from a scrub:
   * seeking back into the slide being read leaves the index unchanged, and
   * seeking to a slide already read leaves both the index and "has been spoken"
   * unchanged. Comparing positions catches both — a jump is any move the
   * playhead could not have made on its own.
   *
   * The comparison has to be against the *previous frame*, not against the
   * position the current narration was started at. Measured against the start,
   * ordinary playback drifts past the tolerance on its own — half a second of
   * narration reads as a seek, the reader is torn down and rebuilt, and because
   * `stop()` nulls the channel the subtitle drops to idle and re-lights. That is
   * a four-times-a-second restart loop that looks exactly like a flickering
   * caption. Frame to frame, a real frame is ~16ms, so the tolerance can be
   * generous enough to survive a stalled tab and still catch a scrub.
   */
  const lastSeenTimeRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /**
   * Speed and loudness, mirrored out of the timebase.
   *
   * Refs rather than state because the effect that consumes them must not
   * re-render the narrator on every rate or volume change, and because `play`
   * is a `useCallback` that would otherwise have to take the timebase as a
   * dependency — a new object each render, which restarts the reader.
   */
  const rateRef = useRef(timebase.rate);
  const volumeRef = useRef(timebase.volume);
  const mutedRef = useRef(timebase.muted);
  rateRef.current = timebase.rate;
  volumeRef.current = timebase.volume;
  mutedRef.current = timebase.muted;
  const abortRef = useRef<AbortController | null>(null);
  /** sceneId|voice -> synthesised narration. Re-reading must not re-synthesise. */
  const cacheRef = useRef(new Map<string, CachedNarration>());
  /** Prefetches already in flight, so warming never doubles up on one slide. */
  const warmingRef = useRef(new Set<string>());
  /** rAF handle driving the subtitle highlight from the audio's own clock. */
  const trackFrameRef = useRef<number | null>(null);
  /** Latest narration callback, so the loop reads it without re-binding. */
  const narrationRef = useRef(onNarration);
  narrationRef.current = onNarration;

  /**
   * Pushes the audio's playback position out for the running subtitle.
   *
   * A rAF loop rather than the audio's `timeupdate` event: `timeupdate` fires
   * about four times a second, which is far too coarse to light up individual
   * words, and it is throttled further in background tabs. Reading
   * `currentTime` every frame costs nothing and tracks the voice exactly.
   */
  const stopTracking = useCallback(() => {
    if (trackFrameRef.current !== null) {
      cancelAnimationFrame(trackFrameRef.current);
      trackFrameRef.current = null;
    }
    narrationRef.current?.({ type: "stop" });
  }, []);

  const track = useCallback((audio: HTMLAudioElement, sceneIndex: number) => {
    if (trackFrameRef.current !== null) cancelAnimationFrame(trackFrameRef.current);
    const tick = () => {
      narrationRef.current?.({ type: "position", sceneIndex, time: audio.currentTime });
      trackFrameRef.current = requestAnimationFrame(tick);
    };
    trackFrameRef.current = requestAnimationFrame(tick);
  }, []);

  /**
   * Rides along on a lookahead fetch for the same slide+voice, if one is already
   * running, instead of synthesising twice.
   *
   * Returns null when there is nothing to ride (warmer failed or gave up), and
   * the caller falls through to its own fetch. The warmer always removes its
   * key when it settles, so waiting on the key alone can never hang past the
   * timeout — and a switch aborts through the same signal.
   */
  const waitForWarm = useCallback(
    async (key: string, signal: AbortSignal): Promise<CachedNarration | null> => {
      const start = Date.now();
      for (;;) {
        if (signal.aborted) return null;
        const hit = cacheRef.current.get(key);
        if (hit) return hit;
        // The warmer finished without caching: it failed, and waiting longer
        // only delays the retry that actually reports the failure.
        if (!warmingRef.current.has(key)) return null;
        if (Date.now() - start > 150_000) return null;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    },
    [],
  );

  useEffect(() => {
    fetch("/api/tts")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.voices?.length) return;
        setVoices(data.voices);
        // A stored voice from an older build, or one the service has since
        // retired, would be sent to the API and come back as a request it
        // rejects. Falling back to the server's own default keeps the deck
        // audible rather than silent with a notice nobody asked for.
        setVoice((current) =>
          data.voices.some((entry: VoiceOption) => entry.id === current)
            ? current
            : (data.default ?? FALLBACK_VOICES[0].id),
        );
      })
      .catch(() => {
        /* keep the built-in list; the server is optional */
      });
  }, []);

  useEffect(() => {
    const cache = cacheRef.current;
    const urls = Array.from(cache.values()).map((entry) => entry.url);
    return () => {
      stopTracking();
      abortRef.current?.abort();
      audioRef.current?.pause();
      urls.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

  const stop = useCallback((reportVoice?: string) => {
    abortRef.current?.abort();
    abortRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    stopTracking();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
    setLoading(false);
    // The voice that is actually done, not the one from the closure: after a
    // switch the stale id would flash on the chip until the new fetch lands.
    onVoiceState?.({ status: "idle", sceneIndex: null, sceneTitle: "", voice: reportVoice ?? voice });
  }, [onVoiceState, stopTracking, voice]);

  /** Hands a decoded narration to the player. */
  const play = useCallback(
    (
      entry: CachedNarration,
      sceneIndex: number,
      sceneTitle: string,
      text: string,
      /** Seconds into the slide to begin at; 0 for ordinary forward playback. */
      startAt = 0,
      /** Timeline end of this slide; the silence skip aims at it. */
      sceneEnd = Number.POSITIVE_INFINITY,
    ) => {
      const audio = new Audio(entry.url);
      audioRef.current = audio;
      // The narration follows the timebase's speed.
      //
      // Without this the deck runs at `rate` while the voice runs at 1x, and the
      // two are wrong by the time the first slide ends. That is not a subtle
      // desync: at 2x the slides are two scenes ahead of the sentence being
      // read, the subtitle highlight is on the wrong line, and the speed
      // control looks like it did nothing. The timebase owns the deck's clock, so it
      // hands the same rate to this element.
      audio.playbackRate = rateRef.current;
      // Loudness travels with the timebase's, for the same reason: the mute
      // button silences the deck, and the deck is mostly this audio.
      audio.volume = volumeRef.current;
      audio.muted = mutedRef.current;
      // Without this, seeking into a slide that was already narrated would play
      // its whole sentence from the top while the slide sits at 1:20. Seeking the
      // element before `play()` is what lines the voice back up with the playhead.
      if (startAt > 0) {
        const resume = () => {
          audio.currentTime = startAt;
        };
        // `currentTime` before metadata is loaded is silently ignored by some
        // browsers and throws in others, so it is applied on whichever of the
        // two events actually arrives first.
        if (audio.readyState >= 1) resume();
        else audio.addEventListener("loadedmetadata", resume, { once: true });
      }
      audio.onplay = () => {
        setSpeaking(true);
        track(audio, sceneIndex);
        onVoiceState?.({ status: "speaking", sceneIndex, sceneTitle, voice });
      };
      audio.onended = () => {
        setSpeaking(false);
        setLoading(false);
        stopTracking();
        onVoiceState?.({ status: "idle", sceneIndex: null, sceneTitle: "", voice });
        // Residual silence, skipped: the clip ended but its slide still holds
        // seconds of nothing (the engine read faster than the estimate, or an
        // older deck was authored under the old 3-words-a-second rate). Land
        // on the fade's doorstep rather than the boundary itself, so the
        // two-second scene transition still plays instead of being jumped
        // over — and mark the frames seen, so the landing does not re-speak
        // the clip's tail. The 2.5s floor keeps the designed end-of-slide
        // pause: only unintended silence is skipped. Not on the last slide
        // (let it end naturally) and never while looping.
        if (!loopEnabled) {
          const tb = timebaseRef.current;
          const now = tb.timeRef.current;
          const total = tb.duration;
          if (
            sceneEnd - now > 2.5 &&
            sceneEnd < total - 0.3 &&
            now < sceneEnd
          ) {
            const target = sceneEnd - 2;
            lastSeenTimeRef.current = target;
            tb.seek(target);
          }
        }
      };
      audio.onerror = () => {
        setSpeaking(false);
        setLoading(false);
        stopTracking();
      };
      void audio.play().catch(() => {
        setNotice(t.voiceBlocked);
      });
      // Published even on a cache hit, so a slide that is revisited highlights
      // without waiting on a fetch.
      if (entry.words.length > 0) {
        narrationRef.current?.({ type: "words", sceneIndex, words: entry.words });
      } else {
        // This entry has no recorded boundaries — it was cached before timings
        // were kept, or the voice service reported none. The audio still knows
        // its own length, so lay an even sweep over it rather than leave the
        // line frozen. One listener, not a poll.
        audio.addEventListener(
          "loadedmetadata",
          () => {
            if (Number.isFinite(audio.duration) && audio.duration > 0) {
              narrationRef.current?.({
                type: "words",
                sceneIndex,
                words: approximateWords(text, audio.duration),
              });
            }
          },
          { once: true },
        );
      }
    },
    // `t` is the active dictionary object itself, so its identity only changes
    // with the language — naming it here cannot restart the reader per frame.
    [onVoiceState, stopTracking, track, voice, t, loopEnabled],
  );

  const speak = useCallback(
    async (
      text: string,
      sceneId: string,
      sceneIndex: number,
      sceneTitle: string,
      sceneSeconds: number,
      /**
       * How far into the slide to begin reading, in seconds.
       *
       * This is what makes scrubbing a narrated deck work. A jump to 1:20 in a
       * scene whose audio has already been played would otherwise start the
       * voice from the top of the sentence — the highlight and the sound a
       * whole sentence ahead of the slide, which reads as the deck ignoring
       * the seek entirely.
       */
      startAt = 0,
      /** Timeline end of this slide; the silence skip aims at it. */
      sceneEnd = Number.POSITIVE_INFINITY,
    ) => {
      stop();
      const key = `${sceneId}|${voice}`;
      const cached = cacheRef.current.get(key);
      const controller = new AbortController();
      abortRef.current = controller;

      if (cached) {
        play(cached, sceneIndex, sceneTitle, text, startAt, sceneEnd);
        return;
      }

      // A lookahead may already be fetching this exact slide+voice (switching
      // voices re-warms the current slide before the next frame speaks it).
      // Riding along beats a second synthesis for one playback.
      if (warmingRef.current.has(key)) {
        setLoading(true);
        onVoiceState?.({ status: "preparing", sceneIndex, sceneTitle, voice });
        const rode = await waitForWarm(key, controller.signal);
        if (rode) {
          play(rode, sceneIndex, sceneTitle, text, startAt, sceneEnd);
          return;
        }
        if (controller.signal.aborted) return;
      }

      // The warmers share this set: without registering, a lookahead fetch
      // for this same slide+voice runs alongside this one and the server
      // synthesises twice for one playback.
      warmingRef.current.add(key);
      const release = () => warmingRef.current.delete(key);

      setLoading(true);
      // The gap the presenter actually cares about: the slide is on screen but
      // its narration is still being fetched.
      onVoiceState?.({ status: "preparing", sceneIndex, sceneTitle, voice });
      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text, voice }),
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          release();
          return;
        }

        if (!response.ok) {
          const detail = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(detail?.error ?? `HTTP ${response.status}`);
        }

        // Read the header before the body: `decodeWordMarks` is async, and the
        // blob is what we actually need from it.
        const words = await decodeWordMarks(response.headers.get("x-tts-words"));
        const blob = await response.blob();
        if (controller.signal.aborted) {
          release();
          return;
        }
        const entry: CachedNarration = { url: URL.createObjectURL(blob), words };
        cacheRef.current.set(key, entry);
        release();
        play(entry, sceneIndex, sceneTitle, text, startAt, sceneEnd);
      } catch (error) {
        release();
        if (controller.signal.aborted) return;
        setLoading(false);
        if (error instanceof Error && error.name === "AbortError") return;
        // The server voice is a nicety; never let it silence the teacher.
        setNotice(t.voiceServerFallback);
        // The browser gives no timings and no duration, so the subtitle gets an
        // even sweep across the scene's own length. Approximate, but it still
        // moves with the reading instead of sitting frozen.
        const guess = approximateWords(text, sceneSeconds);
        narrationRef.current?.({ type: "words", sceneIndex, words: guess });
        // Offset by where playback actually joined the slide, so the sweep does
        // not restart at the first word either.
        const startedAt = performance.now() - startAt * 1000;
        const sweep = window.setInterval(() => {
          narrationRef.current?.({
            type: "position",
            sceneIndex,
            time: (performance.now() - startedAt) / 1000,
          });
        }, 120);
        speakWithBrowser(
          text,
          () => {
            window.clearInterval(sweep);
            setSpeaking(false);
            stopTracking();
          },
          () => {
            window.clearInterval(sweep);
            setSpeaking(false);
          },
        );
      }
    },
    [play, stop, stopTracking, voice, t, waitForWarm],
  );

  /**
   * Fetches one slide's narration into the cache without playing it.
   *
   * Shared by the prefetch below (current slide, before the first play) and
   * the lookahead (next slides, while playing). The guards make double work
   * impossible: a slide already cached or already being warmed is skipped, and
   * the in-flight set is cleared even when the fetch fails.
   */
  const warmScene = useCallback(
    (index: number) => {
      const scene = lesson.scenes[index];
      if (!scene?.narration) return;
      const key = `${scene.id}|${voice}`;
      if (cacheRef.current.has(key) || warmingRef.current.has(key)) return;

      warmingRef.current.add(key);
      fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: scene.narration, voice }),
      })
        .then(async (response) => {
          if (response.ok) {
            // Timings are warmed too, otherwise the next slide would come back
            // without a highlight even though the server sent one.
            const words = await decodeWordMarks(response.headers.get("x-tts-words"));
            cacheRef.current.set(key, {
              url: URL.createObjectURL(await response.blob()),
              words,
            });
          }
        })
        .catch(() => {
          // Warming is best effort; the real request retries on its own.
        })
        .finally(() => warmingRef.current.delete(key));
    },
    [lesson.scenes, voice],
  );

  /**
   * Prefetches the current slide as soon as the lesson loads.
   *
   * The old behaviour only warmed while playing, so the very first press of
   * play always paid a full cold synthesis (tens of seconds) on slide 0. This
   * moves that work to the moment the deck opens, when the student is still
   * reading the title — by the time they press play, slide 0 is usually a
   * cache hit.
   */
  useEffect(() => {
    if (!enabled) return;
    warmScene(activeSceneIndex);
  }, [activeSceneIndex, enabled, lesson.scenes, voice, warmScene]);

  /**
   * Warms the next two slides' audio while the current one is playing.
   *
   * Synthesis is seconds of latency; without this a presenter reaches the next
   * slide and hears nothing. Two slides instead of one because a short slide
   * can finish before the single lookahead lands. Cached hits are free, and
   * misses only move work earlier rather than adding to it.
   */
  useEffect(() => {
    if (!enabled || !timebase.playing) return;
    warmScene(activeSceneIndex + 1);
    warmScene(activeSceneIndex + 2);
  }, [activeSceneIndex, enabled, lesson.scenes, timebase.playing, voice, warmScene]);

  /**
   * Everything the playhead subscription needs, published after `speak` exists.
   *
   * Kept in a ref so the subscription is not rebuilt when a parent passes a new
   * callback identity down — see the note on the sync effect for why that would
   * loop.
   */
  const liveRef = useRef({
    scenes: lesson.scenes,
    speakNow: speak,
    spokenIndex: () => activeSceneIndex,
  });
  liveRef.current = { scenes: lesson.scenes, speakNow: speak, spokenIndex: () => activeSceneIndex };

  /**
   * The timebase, read through a ref for the same reason.
   *
   * `useTimebase` returns a fresh object on every render, so naming it in a
   * dependency array re-runs the effect on every render — and this effect, on
   * attach, calls `stop()`, which publishes a new voice state, which re-renders,
   * which builds a new timebase. That cycle is a "Maximum update depth exceeded"
   * as soon as the deck is opened and never stops.
   */
  const timebaseRef = useRef(timebase);
  timebaseRef.current = timebase;

  /**
   * Synchronize voice with the timeline.
   *
   * This follows the playhead by subscribing to it, rather than waiting for the
   * scene index to change. That distinction is the whole fix: a scrub that lands
   * on a slide the voice already read leaves the index *and* the "has this been
   * spoken" flag both unchanged, so an index-driven effect sees nothing to do and
   * that slide's audio plays on from wherever it was — which is the report that
   * seeking did not work and the voice just runs start to finish.
   *
   * A restart is therefore triggered by a *discontinuity* in the playhead: a move
   * larger than playback could have made on its own. Crossing into the next slide
   * is such a jump and restarts that slide at its beginning, which is free because
   * the narration is cached. Ordinary frames move by ~16ms and restart nothing.
   *
   * Everything the callback needs is read from refs, so this effect subscribes
   * once. That is not an optimisation: `subscribe` fires the listener immediately
   * on attach, and if re-subscribing were triggered by an unstable callback
   * identity, the speak it starts would re-render, change that identity, resubscribe
   * and start another speak — "Maximum update depth exceeded", sixty times a
   * second, for as long as the deck was open.
   */
  useEffect(() => {
    if (!enabled) return;
    const tb = timebaseRef.current;
    if (!tb.playing) {
      stop();
      lastSpokenSceneRef.current = null;
      lastSeenTimeRef.current = null;
      return;
    }

    return tb.subscribe((time) => {
      const { scenes, speakNow, spokenIndex } = liveRef.current;
      const sceneIndex = spokenIndex();
      const scene = scenes[sceneIndex];

      // One ordinary frame is ~16ms of deck; the timebase clamps its own delta to
      // 250ms, and the rate multiplies that. Anything past that budget could not
      // have happened on its own, and a backward move never could. The previous
      // position is consumed here so the next frame is compared against this one.
      const previous = lastSeenTimeRef.current;
      lastSeenTimeRef.current = time;

      if (!scene?.narration) {
        lastSpokenSceneRef.current = null;
        return;
      }

      // Where the playhead is inside this slide. Clamped at zero because a seek
      // can land fractionally before a scene's own start, and a negative audio
      // offset throws in some browsers.
      const offset = Math.max(0, time - scene.start);
      const frameBudget = 0.25 * Math.max(1, rateRef.current) + 0.15;
      const movedBackwards = previous !== null && time < previous - 0.05;
      const jumpedForward = previous !== null && time - previous > frameBudget;
      const jumped =
        lastSpokenSceneRef.current !== sceneIndex ||
        previous === null ||
        movedBackwards ||
        jumpedForward;
      if (!jumped) return;

      lastSpokenSceneRef.current = sceneIndex;
      void speakNow(scene.narration, scene.id, sceneIndex, scene.title, scene.duration, offset, scene.start + scene.duration);
    });
    // `enabled` and `playing` are the only things that change what this does.
    // Deliberately not `timebase`: it is a new object every render, and depending
    // on it re-runs the effect that calls `stop()`, which re-renders — forever.
  }, [enabled, stop, timebase.playing]);

  // Rate or volume changed mid-sentence: the audio element already in flight
  // has to follow, not just the next one to be created. Depends on the two
  // numbers rather than on the timebase object, which is new every render and
  // would restart the reader on every frame.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.playbackRate !== timebase.rate) audio.playbackRate = timebase.rate;
    if (audio.volume !== timebase.volume) audio.volume = timebase.volume;
    if (audio.muted !== timebase.muted) audio.muted = timebase.muted;
  }, [timebase.rate, timebase.volume, timebase.muted]);

  // A different lesson brings its own voice (the one picked in Studio).
  // Follow it the same way a manual change does: drain the old run so the
  // new lesson is narrated from its first scene instead of staying silent.
  // Depends on the id only, so picking a voice by hand never gets clobbered.
  useEffect(() => {
    if (lesson.voice) {
      setVoice(lesson.voice);
      lastSpokenSceneRef.current = null;
      lastSeenTimeRef.current = null;
      setNotice(null);
      stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  // Switching voice must not replay a scene that was already narrated.
  const changeVoice = (next: string) => {
    setVoice(next);
    lastSpokenSceneRef.current = null;
    // The frame history goes too. It describes a run of playhead positions read
    // for the old voice, so keeping it would let the next frame look like ordinary
    // playback — and the slide would then stay silent until the playhead moved by
    // more than a frame, which on a paused deck is never.
    lastSeenTimeRef.current = null;
    setNotice(null);
    stop(next);
  };

  const toggle = () => {
    if (enabled) stop();
    else {
      lastSpokenSceneRef.current = null;
      // Same reason as in `changeVoice`: the surviving frame history would make
      // the first frame back look like ordinary playback, and re-enabling would
      // leave the slide silent instead of restarting the narration.
      lastSeenTimeRef.current = null;
    }
    setEnabled(!enabled);
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggle}
        className={`chip transition-colors ${
          enabled
            ? "border-brand-500 bg-brand-500/15 text-brand-100"
            : "border-ink-700 bg-ink-900/60 text-mist-500 hover:text-mist-300"
        }`}
        title={enabled ? t.voiceTurnOff : t.voiceTurnOn}
      >
        {loading ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : enabled ? (
          <Volume2 className={`h-3.5 w-3.5 ${speaking ? "animate-pulse text-gold-300" : ""}`} />
        ) : (
          <VolumeX className="h-3.5 w-3.5" />
        )}
        <span>
          {t.voiceChipLabel}{" "}
          {loading ? t.voicePreparing : speaking ? t.voiceTeaching : enabled ? t.voiceOn : t.voiceOff}
        </span>
      </button>

      {enabled && (
        <>
          <label className="sr-only" htmlFor="tts-voice">
            {t.voiceSelectLabel}
          </label>
          <select
            id="tts-voice"
            value={voice}
            onChange={(e) => changeVoice(e.target.value)}
            title={notice ?? t.voiceSelectTitle}
            className="chip border-ink-700 bg-ink-900/60 text-mist-300 hover:text-mist-100"
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
