/**
 * Entrance motions: how a slide's content arrives, picked in the studio.
 *
 * One table drives both renderers (the web player's GSAP timeline and the
 * standalone export's), so a deck moves the same way everywhere it plays.
 * Each entry is only "from" values — the "to" is always the natural layout,
 * which is what keeps a motion from ever leaving a slide somewhere strange.
 *
 * Ten entries, `none` first: stillness is a valid choice and the default, so
 * a lesson saved before this field existed plays exactly as it used to.
 */

export const SLIDE_MOTIONS = [
  "none",
  "rise",
  "fade",
  "pop",
  "zoom",
  "slide-left",
  "slide-right",
  "bounce",
  "flip",
  "blur",
] as const;

export type SlideMotion = (typeof SLIDE_MOTIONS)[number];

export const DEFAULT_SLIDE_MOTION: SlideMotion = "none";

export function isSlideMotion(value: unknown): value is SlideMotion {
  return (
    typeof value === "string" &&
    (SLIDE_MOTIONS as readonly string[]).includes(value)
  );
}

export interface MotionFrom {
  x?: number;
  y?: number;
  yPercent?: number;
  scale?: number;
  rotationY?: number;
  transformPerspective?: number;
  filter?: string;
  opacity?: number;
}

export interface MotionSpec {
  /** Skip the intro tweens entirely; the slide is simply there. */
  instant: boolean;
  card: MotionFrom;
  title: MotionFrom;
  item: MotionFrom;
  stagger: number;
  ease: string;
  duration: number;
}

const OPACITY = { opacity: 0 };

export function motionFor(motion: string): MotionSpec {
  switch (motion) {
    case "rise":
      return {
        instant: false,
        card: { y: 26, ...OPACITY },
        title: { yPercent: 60, ...OPACITY },
        item: { x: -18, ...OPACITY },
        stagger: 0.09,
        ease: "power3.out",
        duration: 0.55,
      };
    case "fade":
      return {
        instant: false,
        card: { ...OPACITY },
        title: { ...OPACITY },
        item: { ...OPACITY },
        stagger: 0.06,
        ease: "power2.out",
        duration: 0.7,
      };
    case "pop":
      return {
        instant: false,
        card: { y: 10, scale: 0.92, ...OPACITY },
        title: { yPercent: 40, scale: 0.96, ...OPACITY },
        item: { y: 14, ...OPACITY },
        stagger: 0.07,
        ease: "back.out(1.6)",
        duration: 0.5,
      };
    case "zoom":
      return {
        instant: false,
        card: { scale: 1.14, ...OPACITY },
        title: { scale: 1.06, ...OPACITY },
        item: { ...OPACITY },
        stagger: 0.07,
        ease: "power2.out",
        duration: 0.6,
      };
    case "slide-left":
      return {
        instant: false,
        card: { x: -48, ...OPACITY },
        title: { x: -30, ...OPACITY },
        item: { x: -30, ...OPACITY },
        stagger: 0.09,
        ease: "power3.out",
        duration: 0.55,
      };
    case "slide-right":
      return {
        instant: false,
        card: { x: 48, ...OPACITY },
        title: { x: 30, ...OPACITY },
        item: { x: 30, ...OPACITY },
        stagger: 0.09,
        ease: "power3.out",
        duration: 0.55,
      };
    case "bounce":
      return {
        instant: false,
        card: { y: 26, ...OPACITY },
        title: { yPercent: 50, ...OPACITY },
        item: { x: -14, ...OPACITY },
        stagger: 0.08,
        ease: "bounce.out",
        duration: 0.75,
      };
    case "flip":
      return {
        instant: false,
        card: { rotationY: -45, transformPerspective: 900, ...OPACITY },
        title: { ...OPACITY },
        item: { ...OPACITY },
        stagger: 0.07,
        ease: "power3.out",
        duration: 0.65,
      };
    case "blur":
      return {
        instant: false,
        card: { filter: "blur(12px)", ...OPACITY },
        title: { filter: "blur(8px)", ...OPACITY },
        item: { ...OPACITY },
        stagger: 0.06,
        ease: "power2.out",
        duration: 0.6,
      };
    case "none":
    default:
      return {
        instant: true,
        card: {},
        title: {},
        item: {},
        stagger: 0,
        ease: "power3.out",
        duration: 0.01,
      };
  }
}
