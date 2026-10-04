"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  SCENE_KIND_LABEL,
  SLIDE_GRID,
  defaultSlideLayout,
  type Lesson,
  type SlideBlock,
  type SlideLayout,
} from "@/lib/lesson/types";
import { slideIcon } from "@/lib/lesson/slide-icons";
import { sanitizeBlocks } from "@/lib/lesson/validate";
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
import { InlineText } from "./InlineText";
import { ScenePointer } from "./ScenePointer";
import { pointerColorToRgb } from "@/lib/lesson/pollinations";
import {
  createNarrationChannel,
  type NarrationChannel,
} from "@/lib/karaoke";
import { useCopy } from "@/i18n/provider";

const COPY = {
  en: {
    zoom: "Zoom",
    zoomFormula: "Zoom the formula",
    graphFallback: "the graph",
    dataTitle: "Data",
  },
  vi: {
    zoom: "Phóng to",
    zoomFormula: "Phóng to công thức",
    graphFallback: "đồ thị",
    dataTitle: "Số liệu",
  },
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * The type ladder, walked from the top.
 *
 * The old fit pass multiplied the whole slide by a factor and let it be, which
 * shrank the hairlines and the letter spacing along with the words — a crowded
 * slide looked squeezed rather than smaller. Stepping one multiplier that only
 * the type sizes read keeps every rule and border at its own size, and choosing
 * the first step that fits is a lookup over a type scale, which is what a
 * designer does by hand.
 *
 * The steps are close enough (about a tenth apart) to read as one system, and
 * the floor is where a slide stops being legible at classroom distance rather
 * than where the arithmetic runs out.
 *
 * It reaches well past what a slide of prose needs, because the steps that
 * matter are the crowded ones: a slide carrying a title, a few bullets, a board
 * solution and a picture has to land somewhere inside the paper, and a ladder
 * that stopped at 0.7 left the picture with nowhere to go but the caption.
 */
const FIT_STEPS = [1, 0.94, 0.88, 0.82, 0.76, 0.7, 0.64, 0.58, 0.52] as const;

/**
 * One slide, drawn the way the full player draws it.
 *
 * The classroom used to show a wall of text where a slide should be: the
 * title, the subtitle and one line per sentence of the narration. That is a
 * transcript, not a slide — no paper, no kicker, no page number, no picture
 * column. This is the same markup, the same container-query sizing and the same
 * fit pass the player runs, lifted out of the GSAP timeline so both places can
 * show a slide and stay in step. The full player still owns its own copy inside
 * `GsapSlideStage`, because that one is driven by a timeline rather than by
 * React; when a slide's markup changes, this is the file to change.
 */
export function SlideSurface({
  scene,
  index,
  lessonId,
  theme,
  caption,
  channel,
  playing,
  pointerColor,
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
  /**
   * The shared voice channel. Given one, the slide points at the part it is
   * reading and warming the line under it - the same run the full player uses, so a slide
   * behaves the same wherever it is shown.
   */
  channel?: NarrationChannel;
  /** Whether the voice is actually reading right now. */
  playing?: boolean;
  /** Pointer colour, hex; the slide's default amber is used when absent. */
  pointerColor?: string;
  className?: string;
}) {
  const t = useCopy(COPY);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const KickerIcon = slideIcon(scene.icon);
  // The pointer needs a voice channel whether or not one was passed: a slide
  // shown on its own has nothing to read, and a fresh channel simply never
  // reports a playhead.
  const silentChannel = useRef<NarrationChannel>(createNarrationChannel());
  const voice = channel ?? silentChannel.current;

  const hasFigure = Boolean(
    scene.formula ||
      scene.table ||
      scene.data?.length ||
      scene.graph ||
      scene.simulation3d ||
      (scene.kind === "quiz" && scene.quiz) ||
      (scene.imagePrompt ?? "").trim() ||
      (scene.imageQuery ?? "").trim(),
  );
  // A scene with no picture cannot be an "image beside the text" slide; asking
  // for one would leave the room the renderer reserved empty.
  const requested: SlideLayout =
    scene.layout && typeof scene.layout === "string"
      ? (scene.layout as SlideLayout)
      : defaultSlideLayout(scene);
  const layout: SlideLayout =
    (requested === "image-left" || requested === "image-right") && !hasFigure
      ? "statement"
      : requested;
  const split = layout === "image-left" || layout === "image-right";

  /**
   * Free layout: when the scene brings its own geometry, that geometry is the
   * slide and the named layout is only there to pick the wash.
   *
   * The title is the one thing a slide cannot do without, so a set of blocks
   * that forgot it gets the scene's own title dropped in at the top — a missing
   * headline is a hole in the page, and the headline already exists.
   *
   * Sanitised here as well as at save time: a slide arriving over the live
   * stream never passed through `coerceLesson`, and a card with no words in it
   * or a block hanging off the canvas would otherwise reach the screen.
   */
  const placed: SlideBlock[] | null = (() => {
    const blocks = sanitizeBlocks(scene.blocks);
    if (!blocks?.length) return null;
    return blocks.some((block) => block.kind === "title")
      ? blocks
      : [
          {
            kind: "title" as const,
            x: 60,
            y: 40,
            w: 880,
            h: 90,
            text: scene.title,
          },
          ...blocks,
        ];
  })();

  /**
   * The fit pass: a slide with more text than its paper can hold steps the type
   * ladder down until it fits, rather than letting the last bullet run off the
   * bottom. The picture is part of the column and steps with it.
   *
   * Three things it has to get right. The height of the column *uncapped* —
   * `.scene-fit` is capped at the card's content box so nothing spills into the
   * caption track, and measuring the capped box would report every slide as
   * fitting. The picture's real height, because a remote image is nothing at
   * first paint and its full size a second later, so a pass that ran only on
   * mount measured a slide without its picture and stopped stepping. And the
   * last resort: a slide whose words fill the paper even at the floor keeps its
   * words and loses the picture, because a caption nobody can read is a worse
   * outcome than a slide without a photograph.
   */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const card = stage.querySelector<HTMLElement>(".scene-card");
    const content = card?.querySelector<HTMLElement>(".scene-fit");
    if (!card || !content) return;
    const picture = card.querySelector<HTMLElement>(".scene-image");
    const fit = () => {
      card.style.setProperty("--slide-fit", "1");
      card.removeAttribute("data-no-figure");
      card.removeAttribute("data-small-figure");
      const style = getComputedStyle(card);
      const available =
        card.clientHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom);
      content.style.maxHeight = "none";
      if (available <= 0) {
        content.style.maxHeight = "";
        return;
      }
      // Placed blocks bring their own geometry: they are boxes on the grid, so
      // what has to fit is the union of those boxes, not the container. Measuring
      // the container would always read as too tall and step the type down to its
      // floor for a slide that was already sized by hand.
      const measure = (): number => {
        if (!placed) return content.getBoundingClientRect().height;
        const boxes = Array.from(
          content.querySelectorAll<HTMLElement>(".scene-block"),
        ).map((box) => box.getBoundingClientRect());
        if (boxes.length === 0) return 0;
        const top = Math.min(...boxes.map((box) => box.top));
        const bottom = Math.max(...boxes.map((box) => box.bottom));
        return bottom - top;
      };
      for (const step of FIT_STEPS) {
        card.style.setProperty("--slide-fit", String(step));
        if (measure() <= available) break;
      }
      // Still too tall at the floor: give the picture a small size before
      // giving it up. A picture the reader can still make out is worth more
      // than a clean margin, and only a slide with no room at all loses it.
      if (picture && measure() > available) {
        card.setAttribute("data-small-figure", "true");
        if (measure() > available) {
          card.removeAttribute("data-small-figure");
          card.setAttribute("data-no-figure", "true");
        }
      }
      // Hand the cap back, so what is on screen is the bounded column.
      content.style.maxHeight = "";
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    // `load` does not bubble, so this is captured: one listener for every
    // picture the slide may grow, including the ones the fallback chain swaps in
    // later.
    content.addEventListener("load", fit, true);
    return () => {
      observer.disconnect();
      content.removeEventListener("load", fit, true);
    };
  }, [scene, layout, placed]);

  // The words. Kept apart from the figures so a layout can put them side by
  // side instead of stacked, which is the difference between a slide and a page.
  const text = (
    <>
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
              <InlineText text={bullet} />
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
              <InlineText text={step} />
            </li>
          ))}
        </ol>
      ) : null}
    </>
  );

  // The evidence: a formula, a table, a chart, a graph, a quiz, a simulation —
  // or the picture the scene asked for.
  const figure = (
    <>
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
        <FigureZoom label={t.zoomFormula}>
          <SceneFormula formula={scene.formula} />
        </FigureZoom>
      ) : null}
      {scene.table ? <SceneTable table={scene.table} /> : null}
      {scene.data?.length ? (
        <SceneDataChart data={scene.data} title={t.dataTitle} />
      ) : null}
      {scene.graph ? (
        <FigureZoom label={`${t.zoom} ${scene.graph.title ?? t.graphFallback}`}>
          <FunctionGraph graph={scene.graph} />
        </FigureZoom>
      ) : null}

      <SlideImageView lessonId={lessonId} scene={scene} />
    </>
  );

  const head = (
    <header className="scene-head relative z-10 w-full max-w-[86%]">
      <span className="scene-kicker">
        {KickerIcon ? (
          <KickerIcon className="scene-kicker-icon" aria-hidden="true" />
        ) : null}
        {SCENE_KIND_LABEL[scene.kind]}
      </span>
      <h3 className="scene-title mt-[2.5%] text-balance font-bold tracking-tight">
        <InlineText text={scene.title} />
      </h3>
      {scene.subtitle ? (
        <p className="scene-sub mt-[2%]">
          <InlineText text={scene.subtitle} />
        </p>
      ) : null}
      <hr className="scene-rule mt-[3%]" />
    </header>
  );

  const renderBlock = (block: SlideBlock, blockIndex: number): ReactNode => {
    switch (block.kind) {
      case "title":
        return <h3 className="scene-block-title"><InlineText text={block.text ?? ""} /></h3>;
      case "subtitle":
        return <p className="scene-block-sub"><InlineText text={block.text ?? ""} /></p>;
      case "card":
        return (
          <>
            {block.label ? (
              <span className="scene-block-label">{block.label}</span>
            ) : null}
            <InlineText text={block.text ?? ""} className="scene-block-text" />
          </>
        );
      case "formula":
        return <SceneFormula formula={block.text ?? ""} />;
      // A plain panel and a plain line: geometry with no words of its own, so
      // other blocks can sit on top of one. This is what lets a card hold a
      // heading, or a rule divide two halves, instead of every box being a
      // rectangle of text.
      case "shape":
        return <span className="scene-block-shape" />;
      case "rule":
        return <span className="scene-block-rule" />;
      case "image":
        return (
          <SlideImageView
            lessonId={lessonId}
            scene={{
              ...scene,
              id: `${scene.id}-b${blockIndex}`,
              title: block.label ?? scene.title,
              imagePrompt: block.imagePrompt,
              imageQuery: block.imageQuery,
            }}
          />
        );
      default:
        return <p className="scene-block-text"><InlineText text={block.text ?? ""} /></p>;
    }
  };

  return (
    <div
      className={`slide-fitted overflow-hidden ${className}`}
      data-theme={theme ?? DEFAULT_SLIDE_THEME}
      data-theme-dark={isDarkTheme(theme) ? "" : undefined}
      style={paletteStyle(theme)}
    >
      {/* Fills the paper, which owns the 16:9 box the cqw units measure. */}
      <div ref={stageRef} className="absolute inset-0">
        {/*
         * `key={scene.id}` is what makes the room feel like it turned a page:
         * React remounts the card when the scene changes, so the entrance
         * animation runs once per slide instead of only on the first one. A
         * class on the card would have run exactly once and never again.
         */}
        <div
          key={scene.id}
          data-scene="0"
          className={`scene-card scene-enter scene-on-${layout} relative flex h-full flex-col overflow-hidden`}
        >
          {/* The tinted corner behind the content. Empty on purpose: it is
              paint, not content, and the layout class on the card picks its
              direction from the palette. */}
          <div aria-hidden="true" className="scene-wash" />
          <div
            className={`scene-fit ${
              placed ? "scene-layout-blocks" : `scene-layout-${layout}`
            }`}
          >
            {placed ? (
              <div className="scene-blocks">
                {placed.map((block, blockIndex) => (
                  <div
                    key={`${block.kind}-${blockIndex}`}
                    className={`scene-block scene-block-${block.kind}`}
                    style={{
                      left: `${(block.x / SLIDE_GRID.width) * 100}%`,
                      top: `${(block.y / SLIDE_GRID.height) * 100}%`,
                      width: `${(block.w / SLIDE_GRID.width) * 100}%`,
                      height: `${(block.h / SLIDE_GRID.height) * 100}%`,
                    }}
                  >
                    {renderBlock(block, blockIndex)}
                  </div>
                ))}
              </div>
            ) : (
              <>
            {layout === "spotlight" || layout === "quote" ? (
              // Pure decoration behind the claim: a ring for one big idea, a
              // soft disc for a quotation. Drawn, not content.
              <div
                aria-hidden="true"
                className={`scene-ornament scene-ornament-${layout}`}
              />
            ) : null}
            {head}
            {split ? (
              <div className="scene-split relative z-10 grid w-full max-w-[86%] items-start gap-x-[5%] sm:grid-cols-2">
                {layout === "image-left" ? (
                  <>
                    <figure className="scene-split-figure">{figure}</figure>
                    <div className="scene-split-text">{text}</div>
                  </>
                ) : (
                  <>
                    <div className="scene-split-text">{text}</div>
                    <figure className="scene-split-figure">{figure}</figure>
                  </>
                )}
              </div>
            ) : layout === "full-figure" ? (
              <>
                {figure}
                {text}
              </>
            ) : (
              <>
                {text}
                {figure}
              </>
            )}
              </>
            )}
          </div>

          {/* Outside .scene-fit: the fit pass sizes that block's type, and a
              page number that shrank with the text would stop being a page
              number. */}
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

          {channel ? (
            <ScenePointer
              scene={scene}
              // One scene is the whole deck from here: the pointer resolves its
              // target inside the slide it is handed, not in a deck it walks.
              lesson={{ scenes: [scene] } as Lesson}
              stageRef={stageRef}
              channel={voice}
              playing={Boolean(playing)}
              enabled
              colorRgb={pointerColorToRgb(pointerColor)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}