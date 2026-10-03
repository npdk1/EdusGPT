"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { SCENE_KIND_LABEL, type Lesson } from "@/lib/lesson/types";
import { slideIcon } from "@/lib/lesson/slide-icons";
import {
  DEFAULT_SLIDE_THEME,
  isDarkTheme,
  paletteStyle,
} from "@/lib/lesson/themes";
import {
  FigureZoom,
  FunctionGraph,
  SceneDataChart,
  SceneFormula,
  SceneTable,
  SlideImageView,
} from "./SceneFigure";
import { InteractiveQuiz } from "./InteractiveQuiz";
import { InteractiveSimulation } from "./InteractiveSimulation";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * One slide, drawn the way the full player draws it.
 *
 * The classroom used to show a wall of text where a slide should be: the
 * title, the subtitle and one line per sentence of the narration. That is a
 * transcript, not a slide — no paper, no kicker, no page number, no picture
 * column. This is the same markup, the same container-query sizing and the same
 * "shrink to fit" pass the player runs, lifted out of the GSAP timeline so both
 * places can show a slide and stay in step. The full player still owns its own
 * copy inside `GsapSlideStage`, because that one is driven by a timeline rather
 * than by React; when a slide's markup changes, this is the file to change.
 */
export function SlideSurface({
  scene,
  index,
  lessonId,
  theme,
  caption,
  className = "",
}: {
  scene: Lesson["scenes"][number];
  /** Zero-based deck position, for the page number in the corner. */
  index: number;
  /** Stable deck id — the picture seed, exactly as the saved lesson's. */
  lessonId: string;
  /** Slide theme id; the classroom plays the default paper. */
  theme?: string | null;
  /** Karaoke caption, pinned to the band the slide reserves at the bottom. */
  caption?: ReactNode;
  className?: string;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const KickerIcon = slideIcon(scene.icon);

  // The player's fit pass: a slide with more text than its paper can hold is
  // scaled down to fit rather than allowed to run off the bottom, which is what
  // happened before a caption bar was added under every slide.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const fit = () => {
      stage.querySelectorAll<HTMLElement>(".scene-card").forEach((card) => {
        const content = card.querySelector<HTMLElement>(".scene-fit");
        if (!content) return;
        content.style.transform = "none";
        content.style.width = "";
        const style = getComputedStyle(card);
        const available =
          card.clientHeight -
          parseFloat(style.paddingTop) -
          parseFloat(style.paddingBottom);
        const natural = content.getBoundingClientRect().height;
        if (natural <= available || available <= 0) return;
        const scale = Math.max(0.6, (available * 0.98) / natural);
        content.style.transformOrigin = "top center";
        content.style.transform = `scale(${scale})`;
      });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [scene]);

  return (
    <div
      className={`slide-fitted overflow-hidden ${className}`}
      data-theme={theme ?? DEFAULT_SLIDE_THEME}
      data-theme-dark={isDarkTheme(theme) ? "" : undefined}
      style={paletteStyle(theme)}
    >
      {/* Fills the paper, which owns the 16:9 box the cqw units measure. */}
      <div ref={stageRef} className="absolute inset-0">
        <div className="scene-card relative flex h-full flex-col overflow-hidden">
          <div className="scene-fit">
            <header className="relative z-10 w-full max-w-[86%]">
              <span className="scene-kicker">
                {KickerIcon ? (
                  <KickerIcon className="scene-kicker-icon" aria-hidden="true" />
                ) : null}
                {SCENE_KIND_LABEL[scene.kind]}
              </span>
              <h3 className="scene-title mt-[2.5%] text-balance font-bold tracking-tight">
                {scene.title}
              </h3>
              {scene.subtitle ? (
                <p className="scene-sub mt-[2%]">{scene.subtitle}</p>
              ) : null}
              <hr className="scene-rule mt-[3%]" />
            </header>

            {scene.bullets.length > 0 ? (
              <ul className="scene-body relative z-10 grid w-full max-w-[86%] gap-x-[6%] sm:grid-cols-2">
                {scene.bullets.map((bullet, bulletIndex) => (
                  <li
                    key={bullet}
                    className="scene-bullet flex items-baseline gap-[1.5cqw] leading-relaxed"
                  >
                    <span className="scene-bullet-index tabular-nums">
                      {pad2(bulletIndex + 1)}
                    </span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {scene.steps?.length ? (
              <ol className="scene-steps relative z-10 grid w-full max-w-[86%] gap-x-[6%] sm:grid-cols-2">
                {scene.steps.map((step, stepIndex) => (
                  <li
                    key={step}
                    className="scene-step flex items-baseline gap-[1.5cqw] leading-relaxed"
                  >
                    <span className="scene-step-index tabular-nums">
                      B{stepIndex + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            ) : null}

            {scene.kind === "simulation3d" || scene.simulation3d ? (
              <div className="relative z-10 my-2 max-w-xl">
                <InteractiveSimulation config={scene.simulation3d} />
              </div>
            ) : null}

            {scene.kind === "quiz" && scene.quiz ? (
              <div className="relative z-10 my-2 max-w-2xl">
                <InteractiveQuiz
                  question={scene.quiz.question}
                  options={scene.quiz.options}
                />
              </div>
            ) : null}

            {scene.formula ? (
              <FigureZoom label="Phóng to công thức">
                <SceneFormula formula={scene.formula} />
              </FigureZoom>
            ) : null}
            {scene.table ? <SceneTable table={scene.table} /> : null}
            {scene.data?.length ? (
              <SceneDataChart data={scene.data} title="Số liệu" />
            ) : null}
            {scene.graph ? (
              <FigureZoom label={`Phóng to ${scene.graph.title ?? "đồ thị"}`}>
                <FunctionGraph graph={scene.graph} />
              </FigureZoom>
            ) : null}

            <SlideImageView lessonId={lessonId} scene={scene} />
          </div>

          {/* Outside .scene-fit: the fit pass scales that block, and a page
              number that shrank with the text would stop being a page number. */}
          <span
            aria-hidden
            className="scene-watermark pointer-events-none absolute bottom-[4%] right-[6%] font-mono tabular-nums"
          >
            {pad2(index + 1)}
          </span>

          {caption ? (
            <div
              className="pointer-events-none absolute inset-x-0 z-20 flex justify-center px-[4%] transition-opacity duration-200"
              style={{ bottom: "calc(var(--slide-caption-track) * 0.12)" }}
            >
              {caption}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}