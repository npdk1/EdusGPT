import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, KeyRound } from "lucide-react";
import LessonClient from "./LessonClient";

export const metadata: Metadata = {
  title: "Trình phát bài giảng",
  description:
    "Tua tới, tua lui, lặp A→B và bước từng khung hình trên timeline của bài giảng, có giọng đọc và phụ đề chạy theo.",
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
      <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-mist-50 sm:text-4xl">
            Trình phát bài giảng
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-mist-300 sm:text-base">
            Mỗi cảnh có mốc thời gian riêng nên tua ngược vẫn ra đúng khung, và
            thanh chương cho biết mình đang ở đâu. Giọng đọc chạy theo slide, phụ
            đề tô từng chữ theo đúng lúc giọng nói tới.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/setup" className="btn-ghost">
            <KeyRound className="h-4 w-4" /> Cài API key
          </Link>
          <Link href="/library" className="btn-ghost">
            <FolderOpen className="h-4 w-4" /> Thư viện bài học
          </Link>
        </div>
      </header>

      <LessonClient courseId={courseId} />
    </div>
  );
}
