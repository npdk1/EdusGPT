"use client";

import { useRef, type ElementType, type ReactNode } from "react";
import { ensureGsap, prefersReducedMotion, ScrollTrigger, SplitText } from "@/lib/gsap";
import { useIsoLayoutEffect } from "./hooks";

interface SplitHeadingProps {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  /** "words" reads better for Vietnamese diacritics than per-character. */
  by?: "words" | "chars";
  delay?: number;
  stagger?: number;
  duration?: number;
  /** Play immediately instead of waiting for the element to scroll in. */
  immediate?: boolean;
}

/** GSAP SplitText headline: masked lines, staggered words. */
export function SplitHeading({
  children,
  className,
  as: Tag = "h2",
  by = "words",
  delay = 0,
  stagger,
  duration = 1,
  immediate = false,
}: SplitHeadingProps) {
  const ref = useRef<HTMLElement | null>(null);

  useIsoLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const gsap = ensureGsap();

    if (prefersReducedMotion()) {
      gsap.set(element, { opacity: 1 });
      return;
    }

    let split: SplitText | null = null;
    /**
     * Re-measures the per-word gradient offsets. Declared out here so the font
     * and resize listeners below can reach it; assigned inside the context, and
     * the cleanup no-ops until it is.
     */
    let repaint: (() => void) | null = null;
    const ctx = gsap.context(() => {
      split = new SplitText(element, {
        type: by === "chars" ? "chars,words" : "words",
        mask: "lines",
        wordsClass: "split-word",
        charsClass: "split-char",
      });

      /**
       * Keeps a `background-clip: text` gradient continuous across split words.
       *
       * The gradient on a wrapper does not survive the split. `SplitText` gives
       * every word `position: relative`, which makes it paint in its own layer,
       * so the wrapper's clipped background never reaches it — and the words
       * still inherit the wrapper's `color: transparent`. Net effect: the
       * headline rendered as nothing at all.
       *
       * So each word paints the gradient itself, sized to the wrapper and
       * offset by the word's position inside it. One gradient, drawn once, with
       * no seams between words.
       *
       * Positions come from `offsetLeft`/`offsetTop`, not from
       * `getBoundingClientRect`. The measurement is re-run on font load and on
       * resize, and both of those can land while the entry animation is still
       * running — a rect at that moment is the animated position, word shoved
       * down by `yPercent: 120`, and the gradient gets painted a line below the
       * text it is supposed to colour. Offsets are layout, not transform, so
       * they are correct whenever they are taken.
       *
       * Returns a function to re-run the measurement, because the offsets are
       * only correct for the layout that produced them.
       */
      const paintGradient = () => {
        const gradient = element.querySelector<HTMLElement>(".text-gradient-warm");
        if (!gradient) return;

        /**
         * The word's layout offset from the gradient wrapper.
         *
         * Measured against `gradient.offsetParent` rather than by walking the
         * chain until it reaches the wrapper. The chain does not reach it: with
         * `mask: "lines"` the words sit inside a mask div, and the first
         * positioned ancestor of both is above the wrapper — so a walk that
         * expects to hit the wrapper runs on to `<body>` and returns the word's
         * position in the document, which paints the gradient off the slide.
         *
         * Both sides are resolved to the same base, so whatever that base is,
         * the difference is the offset that actually matters.
         */
        const base = gradient.offsetParent;
        const offsetWithin = (word: HTMLElement) => {
          let x = 0;
          let y = 0;
          for (let node: HTMLElement | null = word; node && node !== base; ) {
            x += node.offsetLeft;
            y += node.offsetTop;
            node = node.offsetParent as HTMLElement | null;
          }
          return { x: x - gradient.offsetLeft, y: y - gradient.offsetTop };
        };

        const words = [...gradient.querySelectorAll<HTMLElement>(".split-word, .split-char")];
        if (words.length === 0) return;

        // The gradient is drawn once, across the whole headline, so the image
        // has to be big enough to reach the bottom-right of the last word.
        // Sizing it to the wrapper instead left the lower part of every glyph
        // unpainted — with `no-repeat` and `color: transparent` that part is not
        // a lighter shade, it is nothing at all, and the headline read as if it
        // had been cut off mid-word.
        const placed = words.map((word) => ({ word, at: offsetWithin(word) }));
        const left = Math.min(...placed.map((p) => p.at.x));
        const top = Math.min(...placed.map((p) => p.at.y));
        // `ceil` on the far edges: `offsetWidth` rounds, and a word one pixel
        // wider than the image would show a bare sliver.
        const right = Math.max(...placed.map((p) => p.at.x + p.word.offsetWidth));
        const bottom = Math.max(...placed.map((p) => p.at.y + p.word.offsetHeight));
        const width = Math.ceil(right - left);
        const height = Math.ceil(bottom - top);
        if (width === 0 || height === 0) return;

        const { backgroundImage } = getComputedStyle(gradient);
        for (const { word, at } of placed) {
          word.style.backgroundImage = backgroundImage;
          word.style.backgroundSize = `${width}px ${height}px`;
          word.style.backgroundPosition = `${-(at.x - left)}px ${-(at.y - top)}px`;
          word.style.backgroundRepeat = "no-repeat";
          word.style.webkitBackgroundClip = "text";
          word.style.backgroundClip = "text";
          word.style.color = "transparent";
        }
      };
      repaint = paintGradient;
      paintGradient();

      const targets = by === "chars" ? split.chars : split.words;
      gsap.fromTo(
        targets,
        { yPercent: 120, opacity: 0, rotate: by === "chars" ? 4 : 0 },
        {
          yPercent: 0,
          opacity: 1,
          rotate: 0,
          duration,
          delay,
          ease: "power4.out",
          stagger: stagger ?? (by === "chars" ? 0.02 : 0.05),
          ...(immediate
            ? {}
            : { scrollTrigger: { trigger: element, start: "top 85%", once: true } }),
        },
      );
    }, element);

    /**
     * Re-measure on the two events that move a word without re-splitting.
     *
     * `document.fonts.ready` matters more than it looks: the gradient is painted
     * with pixel offsets, so a fallback font swapping in afterwards leaves the
     * words visibly out of step with each other. `ResizeObserver` on the element
     * covers the same ground for a rewrap, without a window listener firing for
     * every unrelated resize in the app.
     */
    const onResize = () => repaint?.();
    const fonts = document.fonts;
    const observer = new ResizeObserver(onResize);
    observer.observe(element);
    fonts?.ready.then(() => repaint?.()).catch(() => {
      /* no FontFaceSet, or it never settled; the first paint still stands */
    });

    return () => {
      observer.disconnect();
      repaint = null;
      // `ctx.revert()` also drops the plugin instances; guard so a second
      // revert can never throw during fast navigation.
      try {
        split?.revert();
      } catch {
        /* already reverted by the context */
      }
      ctx.revert();
    };
  }, [by, delay, stagger, duration, immediate]);

  return (
    <Tag ref={ref as never} className={className}>
      {children}
    </Tag>
  );
}

interface AnimatedNumberProps {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  className?: string;
  duration?: number;
}

/** Count-up statistic that fires when scrolled into view. */
export function AnimatedNumber({
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
  className,
  duration = 1.6,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useIsoLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const gsap = ensureGsap();
    const format = (input: number) =>
      `${prefix}${input.toLocaleString("vi-VN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`;

    if (prefersReducedMotion()) {
      element.textContent = format(value);
      return;
    }

    const counter = { current: 0 };
    const ctx = gsap.context(() => {
      gsap.to(counter, {
        current: value,
        duration,
        ease: "power2.out",
        onUpdate: () => {
          element.textContent = format(counter.current);
        },
        scrollTrigger: { trigger: element, start: "top 92%", once: true },
      });
    }, element);

    return () => ctx.revert();
  }, [value, suffix, prefix, decimals, duration]);

  return (
    <span ref={ref} className={className}>
      {`${prefix}${value}${suffix}`}
    </span>
  );
}

export { ScrollTrigger };
