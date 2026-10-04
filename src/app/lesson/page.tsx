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
    <div className="lesson-shell px-4 py-6 sm:px-6 md:flex md:h-dvh md:flex-col md:gap-2 md:overflow-hidden md:py-3">
      <LessonHeader />

      {/*
        On a desktop the page is the player, so it is sized to the window rather
        than to its content: `h-dvh` plus `overflow-hidden` means the stage, the
        transport and the AI panel fill the screen and the page itself never
        scrolls — zooming the browser re-lays it out inside the same frame
        instead of pushing the controls off the bottom. Below `md` the document
        keeps its normal flow, because a phone has no room to spare.
      */}
      <div className="flex min-h-0 flex-1 flex-col">
        <LessonClient courseId={courseId} />
      </div>
    </div>
  );
}
