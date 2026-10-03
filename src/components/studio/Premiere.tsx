"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import type { LiveScene } from "./GenerationTimeline";
import { SceneLoader3D } from "../three/SceneLoader3D";
import {
  alignSentences,
  decodeWordMarks,
  type AlignedSentence,
} from "@/lib/karaoke";

interface CachedAudio {
  url: string;
  sentences: AlignedSentence[];
}

type Phase =
  | { name: "idle" }
  | { name: "loading-audio"; index: number }
  | { name: "playing"; index: number }
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
  /**
   * Fires with the scene whose voice starts, and with null when nothing is
   * speaking — the classroom's bottom narration bar listens to this.
   */
  onSceneChange?: (scene: LiveScene | null) => void;
}) {
  const [auto, setAuto] = useState(true);
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [now, setNow] = useState(0);
  const [sentences, setSentences] = useState<AlignedSentence[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef(new Map<number, CachedAudio>());
  const playedRef = useRef(new Set<number>());
  const failedRef = useRef(new Set<number>());
  const atRef = useRef<number | null>(null);
  const busyRef = useRef(false);

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
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
    setNow(0);
    setSentences([]);
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
        body: JSON.stringify({ text, voice }),
      });
      if (!response.ok) throw new Error(`giọng đọc trả lỗi ${response.status}`);
      const [blob, marks] = await Promise.all([
        response.blob(),
        decodeWordMarks(response.headers.get("x-tts-words")),
      ]);
      const url = URL.createObjectURL(blob);
      const cached = { url, sentences: alignSentences(text, marks) };
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
      setNow(0);
      setSentences([]);
      setNote(null);
      setPhase({ name: "loading-audio", index });
      try {
        const cached = await fetchAudio(scene);
        // The deck moved on while the voice was being made.
        if (atRef.current !== index) return;
        const audio = new Audio(cached.url);
        audioRef.current = audio;
        setSentences(cached.sentences);
        setPhase({ name: "playing", index });
        onSceneChange?.(scene);
        audio.ontimeupdate = () => setNow(audio.currentTime);
        audio.onended = () => {
          if (audioRef.current !== audio) return;
          audioRef.current = null;
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
          failedRef.current.add(index);
          atRef.current = null;
          busyRef.current = false;
          setNote(`Không phát được giọng cảnh ${index + 1}, bỏ qua.`);
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
        setNote(`Không tạo được giọng cảnh ${index + 1}, bỏ qua.`);
        setPhase({ name: "idle" });
      } finally {
        if (atRef.current !== index) busyRef.current = false;
      }
    },
    [scenes, fetchAudio, stopAudio, evictBehind, onSceneChange],
  );

  // The driver: whenever idle, play the earliest unplayed ready scene; when
  // the next scene is missing and the run continues, wait on the loader.
  useEffect(() => {
    if (!auto || busyRef.current || phase.name === "error") return;
    if (phase.name === "playing" || phase.name === "loading-audio") return;
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
  }, [scenes, auto, phase, running, done, playAt]);

  const jump = useCallback(
    (index: number) => {
      busyRef.current = false;
      stopAudio();
      atRef.current = null;
      void playAt(index);
    },
    [playAt, stopAudio],
  );

  const replay = useCallback(() => {
    playedRef.current.clear();
    failedRef.current.clear();
    setNote(null);
    setPhase({ name: "idle" });
  }, []);

  if (scenes.length === 0) return null;

  const current =
    phase.name === "playing" || phase.name === "loading-audio"
      ? (scenes.find((scene) => scene.index === phase.index) ?? null)
      : null;
  const activeSentence = [...sentences]
    .reverse()
    .find((sentence) => sentence.start !== null && sentence.start <= now);

  return (
    <div className="mt-4 space-y-3">
      <div className="overflow-hidden rounded-xl border border-brand-700/50 bg-ink-950/70">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700/60 px-4 py-2.5">
          <p className="flex items-center gap-2 text-sm font-semibold text-mist-100">
            <span className="h-2 w-2 animate-pulse rounded-full bg-ember-400" />
            Chiếu ngay
            {current ? (
              <span className="font-mono text-[11px] font-normal text-mist-400">
                cảnh {current.index + 1}
                {phase.name === "playing" ? " · đang đọc" : " · đang lấy giọng…"}
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
                <RotateCcw className="h-3.5 w-3.5" /> Chiếu lại
              </button>
            ) : phase.name === "playing" ? (
              <button
                type="button"
                onClick={stopAudio}
                className="btn-ghost px-3 py-1 text-xs"
              >
                <Pause className="h-3.5 w-3.5" /> Dừng giọng
              </button>
            ) : null}
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-mist-300">
              <input
                type="checkbox"
                checked={auto}
                onChange={(event) => setAuto(event.target.checked)}
                className="h-3.5 w-3.5 accent-emerald-400"
              />
              <Volume2 className="h-3.5 w-3.5" /> Tự chiếu tiếp
            </label>
          </div>
        </div>

        {current ? (
          <div className="space-y-2 px-4 py-4">
            <p className="font-mono text-[11px] uppercase tracking-wide text-brand-300">
              Cảnh {current.index + 1}
            </p>
            <h3 className="text-lg font-semibold text-mist-50">{current.title}</h3>
            {sentences.length > 0 ? (
              <div className="space-y-1.5" aria-live="polite">
                {sentences.map((sentence, i) => {
                  const active = activeSentence === sentence;
                  const past =
                    sentence.start !== null &&
                    activeSentence?.start !== null &&
                    activeSentence !== sentence &&
                    (sentence.start ?? 0) < (activeSentence?.start ?? 0);
                  return (
                    <p
                      key={i}
                      className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        active
                          ? "bg-brand-500/15 text-mist-50"
                          : past
                            ? "text-mist-500"
                            : "text-mist-300"
                      }`}
                    >
                      {sentence.text}
                    </p>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm italic leading-relaxed text-mist-300">
                {current.narration}
              </p>
            )}
            {phase.name === "loading-audio" ? (
              <p className="flex items-center gap-2 text-xs text-mist-400">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Đang lấy giọng đọc…
              </p>
            ) : null}
          </div>
        ) : phase.name === "waiting-scene" ? (
          <div className="p-4">
            <SceneLoader3D
              label={`Đang viết cảnh ${phase.index + 1}…`}
              progress={progress}
            />
          </div>
        ) : phase.name === "finished" ? (
          <p className="px-4 py-6 text-center text-sm text-mist-300">
            Đã chiếu hết {playedRef.current.size} cảnh. Bài đầy đủ nằm ở phần kịch
            bản bên dưới.
          </p>
        ) : phase.name === "error" ? (
          <p className="px-4 py-6 text-center text-sm text-ember-400">{phase.message}</p>
        ) : (
          <div className="p-4">
            <SceneLoader3D label="Chuẩn bị chiếu…" progress={progress} />
          </div>
        )}
      </div>

      {note ? <p className="text-xs text-gold-200">{note}</p> : null}

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
    </div>
  );
}
