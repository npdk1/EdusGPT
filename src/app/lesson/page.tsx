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
  const raw = (await searchParams).c;
  const courseId = typeof raw === "string" && raw ? raw : null;
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <LessonHeader />

      <LessonClient courseId={courseId} />
    </div>
  );
}
