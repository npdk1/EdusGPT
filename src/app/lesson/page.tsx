import type { Metadata } from "next";
import { LessonHeader } from "./LessonHeader";
import LessonClient from "./LessonClient";

export const metadata: Metadata = {
  title: "Lesson player · Trình phát bài giảng",
  description:
    "Scrub forward and back, loop an A→B passage and step frame by frame on a lesson timeline, with narration and subtitles that follow every word. " +
    "Tua tới, tua lui, lặp A→B và bước từng khung hình trên timeline của bài giảng, có giọng đọc và phụ đề chạy theo từng chữ.",
};

interface LessonPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LessonPage({ searchParams }: LessonPageProps) {
  // Resolved here, on the server, so the player keeps rendering server-side.
  const sp = await searchParams;
  const raw = sp.c || sp.id;
  const modeRaw = sp.mode;
  const courseId = typeof raw === "string" && raw ? raw : null;
  const initialMode =
    typeof modeRaw === "string" && (modeRaw === "quiz" || modeRaw === "flashcard")
      ? (modeRaw as "quiz" | "flashcard")
      : null;

  return (
    <div className="lesson-shell px-4 py-3 sm:px-6 lg:flex lg:h-full lg:flex-col lg:gap-2 lg:py-2">
      <LessonHeader />

      <div className="flex min-h-0 flex-1 flex-col">
        <LessonClient courseId={courseId} initialMode={initialMode} />
      </div>
    </div>
  );
}
