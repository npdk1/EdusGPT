import type { Metadata } from "next";
import { QuizClient } from "./QuizClient";

export const metadata: Metadata = {
  title: "Quiz Practice · Luyện trắc nghiệm · EdusGPT",
  description:
    "Interactive examination & quiz practice for lessons with live scoring and explanations · Luyện thi và làm bài trắc nghiệm tương tác đầy đủ câu hỏi, có bảng điều hướng và chấm điểm chi tiết.",
};

interface QuizPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function QuizPage({ searchParams }: QuizPageProps) {
  const sp = await searchParams;
  const raw = sp.c;
  const courseId = typeof raw === "string" && raw ? raw : null;

  return <QuizClient courseId={courseId} />;
}
