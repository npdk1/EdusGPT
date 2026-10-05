/**
 * The catalogue of slide papers.
 *
 * A slide in this app is type on a field, and nothing else, so a palette is a
 * very small set of roles: one field, one step down for sunken blocks, three
 * strengths of ink, a hairline, and an accent. That deliberately tiny surface
 * is what lets thirty-odd combinations all read as the same design — the
 * presets differ in colour, never in structure.
 *
 * Every value is muted. A saturated field fights the words it is meant to
 * carry, and a deck whose paper shouts reads as generated rather than authored.
 */
import type { CSSProperties } from "react";
import type { SlideTheme } from "./types";

export interface SlidePalette {
  /** The field the type sits on. */
  bg: string;
  /** A second step of the field: table headers, chart tracks, sunken blocks. */
  bgSunk: string;
  /** Full-strength text. */
  ink: string;
  /** Supporting text: subtitles, bullets, chart labels. */
  inkSoft: string;
  /** Barely-there text: captions, the page number. */
  inkFaint: string;
  /** The hairline that divides a slide. */
  rule: string;
  /** Kicker, bullet numbers, the word being spoken. */
  accent: string;
  /** Accent one step down, for a long run of accent text. */
  accentSoft: string;
}

/** One selectable look, and the identity stored on the lesson. */
export interface SlideThemePreset {
  id: string;
  label: string;
  /** Buckets the picker, so thirty-six options stay scannable. */
  group: "paper" | "ink" | "tint";
  palette: SlidePalette;
}

/** The default, and what an unrecognised or missing id falls back to. */
export const DEFAULT_SLIDE_THEME = "paper";

export const SLIDE_PRESETS: readonly SlideThemePreset[] = [
  // --- Giấy: warm off-whites -------------------------------------------------
  {
    id: "paper",
    label: "Giấy kem",
    group: "paper",
    palette: { bg: "#efe9dd", bgSunk: "#e7e0d1", ink: "#17150f", inkSoft: "#5d564a", inkFaint: "#8d8477", rule: "#cfc5b2", accent: "#9a3324", accentSoft: "#c4695a" },
  },
  {
    id: "bone",
    label: "Giấy ngà",
    group: "paper",
    palette: { bg: "#f5f2ea", bgSunk: "#ebe6d9", ink: "#1a1813", inkSoft: "#5f594c", inkFaint: "#918a7c", rule: "#d5cdbc", accent: "#2f6f63", accentSoft: "#5c9c90" },
  },
  {
    id: "chalk",
    label: "Giấy phấn",
    group: "paper",
    palette: { bg: "#f2f1ec", bgSunk: "#e6e4dc", ink: "#191a17", inkSoft: "#575951", inkFaint: "#8b8d85", rule: "#cfd0c7", accent: "#1f5f8f", accentSoft: "#5791b8" },
  },
  {
    id: "sand",
    label: "Cát",
    group: "paper",
    palette: { bg: "#ece2cd", bgSunk: "#e1d4b9", ink: "#1c1810", inkSoft: "#5f5747", inkFaint: "#918878", rule: "#cec1a6", accent: "#8a5a1e", accentSoft: "#b98b4f" },
  },
  {
    id: "linen",
    label: "Vải",
    group: "paper",
    palette: { bg: "#e9e3d6", bgSunk: "#ded7c6", ink: "#1b1a15", inkSoft: "#5d5a4e", inkFaint: "#8e8a7c", rule: "#cbc4b2", accent: "#6b5320", accentSoft: "#a08a4d" },
  },
  {
    id: "pearl",
    label: "Ngọc trai",
    group: "paper",
    palette: { bg: "#eef1f0", bgSunk: "#e2e6e4", ink: "#15181a", inkSoft: "#555c5c", inkFaint: "#888f8e", rule: "#ccd2d1", accent: "#146a5f", accentSoft: "#4a9a8d" },
  },
  {
    id: "butter",
    label: "Bơ",
    group: "paper",
    palette: { bg: "#f5f1e0", bgSunk: "#ebe5cf", ink: "#1a1810", inkSoft: "#5c5747", inkFaint: "#8d8878", rule: "#d3ccb3", accent: "#8a6a1c", accentSoft: "#b3924c" },
  },
  {
    id: "wheat",
    label: "Lúa mì",
    group: "paper",
    palette: { bg: "#f2e9d4", bgSunk: "#e7dabc", ink: "#1d180f", inkSoft: "#5f5643", inkFaint: "#938872", rule: "#d4c7a5", accent: "#96621a", accentSoft: "#bb8b45" },
  },
  {
    id: "ochre",
    label: "Nâu ocher",
    group: "paper",
    palette: { bg: "#f1e4cc", bgSunk: "#e6d5b6", ink: "#1b1610", inkSoft: "#5e5140", inkFaint: "#91826c", rule: "#d3c0a0", accent: "#9a5f16", accentSoft: "#bd8a44" },
  },
  {
    id: "stone",
    label: "Đá",
    group: "paper",
    palette: { bg: "#ecebe7", bgSunk: "#dfdeda", ink: "#191917", inkSoft: "#565650", inkFaint: "#8a8b84", rule: "#cdcdc6", accent: "#5a5f3a", accentSoft: "#878a5e" },
  },
  {
    id: "slate-light",
    label: "Đá xám sáng",
    group: "paper",
    palette: { bg: "#e8ebee", bgSunk: "#dadee2", ink: "#141719", inkSoft: "#4f5559", inkFaint: "#82888c", rule: "#ccd1d4", accent: "#33607f", accentSoft: "#63879f" },
  },
  // --- Mực: near-blacks ------------------------------------------------------
  {
    id: "ink",
    label: "Mực tối",
    group: "ink",
    palette: { bg: "#14120e", bgSunk: "#1d1a15", ink: "#f2ede1", inkSoft: "#a89f8f", inkFaint: "#6f675a", rule: "#35302a", accent: "#e8937a", accentSoft: "#b4695a" },
  },
  {
    id: "charcoal",
    label: "Than",
    group: "ink",
    palette: { bg: "#1b1b1d", bgSunk: "#242427", ink: "#f0efec", inkSoft: "#a5a4a0", inkFaint: "#6c6b68", rule: "#38383a", accent: "#d7a24a", accentSoft: "#a8833d" },
  },
  {
    id: "slate",
    label: "Đá xám",
    group: "ink",
    palette: { bg: "#181c21", bgSunk: "#212630", ink: "#eceff3", inkSoft: "#9ba5b0", inkFaint: "#67707b", rule: "#30363f", accent: "#6fb0d8", accentSoft: "#4d8aad" },
  },
  {
    id: "forest",
    label: "Rừng",
    group: "ink",
    palette: { bg: "#10160f", bgSunk: "#18201a", ink: "#e9f0e6", inkSoft: "#99a996", inkFaint: "#667061", rule: "#2b3628", accent: "#8ec06a", accentSoft: "#6c9a51" },
  },
  {
    id: "plum",
    label: "Mận",
    group: "ink",
    palette: { bg: "#171019", bgSunk: "#201823", ink: "#efe8f0", inkSoft: "#a696a4", inkFaint: "#6c5e6a", rule: "#33242f", accent: "#c98ab4", accentSoft: "#a26a90" },
  },
  {
    id: "espresso",
    label: "Cà phê",
    group: "ink",
    palette: { bg: "#1b1512", bgSunk: "#251d18", ink: "#f2e9dd", inkSoft: "#ab9c8c", inkFaint: "#736658", rule: "#382e26", accent: "#d9964f", accentSoft: "#ac7740" },
  },
  {
    id: "midnight",
    label: "Nửa đêm",
    group: "ink",
    palette: { bg: "#10131a", bgSunk: "#191d26", ink: "#e9ecf2", inkSoft: "#98a1b3", inkFaint: "#646d7e", rule: "#2b313d", accent: "#7f9ce0", accentSoft: "#6279b4" },
  },
  {
    id: "aubergine",
    label: "Tím mận",
    group: "ink",
    palette: { bg: "#17111c", bgSunk: "#201826", ink: "#ece5f0", inkSoft: "#a191ab", inkFaint: "#6a5b74", rule: "#30253b", accent: "#b184d8", accentSoft: "#8d68b0" },
  },
  {
    id: "moss",
    label: "Rêu",
    group: "ink",
    palette: { bg: "#131710", bgSunk: "#1c211a", ink: "#eaf0e4", inkSoft: "#9aa491", inkFaint: "#66705b", rule: "#2c3427", accent: "#a8c46a", accentSoft: "#859b50" },
  },
  {
    id: "gunmetal",
    label: "Kim loại",
    group: "ink",
    palette: { bg: "#14171a", bgSunk: "#1d2126", ink: "#e9edf1", inkSoft: "#9aa2ac", inkFaint: "#646c76", rule: "#2c333b", accent: "#d0b45a", accentSoft: "#a68f47" },
  },
  {
    id: "deep-sea",
    label: "Biển sâu",
    group: "ink",
    palette: { bg: "#0c1418", bgSunk: "#131d22", ink: "#e6eef0", inkSoft: "#93a6ab", inkFaint: "#5e7176", rule: "#293a40", accent: "#4fb3c9", accentSoft: "#3a8ba0" },
  },
  {
    id: "oxblood",
    label: "Máu bò",
    group: "ink",
    palette: { bg: "#1c1010", bgSunk: "#261818", ink: "#f2e6e4", inkSoft: "#ab918e", inkFaint: "#71605d", rule: "#3a2725", accent: "#d9705f", accentSoft: "#ad574a" },
  },
  {
    id: "brick",
    label: "Gạch",
    group: "ink",
    palette: { bg: "#1d1310", bgSunk: "#271b17", ink: "#f3e7de", inkSoft: "#b0968a", inkFaint: "#736159", rule: "#3a2a24", accent: "#e08a5a", accentSoft: "#b26c47" },
  },
  // --- Màu: tinted, light and dark -------------------------------------------
  {
    id: "rose",
    label: "Hồng",
    group: "tint",
    palette: { bg: "#f4e7e5", bgSunk: "#e9d9d6", ink: "#1d1512", inkSoft: "#5f4f4b", inkFaint: "#907e79", rule: "#d7c6c2", accent: "#a8324a", accentSoft: "#c56a80" },
  },
  {
    id: "blush",
    label: "Hồng phấn",
    group: "tint",
    palette: { bg: "#f6ebe8", bgSunk: "#ebdcd7", ink: "#1d1614", inkSoft: "#61524d", inkFaint: "#93827c", rule: "#d9cac5", accent: "#b23a5c", accentSoft: "#cb6b88" },
  },
  {
    id: "coral",
    label: "San hô",
    group: "tint",
    palette: { bg: "#f6e6e1", bgSunk: "#ebd6cf", ink: "#1d1512", inkSoft: "#62504a", inkFaint: "#96807a", rule: "#dbc7c0", accent: "#c04a2f", accentSoft: "#d67a5f" },
  },
  {
    id: "apricot",
    label: "Đào",
    group: "tint",
    palette: { bg: "#f5e7d8", bgSunk: "#ebd9c6", ink: "#1e1710", inkSoft: "#625448", inkFaint: "#948575", rule: "#dbcab7", accent: "#b8621f", accentSoft: "#d18b52" },
  },
  {
    id: "lemon",
    label: "Chanh",
    group: "tint",
    palette: { bg: "#f2f0dd", bgSunk: "#e7e4ca", ink: "#1a1a11", inkSoft: "#565749", inkFaint: "#888a78", rule: "#d2d0b3", accent: "#7c7014", accentSoft: "#a89a3c" },
  },
  {
    id: "sage",
    label: "Xanh non",
    group: "tint",
    palette: { bg: "#e7eee4", bgSunk: "#dbe4d6", ink: "#141a13", inkSoft: "#4f5a4c", inkFaint: "#7f8b7b", rule: "#c3d1be", accent: "#3f7a4a", accentSoft: "#6da179" },
  },
  {
    id: "mint",
    label: "Bạc hà",
    group: "tint",
    palette: { bg: "#eaf2e9", bgSunk: "#dde8db", ink: "#131a14", inkSoft: "#4d584e", inkFaint: "#7f8a80", rule: "#c6d4c3", accent: "#2c7a5e", accentSoft: "#5ca184" },
  },
  {
    id: "teal",
    label: "Mòng két",
    group: "tint",
    palette: { bg: "#e2eeec", bgSunk: "#d4e2e0", ink: "#101c1b", inkSoft: "#475956", inkFaint: "#7a8c89", rule: "#c2d4d1", accent: "#14655c", accentSoft: "#4a9a8e" },
  },
  {
    id: "seafoam",
    label: "Bọt biển",
    group: "tint",
    palette: { bg: "#e6efec", bgSunk: "#d8e3df", ink: "#101a18", inkSoft: "#485754", inkFaint: "#7b8b88", rule: "#c3d3ce", accent: "#0f6d70", accentSoft: "#4b9c9e" },
  },
  {
    id: "sky",
    label: "Trời",
    group: "tint",
    palette: { bg: "#e3edf2", bgSunk: "#d7e4eb", ink: "#111a1e", inkSoft: "#4a5a61", inkFaint: "#7c8c93", rule: "#c3d4dc", accent: "#1f6d94", accentSoft: "#5597ba" },
  },
  {
    id: "dusk",
    label: "Hoàng hôn",
    group: "tint",
    palette: { bg: "#e8e6ee", bgSunk: "#dcd9e5", ink: "#16151c", inkSoft: "#4f4c59", inkFaint: "#807d8a", rule: "#ccc8d6", accent: "#5b4a8c", accentSoft: "#8271ad" },
  },
  {
    id: "lilac",
    label: "Tím nhạt",
    group: "tint",
    palette: { bg: "#eee9f2", bgSunk: "#e2dbe8", ink: "#181420", inkSoft: "#544c5c", inkFaint: "#857c8d", rule: "#d0c8d8", accent: "#6a4a9a", accentSoft: "#9276bb" },
  },
  {
    id: "aurora",
    label: "Cực quang",
    group: "paper",
    palette: { bg: "#edf1fb", bgSunk: "#dde6f6", ink: "#141a2e", inkSoft: "#4d5878", inkFaint: "#8b93ad", rule: "#c3cfe4", accent: "#0b7a5c", accentSoft: "#45b393" },
  },
  {
    id: "peach",
    label: "Đào",
    group: "paper",
    palette: { bg: "#faf0e6", bgSunk: "#f1e0cf", ink: "#221610", inkSoft: "#6b5a4d", inkFaint: "#a08e7e", rule: "#d9c7b3", accent: "#c2410c", accentSoft: "#e08a5a" },
  },
  {
    id: "ocean",
    label: "Đại dương",
    group: "paper",
    palette: { bg: "#e9f4f6", bgSunk: "#d5e8ec", ink: "#0e1c1e", inkSoft: "#476064", inkFaint: "#7e9396", rule: "#bcd5da", accent: "#0e7490", accentSoft: "#4aa8bd" },
  },
  {
    id: "galaxy",
    label: "Ngân hà",
    group: "ink",
    palette: { bg: "#0d0f23", bgSunk: "#171a3a", ink: "#e8eaf6", inkSoft: "#9aa1c7", inkFaint: "#5f6584", rule: "#2c3157", accent: "#8b7cf6", accentSoft: "#a5b4fc" },
  },
  {
    id: "ember",
    label: "Than hồng",
    group: "ink",
    palette: { bg: "#170f0d", bgSunk: "#261511", ink: "#f5e9e2", inkSoft: "#a8988d", inkFaint: "#6e5f57", rule: "#3b2b24", accent: "#f97316", accentSoft: "#fca55c" },
  },
  {
    id: "jade",
    label: "Ngọc bích",
    group: "ink",
    palette: { bg: "#0b1512", bgSunk: "#13211a", ink: "#e6f0e9", inkSoft: "#93a89b", inkFaint: "#5f6f65", rule: "#27352c", accent: "#34d399", accentSoft: "#6ee7b7" },
  },
] as const;

const PRESET_BY_ID = new Map(SLIDE_PRESETS.map((preset) => [preset.id, preset]));

/**
 * Resolves a stored id to a preset, always succeeding.
 *
 * Themes arrive over HTTP, out of localStorage, and out of `data/courses`, and
 * each can carry a value this build no longer knows — a preset that was
 * renamed, a deck written before the picker existed. Falling back here is what
 * keeps a slide from rendering with no colours at all, which is what an
 * unmatched `data-theme` produces.
 */
export function resolveSlideTheme(id: string | null | undefined): SlideThemePreset {
  return (id ? PRESET_BY_ID.get(id) : undefined) ?? PRESET_BY_ID.get(DEFAULT_SLIDE_THEME)!;
}

/** Ids the picker offers, in registry order. */
export const SLIDE_THEME_IDS = SLIDE_PRESETS.map((preset) => preset.id);

/**
 * A palette as inline custom properties.
 *
 * The slide reads its colours only through `var(--slide-*)`, so handing the
 * palette down as variables is enough to restyle a whole deck — which is what
 * lets forty-two presets exist without forty-two blocks of CSS, and what lets
 * the studio preview and the player share one code path.
 */
export function paletteStyle(id: string | null | undefined): Record<string, string> {
  const p = resolveSlideTheme(id).palette;
  return {
    "--slide-bg": p.bg,
    "--slide-bg-sunk": p.bgSunk,
    "--slide-ink": p.ink,
    "--slide-ink-soft": p.inkSoft,
    "--slide-ink-faint": p.inkFaint,
    "--slide-rule": p.rule,
    "--slide-accent": p.accent,
    "--slide-accent-soft": p.accentSoft,
  };
}

/** A preset's colours as a flat style object, for a swatch in the picker. */
export function swatchStyle(id: string): CSSProperties {
  const p = resolveSlideTheme(id).palette;
  return { backgroundColor: p.bg, color: p.ink, borderColor: p.rule };
}

/**
 * Perceived brightness of a `#rrggbb` colour, 0 (black) to 1 (white).
 *
 * Uses the sRGB coefficients rather than a plain average of the channels,
 * because a naive mean calls `#14120e` and `#e8e6ee` nearly the same value, and
 * the picker would then offer an unreadable dark slide among the light ones.
 */
function relativeLuminance(hex: string): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return 1;
  const n = parseInt(match[1], 16);
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

/** True when the preset's field is dark, and light type is what it needs. */
export function isDarkTheme(id: string | null | undefined): boolean {
  return relativeLuminance(resolveSlideTheme(id).palette.bg) < 0.5;
}

export type { SlideTheme };
