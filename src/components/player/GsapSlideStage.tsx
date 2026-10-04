"use client";

import { useEffect, useRef } from "react";
import { ensureGsap } from "@/lib/gsap";
import type { Timebase } from "@/hooks/useTimebase";
import { SCENE_KIND_LABEL, type Lesson } from "@/lib/lesson/types";
import { slideIcon } from "@/lib/lesson/slide-icons";
import { DEFAULT_SLIDE_THEME, isDarkTheme, paletteStyle } from "@/lib/lesson/themes";
import { InteractiveSimulation } from "./InteractiveSimulation";
import { InteractiveQuiz } from "./InteractiveQuiz";
import { InlineText } from "./InlineText";
import { SceneDataChart, SceneFormula, SceneTable, SlideImageView, SlideImagePreload, FunctionGraph, FigureZoom } from "./SceneFigure";
import { KaraokeSubtitle } from "./KaraokeSubtitle";
import { ScenePointer } from "./ScenePointer";
import { pointerColorToRgb } from "@/lib/lesson/pollinations";
import { formatClock } from "@/lib/format";
import type { NarrationChannel } from "@/lib/karaoke";
import { useCopy } from "@/i18n/provider";

const COPY = {
  en: {
    stageTimeline: "Timeline",
    stageScene: "Scene",
    stagePlaying: "playing",
    stageRewinding: "back",
    stageForwarding: "forward",
    stagePaused: "paused",
    stageDataTitle: "Data",
    zoomFormula: "Zoom the formula",
    zoom: "Zoom",
    zoomGraph: "the graph",
  },
  vi: {
    stageTimeline: "Dòng thời gian",
    stageScene: "cảnh",
    stagePlaying: "đang phát",
    stageRewinding: "tua lui",
    stageForwarding: "tua tới",
    stagePaused: "tạm dừng",
    stageDataTitle: "Số liệu",
    zoomFormula: "Phóng to công thức",
    zoom: "Phóng to",
    zoomGraph: "đồ thị",
  },
};


interface GsapSlideStageProps {
  lesson: Lesson;
  timebase: Timebase;
  activeScene: number;
  /** The shared voice channel, so each slide can light up as it is read. */
  narration: NarrationChannel;
  /** The caption fades out when paused; a stopped deck is one being read. */
  playing: boolean;
}

/**
 * The seekable "film": every scene lives on one deterministic GSAP timeline
 * built exclusively from `fromTo` tweens, so scrubbing is exact in both
 * directions — rewind and replay never drift.
 *
 * Nothing here re-renders during playback: the playhead pushes straight into
 * `timeline.time()` and into plain DOM nodes.
 */
export function GsapSlideStage({
  lesson,
  timebase,
  activeScene,
  narration,
  playing,
}: GsapSlideStageProps) {
  const t = useCopy(COPY);
  const stageRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const directionRef = useRef<HTMLSpanElement>(null);
  /**
   * The playhead writes its status word straight into `directionRef` from a
   * subscription that is attached once and never re-attached. The dictionary
   * therefore travels through a ref: a language switch has to change the word
   * without re-running this effect and disturbing the timeline it follows.
   */
  const copyRef = useRef(t);
  useEffect(() => {
    copyRef.current = t;
  }, [t]);

  const activeSceneData = lesson.scenes[activeScene];

  // --- build the master timeline -------------------------------------------
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const gsap = ensureGsap();
    const scenes = Array.from(stage.querySelectorAll<HTMLElement>("[data-scene]"));
    if (scenes.length === 0) return;

    gsap.set(scenes, { autoAlpha: 0 });

    const tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });

    scenes.forEach((element, index) => {
      const scene = lesson.scenes[index];
      if (!scene) return;
      const at = scene.start;
      const card = element.querySelector(".scene-card");
      const title = element.querySelector(".scene-title");
      const subtitle = element.querySelector(".scene-sub");
      const bullets = element.querySelectorAll(".scene-bullet");
      const formula = element.querySelector(".scene-formula");
      const table = element.querySelector(".scene-table");
      const bar = element.querySelector(".scene-bar");

      /*
       * `immediateRender: false` on every intro tween, and the first scene is
       * pre-set to its end state below.
       *
       * A `fromTo` scheduled at time 0 renders as its *from* state when the
       * timeline is parked at 0 — which is where a deck sits until someone
       * presses play. Without this the first slide is a blank white rectangle,
       * with a header and a progress bar and nothing between them. Deferring
       * the tween's first render lets the "already there" state stand until
       * playback actually moves through it.
       */
      tl.set(element, { autoAlpha: 1, zIndex: 2 }, at)
        .set(element, { autoAlpha: 0, zIndex: 1 }, at + scene.duration - 0.001)
        .fromTo(
          card,
          { y: 26, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, immediateRender: false },
          at,
        )
        .fromTo(
          title,
          { yPercent: 60, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.55, immediateRender: false },
          at + 0.08,
        )
        .fromTo(
          subtitle,
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, immediateRender: false },
          at + 0.18,
        )
        .fromTo(
          bullets,
          { x: -18, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.5, stagger: 0.09, immediateRender: false },
          at + 0.3,
        );

      if (formula) {
        tl.fromTo(
          formula,
          { scale: 0.94, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.5,
            ease: "back.out(1.5)",
            immediateRender: false,
          },
          at + 0.45,
        );
      }
      if (table) {
        tl.fromTo(
          table,
          { y: 18, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.55,
            ease: "back.out(1.2)",
            immediateRender: false,
          },
          at + 0.5,
        );
      }
      // No tween for the narration: it now lives outside the scene articles, as
      // one fixed caption band for the whole deck. A per-scene fade here would
      // have restarted it from the top on every re-evaluation, which is exactly
      // what the running highlight must not do.
      if (bar) {
        tl.fromTo(
          bar,
          { scaleX: 0, transformOrigin: "left center" },
          { scaleX: 1, duration: scene.duration, ease: "none" },
          at,
        );
      }
    });

    tl.duration(Math.max(lesson.duration, tl.duration()));
    timelineRef.current = tl;
    tl.pause();

    // Force a render rather than a plain `time(t)`: seeking to the position the
    // timeline already sits at is a no-op, so nothing would be drawn.
    tl.render(Math.min(timebase.timeRef.current, tl.duration()), false, true);

    /*
     * Put the first scene in its finished state, *after* the render above.
     *
     * Two things have to be true for the opening slide to be readable, and they
     * fight: the intro tweens must not paint their "from" state when the
     * timeline is parked at 0 (where a deck sits until someone presses play),
     * and the deck must still be able to animate normally once it does play.
     *
     * `immediateRender: false` handles the tweens. This handles what they leave
     * behind — and it has to run after the render, because the render is what
     * walks the timeline's own `set`s. Set before it and the card tween, which
     * sits at position 0, paints over the finished state on the very next line.
     *
     * Seeking back to 0 later replays the intro as usual, which is the
     * behaviour a presenter expects.
     */
    const first = scenes[0];
    if (first) {
      const firstCard = first.querySelector(".scene-card");
      const firstTitle = first.querySelector(".scene-title");
      const firstSub = first.querySelector(".scene-sub");
      const firstBullets = first.querySelectorAll(".scene-bullet");
      const firstFigure = first.querySelector(".scene-formula, .scene-table");
      gsap.set(first, { autoAlpha: 1, zIndex: 2 });
      if (firstCard) gsap.set(firstCard, { y: 0, opacity: 1 });
      if (firstTitle) gsap.set(firstTitle, { yPercent: 0, opacity: 1 });
      if (firstSub) gsap.set(firstSub, { y: 0, opacity: 1 });
      if (firstBullets.length) gsap.set(firstBullets, { x: 0, opacity: 1 });
      if (firstFigure) {
        gsap.set(
          firstFigure,
          firstFigure.classList.contains("scene-formula")
            ? { scale: 1, opacity: 1 }
            : { y: 0, opacity: 1 },
        );
      }
    }

    return () => {
      timelineRef.current = null;
      tl.kill();
    };
    // `timebase` is deliberately not a dependency: rebuilding on every playhead
    // tick would destroy the very timeline we are scrubbing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson]);

  // --- follow the shared playhead ------------------------------------------
  // `subscribe`/`timeRef` are stable; the `timebase` object is fresh every
  // render, so naming it here re-attached this subscription every render.
  const followTimeRef = timebase.timeRef;
  const followSubscribe = timebase.subscribe;
  useEffect(() => {
    let previous = followTimeRef.current;

    return followSubscribe((time, meta) => {
      const timeline = timelineRef.current;
      if (timeline) {
        timeline.pause();
        timeline.time(Math.min(time, timeline.duration()));
      }

      const total = meta.duration || lesson.duration || 1;
      // `scale`, not `transform` — see the note on the fullscreen scrub line.
      // Tailwind v4's `scale-x-0` sets the standalone `scale` property, which wins
      // over `transform` and left this rail permanently empty.
      if (fillRef.current) {
        fillRef.current.style.scale = `${Math.min(Math.max(time / total, 0), 1)} 1`;
      }
      if (clockRef.current) {
        clockRef.current.textContent = `${formatClock(time, false)} / ${formatClock(total, false)}`;
      }
      if (directionRef.current) {
        const delta = time - previous;
        previous = time;
        if (meta.playing) {
          directionRef.current.textContent = `▶ ${copyRef.current.stagePlaying} ${meta.rate.toFixed(2)}×`;
        } else if (delta < -0.004) {
          directionRef.current.textContent = `◀◀ ${copyRef.current.stageRewinding}`;
        } else if (delta > 0.004) {
          directionRef.current.textContent = `▶▶ ${copyRef.current.stageForwarding}`;
        } else {
          directionRef.current.textContent = `⏸ ${copyRef.current.stagePaused}`;
        }
      }
    });
  }, [followSubscribe, followTimeRef, lesson.duration]);

  /**
   * Shrinks a slide whose content is taller than the card, rather than letting it
   * run off the bottom.
   *
   * A generated scene can hold a heading, four bullets, a formula and a
   * seven-row table. That does not fit a 16:9 card, and every earlier answer was
   * worse than the next: centring clipped the title off the top, letting the
   * list shrink made the bullets vanish to a 1px sliver, and letting the block
   * overflow put a table on top of the subtitle. Scaling the whole thing down
   * keeps every row and every word and only costs a little type size, which is
   * what a person does when a slide is too full.
   *
   * `transform` rather than a font-size cascade, because it is one composited
   * change instead of a re-layout of the whole card, and it is undone exactly by
   * setting it back to `none` when the content fits — so a slide that is merely
   * full, not too big, is never shrunk at all.
   *
   * A ResizeObserver rather than a window listener, because the card changes
   * size when the player goes fullscreen or the panel reflows, and the caption
   * track is measured in `cqw` — both change the answer without the page
   * resizing.
   */
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
        /*
         * The rendered height, not `scrollHeight`.
         *
         * A flex container's border box is its children's heights plus their gaps
         * and their margins, and `scrollHeight` does not report that — the rule
         * between the heading and the list carries a `margin-top` sized in percent
         * of the slide's width, and going by `scrollHeight` understated the real
         * height by ~15px. That is enough to put the last table row under the
         * subtitle while the arithmetic claimed everything fitted. The transform
         * was reset a line above, so this is the unscaled height.
         */
        const natural = content.getBoundingClientRect().height;
        if (natural <= available || available <= 0) return;

        // Two things are being absorbed here. A safety factor, because the
        // measurement is taken before the width compensation below is applied and
        // a slide that is 99% full should still leave the subtitle its air. And
        // the 0.6 floor, past which the type stops being readable — a slide that
        // needs shrinking that badly is a lesson-generation problem the prompt
        // already warns about, not something to paper over here.
        const scale = Math.max(0.6, (available * 0.98) / natural);
        content.style.transformOrigin = "top center";
        content.style.transform = `scale(${scale})`;
        // No width compensation here, and the reason is worth keeping: widening
        // the column to `100 / scale` percent does undo the narrowing, but the
        // children are sized in percentages of it — a heading capped at `86%`
        // then measured 114% of the card and ran off the side. A slide that is
        // scaled also reads as a slide pulled back a little, which is honest
        // about what happened; a heading hanging over the edge is not.
      });
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [lesson]);

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700/70 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${timebase.playing ? "bg-ember-400" : "bg-mist-500"}`}
            />
            <span className="text-xs font-semibold text-mist-200">{t.stageTimeline}</span>
          </span>
          <span className="text-xs text-mist-500">
            {t.stageScene} {activeScene + 1}/{lesson.scenes.length} ·{" "}
            {SCENE_KIND_LABEL[lesson.scenes[activeScene]?.kind ?? "concept"]}
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs text-mist-400">
          <span ref={directionRef}>⏸ {t.stagePaused}</span>
          <span ref={clockRef} className="tabular-nums text-brand-200">
            00:00.0 / 00:00.0
          </span>
        </div>
      </div>

      <div
        ref={stageRef}
        className="slide-fitted overflow-hidden"
        // The paper, not a dashboard. The theme is a lesson-level choice made
        // when the lesson was written, and it is the one thing that has to be on
        // this node: every colour below resolves through the variables it sets.
        data-theme={lesson.theme ?? DEFAULT_SLIDE_THEME}
        // Only dark papers get the fullscreen backdrop. A boolean attribute
        // rather than a name, so the rule keys off the resolved luminance and
        // every one of the dark palettes is covered without naming thirty of
        // them in the stylesheet.
        data-theme-dark={isDarkTheme(lesson.theme) ? "" : undefined}
        // The palette arrives as custom properties, which is what keeps one set
        // of stylesheet rules valid for all thirty-six papers.
        style={paletteStyle(lesson.theme)}
      >
        {lesson.scenes.map((scene, index) => {
          const KickerIcon = slideIcon(scene.icon);
          return (
          <article
            key={scene.id}
            data-scene={index}
            className="absolute inset-0 opacity-0"
            aria-hidden={index !== activeScene}
          >
            {/* No `justify-center` here on purpose: `.scene-card` centres the
                column in CSS with `safe center`, so a slide that outgrows the
                card falls back to the top instead of having its title clipped
                off. A Tailwind utility here would win the cascade and undo it. */}
            <div className="scene-card relative flex h-full flex-col overflow-hidden">
              {/* Everything a viewer reads goes inside this one box, so the fit
                  pass below has a single element to measure and scale. The page
                  number stays outside it: it is chrome pinned to the corner, and
                  scaling it with the content would move it. */}
              <div className="scene-fit">
              {/* Measured against the slide's own width (container queries), not
                  a fixed cap: a fullscreen slide is twice the width of the
                  embedded one and must use the space, not sit in the corner. */}
              <header className="relative z-10 w-full max-w-[86%]">
                {/* The kicker. In this style the scene kind is a small caps label
                    above the title, not a coloured pill — it should read as
                    metadata, not as a button. The icon leads it: one glyph that
                    names the subject, so a slide reads as a topic at a glance
                    from across a room before anyone reads a word of it. */}
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

              {/* The body. `min-h-0` plus a shrinkable ul is what makes an
                  over-full slide compress instead of clipping: a scene with a
                  formula *and* four bullets genuinely does not fit a 16:9 card,
                  and the honest response is to tighten the gaps rather than lose
                  the last line off the bottom edge. */}
              <ul className="scene-body relative z-10 grid w-full max-w-[86%] gap-x-[6%] sm:grid-cols-2">
                {scene.bullets.map((bullet, bulletIndex) => (
                  <li
                    key={bullet}
                    className="scene-bullet flex items-baseline gap-[1.5cqw] leading-relaxed"
                  >
                    <span className="scene-bullet-index tabular-nums">
                      {String(bulletIndex + 1).padStart(2, "0")}
                    </span>
                    <InlineText text={bullet} />
                  </li>
                ))}
              </ul>

              {/* Board solution: numbered steps under the bullets, shown only
                  on scenes that carry a working (example scenes). */}
              {scene.steps && scene.steps.length > 0 ? (
                <ol className="scene-steps relative z-10 grid w-full max-w-[86%] gap-x-[6%] sm:grid-cols-2">
                  {scene.steps.map((step, stepIndex) => (
                    <li
                      key={`step-${stepIndex}`}
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

              {scene.kind === "simulation3d" || scene.simulation3d ? (
                <div className="relative z-10 my-2 flex justify-center">
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

              {scene.data && scene.data.length > 0 ? (
                <SceneDataChart data={scene.data} title={t.stageDataTitle} />
              ) : null}

              {scene.graph ? (
                <FigureZoom label={`${t.zoom} ${scene.graph.title ?? t.zoomGraph}`}>
                  <FunctionGraph graph={scene.graph} />
                </FigureZoom>
              ) : null}

              <SlideImageView lessonId={lesson.id} scene={scene} />
              </div>

              {/* The page number. A plain baseline mark in the corner, no
                  watermark: at 11cqw the old "01" was a second headline
                  competing with the title for attention. */}
              <span
                aria-hidden="true"
                className="scene-watermark pointer-events-none absolute bottom-[4%] right-[6%] font-mono tabular-nums"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
          </article>
          );
        })}

        {/*
          The running subtitle, centred at the foot of the slide the way a
          media player's captions are.

          It lives outside the per-scene articles on purpose. Inside a scene it
          would be laid out with that scene's text — sitting under the
          left-aligned column rather than centred, and moving up and down as each
          scene's content height differed. Out here it is one fixed position for
          the whole deck, and it is no longer a node the GSAP timeline fades.

          Two things keep it from swallowing the slide. It is capped at three
          lines, because a narration of a few hundred characters is 10 lines of
          text and an uncapped block grew upwards until it covered the title and
          the bullets. And it fades out when paused, because a paused deck is
          being read, not watched — the highlight is only useful while the voice
          is moving through the sentence.
        */}
        {activeSceneData?.narration ? (
          <div
            className={`pointer-events-none absolute inset-x-0 z-20 flex justify-center px-[4%] transition-opacity duration-200 ${
              playing ? "opacity-100" : "opacity-0"
            }`}
            style={{ bottom: "calc(var(--slide-caption-track) * 0.12)" }}
          >
            <KaraokeSubtitle
              key={activeSceneData.id}
              text={activeSceneData.narration}
              sceneIndex={activeScene}
              channel={narration}
            />
          </div>
        ) : null}
        {/*
          The teacher's pointer, synced to the narration sentence by sentence.
          It lives on the stage (not inside a scene article) so its coordinates
          are stable while slides fade under it, and it is pointer-events-none
          so quizzes and simulations stay clickable through it.
        */}
        <ScenePointer
          lesson={lesson}
          stageRef={stageRef}
          channel={narration}
          playing={playing}
          enabled={lesson.showPointer !== false}
          colorRgb={pointerColorToRgb(lesson.pointerColor)}
        />
      </div>

      <div className="relative h-1 w-full bg-ink-800">
        <div
          ref={fillRef}
          className="h-full w-full origin-left bg-gradient-to-r from-brand-400 via-brand-300 to-gold-400"
          style={{ scale: "0 1" }}
        />
      </div>
    </div>
  );
}

