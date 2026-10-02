import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Observer } from "gsap/Observer";
import { SplitText } from "gsap/SplitText";

/**
 * Single registration point for GSAP plugins. GSAP 3.13+ ships every plugin in
 * the public npm package, so SplitText/ScrollTrigger/Observer are available
 * without a club membership.
 */
let registered = false;

export function ensureGsap(): typeof gsap {
  if (typeof window === "undefined") return gsap;
  if (!registered) {
    gsap.registerPlugin(ScrollTrigger, Observer, SplitText);
    gsap.defaults({ ease: "power3.out", duration: 0.6 });
    registered = true;
  }
  return gsap;
}

/** True when the visitor asked the OS to reduce motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export { gsap, ScrollTrigger, Observer, SplitText };
