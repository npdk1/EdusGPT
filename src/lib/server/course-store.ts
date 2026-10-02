import fs from "node:fs/promises";
import path from "node:path";
import type { Lesson } from "@/lib/lesson/types";
import { coerceLesson } from "@/lib/lesson/validate";

/**
 * Server-side course library.
 *
 * OpenMAIC persists courses through `/api/persistence` (browser storage by
 * default, PostgreSQL optionally). Our version had a real hole: lessons only
 * lived in `localStorage`, so switching browser or machine lost every generated
 * course. This store keeps one JSON file per course under `data/courses/`, so
 * the library survives a reinstall of the browser and can be shared between
 * browser profiles on the same machine.
 *
 * No database required — same philosophy as their default storage layer, minus
 * the browser-only limitation.
 */

export const COURSES_DIR = path.join(process.cwd(), "data", "courses");

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,80}$/i;

/** Defends against path traversal — ids come straight from URLs. */
export function isValidCourseId(id: string): boolean {
  return ID_PATTERN.test(id) && !id.includes("..");
}

export interface CourseSummary {
  id: string;
  title: string;
  subject: string;
  grade?: string;
  sceneCount: number;
  duration: number;
  createdAt: string;
  updatedAt: string;
  source: Lesson["source"];
  model?: string;
  /** Carried so the library can show a deck's paper without loading its scenes. */
  theme?: Lesson["theme"];
  /** Carried so the player opens in the voice that was chosen. */
  voice?: Lesson["voice"];
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(COURSES_DIR, { recursive: true });
}

function fileFor(id: string): string {
  return path.join(COURSES_DIR, `${id}.json`);
}

function toSummary(lesson: Lesson, updatedAt: string): CourseSummary {
  return {
    id: lesson.id,
    title: lesson.title,
    subject: lesson.subject,
    grade: lesson.grade,
    sceneCount: lesson.scenes.length,
    duration: lesson.duration,
    createdAt: lesson.createdAt,
    updatedAt,
    source: lesson.source,
    model: lesson.model,
    theme: lesson.theme,
    voice: lesson.voice,
  };
}

export async function listCourses(): Promise<CourseSummary[]> {
  await ensureDir();
  const files = (await fs.readdir(COURSES_DIR)).filter((name) =>
    name.endsWith(".json"),
  );

  const summaries = await Promise.all(
    files.map(async (name) => {
      try {
        const raw = await fs.readFile(path.join(COURSES_DIR, name), "utf8");
        const parsed = JSON.parse(raw) as { lesson: unknown; updatedAt?: string };
        const lesson = coerceLesson(parsed.lesson);
        if (!lesson) return null;
        return toSummary(lesson, parsed.updatedAt ?? lesson.createdAt);
      } catch {
        // A corrupt file must not take the whole library down.
        return null;
      }
    }),
  );

  return summaries
    .filter((item): item is CourseSummary => item !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function readCourse(id: string): Promise<Lesson | null> {
  if (!isValidCourseId(id)) return null;
  try {
    const raw = await fs.readFile(fileFor(id), "utf8");
    const parsed = JSON.parse(raw) as { lesson: unknown };
    return coerceLesson(parsed.lesson);
  } catch {
    return null;
  }
}

export async function saveCourse(lesson: Lesson): Promise<Lesson> {
  await ensureDir();
  if (!isValidCourseId(lesson.id)) {
    throw new Error(`Course id không hợp lệ: ${lesson.id}`);
  }
  // Write to a temp file then rename, so a crash mid-write cannot leave a
  // half-written course that `listCourses` would silently skip.
  const target = fileFor(lesson.id);
  const temp = `${target}.${process.pid}.tmp`;
  const payload = {
    format: "eduai-studio/course@1",
    updatedAt: new Date().toISOString(),
    lesson,
  };
  await fs.writeFile(temp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.rename(temp, target);
  return lesson;
}

export async function deleteCourse(id: string): Promise<boolean> {
  if (!isValidCourseId(id)) return false;
  try {
    await fs.unlink(fileFor(id));
    return true;
  } catch {
    return false;
  }
}

export async function deleteAllCourses(): Promise<number> {
  await ensureDir();
  const files = (await fs.readdir(COURSES_DIR)).filter((name) =>
    name.endsWith(".json"),
  );
  await Promise.all(
    files.map((name) =>
      fs.unlink(path.join(COURSES_DIR, name)).catch(() => null),
    ),
  );
  return files.length;
}

export async function renameCourse(id: string, title: string): Promise<Lesson | null> {
  const lesson = await readCourse(id);
  if (!lesson) return null;
  const next = { ...lesson, title: title.trim().slice(0, 200) || lesson.title };
  return saveCourse(next);
}
