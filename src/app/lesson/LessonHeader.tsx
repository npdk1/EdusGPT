"use client";

import Link from "next/link";
import { IconFolderOpen, IconKey, IconPlayerPlay } from "@tabler/icons-react";
import { useCopy } from "@/i18n/provider";

const COPY = {
  en: {
    lessonTitle: "Lesson player",
    lessonLead:
      "Every scene has its own timings, so seeking backwards still lands on the right frame, and the chapter bar shows where you are. The voice follows the slide, and the subtitles light up each word as it is spoken.",
    lessonCtaKey: "Add an API key",
    lessonCtaLibrary: "Lesson library",
  },
  vi: {
    lessonTitle: "Trình phát bài giảng",
    lessonLead:
      "Mỗi cảnh có mốc thời gian riêng nên tua ngược vẫn ra đúng khung, và thanh chương cho biết mình đang ở đâu. Giọng đọc chạy theo slide, phụ đề tô từng chữ theo đúng lúc giọng nói tới.",
    lessonCtaKey: "Cài API key",
    lessonCtaLibrary: "Thư viện bài học",
  },
};

/**
 * The heading above the player.
 *
 * A client island of its own: the page keeps its `metadata` and the `?c=` lookup
 * on the server, and only the words on screen need the language switch.
 */
export function LessonHeader() {
  const t = useCopy(COPY);

  return (
    <header className="mb-6 flex flex-col gap-4 lg:mb-1 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <h1 className="flex shrink-0 items-center gap-2.5 text-2xl font-bold tracking-tight text-mist-50 sm:text-3xl lg:text-xl">
          <IconPlayerPlay className="h-6 w-6 shrink-0 text-brand-300 sm:h-7 sm:w-7 lg:h-5 lg:w-5" />
          {t.lessonTitle}
        </h1>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/setup" className="btn-ghost">
          <IconKey className="h-4 w-4" /> {t.lessonCtaKey}
        </Link>
        <Link href="/library" className="btn-ghost">
          <IconFolderOpen className="h-4 w-4" /> {t.lessonCtaLibrary}
        </Link>
      </div>
    </header>
  );
}