import fs from "node:fs/promises";
import path from "node:path";
import type { Lesson, LessonScene } from "../lesson/types.ts";
import { coerceLesson } from "../lesson/validate.ts";
import { sanitizeRunLog, type RunLogEntry } from "../lesson/run-log.ts";
import { decryptText, encryptText } from "./crypto-vault.ts";
import { deleteTtsCacheForLesson } from "./tts-cache.ts";

/**
 * Server-side course library with Latin-Chinese AES-256-GCM encryption.
 *
 * Courses are stored in `data/courses/` as encrypted files with Latin-Chinese
 * glyph representation. They can only be accessed through EdusGPT.
 */

export const COURSES_DIR = path.join(process.cwd(), "data", "courses");
export const TEMP_DELETE_DIR = path.join(process.cwd(), "data", "temp_delete");

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

export interface GenerationDraft {
  id: string;
  title: string;
  subject: string;
  total: number;
  done: number;
  message: string;
  updatedAt: string;
  error?: string;
  voice?: string;
  scenes?: unknown[];
}

function draftFor(id: string): string {
  return path.join(COURSES_DIR, `${id}.draft.json`);
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(COURSES_DIR, { recursive: true });
}

async function ensureTempDeleteDir(): Promise<void> {
  await fs.mkdir(TEMP_DELETE_DIR, { recursive: true });
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

interface CachedSummary {
  mtimeMs: number;
  summary: CourseSummary;
}
const summaryCache = new Map<string, CachedSummary>();

export async function listCourses(): Promise<CourseSummary[]> {
  await ensureDir();
  const fileNames = (await fs.readdir(COURSES_DIR)).filter(
    (name) => name.endsWith(".json") && !name.endsWith(".draft.json"),
  );
  const currentSet = new Set(fileNames);
  for (const name of summaryCache.keys()) {
    if (!currentSet.has(name)) summaryCache.delete(name);
  }

  const summaries = await Promise.all(
    fileNames.map(async (name) => {
      const filePath = path.join(COURSES_DIR, name);
      try {
        const stats = await fs.stat(filePath);
        const cached = summaryCache.get(name);
        if (cached && cached.mtimeMs === stats.mtimeMs) {
          return cached.summary;
        }

        const raw = await fs.readFile(filePath, "utf8");
        const decrypted = decryptText(raw);
        const parsed = JSON.parse(decrypted) as { lesson: unknown; updatedAt?: string };
        const lesson = coerceLesson(parsed.lesson);
        if (!lesson) return null;
        const summary = toSummary(lesson, parsed.updatedAt ?? lesson.createdAt);
        summaryCache.set(name, { mtimeMs: stats.mtimeMs, summary });
        return summary;
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
    const decrypted = decryptText(raw);
    const parsed = JSON.parse(decrypted) as { lesson: unknown };
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
    const decrypted = decryptText(raw);
    const parsed = JSON.parse(decrypted) as { log?: unknown };
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

  const target = fileFor(lesson.id);
  const temp = `${target}.${process.pid}.tmp`;
  const payload = {
    format: "eduai-studio/course@1",
    updatedAt: new Date().toISOString(),
    lesson,
    log: sanitizeRunLog(log) ?? undefined,
  };

  const plainJson = JSON.stringify(payload, null, 2);
  const encryptedPayload = encryptText(plainJson);

  await fs.writeFile(temp, `${encryptedPayload}\n`, "utf8");
  await fs.rename(temp, target);
  await deleteDraft(lesson.id);

  summaryCache.delete(`${lesson.id}.json`);
  return lesson;
}

/**
 * Permanently delete a course and its associated audio cache.
 */
export async function deleteCourse(id: string): Promise<boolean> {
  if (!isValidCourseId(id)) return false;
  try {
    const lesson = await readCourse(id);
    if (lesson) {
      await deleteTtsCacheForLesson(lesson).catch(() => {});
    }
    await fs.unlink(fileFor(id));
    await fs.unlink(draftFor(id)).catch(() => null);
    summaryCache.delete(`${id}.json`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Soft delete: Move course file to `data/temp_delete/${timestamp}_${id}.json`
 * Preserves the file in trash for safe recovery.
 */
export async function softDeleteCourse(id: string): Promise<{ ok: boolean; path: string }> {
  if (!isValidCourseId(id)) {
    return { ok: false, path: "" };
  }
  await ensureTempDeleteDir();
  const sourcePath = fileFor(id);
  const targetName = `${Date.now()}_${id}.json`;
  const targetPath = path.join(TEMP_DELETE_DIR, targetName);

  try {
    await fs.rename(sourcePath, targetPath);
    await fs.unlink(draftFor(id)).catch(() => null);
    summaryCache.delete(`${id}.json`);
    return { ok: true, path: targetPath };
  } catch {
    return { ok: false, path: "" };
  }
}

/**
 * Trim storage: Remove slide presentations & narration audio to save disk space,
 * retaining only interactive quizzes, review flashcards (bullets & formulas), and mindmaps.
 */
export async function trimCourseContent(
  id: string,
  options: { keepQuiz?: boolean; keepFlashcards?: boolean } = { keepQuiz: true, keepFlashcards: true }
): Promise<Lesson | null> {
  const original = await readCourse(id);
  if (!original) return null;

  // 1. Delete narration audio cache from disk
  await deleteTtsCacheForLesson(original).catch(() => {});

  const keepQuiz = options.keepQuiz !== false;
  const keepFlashcards = options.keepFlashcards !== false;

  const preservedScenes: LessonScene[] = [];
  let currentTime = 0;

  for (let i = 0; i < original.scenes.length; i++) {
    const s = original.scenes[i];
    const isQuiz = s.kind === "quiz" || Boolean(s.quiz);

    if (isQuiz) {
      if (keepQuiz) {
        preservedScenes.push({
          ...s,
          narration: "", // Clear narration to save space & decouple audio
          image: undefined,
          imagePrompt: undefined,
          imageQuery: undefined,
          start: currentTime,
          duration: Math.max(15, s.duration),
        });
        currentTime += Math.max(15, s.duration);
      }
    } else {
      if (keepFlashcards) {
        // Retain as a concise review flashcard
        preservedScenes.push({
          id: s.id,
          kind: s.kind === "summary" || s.kind === "formula" ? s.kind : "concept",
          accent: s.accent,
          title: s.title,
          subtitle: s.subtitle,
          bullets: s.bullets,
          formula: s.formula,
          mindmap: s.mindmap,
          narration: "", // Clear audio narration
          image: undefined, // Drop heavy illustrations
          imagePrompt: undefined,
          imageQuery: undefined,
          simulation3d: undefined,
          start: currentTime,
          duration: 10,
        });
        currentTime += 10;
      }
    }
  }

  // If everything was stripped, preserve at least a minimal summary card
  if (preservedScenes.length === 0) {
    preservedScenes.push({
      id: "summary-review",
      kind: "summary",
      accent: "brand",
      title: `${original.title} (Thẻ ôn tập)`,
      bullets: ["Nội dung đã được tối ưu dung lượng."],
      narration: "",
      start: 0,
      duration: 10,
    });
    currentTime = 10;
  }

  const trimmedLesson: Lesson = {
    ...original,
    scenes: preservedScenes,
    duration: currentTime,
    chapters: [
      {
        id: "ch-review",
        title: "Nội dung ôn tập (Quiz & Flashcards)",
        start: 0,
        end: currentTime,
        sceneIds: preservedScenes.map((s) => s.id),
      },
    ],
  };

  await saveCourse(trimmedLesson);
  return trimmedLesson;
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
  summaryCache.clear();
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
  const plainJson = JSON.stringify(payload);
  const encryptedPayload = encryptText(plainJson);

  await fs.writeFile(temp, `${encryptedPayload}\n`, "utf8");
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
        const decrypted = decryptText(raw);
        const parsed = JSON.parse(decrypted) as {
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
