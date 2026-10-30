import { sceneIndexAt, type Lesson, type QuizOption, type QuizQuestion } from "./types.ts";

/**
 * The quiz gate.
 *
 * A quiz slide used to be a slide like any other: the deck reached the end of
 * its duration and moved on, whether or not anyone had answered. In a room that
 * meant the question went past in the time it took to read it, and the answer
 * was never used.
 *
 * The deck now stops at the end of an unanswered quiz and waits. Two pure
 * functions decide where it stops and how long it then waits for the
 * explanation, so the stage only has to wire them to the clock.
 */

/** Seconds of fade-out a slide ends with, so the hold lands on a lit slide. */
const SCENE_FADE = 2;

/** Below this, a slide is too short to hold anywhere useful. */
const MIN_SLIDE = 3;

/**
 * Where the playhead must stop for the quiz at `time`, or `null` when it may
 * run.
 *
 * `answered` holds the ids of the quizzes already answered in this session, so
 * seeking back to one does not re-arm a gate the teacher already passed.
 */
export function quizHold(
  lesson: Lesson,
  time: number,
  answered: ReadonlySet<string>,
): number | null {
  const scene = lesson.scenes[sceneIndexAt(lesson, time)];
  if (scene?.kind !== "quiz" || !scene.quiz || answered.has(scene.id)) return null;
  const end = scene.start + scene.duration;
  if (scene.duration <= MIN_SLIDE) return null;
  return end - SCENE_FADE;
}

/**
 * How long the answered quiz holds the deck for reading, 5 to 10 seconds.
 *
 * `WORDS_PER_SECOND` matches the lesson-length presets: a long explanation needs
 * longer than a short one, but the answer is never held for so long that the
 * room waits on a slide nobody is reading.
 */
const WORDS_PER_SECOND = 3;
const MIN_READ = 5;
const MAX_READ = 10;

export function quizReadSeconds(explanation: string | undefined): number {
  const words = (explanation ?? "").trim().split(/\s+/).filter(Boolean).length;
  const seconds = 2 + words / WORDS_PER_SECOND;
  // Whole seconds: the slide prints this number ("in Ns"), and 8.333…s read as
  // a bug. Rounded up so the hold never undershoots the reading time it promises.
  return Math.min(MAX_READ, Math.max(MIN_READ, Math.ceil(seconds)));
}

export interface QuizTargetOptions {
  /** Whether quizzes should be generated in the lesson. Defaults to true. */
  enabled?: boolean;
  /** "auto" calculates pedagogical defaults based on scene count; "custom" enforces user min/max bounds. */
  mode?: "auto" | "custom";
  /** Minimum number of total questions. Clamped to >= 1. */
  minQuestions?: number;
  /** Maximum number of total questions. Clamped to >= minQuestions. */
  maxQuestions?: number;
  /** Custom checkpoint size per milestone. Default is typically 2 or 3. */
  checkpointSize?: number;
}

export type QuizSettings = QuizTargetOptions;

export const DEFAULT_QUIZ_SETTINGS: Required<QuizTargetOptions> = {
  enabled: true,
  mode: "auto",
  minQuestions: 5,
  maxQuestions: 25,
  checkpointSize: 3,
};

export interface QuizAllocationPlan {
  enabled: boolean;
  /** Number of checkpoint quizzes inserted mid-lesson. */
  checkpointCount: number;
  /** Questions per checkpoint quiz. */
  questionsPerCheckpoint: number;
  /** Total checkpoint questions. */
  checkpointTotal: number;
  /** Target questions for the final closing quiz. */
  finalTarget: number;
  /** Total questions across all checkpoints + final exam. */
  totalQuestions: number;
  /** Pedagogical rationale or summary note. */
  reasoning: string;
}

/**
 * Intelligent algorithm that computes the optimal quiz question allocation
 * across mid-lesson checkpoints and the final closing assessment.
 *
 * It balances pedagogical pacing with user-defined min/max bounds:
 * - Micro lessons (3-5 slides): Avoids question overload; 0 checkpoints and 5-10 final questions.
 * - Standard lessons (6-15 slides): 1 checkpoint mid-way (2-3 questions) + comprehensive closing quiz.
 * - Deep lectures (16+ slides): 2 checkpoints at 1/3 and 2/3 milestones + thorough closing exam.
 */
export function calculateOptimalQuizPlan(
  sceneCount: number,
  options?: QuizTargetOptions,
): QuizAllocationPlan {
  const enabled = options?.enabled !== false;
  if (!enabled) {
    return {
      enabled: false,
      checkpointCount: 0,
      questionsPerCheckpoint: 0,
      checkpointTotal: 0,
      finalTarget: 0,
      totalQuestions: 0,
      reasoning: "Quiz is disabled by user settings.",
    };
  }

  const mode =
    options?.mode ??
    (options?.minQuestions !== undefined || options?.maxQuestions !== undefined
      ? "custom"
      : "auto");

  let defaultCheckpointCount = 0;
  let defaultCheckpointSize = 3;
  let defaultFinalTarget = 10;

  if (sceneCount <= 5) {
    defaultCheckpointCount = 0;
    defaultCheckpointSize = 0;
    defaultFinalTarget = 10;
  } else if (sceneCount <= 15) {
    defaultCheckpointCount = 1;
    defaultCheckpointSize = 3;
    defaultFinalTarget = 15;
  } else {
    defaultCheckpointCount = 2;
    defaultCheckpointSize = 3;
    defaultFinalTarget = 20;
  }

  if (mode === "auto") {
    const checkpointTotal = defaultCheckpointCount * defaultCheckpointSize;
    return {
      enabled: true,
      checkpointCount: defaultCheckpointCount,
      questionsPerCheckpoint: defaultCheckpointSize,
      checkpointTotal,
      finalTarget: defaultFinalTarget,
      totalQuestions: checkpointTotal + defaultFinalTarget,
      reasoning: `Tự động tối ưu cho ${sceneCount} cảnh: ${defaultCheckpointCount} chặng (${defaultCheckpointSize} câu/chặng) + ${defaultFinalTarget} câu tổng kết.`,
    };
  }

  // Custom mode: calculates distribution strictly respecting minQuestions and maxQuestions
  const rawMin =
    typeof options?.minQuestions === "number" && !isNaN(options.minQuestions)
      ? Math.max(1, Math.floor(options.minQuestions))
      : 5;
  const rawMax =
    typeof options?.maxQuestions === "number" && !isNaN(options.maxQuestions)
      ? Math.max(rawMin, Math.floor(options.maxQuestions))
      : Math.max(rawMin, 25);

  const minQ = Math.min(rawMin, rawMax);
  const maxQ = Math.max(rawMin, rawMax);

  let checkpointCount = defaultCheckpointCount;
  if (maxQ <= 4 || sceneCount < 6) {
    checkpointCount = 0;
  } else if (maxQ <= 8 && checkpointCount > 1) {
    checkpointCount = 1;
  }

  const checkpointSize =
    typeof options?.checkpointSize === "number" && options.checkpointSize > 0
      ? Math.floor(options.checkpointSize)
      : checkpointCount > 0
        ? maxQ <= 8
          ? 2
          : 3
        : 0;

  const checkpointTotal = checkpointCount * checkpointSize;

  let finalTarget = defaultFinalTarget;
  if (checkpointTotal + finalTarget > maxQ) {
    finalTarget = Math.max(1, maxQ - checkpointTotal);
  }
  if (checkpointTotal + finalTarget < minQ) {
    finalTarget = Math.max(1, minQ - checkpointTotal);
  }

  finalTarget = Math.max(1, Math.min(maxQ, finalTarget));
  const totalQuestions = checkpointTotal + finalTarget;

  return {
    enabled: true,
    checkpointCount,
    questionsPerCheckpoint: checkpointSize,
    checkpointTotal,
    finalTarget,
    totalQuestions,
    reasoning: `Tuỳ chỉnh [${minQ}–${maxQ} câu]: ${checkpointCount} chặng (${checkpointSize} câu) + ${finalTarget} câu tổng kết (Tổng cộng: ${totalQuestions} câu).`,
  };
}

/**
 * How many questions the closing bank asks.
 * When called without options, preserves original fixed counts for backward compatibility.
 * When called with options, uses calculateOptimalQuizPlan.
 */
export function quizQuestionTarget(sceneCount: number, options?: QuizTargetOptions): number {
  if (!options) {
    if (sceneCount <= 5) return 10;
    if (sceneCount <= 15) return 15;
    return 20;
  }
  return calculateOptimalQuizPlan(sceneCount, options).finalTarget;
}

/**
 * The question list of a quiz scene. Old decks carry one question; every
 * mount reads both shapes through this, so the single-question look is just a
 * bank of one and no renderer needs a second code path.
 */
export function quizQuestionsOf(quiz: {
  question: string;
  options: QuizOption[];
  questions?: Array<{ question: string; options: QuizOption[] }>;
}): Array<{ question: string; options: QuizOption[] }> {
  return quiz.questions?.length ? quiz.questions : [{ question: quiz.question, options: quiz.options }];
}

/**
 * Splits the flat bank response into the checkpoint banks and the closing one.
 *
 * The model answers in one ordered list — the checkpoints first, then the
 * closing questions — because the response schema subset has no nested arrays,
 * so position is the contract. A short answer fills the earlier buckets first,
 * and a missing one is survivable: a deck with fewer questions still plays.
 */
export function splitBankQuestions(
  questions: QuizQuestion[],
  checkpointSizes: number[],
  finalTarget: number,
): { checkpoints: QuizQuestion[][]; final: QuizQuestion[] } {
  const rest = questions.slice();
  const checkpoints = checkpointSizes.map((size) => rest.splice(0, size));
  return { checkpoints, final: rest.slice(0, finalTarget) };
}

/**
 * The closing remark's tier, by ratio rather than by perfection: a 9-of-10 run
 * is an excellent result, not a middling one — the plan's thresholds are 85%
 * and 60%. Lives here, not in the component, so the boundaries are testable
 * and cannot quietly rot back to "perfect score only".
 */
export function quizPraiseTier(
  correct: number,
  total: number,
): "excellent" | "good" | "review" {
  if (correct * 100 >= total * 85) return "excellent";
  if (correct * 100 >= total * 60) return "good";
  return "review";
}

/**
 * Keeps the correct answer out of a single position.
 *
 * A real 18-question run put every correct answer first — a bank anyone can
 * beat by always pressing A, and a wrong signal for self-checking. Each
 * question's options are rotated so the correct one lands on `index % len`;
 * the texts move as a block, so wording and explanations survive untouched.
 * Applied only to model-generated banks (the route), never in coerceLesson:
 * rotating an imported hand-authored question ("Cả A và B" style) would
 * change what its options mean.
 */
export function spreadCorrectAnswers(questions: QuizQuestion[]): QuizQuestion[] {
  return questions.map((question, index) => {
    const { options } = question;
    if (options.length < 2) return question;
    const correct = options.findIndex((option) => option.isCorrect);
    if (correct < 0) return question;
    const target = index % options.length;
    if (correct === target) return question;
    const shift = (correct - target + options.length) % options.length;
    return { ...question, options: options.map((_, i) => options[(i + shift) % options.length]) };
  });
}

/**
 * Detects and purges Chinese / Han characters that occasionally leak into quiz explanations
 * from multilingual LLMs (such as Qwen, DeepSeek, GLM, etc.).
 *
 * When the lesson is in Vietnamese, models sometimes prefix explanations with
 * "正确。" or "错误。" or write Chinese sentences ("因为...", "解释：...").
 * This function translates common Chinese markers into natural Vietnamese, strips
 * remaining CJK ideographs, and ensures students ALWAYS receive a clean, friendly Vietnamese
 * explanation.
 */
export function cleanQuizExplanation(
  explanation: string | undefined | null,
  isCorrect?: boolean,
  optionText?: string,
): string {
  if (!explanation || typeof explanation !== "string") {
    if (optionText) {
      return isCorrect
        ? `Chính xác! "${optionText}" là phương án đúng.`
        : `Chưa chính xác. Đáp án đúng là: "${optionText}".`;
    }
    return isCorrect
      ? "Chính xác! Bạn đã chọn đúng phương án."
      : "Chưa chính xác. Hãy xem lại kiến thức ở các slide trước nhé!";
  }

  let text = explanation.trim();

  // Han script character detector
  const HAS_HAN = /[\u4e00-\u9fff\u3400-\u4dbf]/u;
  if (!HAS_HAN.test(text)) {
    return text;
  }

  // 1. Convert common Chinese quiz explanation markers to friendly Vietnamese
  const replacements: [RegExp, string][] = [
    [/^(?:正确|回答正确|正确答案|正确选项)[。:：,\s]*/u, "Chính xác. "],
    [/^(?:错误|回答错误|错误答案|错误选项)[。:：,\s]*/u, "Chưa đúng. "],
    [/^(?:解析|解释|原因)[。:：\s]*/u, "Lời giải: "],
    [/^(?:注意|提示)[。:：\s]*/u, "Lưu ý: "],
    [/(?<=\s|^)因为\s*/gu, "Bởi vì "],
    [/(?<=\s|^)所以\s*/gu, "Do đó "],
    [/(?<=\s|^)答案是\s*/gu, "Đáp án là "],
    [/(?<=\s|^)这是因为\s*/gu, "Đây là vì "],
    [/(?<=\s|^)不对[。!,\s]*/gu, "Không đúng. "],
    [/(?<=\s|^)是的[。!,\s]*/gu, "Đúng vậy. "],
  ];

  for (const [regex, repl] of replacements) {
    text = text.replace(regex, repl);
  }

  // Count remaining Chinese characters vs total non-whitespace length
  const hanChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/gu) || []).length;
  const nonSpaceLen = text.replace(/\s+/g, "").length;

  // 2. If the explanation was predominantly Chinese (> 20% Han characters):
  // Stripping Han characters would leave incomprehensible fragments.
  // Instead, replace with a pedagogical Vietnamese explanation!
  if (nonSpaceLen > 0 && hanChars / nonSpaceLen > 0.2) {
    if (optionText) {
      return isCorrect
        ? `Chính xác! "${optionText}" là phương án hoàn toàn chính xác.`
        : `Chưa chính xác. Đáp án đúng của câu này là: "${optionText}".`;
    }
    return isCorrect
      ? "Chính xác! Bạn đã nắm rất vững kiến thức này."
      : "Chưa chính xác. Bạn hãy ôn lại phần lý thuyết ở các slide trước nhé.";
  }

  // 3. Otherwise, strip isolated remaining Han characters and normalize whitespace
  text = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]+/gu, " ");
  text = text.replace(/\s{2,}/g, " ").replace(/\s+([.,!?:;])/g, "$1").trim();

  // If text became too short after stripping
  if (text.length < 5) {
    if (optionText) {
      return isCorrect
        ? `Chính xác! "${optionText}" là phương án đúng.`
        : `Chưa đúng. Đáp án chính xác là: "${optionText}".`;
    }
    return isCorrect ? "Chính xác!" : "Chưa chính xác.";
  }

  return text;
}

