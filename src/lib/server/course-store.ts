import fs from "node:fs/promises";
import path from "node:path";
import type { Lesson } from "@/lib/lesson/types";
import { coerceLesson } from "@/lib/lesson/validate";
import { sanitizeRunLog, type RunLogEntry } from "@/lib/lesson/run-log";

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

/**
 * A lesson that is still being written. Lives in `<id>.draft.json` next to
 * the finished courses, so the library can show a "Đang tạo…" card while the
 * run is in flight — switching to /library mid-run no longer shows nothing.
 *
 * Only the server writes drafts (the lesson route updates one per finished
 * scene and deletes it on `done`). A draft whose `updatedAt` is old and has no
 * `error` means the server died mid-run: the stream is gone and the card says
 * so instead of spinning forever.
 */
export interface GenerationDraft {
  id: string;
  title: string;
  subject: string;
  /** Planned scene count, from the outline. */
  total: number;
  /** Scenes finished so far. */
  done: number;
  /** Last status line, shown under the progress bar. */
  message: string;
  updatedAt: string;
  /** Set when the run failed instead of finishing. */
  error?: string;
}

function draftFor(id: string): string {
  return path.join(COURSES_DIR, `${id}.draft.json`);
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
  const files = (await fs.readdir(COURSES_DIR)).filter(
    (name) => name.endsWith(".json") && !name.endsWith(".draft.json"),
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

/** The run log saved alongside a finished lesson, if the client sent one. */
export async function readCourseLog(id: string): Promise<RunLogEntry[] | null> {
  if (!isValidCourseId(id)) return null;
  try {
    const raw = await fs.readFile(fileFor(id), "utf8");
    const parsed = JSON.parse(raw) as { log?: unknown };
    return sanitizeRunLog(parsed.log);
  } catch {
    return null;
  }
}

export async function saveCourse(lesson: Lesson, log?: unknown): Promise<Lesson> {
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
    // A finished lesson replaces its "Đang tạo…" draft card: same id, so the
    // library never shows both.
    log: sanitizeRunLog(log) ?? undefined,
  };
  await fs.writeFile(temp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.rename(temp, target);
  await deleteDraft(lesson.id);
  return lesson;
}

export async function deleteCourse(id: string): Promise<boolean> {
  if (!isValidCourseId(id)) return false;
  try {
    await fs.unlink(fileFor(id));
    // A leftover draft for the same id must go too, or the library keeps a
    // "Đang tạo…" card for a lesson that is already gone.
    await fs.unlink(draftFor(id)).catch(() => null);
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

/** Draft helpers — see the GenerationDraft comment above. */
export async function saveDraft(draft: GenerationDraft): Promise<void> {
  await ensureDir();
  if (!isValidCourseId(draft.id)) {
    throw new Error(`Draft id không hợp lệ: ${draft.id}`);
  }
  const payload = {
    format: "eduai-studio/draft@1",
    updatedAt: new Date().toISOString(),
    draft,
  };
  const target = draftFor(draft.id);
  const temp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(payload)}\n`, "utf8");
  await fs.rename(temp, target);
}

export async function listDrafts(): Promise<GenerationDraft[]> {
  await ensureDir();
  const files = (await fs.readdir(COURSES_DIR)).filter((name) =>
    name.endsWith(".draft.json"),
  );
  const drafts = await Promise.all(
    files.map(async (name) => {
      try {
        const raw = await fs.readFile(path.join(COURSES_DIR, name), "utf8");
        const parsed = JSON.parse(raw) as {
          draft?: GenerationDraft;
          updatedAt?: string;
        };
        if (!parsed.draft || parsed.draft.id !== name.slice(0, -".draft.json".length)) {
          return null;
        }
        return { ...parsed.draft, updatedAt: parsed.updatedAt ?? parsed.draft.updatedAt };
      } catch {
        return null;
      }
    }),
  );
  return drafts
    .filter((item): item is GenerationDraft => item !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteDraft(id: string): Promise<boolean> {
  if (!isValidCourseId(id)) return false;
  try {
    await fs.unlink(draftFor(id));
    return true;
  } catch {
    return false;
  }
}

export async function renameCourse(id: string, title: string): Promise<Lesson | null> {
  const lesson = await readCourse(id);
  if (!lesson) return null;
  const next = { ...lesson, title: title.trim().slice(0, 200) || lesson.title };
  return saveCourse(next);
}
