"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import type { LiveScene } from "./GenerationTimeline";
import { SceneLoader3D } from "../three/SceneLoader3D";
import { KaraokeSubtitle } from "../player/KaraokeSubtitle";
import { SlideSurface } from "../player/SlideSurface";
import type { Lesson } from "@/lib/lesson/types";
import {
  createNarrationChannel,
  decodeWordMarks,
  type NarrationChannel,
} from "@/lib/karaoke";
import { useCopy } from "@/i18n/provider";
import { pickVoice } from "@/lib/lesson/voices";

const COPY = {
  en: {
    premiereTitle: "Now playing",
    sceneWord: "scene",
    stateReading: "· narrating",
    stateLoadingVoice: "· loading voice…",
    replay: "Play again",
    stopVoice: "Stop voice",
    autoAdvance: "Play on automatically",
    waitingSceneLead: "Writing scene",
    waitingSceneTail: "…",
    gettingReady: "Getting ready to play…",
    playedLead: "Played all",
    sceneUnit: "scenes",
    playedTail: "The full lesson is in the script below.",
    voicePlayFailedLead: "Could not play the voice-over for scene",
    voiceMakeFailedLead: "Could not generate the voice-over for scene",
    skipped: "— skipping.",
    enableSound: "Turn sound on",
    muteSound: "Turn sound off",
    resume: "Resume",
    stateMuted: "· sound off",
    mutedHint: "The slides play silently. Turn the sound on to hear the teacher read them.",
  },
  vi: {
    premiereTitle: "Chiếu ngay",
    sceneWord: "cảnh",
    stateReading: "· đang đọc",
    stateLoadingVoice: "· đang lấy giọng…",
    replay: "Chiếu lại",
    stopVoice: "Dừng giọng",
    autoAdvance: "Tự chiếu tiếp",
    waitingSceneLead: "Đang viết cảnh",
    waitingSceneTail: "…",
    gettingReady: "Chuẩn bị chiếu…",
    playedLead: "Đã chiếu hết",
    sceneUnit: "cảnh",
    playedTail: "Bài đầy đủ nằm ở phần kịch bản bên dưới.",
    voicePlayFailedLead: "Không phát được giọng cảnh",
    voiceMakeFailedLead: "Không tạo được giọng cảnh",
    skipped: "— bỏ qua.",
    enableSound: "Bật tiếng",
    muteSound: "Tắt tiếng",
    resume: "Chiếu tiếp",
    stateMuted: "· đang tắt tiếng",
    mutedHint: "Slide hiện im lặng. Bật tiếng để nghe giọng đọc.",
  },
};

interface CachedAudio {
  url: string;
}

type Phase =
  | { name: "idle" }
  | { name: "loading-audio"; index: number }
  | { name: "playing"; index: number }
  /**
   * The slide is on screen but nothing is being read: the room starts muted, and
   * this is where it waits after the teacher stops it.
   */
  | { name: "silent"; index: number }
  | { name: "waiting-scene"; index: number }
  | { name: "finished" }
  | { name: "error"; message: string };

/**
 * The openmaic-style premiere: the deck starts playing the moment scene 1 and
 * its voice-over are ready — no waiting for the whole lesson. Each slide
 * plays its narration with a sentence-following caption, then the next ready
 * scene takes over; a three.js loader covers the gap while the model is still
 * writing. Playback ends when the run is done and the last slide has spoken.
 *
 * Audio is prefetched one scene ahead so the only visible wait is the model,
 * never the voice. Object URLs are evicted behind the playhead so a 95-scene
 * deck does not keep ninety-five recordings in memory.
 */
export function PremierePlayer({
  scenes,
  voice,
  running,
  done,
  progress,
  lessonId,
  jumpTo,
  showIndex = true,
  onSceneChange,
}: {
  scenes: LiveScene[];
  voice: string;
  /** The stream is still writing scenes. */
  running: boolean;
  /** The stream finished; no more scenes will arrive. */
  done: boolean;
  /** 0..100 deck progress, for the loader bar while waiting. */
  progress: number;
  /** Stable deck id — seeds the slide pictures, same as the saved lesson. */
  lessonId: string;
  /**
   * "Play this slide now", asked for from outside — the classroom's own slide
   * list is the index, and a click there hands the deck back to the player.
   * `seq` makes every click land even when the same slide is asked twice.
   */
  jumpTo?: { index: number; seq: number } | null;
  /** False where the room draws its own numbered list down the side. */
  showIndex?: boolean;
  /**
   * Fires with the scene whose voice starts, and with null when nothing is
   * speaking — the classroom's bottom narration bar listens to this.
   */
  onSceneChange?: (scene: LiveScene | null) => void;
}) {
  const t = useCopy(COPY);
  const [auto, setAuto] = useState(true);
  /**
   * Sound is off until the teacher turns it on.
   *
   * A classroom demo should never start making noise on its own — and the
   * voice-over costs a synthesis call per slide, which nobody asked for yet.
   * The slides still play, silently, until the room is switched on.
   */
  const [audible, setAudible] = useState(false);
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [note, setNote] = useState<string | null>(null);
  /**
   * The voice channel, as a ref and not state.
   *
   * Playback publishes its position here on every animation frame and the
   * caption reads it inside its own rAF loop, so the highlight never costs a
   * React render — the same bargain the full player makes. `words` carries the
   * per-slide word timings, which is why the caption is never a slide behind.
   */
  const channelRef = useRef<NarrationChannel>(createNarrationChannel());

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef(new Map<number, CachedAudio>());
  const playedRef = useRef(new Set<number>());
  const failedRef = useRef(new Set<number>());
  const atRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  /**
   * The teacher stopped the show. While this is on, the driver stays quiet: a
   * stop that only paused the audio would still be "playing" as far as the
   * player is concerned, and the next slide would either never come or come on
   * its own — both read as a broken button.
   */
  const [held, setHeld] = useState(false);

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    channelRef.current.live = null;
  }, []);

  const evictBehind = useCallback((keepFrom: number) => {
    for (const [index, cached] of cacheRef.current) {
      if (index < keepFrom) {
        URL.revokeObjectURL(cached.url);
        cacheRef.current.delete(index);
      }
    }
  }, []);

  const resetAll = useCallback(() => {
    stopAudio();
    for (const cached of cacheRef.current.values()) {
      URL.revokeObjectURL(cached.url);
    }
    cacheRef.current.clear();
    playedRef.current.clear();
    failedRef.current.clear();
    atRef.current = null;
    busyRef.current = false;
    channelRef.current.live = null;
    setNote(null);
    setPhase({ name: "idle" });
  }, [stopAudio]);

  // A new run starts with an empty scene list: forget the old deck.
  useEffect(() => {
    if (scenes.length === 0) resetAll();
  }, [scenes.length, resetAll]);
  useEffect(() => resetAll, [resetAll]);

  const fetchAudio = useCallback(
    async (scene: LiveScene): Promise<CachedAudio> => {
      const hit = cacheRef.current.get(scene.index);
      if (hit) return hit;
      const text = scene.narration.trim().slice(0, 4000);
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, voice: pickVoice(voice, text) }),
      });
      if (!response.ok) throw new Error(`tts voice returned ${response.status}`);
      const [blob, marks] = await Promise.all([
        response.blob(),
        decodeWordMarks(response.headers.get("x-tts-words")),
      ]);
      const url = URL.createObjectURL(blob);
      // Published on the channel, not held here: the caption under the slide is
      // the only thing that reads the timings.
      channelRef.current.words.set(scene.index, marks);
      const cached = { url };
      cacheRef.current.set(scene.index, cached);
      return cached;
    },
    [voice],
  );

  const playAt = useCallback(
    async (index: number) => {
      const scene = scenes.find((item) => item.index === index);
      if (!scene || !scene.narration.trim() || busyRef.current) return;
      busyRef.current = true;
      stopAudio();
      atRef.current = index;
      setNote(null);
      setPhase({ name: "loading-audio", index });
      // Say which slide is on screen straight away: making the voice-over takes
      // a moment, and the room should already name the slide it moved to.
      onSceneChange?.(scene);
      try {
        const cached = await fetchAudio(scene);
        // The deck moved on while the voice was being made.
        if (atRef.current !== index) return;
        const audio = new Audio(cached.url);
        audioRef.current = audio;
        setPhase({ name: "playing", index });
        onSceneChange?.(scene);
        // One write per frame, read by the caption's own loop: the playhead never
        // goes through React, so a slide holding a chart stays still.
        audio.ontimeupdate = () => {
          channelRef.current.live = { sceneIndex: index, time: audio.currentTime };
        };
        audio.onended = () => {
          if (audioRef.current !== audio) return;
          audioRef.current = null;
          channelRef.current.live = null;
          playedRef.current.add(index);
          evictBehind(index);
          atRef.current = null;
          busyRef.current = false;
          onSceneChange?.(null);
          setPhase({ name: "idle" });
        };
        audio.onerror = () => {
          if (audioRef.current !== audio) return;
          audioRef.current = null;
          channelRef.current.live = null;
          failedRef.current.add(index);
          atRef.current = null;
          busyRef.current = false;
          setNote(`${t.voicePlayFailedLead} ${index + 1} ${t.skipped}`);
          onSceneChange?.(null);
          setPhase({ name: "idle" });
        };
        await audio.play();
        // Warm the next slide's voice while this one speaks, so the only
        // visible wait is the model writing — never the TTS.
        const following = scenes.find(
          (item) => item.index === index + 1 && item.narration.trim(),
        );
        if (following && !cacheRef.current.has(following.index)) {
          void fetchAudio(following).catch(() => null);
        }
      } catch {
        if (atRef.current !== index) return;
        failedRef.current.add(index);
        atRef.current = null;
        busyRef.current = false;
        setNote(`${t.voiceMakeFailedLead} ${index + 1} ${t.skipped}`);
        setPhase({ name: "idle" });
      } finally {
        if (atRef.current !== index) busyRef.current = false;
      }
    },
    [scenes, fetchAudio, stopAudio, evictBehind, onSceneChange, t],
  );

  // The driver: whenever idle, play the earliest unplayed ready scene; when
  // the next scene is missing and the run continues, wait on the loader.
  useEffect(() => {
    if (!auto || !audible || busyRef.current || phase.name === "error") return;
    if (phase.name === "playing" || phase.name === "loading-audio") return;
    // Held by the teacher: the slide stays, the show waits for "resume".
    if (held || phase.name === "silent") return;
    const playable = scenes
      .filter(
        (scene) =>
          scene.narration.trim() &&
          !playedRef.current.has(scene.index) &&
          !failedRef.current.has(scene.index),
      )
      .sort((a, b) => a.index - b.index);
    // Resume where the playhead is: prefer the scene right after the last one
    // the audience heard, so a late scene never replays the deck from zero.
    const lastHeard = Math.max(-1, ...playedRef.current);
    const next = playable.find((scene) => scene.index > lastHeard) ?? playable[0];
    if (next) {
      void playAt(next.index);
      return;
    }
    if (running) {
      const expected = lastHeard + 1;
      if (phase.name !== "waiting-scene") setPhase({ name: "waiting-scene", index: expected });
    } else if (done && playedRef.current.size > 0) {
      if (phase.name !== "finished") setPhase({ name: "finished" });
    }
  }, [scenes, auto, audible, held, phase, running, done, playAt]);

  /**
   * Muted: park on the first slide that exists so the room still shows the
   * lesson instead of a spinner, and follow it as more slides land.
   */
  useEffect(() => {
    if (audible) return;
    if (phase.name === "playing" || phase.name === "loading-audio") return;
    const ready = scenes.find(
      (scene) => scene.narration.trim() || scene.bullets.length > 0,
    );
    if (!ready) return;
    if (phase.name === "silent" && phase.index === ready.index) return;
    setPhase({ name: "silent", index: ready.index });
  }, [audible, scenes, phase]);

  /**
   * Stop: silence the voice-over and hold the show on the slide that was up.
   * Everything the player needs to resume is left in place — the cache, the
   * word timings and which slides have already been heard.
   */
  const stopHere = useCallback(
    (index: number) => {
      stopAudio();
      atRef.current = null;
      busyRef.current = false;
      setHeld(true);
      onSceneChange?.(null);
      setPhase({ name: "silent", index });
    },
    [onSceneChange, stopAudio],
  );

  /** Back to the show: the driver picks the next unheard slide by itself. */
  const resume = useCallback(() => {
    setHeld(false);
    setAudible(true);
    setPhase({ name: "idle" });
  }, []);

  const toggleSound = useCallback(() => {
    if (audible) {
      const held =
        phase.name === "silent" ? phase.index : (scenes[0]?.index ?? 0);
      stopHere(held);
      setAudible(false);
    } else {
      resume();
    }
  }, [audible, phase, scenes, resume, stopHere]);

  const jump = useCallback(
    (index: number) => {
      busyRef.current = false;
      stopAudio();
      atRef.current = null;
      void playAt(index);
    },
    [playAt, stopAudio],
  );

  // The room's slide list drives the deck from outside: it hands over an
  // index and the player takes it from here, so the voice, the captions and
  // the "đang viết cảnh" loader all stay in one place. The sequence number
  // is what makes this fire exactly once per click — the scene list itself
  // changes on every new slide, and a plain index would replay the deck.
  const jumpSeqRef = useRef(0);
  useEffect(() => {
    if (!jumpTo || jumpTo.seq === jumpSeqRef.current) return;
    if (!scenes.some((scene) => scene.index === jumpTo.index)) return;
    jumpSeqRef.current = jumpTo.seq;
    busyRef.current = false;
    stopAudio();
    atRef.current = null;
    void playAt(jumpTo.index);
  }, [jumpTo, playAt, scenes, stopAudio]);

  const replay = useCallback(() => {
    playedRef.current.clear();
    failedRef.current.clear();
    setNote(null);
    setPhase({ name: "idle" });
  }, []);

  if (scenes.length === 0) return null;

  const current =
    phase.name === "playing" ||
    phase.name === "loading-audio" ||
    phase.name === "silent"
      ? (scenes.find((scene) => scene.index === phase.index) ?? null)
      : null;
  // A full LessonScene for the slide view, with the same stable id the
  // saved lesson will carry (`ai-<n>`) so picture seeds match it.
  const currentSlide: Lesson["scenes"][number] | null = current
    ? {
        id: `ai-${current.index + 1}`,
        kind: (current.kind as Lesson["scenes"][number]["kind"]) ?? "concept",
        accent: "brand",
        title: current.title,
        subtitle: current.subtitle,
        bullets: current.bullets,
        narration: current.narration,
        imagePrompt: current.imagePrompt,
        imageQuery: current.imageQuery,
        layout: current.layout as Lesson["scenes"][number]["layout"],
        blocks: current.blocks,
        start: 0,
        duration: 0,
      }
    : null;
  return (
    <div className="mt-4 space-y-3">
      <div className="overflow-hidden rounded-xl border border-ink-600 bg-ink-950">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-600 px-4 py-2.5">
          <p className="flex items-center gap-2 text-sm font-semibold text-mist-100">
            <span className="h-2 w-2 animate-pulse rounded-full bg-ember-500" />
            {t.premiereTitle}
            {current ? (
              <span className="font-mono text-[11px] font-normal text-mist-400">
                {t.sceneWord} {current.index + 1}/{scenes.length}
                {phase.name === "playing"
                  ? t.stateReading
                  : phase.name === "silent"
                    ? t.stateMuted
                    : t.stateLoadingVoice}
              </span>
            ) : null}
          </p>
          <div className="flex items-center gap-2">
            {phase.name === "finished" ? (
              <button
                type="button"
                onClick={replay}
                className="btn-ghost px-3 py-1 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" /> {t.replay}
              </button>
            ) : phase.name === "playing" || phase.name === "loading-audio" ? (
              <button
                type="button"
                onClick={() => stopHere(current?.index ?? 0)}
                className="btn-ghost px-3 py-1 text-xs"
              >
                <Pause className="h-3.5 w-3.5" /> {t.stopVoice}
              </button>
            ) : held ? (
              <button
                type="button"
                onClick={resume}
                className="btn-primary px-3 py-1 text-xs"
              >
                <Play className="h-3.5 w-3.5" /> {t.resume}
              </button>
            ) : null}
            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={audible}
              className={`btn-ghost px-3 py-1 text-xs ${audible ? "" : "text-brand-200"}`}
            >
              {audible ? (
                <>
                  <Volume2 className="h-3.5 w-3.5" /> {t.muteSound}
                </>
              ) : (
                <>
                  <VolumeX className="h-3.5 w-3.5" /> {t.enableSound}
                </>
              )}
            </button>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-mist-300">
              <input
                type="checkbox"
                checked={auto}
                onChange={(event) => setAuto(event.target.checked)}
                className="h-3.5 w-3.5 accent-emerald-400"
              />
              <Volume2 className="h-3.5 w-3.5" /> {t.autoAdvance}
            </label>
          </div>
        </div>

        {current && currentSlide ? (
          /* The slide itself, exactly as the full player draws it, with the
             karaoke caption in the band the slide reserves at the bottom. */
          <div className="p-3 sm:p-4">
            <SlideSurface
              scene={currentSlide}
              index={current.index}
              lessonId={lessonId}
              channel={channelRef.current}
              playing={phase.name === "playing"}
              caption={
                // Karaoke needs a playhead: with the sound off there is
                // nothing to highlight against, so the slide sits plain.
                phase.name === "playing" && current.narration.trim() ? (
                  <KaraokeSubtitle
                    key={`ai-${current.index + 1}`}
                    text={current.narration}
                    sceneIndex={current.index}
                    channel={channelRef.current}
                  />
                ) : null
              }
            />
          </div>
        ) : phase.name === "waiting-scene" ? (
          <div className="p-4">
            <SceneLoader3D
              label={`${t.waitingSceneLead} ${phase.index + 1}${t.waitingSceneTail}`}
              progress={progress}
            />
          </div>
        ) : phase.name === "finished" ? (
          <p className="px-4 py-6 text-center text-sm text-mist-300">
            {t.playedLead} {playedRef.current.size} {t.sceneUnit}. {t.playedTail}
          </p>
        ) : phase.name === "error" ? (
          <p className="px-4 py-6 text-center text-sm text-ember-400">{phase.message}</p>
        ) : (
          <div className="p-4">
            <SceneLoader3D label={t.gettingReady} progress={progress} />
          </div>
        )}
      </div>

      {note ? <p className="text-xs text-gold-200">{note}</p> : null}
      {!audible && !held ? (
        <p className="text-xs text-mist-400">{t.mutedHint}</p>
      ) : null}

      {/* The room draws its own index down the side, with slide pictures. */}
      {showIndex ? (
        <ol className="flex flex-wrap gap-1.5">
          {[...scenes]
            .sort((a, b) => a.index - b.index)
            .map((scene) => {
              const isCurrent =
                (phase.name === "playing" || phase.name === "loading-audio") &&
                phase.index === scene.index;
              const heard = playedRef.current.has(scene.index);
              return (
                <li key={scene.index}>
                  <button
                    type="button"
                    onClick={() => jump(scene.index)}
                    title={scene.title}
                    className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                      isCurrent
                        ? "border-ember-500/60 bg-ember-500/10 text-ember-200"
                        : heard
                          ? "border-brand-700/60 bg-brand-500/10 text-brand-200"
                          : "border-ink-700 bg-ink-900/50 text-mist-500 hover:text-mist-200"
                    }`}
                  >
                    {scene.index + 1}
                  </button>
                </li>
              );
            })}
        </ol>
      ) : null}
    </div>
  );
}
