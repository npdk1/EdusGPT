"use client";

import { useRef, type ElementType, type ReactNode } from "react";
import { ensureGsap, prefersReducedMotion, ScrollTrigger } from "@/lib/gsap";
import { useIsoLayoutEffect } from "./hooks";

interface RevealProps {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  /** Vertical travel in px; negative moves down-to-up. */
  y?: number;
  delay?: number;
  duration?: number;
  /** When > 0, animates direct children one after another instead of the box. */
  stagger?: number;
  start?: string;
}

/**
 * Scroll-triggered entrance. Wraps children and reveals them once, using
 * ScrollTrigger so the timing follows the reader instead of a timer.
 */
export function Reveal({
  children,
  className,
  as: Tag = "div",
  y = 30,
  delay = 0,
  duration = 0.85,
  stagger = 0,
  start = "top 88%",
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useIsoLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const gsap = ensureGsap();

    const targets: Element[] =
      stagger > 0 ? Array.from(element.children) : [element];
    if (targets.length === 0) return;

    if (prefersReducedMotion()) {
      gsap.set(targets, { opacity: 1, y: 0, clearProps: "transform" });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { y, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration,
          delay,
          ease: "power3.out",
          stagger: stagger > 0 ? stagger : 0,
          scrollTrigger: { trigger: element, start, once: true },
        },
      );
    }, element);

    return () => ctx.revert();
  }, [y, delay, duration, stagger, start]);

  return (
    <Tag ref={ref as never} className={className}>
      {children}
    </Tag>
  );
}

interface ScrollProgressBarProps {
  className?: string;
}

/** Thin reading-progress rail pinned to the top of the viewport. */
export function ScrollProgressBar({ className }: ScrollProgressBarProps) {
  const ref = useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => {
    const element = ref.current;
    if (!element || prefersReducedMotion()) return;
    const gsap = ensureGsap();
    const ctx = gsap.context(() => {
      gsap.fromTo(
        element,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          transformOrigin: "left center",
          scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 0.35 },
        },
      );
    });
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={
        className ??
        "pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] origin-left scale-x-0 bg-gradient-to-r from-brand-400 via-brand-300 to-gold-400"
      }
    />
  );
}

export { ScrollTrigger };
