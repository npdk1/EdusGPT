/**
 * Does this text fit this box? The arithmetic behind the slide rules.
 *
 * The rules the model is given say to look heights up rather than guess, but a
 * rule only helps if there is a table to look up. This is that table, and the
 * two formulas that decide how many lines a sentence needs:
 *
 * - width: `characters_per_line = (width - 20) / font_size`
 * - height: lines come from the same table, keyed by the largest type in the box
 *
 * The canvas is 1000 units wide, and the slide's own CSS sets type as a
 * percentage of that width, so one unit is one pixel at full size and the two
 * systems measure in the same numbers without converting anything.
 */

/** Text height in pixels for 1, 2, 3, 4 and 5 lines, keyed by font size. */
export const TEXT_HEIGHT_TABLE: Record<number, readonly number[]> = {
  14: [43, 64, 85, 106, 127],
  16: [46, 70, 94, 118, 142],
  18: [49, 76, 103, 130, 157],
  20: [52, 82, 112, 142, 172],
  24: [58, 94, 130, 166, 202],
  28: [64, 106, 148, 190, 232],
  32: [70, 118, 166, 214, 262],
  36: [76, 130, 184, 238, 292],
};

/** The type sizes the slide CSS asks for, in the same units as the table. */
export const BLOCK_TYPE_CQW = {
  title: 5.2,
  subtitle: 1.7,
  text: 1.4,
  card: 1.4,
  label: 1.05,
  formula: 1.8,
} as const;

/**
 * The nearest table entry at or above the requested size.
 *
 * Rounding up is the safe direction: the table is what a reader can actually
 * read at that size, and picking the row below it would hand back a height
 * that is too small for the type on the slide.
 */
export function fontPx(cqw: number): number {
  const wanted = cqw * 10;
  const sizes = Object.keys(TEXT_HEIGHT_TABLE)
    .map(Number)
    .sort((a, b) => a - b);
  for (const size of sizes) if (size >= wanted - 0.01) return size;
  return sizes[sizes.length - 1];
}

/** How many characters fit on one line of a box this wide. */
export function charactersPerLine(boxWidth: number, fontPx: number): number {
  return Math.max(4, Math.floor((boxWidth - 20) / fontPx));
}

/**
 * The height one, two, three, four or five lines need at this size.
 *
 * Five is the end of the table: a block needing six lines is a paragraph, and
 * the answer is to cut it, not to keep counting.
 */
export function textHeight(lines: number, fontPx: number): number {
  const row = TEXT_HEIGHT_TABLE[fontPx] ?? TEXT_HEIGHT_TABLE[36];
  return row[Math.min(Math.max(lines, 1), row.length) - 1];
}

/** Lines this text needs in a box this wide, with the 0.8-line allowance. */
export function linesNeeded(text: string, boxWidth: number, fontPx: number): number {
  const perLine = charactersPerLine(boxWidth, fontPx);
  const paragraphs = text.split(/\n+/).filter(Boolean);
  const counted = paragraphs.reduce(
    (sum, paragraph) => sum + Math.ceil(paragraph.length / perLine),
    0,
  );
  return Math.ceil(counted + 0.8);
}

/** How many lines this box has room for, at this size. */
export function linesAvailable(boxHeight: number, fontPx: number): number {
  const row = TEXT_HEIGHT_TABLE[fontPx] ?? TEXT_HEIGHT_TABLE[36];
  let allowed = 0;
  for (let i = 0; i < row.length; i += 1) {
    if (row[i] <= boxHeight) allowed = i + 1;
  }
  return allowed;
}

/**
 * The text as it can be shown, or `undefined` when not even one line fits.
 *
 * Cutting at a word boundary and leaving an ellipsis keeps the sentence looking
 * finished rather than chopped: the slide still says something true, and the
 * narration is where the rest was said anyway.
 */
export function fitBlockText(
  text: string,
  boxWidth: number,
  boxHeight: number,
  cqw: number,
): string | undefined {
  const size = fontPx(cqw);
  const allowed = linesAvailable(boxHeight, size);
  if (allowed < 1) return undefined;
  if (linesNeeded(text, boxWidth, size) <= allowed) return text;
  const perLine = charactersPerLine(boxWidth, size);
  const budget = perLine * allowed;
  if (text.length <= budget) return text;
  const slice = text.slice(0, budget);
  const lastSpace = slice.lastIndexOf(" ");
  const kept = lastSpace > perLine * 0.5 ? slice.slice(0, lastSpace) : slice;
  return `${kept.trimEnd()}…`;
}