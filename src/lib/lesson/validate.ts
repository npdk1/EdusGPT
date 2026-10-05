import {
  SCENE_ACCENTS,
  SCENE_KINDS,
  SLIDE_LAYOUTS,
  POINTER_TARGETS,
  relayoutLesson,
  SLIDE_BLOCK_KINDS,
  SLIDE_GRID,
  type Lesson,
  type LessonChapter,
  type LessonScene,
  type SceneAccent,
  type SceneKind,
  type SlideBlock,
  type SlideBlockKind,
  type SlideGraph,
  type SlideLayout,
  type SlideTable,
} from "./types";
import { BLOCK_TYPE_CQW, fitBlockText } from "./text-fit";
import { DEFAULT_SLIDE_PATTERN, DEFAULT_SLIDE_THEME, isSlidePattern } from "./themes";
import { DEFAULT_SLIDE_MOTION, isSlideMotion } from "./motion";
import { SLIDE_ICON_NAMES } from "./types";
import { MAX_LESSON_SCENES } from "./presentation-styles";

/** Defensive validation for anything that arrives over HTTP or from localStorage. */

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asStringArray(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter(Boolean)
    .slice(0, limit);
}

function asNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Rectangularises a table so the renderer can trust `row[i]` exists.
 *
 * Short rows are padded with empty cells and long ones trimmed; a table needs
 * at least 2 columns and 1 row, or it is not a table.
 *
 * Rows arrive either as real arrays (hand-written lessons, localStorage) or as
 * "|"-joined strings (Gemini, whose response schema has no nested arrays).
 */
function buildTable(raw: Record<string, unknown>): SlideTable | undefined {
  const columns = asStringArray(raw.columns, 6).map((cell) => cell.slice(0, 40));
  const rawRows = Array.isArray(raw.rows) ? raw.rows : [];
  const rows = rawRows
    .slice(0, 12)
    .map((row) => {
      const cells = Array.isArray(row)
        ? (row as unknown[])
        : asString(row).split("|");
      return columns.map((_, index) => asString(cells[index]).slice(0, 40));
    })
    .filter((row) => row.some(Boolean));
  if (columns.length < 2 || rows.length === 0) return undefined;
  return {
    caption: asString(raw.caption).slice(0, 80) || undefined,
    columns,
    rows,
  };
}

/**
 * A graph only survives when it is actually plottable: ascending finite xs,
 * a y (or an explicit null gap) per x, at least 8 points to draw a curve.
 * y values are clamped to ±1e6 so one runaway sample cannot flatten the rest.
 */
function buildGraph(raw: Record<string, unknown>): SlideGraph | undefined {
  const toFinite = (value: unknown): number | null => {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : null;
  };
  const rawXs = Array.isArray(raw.xs) ? raw.xs : [];
  const rawYs = Array.isArray(raw.ys) ? raw.ys : [];
  const count = Math.min(rawXs.length, rawYs.length, 120);
  const xs: number[] = [];
  const ys: (number | null)[] = [];
  for (let i = 0; i < count; i++) {
    const x = toFinite(rawXs[i]);
    // A null y is a real statement (undefined here), not junk — but a missing
    // x is nothing to plot against, so the pair is dropped.
    if (x === null || (xs.length > 0 && x <= xs[xs.length - 1])) continue;
    const rawY = rawYs[i];
    const y = rawY === null ? null : toFinite(rawY);
    if (y === null && rawY !== null) continue;
    xs.push(x);
    ys.push(y === null ? null : Math.max(-1e6, Math.min(1e6, y)));
  }
  if (xs.length < 8) return undefined;
  // A graph of all gaps is an empty frame: at least two real points, or the
  // axes scale against Infinity and the curve is nothing.
  if (ys.filter((y) => y !== null).length < 2) return undefined;
  const vline = (value: unknown): { x: number; label?: string } | null => {
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    const at = toFinite(item.x);
    if (at === null) return null;
    return { x: at, label: asString(item.label).slice(0, 40) || undefined };
  };
  const hline = (value: unknown): { y: number; label?: string } | null => {
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    const at = toFinite(item.y);
    if (at === null) return null;
    return { y: at, label: asString(item.label).slice(0, 40) || undefined };
  };
  const vlines = (Array.isArray(raw.vlines) ? raw.vlines : [])
    .map(vline)
    .filter((item): item is { x: number; label?: string } => item !== null)
    .slice(0, 4);
  const hlines = (Array.isArray(raw.hlines) ? raw.hlines : [])
    .map(hline)
    .filter((item): item is { y: number; label?: string } => item !== null)
    .slice(0, 4);
  return {
    title: asString(raw.title).slice(0, 120) || undefined,
    xlabel: asString(raw.xlabel).slice(0, 24) || undefined,
    ylabel: asString(raw.ylabel).slice(0, 24) || undefined,
    xs,
    ys,
    vlines: vlines.length > 0 ? vlines : undefined,
    hlines: hlines.length > 0 ? hlines : undefined,
  };
}

/**
 * A placed block only survives if it lands on the grid and says something.
 *
 * The model places these by hand, so the numbers arrive wrong in every way a
 * JSON field can be wrong: off the canvas, negative, half a pixel wide, or a
 * card with no words in it. Each is clamped or dropped here, because a block
 * that overflows the slide would hide the caption and a block of nothing would
 * leave a hole in the middle of the page.
 *
 * The smallest allowed box is deliberately generous: narrower than a tenth of
 * the canvas and text cannot be read at it, so such a box is not a layout the
 * author meant.
 */
const MIN_BLOCK = 60;
const MAX_BLOCKS = 10;

export function sanitizeBlocks(raw: unknown): SlideBlock[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const blocks: SlideBlock[] = [];
  for (const item of raw) {
    if (blocks.length >= MAX_BLOCKS) break;
    if (!item || typeof item !== "object") continue;
    const block = item as Record<string, unknown>;
    const kind = asString(block.kind);
    if (!SLIDE_BLOCK_KINDS.includes(kind as SlideBlockKind)) continue;
    const w = Math.min(
      SLIDE_GRID.width,
      Math.max(MIN_BLOCK, asNumber(block.w, 0)),
    );
    const h = Math.min(
      SLIDE_GRID.height,
      Math.max(MIN_BLOCK, asNumber(block.h, 0)),
    );
    // Clamping the origin keeps a block inside the canvas even when the model
    // pushed it past the edge: the width is already known, so the slide still
    // gets the box it asked for.
    const x = Math.max(0, Math.min(SLIDE_GRID.width - w, asNumber(block.x, 0)));
    const y = Math.max(0, Math.min(SLIDE_GRID.height - h, asNumber(block.y, 0)));
    const text = asString(block.text).slice(0, 300);
    const label = asString(block.label).slice(0, 60) || undefined;
    const imagePrompt =
      asString(block.imagePrompt).slice(0, 400) || undefined;
    const imageQuery = asString(block.imageQuery).slice(0, 120) || undefined;
    // Every kind needs its own something: words for the four text kinds, a way
    // to find the picture for the fifth, a formula for the sixth. A shape or a
    // rule is pure geometry — a box or a line needs no words of its own, it is
    // the thing other blocks sit on or against.
    const usable =
      kind === "image"
        ? Boolean(imagePrompt || imageQuery)
        : kind === "formula"
          ? text.length > 0
          : kind === "shape" || kind === "rule"
            ? true
            : text.length > 0 || Boolean(label);
    if (!usable) continue;
    // The text has to fit the box it was placed in. The prompt asks the model to
    // check this against the same table; doing it here as well means a slide
    // that ignored the rule still reads from the back of the room instead of
    // running off the bottom of the page.
    const cqw =
      kind === "title"
        ? BLOCK_TYPE_CQW.title
        : kind === "subtitle"
          ? BLOCK_TYPE_CQW.subtitle
          : kind === "card"
            ? BLOCK_TYPE_CQW.card
            : BLOCK_TYPE_CQW.text;
    const fitted = text.length
      ? fitBlockText(text, w, h, cqw)
      : undefined;
    if (kind !== "image" && kind !== "formula" && kind !== "shape" && kind !== "rule" && !fitted) continue;
    blocks.push({
      kind: kind as SlideBlockKind,
      x,
      y,
      w,
      h,
      text: fitted || undefined,
      label,
      imagePrompt,
      imageQuery,
    });
  }
  return blocks.length > 0 ? blocks : undefined;
}

export function coerceLesson(input: unknown): Lesson | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const rawScenes = Array.isArray(raw.scenes) ? raw.scenes : [];
  if (rawScenes.length === 0) return null;

  const scenes: LessonScene[] = rawScenes.slice(0, MAX_LESSON_SCENES).map((item, index) => {
    const scene = (item ?? {}) as Record<string, unknown>;
    const kind = SCENE_KINDS.includes(scene.kind as SceneKind)
      ? (scene.kind as SceneKind)
      : "concept";
    const accent = SCENE_ACCENTS.includes(scene.accent as SceneAccent)
      ? (scene.accent as SceneAccent)
      : "brand";
    const bullets = asStringArray(scene.bullets, 7);
    const quizRaw = scene.quiz as Record<string, unknown> | undefined;
    const quiz = quizRaw && typeof quizRaw === "object" ? {
      question: asString(quizRaw.question, "Câu hỏi kiểm tra kiến thức:"),
      options: Array.isArray(quizRaw.options)
        ? quizRaw.options.map((opt: Record<string, unknown>, optIdx: number) => ({
            id: asString(opt.id) || `opt-${optIdx + 1}`,
            text: asString(opt.text, `Lựa chọn ${optIdx + 1}`),
            isCorrect: Boolean(opt.isCorrect),
            explanation: asString(opt.explanation) || undefined,
          }))
        : [],
    } : undefined;

    const simRaw = scene.simulation3d as Record<string, unknown> | undefined;
    const simulation3d = simRaw && typeof simRaw === "object" ? {
      type: (["physics-pendulum", "neural-network", "molecule", "solar-orbit"].includes(asString(simRaw.type))
        ? asString(simRaw.type)
        : "physics-pendulum") as "physics-pendulum" | "neural-network" | "molecule" | "solar-orbit",
    } : (kind === "simulation3d" ? { type: "physics-pendulum" as const } : undefined);

    // Figures are only kept when they are actually plottable: a label and a
    // finite number. A chart of blanks is worse than no chart.
    const rawData = Array.isArray(scene.data) ? scene.data : [];
    const data = rawData
      .map((point) => {
        if (!point || typeof point !== "object") return null;
        const item = point as Record<string, unknown>;
        const value = asNumber(item.value, Number.NaN);
        const label = asString(item.label).slice(0, 60);
        if (!label || !Number.isFinite(value)) return null;
        return {
          label,
          value,
          unit: asString(item.unit).slice(0, 16) || undefined,
          note: asString(item.note).slice(0, 90) || undefined,
        };
      })
      .filter((point): point is NonNullable<typeof point> => point !== null)
      // Capped after filtering: junk entries should not eat the display budget
      // that real figures need.
      .slice(0, 6);

    // A sampled graph, validated point by point (see buildGraph).
    const graph =
      scene.graph && typeof scene.graph === "object"
        ? buildGraph(scene.graph as Record<string, unknown>)
        : undefined;

    // A table only survives if it is rectangular: a row with a missing cell
    // would render as a gap, and a ragged table looks like a rendering bug.
    const rawTable = scene.table as Record<string, unknown> | undefined;
    const table = rawTable && typeof rawTable === "object" ? buildTable(rawTable) : undefined;

    // The pointer script only survives with targets the stage can find: a cue
    // naming anything else would park the pointer nowhere, which reads as a
    // bug rather than as restraint.
    const rawPointer = Array.isArray(scene.pointer) ? scene.pointer : [];
    const pointer = rawPointer
      .map((cue) => {
        if (!cue || typeof cue !== "object") return null;
        const item = cue as Record<string, unknown>;
        const target = asString(item.target).slice(0, 20);
        if (!POINTER_TARGETS.includes(target)) return null;
        return {
          target,
          label: asString(item.label).slice(0, 120) || undefined,
        };
      })
      .filter((cue): cue is NonNullable<typeof cue> => cue !== null)
      .slice(0, 10);

    return {
      id: asString(scene.id) || `scene-${index + 1}`,
      kind,
      accent,
      title: asString(scene.title, `Cảnh ${index + 1}`).slice(0, 160),
      subtitle: asString(scene.subtitle).slice(0, 240) || undefined,
      bullets: bullets.length > 0 ? bullets : ["(chưa có nội dung)"],
      // Board solution lines: one entry per step, capped like bullets. Empty
      // or whitespace-only steps are dropped so the list never numbers a gap.
      steps: (() => {
        const raw = asStringArray(scene.steps, 6)
          .map((step) => step.slice(0, 140).trim())
          .filter(Boolean);
        return raw.length > 0 ? raw : undefined;
      })(),
      formula: asString(scene.formula).slice(0, 200) || undefined,
      data: data.length > 0 ? data : undefined,
      graph,
      table,
      imageQuery: asString(scene.imageQuery).slice(0, 120) || undefined,
      imagePrompt: asString(scene.imagePrompt).slice(0, 500) || undefined,
      // Only a name the slide is allowed to use survives. See SLIDE_ICON_NAMES
      // for why this is a closed list rather than anything lucide exports.
      icon: SLIDE_ICON_NAMES.includes(asString(scene.icon))
        ? asString(scene.icon)
        : undefined,
      visualNote: asString(scene.visualNote).slice(0, 400) || undefined,
      narration: asString(scene.narration).slice(0, 900) || undefined,
      pointer: pointer.length > 0 ? pointer : undefined,
      // Free layout first: an explicit arrangement beats the layout the scene's
      // contents would otherwise imply. Both are optional and the renderer falls
      // back to the layout when blocks are missing.
      blocks: sanitizeBlocks(scene.blocks),
      layout: SLIDE_LAYOUTS.includes(asString(scene.layout) as SlideLayout)
        ? (asString(scene.layout) as SlideLayout)
        : undefined,
      quiz,
      simulation3d,
      start: asNumber(scene.start, 0),
      duration: Math.min(90, Math.max(2.5, asNumber(scene.duration, 7))),
    };
  });

  const rawChapters = Array.isArray(raw.chapters) ? raw.chapters : [];
  const chapters: LessonChapter[] = rawChapters
    .slice(0, 16)
    .map((item, index) => {
      const chapter = (item ?? {}) as Record<string, unknown>;
      // A chapter may legitimately span the whole deck, so this needs the same
      // ceiling as the scene list — at 24 it silently dropped the ids of any
      // chapter in a long lesson, leaving those scenes orphaned.
      const sceneIds = asStringArray(chapter.sceneIds, MAX_LESSON_SCENES).filter((id) =>
        scenes.some((scene) => scene.id === id),
      );
      return {
        id: asString(chapter.id) || `ch-${index + 1}`,
        title: asString(chapter.title, `Chương ${index + 1}`).slice(0, 160),
        start: asNumber(chapter.start, 0),
        end: asNumber(chapter.end, 0),
        sceneIds,
      };
    })
    .filter((chapter) => chapter.sceneIds.length > 0);

  const lesson = relayoutLesson({
    id: asString(raw.id) || `lesson-${Date.now().toString(36)}`,
    title: asString(raw.title, "Bài giảng chưa có tên").slice(0, 200),
    subject: asString(raw.subject, "Chung").slice(0, 80),
    grade: asString(raw.grade).slice(0, 80) || undefined,
    language: asString(raw.language, "vi").slice(0, 12),
    fps: Math.min(120, Math.max(12, asNumber(raw.fps, 30))),
    duration: 0,
    scenes,
    chapters,
    source: raw.source === "gemini" ? "gemini" : "sample",
    // A theme this build does not know still has to render. The player resolves
    // the id through the registry, so passing an unknown one through is safe and
    // a deck written against an older palette keeps the id it was saved with.
    theme: asString(raw.theme).slice(0, 40) || DEFAULT_SLIDE_THEME,
    motion: isSlideMotion(asString(raw.motion)) ? asString(raw.motion) : DEFAULT_SLIDE_MOTION,
    // Unknown patterns fall back to plain: a mistyped id must never blank a
    // slide, the same guarantee the theme above makes.
    pattern: isSlidePattern(asString(raw.pattern)) ? asString(raw.pattern) : DEFAULT_SLIDE_PATTERN,
    voice: asString(raw.voice).slice(0, 60) || undefined,
    showPointer: raw.showPointer === false ? false : true,
    pointerColor:
      /^#[0-9a-fA-F]{6}$/.test(asString(raw.pointerColor).trim())
        ? asString(raw.pointerColor).trim()
        : undefined,
    model: asString(raw.model).slice(0, 80) || undefined,
    createdAt: asString(raw.createdAt) || new Date().toISOString(),
  });

  return lesson;
}
