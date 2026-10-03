"use client";

import { useCopy } from "@/i18n/provider";

const COPY = {
  en: { skip: "Skip to content" },
  vi: { skip: "Bỏ qua tới nội dung" },
};

/**
 * The keyboard user's way past the header.
 *
 * It lives in its own component only because it needs the language: the layout
 * that renders it is a server component.
 */
export function SkipLink() {
  const t = useCopy(COPY);
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-brand-400 focus:px-4 focus:py-2 focus:font-semibold focus:text-ink-950"
    >
      {t.skip}
    </a>
  );
}