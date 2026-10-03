"use client";

import { FolderOpen } from "lucide-react";
import { useCopy } from "@/i18n/provider";

const COPY = {
  en: {
    chip: "saved on your machine",
    title: "Lesson library",
    body: "Lessons live in data/courses/ on this machine, not inside the browser. Change computer, change browser or clear the cache — they are still there.",
  },
  vi: {
    chip: "lưu trên máy bạn",
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
      <span className="chip">
        <FolderOpen className="h-3.5 w-3.5 text-brand-300" /> {t.chip}
      </span>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-mist-50 sm:text-4xl">
        {t.title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist-300">
        {t.body}
      </p>
    </header>
  );
}