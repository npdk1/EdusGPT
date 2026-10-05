"use client";

import { IconLibrary } from "@tabler/icons-react";
import { useCopy } from "@/i18n/provider";

const COPY = {
  en: {
    title: "Lesson library",
    body: "Lessons live in data/courses/ on this machine, not inside the browser. Change computer, change browser or clear the cache — they are still there.",
  },
  vi: {
    title: "Thư viện bài giảng",
    body: "Bài lưu ở data/courses/ trên máy bạn, không nằm trong trình duyệt. Đổi máy, đổi trình duyệt hay xoá cache vẫn còn nguyên.",
  },
};

/**
 * The library's own heading, kept apart from the page so it can read the
 * language: a server page cannot use the reader's context.
 */
export function LibraryHeader() {
  const t = useCopy(COPY);
  return (
    <header className="mb-8">
      <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-mist-50 sm:text-4xl">
        <IconLibrary className="h-7 w-7 shrink-0 text-brand-300 sm:h-8 sm:w-8" />
        {t.title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist-300">
        {t.body}
      </p>
    </header>
  );
}