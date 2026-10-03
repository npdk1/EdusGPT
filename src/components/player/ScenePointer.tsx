"use client";

import { useEffect, useRef, type RefObject } from "react";
import {
  alignSentences,
  splitSentences,
  type AlignedSentence,
  type NarrationChannel,
} from "@/lib/karaoke";
import { scoreCandidates } from "@/lib/pointer-match";
import type { Lesson } from "@/lib/lesson/types";

/**
 * The teacher's pointer: a dot that holds on the slide part being read.
 *
 * It follows the narration the same way the karaoke caption does — by sentence
 * index from the same word timings, never by timer — so the two can never
 * disagree about where the voice is.
 *
 * Which part to hold is decided from the sentence being read, not only from
 * the AI's cue list. The cue list is shorter than the narration whenever the
 * model writes fewer anchors than sentences, and falling back to its first
 * entry parked the pointer on the title for the whole second half of a slide.
 * So the sentence's own words pick the part: the slide whose text shares the
 * most content words with the sentence wins, the cue is the tiebreak when
 * nothing matches, and the last position is held rather than jumping home to
 * the title mid-slide.
 *
 * Playback stays off React: one rAF loop touches only styles and attributes.
 */
export function ScenePointer({
  lesson,
  scene,
  stageRef,
  channel,
  playing,
  enabled,
  colorRgb,
}: {
  lesson: Lesson;
  /**
   * The classroom and the premiere draw one slide at a time and have no deck to
   * look up. Handing the scene straight in lets the same pointer, the same
   * halo and the same highlight run there instead of a second, lesser
   * implementation.
   */
  scene?: Lesson["scenes"][number];
  stageRef: RefObject<HTMLDivElement | null>;
  channel: NarrationChannel;
  playing: boolean;
  /** The studio switch; off means the lesson plays with no dot at all. */
  enabled: boolean;
  /** `r,g,b` triple painted onto the stage's `--pointer-rgb` variable. */
  colorRgb: string;
}) {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef("");
  /** Last resolved anchor, so a sentence that matches nothing holds position. */
  const heldRef = useRef<{ scene: number; target: string } | null>(null);
  /** Cached sentence split, rebuilt only when the scene or its timings change. */
  const alignedRef = useRef<{ key: string; sentences: AlignedSentence[] } | null>(null);
  // Mirrored so the loop sees a toggle without resubscribing: the effect above
  // deliberately depends on stable handles only.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // The colour lives on the stage, not on the dot: the dot, the ring and the
  // target wash all read the same `--pointer-rgb` variable from CSS, so one
  // paint here re-tints all three without touching the keyframes.
  useEffect(() => {
    stageRef.current?.style.setProperty("--pointer-rgb", colorRgb);
  }, [stageRef, colorRgb]);

  useEffect(() => {
    let frame = 0;

    const selectorFor = (target: string): string => {
      if (target === "title") return ".scene-title";
      if (target === "subtitle") return ".scene-sub";
      if (target === "formula") return ".scene-formula";
      if (target === "table") return ".scene-table";
      if (target === "chart") return ".scene-data";
      if (target === "graph") return ".scene-graph";
      if (target === "image") return ".scene-image";
      if (target === "quiz") return ".scene-quiz";
      return ".scene-title";
    };

    const resolveTarget = (article: HTMLElement, target: string): HTMLElement | null => {
      if (target.startsWith("bullet-")) {
        const index = Number(target.slice("bullet-".length));
        const bullets = article.querySelectorAll<HTMLElement>(".scene-bullet");
        return bullets[Number.isFinite(index) ? index : 0] ?? null;
      }
      if (target.startsWith("step-")) {
        const index = Number(target.slice("step-".length));
        const steps = article.querySelectorAll<HTMLElement>(".scene-step");
        return steps[Number.isFinite(index) ? index : 0] ?? null;
      }
      return article.querySelector<HTMLElement>(selectorFor(target));
    };

    const paint = () => {
      frame = requestAnimationFrame(paint);
      const stage = stageRef.current;
      const dot = dotRef.current;
      const ring = ringRef.current;
      if (!stage || !dot || !ring) return;

      const live = channel.live;
      const hide = () => {
        if (stateRef.current !== "hidden") {
          stateRef.current = "hidden";
          dot.style.opacity = "0";
          ring.style.opacity = "0";
          stage.querySelectorAll('[data-pointer="on"]').forEach((node) => {
            node.removeAttribute("data-pointer");
          });
        }
      };

      if (!playing || !live) {
        hide();
        return;
      }
      // Switched off in the studio: clear any parked wash and stay out.
      // Checked inside the loop (not as an early component return) so the
      // rAF handle is still cleaned up by the single effect below.
      if (!enabledRef.current) {
        hide();
        return;
      }
      const deckScene = scene ?? lesson.scenes[live.sceneIndex];
      if (!deckScene?.narration) {
        hide();
        return;
      }

      // The sentence the voice is inside — the exact rule the caption uses
      // (last timed sentence at or before now; parked on the first when the
      // voice never measured one), so pointer and caption cannot disagree.
      const narration = deckScene.narration;
      const marks = channel.words.get(live.sceneIndex) ?? [];
      const cacheKey = `${deckScene.id}:${narration.length}:${marks.length}`;
      let aligned = alignedRef.current;
      if (!aligned || aligned.key !== cacheKey) {
        aligned = { key: cacheKey, sentences: alignSentences(narration, marks) };
        alignedRef.current = aligned;
      }
      const sentences = aligned.sentences;
      let sentence = 0;
      if (sentences.length > 1) {
        let chosen = -1;
        for (let i = 0; i < sentences.length; i += 1) {
          const start = sentences[i].start;
          if (start === null) continue;
          if (start <= live.time) chosen = i;
          else break;
        }
        if (chosen !== -1) sentence = chosen;
      }
      const sentenceText =
        sentences[sentence]?.text ?? splitSentences(narration)[sentence] ?? narration;

      // A single-scene surface (the classroom, the premiere) paints one slide
      // and numbers it 0, because it has no deck to index into.
      const domIndex = scene ? 0 : live.sceneIndex;
      const article = stage.querySelector<HTMLElement>(`[data-scene="${domIndex}"]`);
      if (!article) {
        hide();
        return;
      }

      // 1) The sentence's own words pick the part.
      let node = matchContent(article, sentenceText);
      let targetKey = node?.dataset.pointerKey ?? null;
      let label: string | undefined;

      // 2) Nothing matches: the AI cue for this exact sentence, if it names a
      // part this scene actually shows.
      if (!node) {
        const cue = deckScene.pointer?.[sentence];
        if (cue) {
          const cueNode = resolveTarget(article, cue.target);
          if (cueNode) {
            node = cueNode;
            targetKey = cue.target;
            label = cue.label;
          }
        }
      }

      // 3) Still nothing: hold the last position on this scene rather than
      // jumping home to the title mid-slide. A pointer that leaps away reads
      // as broken; one that stays reads as emphasis.
      if (!node && heldRef.current?.scene === live.sceneIndex) {
        const heldNode = resolveTarget(article, heldRef.current.target);
        if (heldNode) {
          node = heldNode;
          targetKey = heldRef.current.target;
        }
      }

      // 4) First anchor of the scene: the title.
      if (!node) {
        node = article.querySelector<HTMLElement>(".scene-title");
        targetKey = "title";
      }
      if (!node || !targetKey) {
        hide();
        return;
      }
      heldRef.current = { scene: live.sceneIndex, target: targetKey };

      const stageBox = stage.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      // Off-screen scenes (the next slide pre-laid-out at opacity 0) report a
      // box; pointing at one would float the dot over empty paper.
      if (box.width === 0 && box.height === 0) {
        hide();
        return;
      }
      const x = box.left - stageBox.left;
      const y = box.top - stageBox.top;

      dot.style.opacity = "1";
      ring.style.opacity = "1";
      // The dot sits on the target's left edge, vertically centred; the ring
      // frames the whole target. Both are positioned in stage space so they
      // survive the slide's own GSAP transforms.
      dot.style.transform = `translate(${x - 14}px, ${y + box.height / 2 - 9}px)`;
      ring.style.transform = `translate(${x - 8}px, ${y - 8}px)`;
      ring.style.width = `${box.width + 16}px`;
      ring.style.height = `${box.height + 16}px`;

      const key = `${live.sceneIndex}:${sentence}:${targetKey}`;
      if (stateRef.current !== key) {
        stateRef.current = key;
        stage.querySelectorAll('[data-pointer="on"]').forEach((el) => {
          if (el !== node) el.removeAttribute("data-pointer");
        });
        node.setAttribute("data-pointer", "on");
        ring.dataset.label = label ?? "";
      }
    };

    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [lesson, stageRef, channel, playing]);

  return (
    <>
      <div
        ref={ringRef}
        aria-hidden="true"
        className="scene-pointer-ring pointer-events-none absolute left-0 top-0 z-10 opacity-0 transition-opacity duration-300"
      />
      <div
        ref={dotRef}
        aria-hidden="true"
        className="scene-pointer-dot pointer-events-none absolute left-0 top-0 z-10 opacity-0 transition-opacity duration-300"
      >
        <span className="block h-[18px] w-[18px] rounded-full" />
      </div>
    </>
  );
}

interface ContentCandidate {
  key: string;
  node: HTMLElement;
  text: string;
  /** Specific parts outrank the title on a tied score. */
  rank: number;
}

/**
 * The slide part the sentence is actually about, via shared content words
 * (see `lib/pointer-match.ts`). Thin DOM wrapper: builds the candidates from
 * the rendered article, then tags the winning node so the player can hold it.
 */
function matchContent(article: HTMLElement, sentenceText: string): HTMLElement | null {
  const nodes = new Map<string, HTMLElement>();
  const candidates: ContentCandidate[] = [];
  const push = (key: string, node: HTMLElement | null, rank: number) => {
    if (node?.textContent) {
      nodes.set(key, node);
      candidates.push({ key, node, text: node.textContent, rank });
    }
  };
  push("title", article.querySelector<HTMLElement>(".scene-title"), 0);
  push("subtitle", article.querySelector<HTMLElement>(".scene-sub"), 1);
  article.querySelectorAll<HTMLElement>(".scene-bullet").forEach((bullet, index) => {
    push(`bullet-${index}`, bullet, 2);
  });
  article.querySelectorAll<HTMLElement>(".scene-step").forEach((step, index) => {
    push(`step-${index}`, step, 2);
  });
  const extra: Array<[string, string]> = [
    ["formula", ".scene-formula"],
    ["table", ".scene-table"],
    ["chart", ".scene-data"],
    ["graph", ".scene-graph"],
    ["image", ".scene-image"],
    ["quiz", ".scene-quiz"],
  ];
  for (const [key, selector] of extra) {
    push(key, article.querySelector<HTMLElement>(selector), 2);
  }
  const winner = scoreCandidates(candidates, sentenceText);
  if (!winner) return null;
  const node = nodes.get(winner) ?? null;
  if (node) node.dataset.pointerKey = winner;
  return node;
}
