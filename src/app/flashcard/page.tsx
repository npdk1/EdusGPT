import type { Metadata } from "next";
import { FlashcardClient } from "./FlashcardClient";

export const metadata: Metadata = {
  title: "Flashcards · Thẻ ghi nhớ · EdusGPT",
  description:
    "Flashcard revision & preview mode for lessons · Xem trước và luyện tập thẻ ghi nhớ ôn tập nhanh bài học.",
};

interface FlashcardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FlashcardPage({ searchParams }: FlashcardPageProps) {
  const sp = await searchParams;
  const raw = sp.c;
  const courseId = typeof raw === "string" && raw ? raw : null;

  return <FlashcardClient courseId={courseId} />;
}
