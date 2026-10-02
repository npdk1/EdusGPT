"use client";

import { useRef, type ReactNode } from "react";
import { ensureGsap, prefersReducedMotion } from "@/lib/gsap";
import { useIsoLayoutEffect } from "./hooks";

interface MagneticProps {
  children: ReactNode;
  className?: string;
  strength?: number;
}

/** Pointer-follow wrapper — used on the primary CTAs. */
export function Magnetic({ children, className, strength = 0.28 }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => {
    const element = ref.current;
    if (!element || prefersReducedMotion()) return;
    const gsap = ensureGsap();
    const moveX = gsap.quickTo(element, "x", { duration: 0.5, ease: "power3.out" });
    const moveY = gsap.quickTo(element, "y", { duration: 0.5, ease: "power3.out" });

    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      moveX((event.clientX - (rect.left + rect.width / 2)) * strength);
      moveY((event.clientY - (rect.top + rect.height / 2)) * strength);
    };
    const onLeave = () => {
      moveX(0);
      moveY(0);
    };

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
    };
  }, [strength]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

interface MarqueeProps {
  children: ReactNode;
  className?: string;
  duration?: number;
  reverse?: boolean;
}

/** Continuously scrolling strip (the track holds two copies of the content). */
export function Marquee({ children, className, duration = 34, reverse = false }: MarqueeProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || prefersReducedMotion()) return;
    const gsap = ensureGsap();
    const tween = gsap.fromTo(
      track,
      { xPercent: reverse ? -50 : 0 },
      {
        xPercent: reverse ? 0 : -50,
        duration,
        ease: "none",
        repeat: -1,
      },
    );
    const element = track.parentElement;
    const pause = () => tween.timeScale(0.25);
    const resume = () => tween.timeScale(1);
    element?.addEventListener("pointerenter", pause);
    element?.addEventListener("pointerleave", resume);
    return () => {
      element?.removeEventListener("pointerenter", pause);
      element?.removeEventListener("pointerleave", resume);
      tween.kill();
    };
  }, [duration, reverse]);

  return (
    <div className={className ?? "relative overflow-hidden"}>
      <div ref={trackRef} className="flex w-max items-center gap-10 will-change-transform">
        {children}
        {children}
      </div>
    </div>
  );
}
