/**
 * Lesson data model. A lesson is a deterministic, seekable timeline:
 * every scene has an explicit `start`/`duration` (seconds), so the player can
 * jump anywhere — forwards or backwards — and GSAP can seek to that exact time
 * instead of relying on "play through and hope".
 *
 * This mirrors the Hyperframes-style export used by OpenMAIC (a browser-built,
 * self-contained GSAP timeline rendered to MP4) but adds live scrubbing.
 */

/**
 * The Lucide icons a generated slide is allowed to use.
 *
 * A closed list, and that is the point. Handing the model the whole Lucide
 * catalogue invites it to pick `Anchor` for a slide about chemistry, and a
 * literal that is a real icon but means nothing is worse on a teaching slide
 * than no icon at all — it looks like a decision rather than an accident. The
 * list below is grouped by what a lesson is actually about, so the model picks
 * from meaning rather than from vibes.
 *
 * The names are the real exported identifiers in `lucide-react`, and
 * `scripts/check-icons.mjs` fails the build if one of them ever stops existing
 * or if a name is used that is not on this list. That check is the reason to
 * keep the list here instead of writing it into the prompt and hoping.
 */

/** Subjects, in the order a teacher is most likely to reach for one. */
export const SLIDE_ICON_SETS = {
  /** Vật lí, kỹ thuật, cơ khí. */
  science: [
    "Atom", "FlaskConical", "Telescope", "Microscope", "Rocket", "Waves",
    "Zap", "Gauge", "Thermometer", "Orbit", "Magnet", "Sun",
  ],
  /** Sinh học, thể chất, y tế, môi trường. */
  biology: [
    "Dna", "Leaf", "HeartPulse", "Brain", "Eye", "Bone", "Bug",
    "Trees", "Sprout", "PawPrint", "Activity", "Salad",
  ],
  /** Toán, kỹ thuật số, thống kê. */
  math: [
    "Sigma", "Calculator", "FunctionSquare", "BarChart3", "TrendingUp",
    "PieChart", "Ruler", "Compass", "Grid3x3", "Binary", "Percent",
  ],
  /** Lập trình, mạng, dữ liệu. */
  tech: [
    "Code2", "Terminal", "Database", "Server", "Cpu", "Network",
    "GitBranch", "Braces", "FileCode2", "Cloud", "Wifi", "Lock",
  ],
  /** Lịch sử, văn hoá, địa lí, xã hội. */
  society: [
    "Landmark", "ScrollText", "Globe2", "Map", "MapPin", "Users",
    "Scale", "Gavel", "BookOpen", "Building2", "Handshake", "Vote",
  ],
  /** Kinh tế, kinh doanh, khoản đầu tư. */
  economy: [
    "TrendingUp", "Banknote", "PiggyBank", "Briefcase", "ShoppingCart",
    "Factory", "Receipt", "LineChart", "HandCoins", "Building",
  ],
  /** Nghệ thuật, thiết kế, sáng tạo. */
  art: [
    "Palette", "Brush", "Music", "Camera", "Film", "Clapperboard",
    "PenTool", "Shapes", "Sparkles", "Drama",
  ],
  /** Chung, khi bài không thuộc môn nào rõ ràng. */
  general: [
    "Lightbulb", "Target", "Compass", "KeyRound", "Search", "Repeat",
    "Layers", "Flag", "CircleCheck", "ArrowRight", "Clock", "Star",
  ],
} as const;

export type SlideIconName = (typeof SLIDE_ICON_SETS)[keyof typeof SLIDE_ICON_SETS][number];

/** Every allowed name, de-duplicated. Used by validation and by the check script. */
export const SLIDE_ICON_NAMES: readonly string[] = [
  ...new Set(Object.values(SLIDE_ICON_SETS).flat()),
];

/**
 * The set for a subject, matched on the words a Vietnamese lesson would use.
 *
 * A miss is not a failure: the model is given every name as the fallback, so an
 * unfamiliar subject still gets an icon rather than a blank slot.
 */
export function iconSetFor(subject: string | undefined): readonly string[] {
  const text = (subject ?? "").toLowerCase();
  const table: [RegExp, keyof typeof SLIDE_ICON_SETS][] = [
    [/vật lí|physics|cơ khí|điện|quang|âm|năng lượng/, "science"],
    [/sinh học|biology|thể chất|thể dục|y tế|sức khỏe|sinh|khám/, "biology"],
    [/toán|math|kỹ thuật số|thống kê|đại số|hình học/, "math"],
    [/lập trình|programming|tin học|công nghệ|dữ liệu|mạng|phần mềm|ai/, "tech"],
    [/lịch sử|địa lí|văn hoá|xã hội|chính trị|luật|giáo dục civics/, "society"],
    [/kinh tế|kinh doanh|marketing|tài chính|đầu tư|thương mại|kế toán/, "economy"],
    [/nghệ thuật|văn học|thiết kế|âm nhạc|điện ảnh|thể thao/, "art"],
  ];
  for (const [pattern, set] of table) {
    if (pattern.test(text)) return SLIDE_ICON_SETS[set];
  }
  return SLIDE_ICON_NAMES;
}

export const SCENE_KINDS = [
  "cover",
  "concept",
  "formula",
  "diagram",
  "simulation3d",
  "example",
  "quiz",
  "summary",
] as const;

export type SceneKind = (typeof SCENE_KINDS)[number];

/**
 * How a slide arranges itself.
 *
 * One layout for the whole deck is what makes generated slides look generated:
 * every scene is a title over a two-column bullet list, so a deck of twelve
 * scenes reads as twelve variations of the same page. The model picks a layout
 * per scene instead, and the renderer has a real arrangement for each — which is
 * the cheapest way to make a deck look designed without free-form coordinates.
 *
 * The names say what the slide *is*, not where things sit; the renderer owns
 * the geometry.
 */
export const SLIDE_LAYOUTS = [
  "cover",
  "spotlight",
  "quote",
  "flow",
  "compare",
  "statement",
  "two-col",
  "cards",
  "image-left",
  "image-right",
  "full-figure",
] as const;

export type SlideLayout = (typeof SLIDE_LAYOUTS)[number];

/**
 * The layout a scene gets when the model did not choose one, inferred from what
 * the scene already contains — a scene with a picture wants it beside the text, a
 * scene with only a claim wants the claim large.
 */
export function defaultSlideLayout(
  scene: {
    kind?: string;
    bullets?: unknown;
    steps?: unknown;
    imagePrompt?: unknown;
    imageQuery?: unknown;
    formula?: unknown;
    data?: unknown;
    table?: unknown;
    graph?: unknown;
    simulation3d?: unknown;
  },
): SlideLayout {
  const bullets = Array.isArray(scene.bullets) ? scene.bullets.length : 0;
  const steps = Array.isArray(scene.steps) ? scene.steps.length : 0;
  const hasFigure = Boolean(
    scene.formula || scene.data || scene.table || scene.graph || scene.simulation3d,
  );
  const hasPicture = Boolean(
    (typeof scene.imagePrompt === "string" && scene.imagePrompt.trim()) ||
      (typeof scene.imageQuery === "string" && scene.imageQuery.trim()),
  );
  if (scene.kind === "cover" && bullets <= 1) return "cover";
  if (hasFigure) return "full-figure";
  // A worked sequence reads as a journey, not a list: the steps become stations
  // on a line, which is friendlier to follow than a numbered column.
  if (steps >= 2) return "flow";
  // Pairs of ideas side by side want the dividing line that says "these are
  // rivals", not the equal cards that say "these are the same kind of thing".
  if (bullets >= 4) return "compare";
  if (hasPicture && bullets >= 2) return "image-right";
  if (bullets >= 5) return "cards";
  if (bullets >= 3) return "two-col";
  // One idea and nothing to support it: give the idea the whole slide.
  if (bullets <= 1) return "spotlight";
  return "statement";
}

/**
 * The free-layout grid a scene may place blocks on: 1000 × 562.5, the same
 * canvas OpenMAIC draws on, which is a 16:9 frame at "1000 units wide".
 */
export const SLIDE_GRID = { width: 1000, height: 562.5 } as const;

export const SLIDE_BLOCK_KINDS = [
  "title",
  "subtitle",
  "text",
  "card",
  "formula",
  "image",
] as const;

export type SlideBlockKind = (typeof SLIDE_BLOCK_KINDS)[number];

/**
 * One placed piece of a slide.
 *
 * Coordinates are in grid units, not pixels: the renderer turns them into
 * percentages of the slide, so the same numbers work on a phone and on a wall.
 * The alternative — a fixed arrangement per layout — cannot put a picture
 * above three cards, which is most of what a designed slide does.
 */
export interface SlideBlock {
  kind: SlideBlockKind;
  /** Left edge, in grid units from the left. */
  x: number;
  /** Top edge, in grid units from the top. */
  y: number;
  /** Width in grid units. */
  w: number;
  /** Height in grid units. */
  h: number;
  /** The words: a headline, a paragraph, a card's body, or a formula. */
  text?: string;
  /** A small line above a card, naming what the card is about. */
  label?: string;
  /** Picture blocks carry their own prompt or search keyword. */
  imagePrompt?: string;
  imageQuery?: string;
}

export const SCENE_ACCENTS = ["brand", "gold", "ember"] as const;
export type SceneAccent = (typeof SCENE_ACCENTS)[number];

/**
 * The slide's paper, chosen when the lesson is written. See `themes.ts` for the
 * catalogue and what a palette actually contains.
 *
 * An open string rather than a union of the preset ids: the registry is a
 * catalogue the picker offers, not the validation schema, and a lesson is
 * expected to outlive any particular set of swatches. Anything unrecognised
 * resolves through `resolveSlideTheme`.
 */
export type SlideTheme = string;

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
  explanation?: string;
}

/**
 * One step of the pointer script: which slide part the pointer holds on while
 * the matching narration sentence is read.
 *
 * `target` is a closed list of DOM anchors the stage knows how to find
 * (`title`, `subtitle`, `bullet-0`…`bullet-6`, `step-0`…`step-5`, `formula`,
 * `table`, `chart`, `graph`, `image`, `quiz`). A cue per narration sentence,
 * `image`, `quiz`). A cue per narration sentence, in order; the player follows
 * the sentence index exactly like the karaoke caption does.
 */
export interface PointerCue {
  target: string;
  /** Why the pointer stops here; never rendered, keeps cues honest. */
  label?: string;
}

/** Every anchor the pointer script may name. `bullet-N` runs to 6 (max bullets), `step-N` runs to 5 (max steps). */
export const POINTER_TARGETS: readonly string[] = [
  "title",
  "subtitle",
  "bullet-0",
  "bullet-1",
  "bullet-2",
  "bullet-3",
  "bullet-4",
  "bullet-5",
  "bullet-6",
  "step-0",
  "step-1",
  "step-2",
  "step-3",
  "step-4",
  "step-5",
  "formula",
  "table",
  "chart",
  "graph",
  "image",
  "quiz",
];

export interface Simulation3DConfig {
  type: "physics-pendulum" | "neural-network" | "molecule" | "solar-orbit";
  parameters?: Record<string, number>;
}

/** A number the lesson actually shows, with the unit it was measured in. */
/** A real image found on the open web, together with who owns it. */
export interface SlideImage {
  url: string;
  title: string;
  credit: string;
  sourcePage: string;
  /**
   * Archive pictures carry their licence and size; AI-generated ones have
   * neither, so all three stay optional and nothing renders off them.
   */
  license?: string;
  width?: number;
  height?: number;
}

export interface DataPoint {
  label: string;
  value: number;
  unit?: string;
  /** What this number is, e.g. "GDP 2023". Shown under the label. */
  note?: string;
}

/**
 * A spec/lookup table, the shape a teacher actually writes on the board:
 * "9 × 1 = 9", "dân số các tỉnh", "công thức hoá học".
 *
 * Cells stay plain strings on purpose — a multiplication table is not a number
 * dataset, and forcing every cell into `{label, value}` loses the left-hand
 * side. KaTeX inside a cell is rendered as literal text, not maths.
 */
export interface SlideTable {
  /** Small heading above the table, e.g. "Bảng nhân 9". */
  caption?: string;
  columns: string[];
  rows: string[][];
}

/**
 * A function graph, as sampled points — the shape a teacher draws on the board
 * for rational functions, parabolas, asymptotes.
 *
 * Points, not expressions: the model cannot be trusted to emit a parseable
 * formula string, but it can sample y values across a domain. `null` marks
 * where the function is undefined so the renderer breaks the curve instead of
 * drawing a vertical slash across an asymptote. `vlines` names the vertical
 * asymptotes explicitly ("tiệm cận đứng x = 1").
 */
export interface SlideGraph {
  /** Small heading above the graph, e.g. "Đồ thị y = 1/(x - 1)". */
  title?: string;
  xlabel?: string;
  ylabel?: string;
  /** Sample x coordinates, ascending, 8–120 points. */
  xs: number[];
  /** y for each x; `null` where undefined (asymptote, hole). Same length as xs. */
  ys: (number | null)[];
  /** Vertical asymptotes / marked lines, drawn dashed. */
  vlines?: { x: number; label?: string }[];
  /** Horizontal asymptotes / marked lines, drawn dashed. */
  hlines?: { y: number; label?: string }[];
}

export interface LessonScene {
  id: string;
  kind: SceneKind;
  accent: SceneAccent;
  title: string;
  subtitle?: string;
  bullets: string[];
  /**
   * Board solution for an exercise scene, one entry per step, in order.
   *
   * Step 1 states the givens, the middle steps transform and substitute, the
   * last step is the answer. Rendered as a numbered list under the bullets so
   * the student sees the working, not just the result; the narration speaks
   * each step in words while the pointer holds on it.
   */
  steps?: string[];
  /**
   * Math in LaTeX, typeset with KaTeX. Plain text like "F = m · a" renders
   * fine too — KaTeX passes it through unchanged.
   */
  formula?: string;
  /** Concrete figures for this scene, drawn as a bar chart. */
  data?: DataPoint[];
  /** A sampled function graph with axes and asymptotes. Preferred over `data` whenever the scene is about how y varies with x. */
  graph?: SlideGraph;
  /** A lookup/spec table. Preferred over `data` for repeated patterns. */
  table?: SlideTable;
  /**
   * Search terms for a real illustration of this slide. English, because that is
   * what the open image archives are indexed in. Resolved to a URL at render
   * time, so a lesson stays valid when the chosen picture disappears.
   */
  imageQuery?: string;
  /**
   * A detailed English illustration prompt for AI image generation
   * (pollinations.ai), e.g. "watercolor diagram of a human heart pumping blood,
   * no text". Preferred over `imageQuery` when present: the player renders the
   * generated picture directly instead of searching the open image archive.
   */
  imagePrompt?: string;
  /** The picture actually found, with its licence. Absent when nothing matched. */
  image?: SlideImage;
  /**
   * A Lucide icon name for the slide's kicker.
   *
   * Restricted to `SLIDE_ICON_NAMES`, and dropped at validation if it is not on
   * that list. An icon is the one piece of a slide that can be confidently wrong
   * without looking wrong, so it is checked rather than trusted.
   */
  icon?: string;
  /** Short caption describing the visual content of this slide. */
  visualNote?: string;
  /**
   * How the slide arranges itself. See `SLIDE_LAYOUTS`; when absent the
   * renderer infers one from what the scene contains.
   */
  layout?: SlideLayout;
  /**
   * An explicit arrangement for this slide, in `SLIDE_GRID` units.
   *
   * Optional and last resort: a slide without blocks uses its layout, which is
   * what every lesson written before this field existed renders as. Blocks that
   * do not survive validation are dropped, and a scene that keeps too few falls
   * back to the layout too.
   */
  blocks?: SlideBlock[];
  narration?: string;
  /**
   * The pointer script, synced to the narration sentence by sentence.
   *
   * `pointer[i]` names the slide part the pointer holds on while sentence `i`
   * of the narration is read. Optional so older lessons still play; when
   * absent or shorter than the sentence count, the pointer parks on the title.
   */
  pointer?: PointerCue[];
  quiz?: {
    question: string;
    options: QuizOption[];
  };
  simulation3d?: Simulation3DConfig;
  /** Start time in seconds on the lesson timeline. */
  start: number;
  /** Length in seconds. */
  duration: number;
}

export interface LessonChapter {
  id: string;
  title: string;
  start: number;
  end: number;
  sceneIds: string[];
}

export interface Lesson {
  id: string;
  title: string;
  subject: string;
  grade?: string;
  language: string;
  /**
   * The paper every slide is drawn on.
   *
   * Defaults to "paper" so a lesson saved before this field existed still renders:
   * an absent theme must not throw, and a white slide is the closer match to what
   * those lessons were drawn as.
   */
  theme?: SlideTheme;
  /**
   * The narration voice, chosen in the studio.
   *
   * Carried on the lesson so the player opens speaking in the voice the teacher
   * picked by ear, rather than making them find the setting again on every deck.
   */
  voice?: string;
  /**
   * Whether the teacher's pointer dot follows the narration on the slides.
   *
   * Absent means on: every lesson saved before this setting existed plays
   * with the pointer, and the studio switch defaults to on.
   */
  showPointer?: boolean;
  /**
   * Pointer dot/ring/wash colour as `#rrggbb`. The player converts it to the
   * `--pointer-rgb` variable on the stage; anything that is not a 6-digit hex
   * is dropped at validation and the stage falls back to amber.
   */
  pointerColor?: string;
  /** Playback/step granularity used by the frame-step buttons. */
  fps: number;
  duration: number;
  scenes: LessonScene[];
  chapters: LessonChapter[];
  source: "sample" | "gemini";
  model?: string;
  createdAt: string;
}

export const SCENE_KIND_LABEL: Record<SceneKind, string> = {
  cover: "Mở đầu",
  concept: "Khái niệm",
  formula: "Công thức",
  diagram: "Sơ đồ",
  simulation3d: "Mô phỏng 3D",
  example: "Ví dụ",
  quiz: "Trắc nghiệm tương tác",
  summary: "Tổng kết",
};

export function lessonDuration(lesson: Lesson): number {
  if (lesson.scenes.length === 0) return 0;
  const last = lesson.scenes.reduce(
    (max, scene) => Math.max(max, scene.start + scene.duration),
    0,
  );
  return Math.max(1, Math.round(last * 1000) / 1000);
}

export function sceneIndexAt(lesson: Lesson, time: number): number {
  for (let index = lesson.scenes.length - 1; index >= 0; index -= 1) {
    if (time >= lesson.scenes[index].start) return index;
  }
  return 0;
}

export function chapterIndexAt(lesson: Lesson, time: number): number {
  for (let index = lesson.chapters.length - 1; index >= 0; index -= 1) {
    if (time >= lesson.chapters[index].start) return index;
  }
  return 0;
}

/** Recomputes `start` from `duration` and rebuilds/normalises chapters. */
export function relayoutLesson(lesson: Lesson): Lesson {
  let cursor = 0;
  const scenes = lesson.scenes.map((scene) => {
    const duration = Math.min(90, Math.max(2.5, Number(scene.duration) || 6));
    const next = { ...scene, start: Math.round(cursor * 1000) / 1000, duration };
    cursor += duration;
    return next;
  });

  // Chapters are always derived from their scenes, so an imported or generated
  // lesson can never carry stale start/end values into the scrub bar.
  const declared = lesson.chapters
    .map((chapter) => {
      const members = scenes.filter((scene) => chapter.sceneIds.includes(scene.id));
      if (members.length === 0) return null;
      return {
        ...chapter,
        start: Math.min(...members.map((scene) => scene.start)),
        end: Math.max(...members.map((scene) => scene.start + scene.duration)),
      } satisfies LessonChapter;
    })
    .filter((chapter): chapter is LessonChapter => chapter !== null);

  const chapters: LessonChapter[] =
    declared.length > 0
      ? declared
      : scenes.map((scene, index) => ({
          id: `ch-${index + 1}`,
          title: scene.title,
          start: scene.start,
          end: scene.start + scene.duration,
          sceneIds: [scene.id],
        }));

  return {
    ...lesson,
    scenes,
    chapters,
    duration: Math.round(cursor * 1000) / 1000,
  };
}

export function clampTime(time: number, duration: number): number {
  if (!Number.isFinite(time)) return 0;
  return Math.min(Math.max(time, 0), Math.max(0, duration));
}

export function newLessonId(): string {
  return `lesson-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
