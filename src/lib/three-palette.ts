/**
 * Shared 3D palette. Kept in one place so the WebGL layer can never drift into
 * the red-blue colour family that this project deliberately avoids.
 * Hex values mirror the CSS tokens in src/app/globals.css.
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
