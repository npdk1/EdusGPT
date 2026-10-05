import { sceneIndexAt, type Lesson } from "./types.ts";

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
  if (!scene?.quiz || answered.has(scene.id)) return null;
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
  return Math.min(MAX_READ, Math.max(MIN_READ, seconds));
}
