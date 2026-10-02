import { relayoutLesson, type Lesson } from "./types";

const LESSON_KEY = "eduai.lessons.v1";
const ACTIVE_KEY = "eduai.active-lesson.v1";
export const LESSONS_CHANGED_EVENT = "eduai:lessons-changed";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Lessons generated in /studio live in the browser — no database needed. */
export function loadStoredLessons(): Lesson[] {
  if (!isBrowser()) return [];
  const parsed = safeParse<Lesson[]>(localStorage.getItem(LESSON_KEY), []);
  return Array.isArray(parsed) ? parsed.map((lesson) => relayoutLesson(lesson)) : [];
}

export function saveStoredLesson(lesson: Lesson): Lesson[] {
  if (!isBrowser()) return [];
  const next = relayoutLesson(lesson);
  const existing = loadStoredLessons().filter((item) => item.id !== next.id);
  const merged = [next, ...existing].slice(0, 30);
  localStorage.setItem(LESSON_KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent(LESSONS_CHANGED_EVENT, { detail: next.id }));
  return merged;
}

export function deleteStoredLesson(id: string): Lesson[] {
  if (!isBrowser()) return [];
  const merged = loadStoredLessons().filter((lesson) => lesson.id !== id);
  localStorage.setItem(LESSON_KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent(LESSONS_CHANGED_EVENT, { detail: id }));
  return merged;
}

export function setActiveLessonId(id: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(ACTIVE_KEY, id);
}

export function getActiveLessonId(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACTIVE_KEY);
}
