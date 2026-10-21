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

/**
 * How many questions the closing bank asks. The deck's length decides where
 * the quiz stands between "quick self-check" and "real exam" — a micro lesson
 * gets 10, a normal one 15, a long workshop 20.
 */
export function quizQuestionTarget(sceneCount: number): number {
  if (sceneCount <= 5) return 10;
  if (sceneCount <= 15) return 15;
  return 20;
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
