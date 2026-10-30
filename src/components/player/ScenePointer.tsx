"use client";

import { useEffect, useRef, type RefObject } from "react";
import {
  alignSentences,
  splitSentences,
  type AlignedSentence,
  type NarrationChannel,
} from "@/lib/karaoke";
import { scoreCandidates, splitGrammaticalSentences, type PointerCandidate } from "@/lib/pointer-match";
import type { Lesson } from "@/lib/lesson/types";

/**
 * The teacher's pointer: a dynamic laser dot and highlight frame that holds on the slide part being read.
 *
 * It synchronizes with the narration using a multi-signal architecture:
 * 1. Full Grammatical Sentence Context: Resolves each karaoke caption fragment to its full
 *    grammatical sentence so the matcher sees the complete domain concept (e.g. "Sao Mộc xa nhất").
 * 2. Discriminative Scoring (IDF + Bigrams): Identifies distinct keywords ("Sao Mộc", "1,5 đơn vị")
 *    with high discriminative weights, preventing false matches on ubiquitous words like "Mặt Trời" or "nằm".
 * 3. AI Cue Reinforcement: Respects author/AI-generated pointer targets as strong semantic priors.
 * 4. Temporal Progression: Maintains smooth forward continuity across the slide.
 * 5. Adaptive Anchor Positioning: Aligns with inner index pills (e.g. "01", "02", "B1") and hugs cards
 *    without overflowing into adjacent grid columns.
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
  scene?: Lesson["scenes"][number];
  stageRef: RefObject<HTMLDivElement | null>;
  channel: NarrationChannel;
  playing: boolean;
  enabled: boolean;
  colorRgb: string;
}) {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const pingRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef("");
  const heldRef = useRef<{ scene: number; target: string } | null>(null);
  const alignedRef = useRef<{ key: string; sentences: AlignedSentence[]; fullSentences: string[] } | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

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
      if (target === "quiz") return ".scene-interactive-quiz, .scene-quiz";
      if (target === "sim" || target === "simulation") return ".scene-sim, .scene-interactive-panel";
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
      const ping = pingRef.current;
      if (!stage || !dot || !ring) return;

      const live = channel.live;
      const hide = () => {
        if (stateRef.current !== "hidden") {
          stateRef.current = "hidden";
          dot.style.opacity = "0";
          ring.style.opacity = "0";
          ping?.classList.remove("scene-pointer-ping-on");
          stage.querySelectorAll('[data-pointer="on"]').forEach((node) => {
            node.removeAttribute("data-pointer");
          });
        }
      };

      if (!playing || !live || !enabledRef.current) {
        hide();
        return;
      }

      const deckScene = scene ?? lesson.scenes[live.sceneIndex];
      if (!deckScene?.narration) {
        hide();
        return;
      }

      const narration = deckScene.narration;
      const marks = channel.words.get(live.sceneIndex) ?? [];
      const cacheKey = `${deckScene.id}:${narration.length}:${marks.length}`;
      let aligned = alignedRef.current;
      if (!aligned || aligned.key !== cacheKey) {
        aligned = {
          key: cacheKey,
          sentences: alignSentences(narration, marks),
          fullSentences: splitGrammaticalSentences(narration),
        };
        alignedRef.current = aligned;
      }

      const sentences = aligned.sentences;
      const fullSentences = aligned.fullSentences;

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

      // Map caption slice to its parent full grammatical sentence
      const sliceText = sentences[sentence]?.text ?? splitSentences(narration)[sentence] ?? narration;
      let fullSentenceIndex = 0;
      if (fullSentences.length > 1) {
        const trimmedSlice = sliceText.trim();
        const foundIdx = fullSentences.findIndex((full) => full.includes(trimmedSlice));
        if (foundIdx !== -1) {
          fullSentenceIndex = foundIdx;
        } else {
          fullSentenceIndex = Math.min(
            fullSentences.length - 1,
            Math.floor((sentence / Math.max(1, sentences.length)) * fullSentences.length),
          );
        }
      }
      const fullSentenceText = fullSentences[fullSentenceIndex] ?? narration;

      // Single-scene surfaces (classroom, premiere) paint slide 0
      const domIndex = scene ? 0 : live.sceneIndex;
      const article = stage.querySelector<HTMLElement>(`[data-scene="${domIndex}"]`);
      if (!article) {
        hide();
        return;
      }

      // AI-generated cue for this full sentence
      const cue = deckScene.pointer?.[fullSentenceIndex] ?? deckScene.pointer?.[Math.min(fullSentenceIndex, (deckScene.pointer?.length ?? 1) - 1)];

      // 1) Match using discriminative algorithm with full sentence text + cue signal
      let node = matchContent(
        article,
        fullSentenceText,
        deckScene,
        cue?.target,
        heldRef.current?.scene === live.sceneIndex ? heldRef.current.target : null,
      );
      let targetKey = node?.dataset.pointerKey ?? null;
      let label: string | undefined = cue?.label;

      // 2) Cue fallback if content matcher returned null
      if (!node && cue) {
        const cueNode = resolveTarget(article, cue.target);
        if (cueNode) {
          node = cueNode;
          targetKey = cue.target;
          label = cue.label;
        }
      }

      // 3) Hold previous position on this scene rather than jumping backwards
      if (!node && heldRef.current?.scene === live.sceneIndex) {
        const heldNode = resolveTarget(article, heldRef.current.target);
        if (heldNode) {
          node = heldNode;
          targetKey = heldRef.current.target;
        }
      }

      // 4) Initial anchor: title
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
      if (box.width === 0 && box.height === 0) {
        hide();
        return;
      }

      const x = box.left - stageBox.left;
      const y = box.top - stageBox.top;

      // Anchor calculation: locate the inner element (e.g. index badge "01", "02", "B1")
      const anchorNode = node.querySelector<HTMLElement>(
        ".scene-bullet-index, .scene-step-index, .scene-kicker, h3, h2, p",
      );
      const anchorBox = anchorNode ? anchorNode.getBoundingClientRect() : box;

      let dotX = x - 14;
      let dotY = y + box.height / 2 - 7;

      if (anchorNode && anchorBox.width > 0 && anchorBox.height > 0) {
        dotY = anchorBox.top - stageBox.top + anchorBox.height / 2 - 7;
        const proposedDotX = anchorBox.left - stageBox.left - 16;
        dotX = proposedDotX < x - 16 ? x - 14 : proposedDotX;
      }

      dot.style.opacity = "1";
      ring.style.opacity = "1";

      dot.style.transform = `translate(${dotX}px, ${dotY}px)`;
      ring.style.transform = `translate(${x - 4}px, ${y - 4}px)`;
      ring.style.width = `${box.width + 8}px`;
      ring.style.height = `${box.height + 8}px`;

      const key = `${live.sceneIndex}:${fullSentenceIndex}:${targetKey}`;
      if (stateRef.current !== key) {
        stateRef.current = key;
        stage.querySelectorAll('[data-pointer="on"]').forEach((el) => {
          if (el !== node) el.removeAttribute("data-pointer");
        });
        node.setAttribute("data-pointer", "on");
        ring.dataset.label = label ?? "";

        if (ping) {
          ping.style.left = `${x - 4}px`;
          ping.style.top = `${y - 4}px`;
          ping.style.width = `${box.width + 8}px`;
          ping.style.height = `${box.height + 8}px`;
          ping.classList.remove("scene-pointer-ping-on");
          void ping.offsetWidth;
          ping.classList.add("scene-pointer-ping-on");
        }
      }
    };

    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [lesson, stageRef, channel, playing]);

  return (
    <>
      <div
        ref={pingRef}
        aria-hidden="true"
        className="scene-pointer-ping pointer-events-none absolute left-0 top-0 z-10"
      />
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
        <span className="block h-[14px] w-[14px] rounded-full" />
      </div>
    </>
  );
}

interface ContentCandidate extends PointerCandidate {
  node: HTMLElement;
}

/**
 * Builds candidate targets from rendered slide DOM and selects the winning element
 * via discriminative token & bigram scoring.
 */
function matchContent(
  article: HTMLElement,
  sentenceText: string,
  scene?: Lesson["scenes"][number],
  cueTarget?: string | null,
  previousTarget?: string | null,
): HTMLElement | null {
  const nodes = new Map<string, HTMLElement>();
  const candidates: ContentCandidate[] = [];

  const push = (key: string, node: HTMLElement | null, rank: number, overrideText?: string) => {
    const text = overrideText ?? node?.textContent;
    if (node && text && text.trim().length > 0) {
      nodes.set(key, node);
      candidates.push({ key, node, text: text.trim(), rank });
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
    ["quiz", ".scene-interactive-quiz, .scene-quiz"],
    ["sim", ".scene-sim, .scene-interactive-panel"],
  ];
  for (const [key, selector] of extra) {
    push(key, article.querySelector<HTMLElement>(selector), 2);
  }

  // Image candidate enriched with prompt/description
  const imageNode = article.querySelector<HTMLElement>(".scene-image");
  if (imageNode) {
    const imgDesc = [
      imageNode.textContent ?? "",
      scene?.imagePrompt ?? "",
      scene?.visualNote ?? "",
      "hình ảnh minh hoạ sơ đồ",
    ]
      .filter(Boolean)
      .join(" ");
    push("image", imageNode, 2, imgDesc);
  }

  const winner = scoreCandidates(candidates, sentenceText, { cueTarget, previousTarget });
  if (!winner) return null;

  const node = nodes.get(winner) ?? null;
  if (node) node.dataset.pointerKey = winner;
  return node;
}
