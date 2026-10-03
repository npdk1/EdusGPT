/**
 * Shared 3D palette. Kept in one place so the WebGL layer can never drift.
 * Hex values mirror the CSS tokens in src/app/globals.css.
 *
 * The `blue` family matches the site's brand blues: the tutor robot wears it
 * because it is the site's primary colour, not an accent.
 */
export const THREECOLORS = {
  ink950: 0x04090b,
  ink900: 0x080f13,
  ink800: 0x111d23,
  ink700: 0x18272f,
  mist100: 0xe3eff0,
  brand300: 0x57d6c6,
  brand400: 0x24bdac,
  brand500: 0x0fa192,
  brand700: 0x0d665e,
  blue300: 0x6db3e8,
  blue400: 0x2f8fd0,
  blue500: 0x1a6fc0,
  blue700: 0x0d4a7d,
  blush: 0xf5a3b7,
  gold300: 0xfbd275,
  gold400: 0xf6b93b,
  gold500: 0xe79a12,
  ember400: 0xff8a5b,
} as const;

export type ThreeColorName = keyof typeof THREECOLORS;

/** Particle colour palette: teal-dominant with a warm minority. */
export const PARTICLE_COLORS: number[] = [
  THREECOLORS.brand300,
  THREECOLORS.brand400,
  THREECOLORS.brand500,
  THREECOLORS.gold400,
  THREECOLORS.mist100,
];
