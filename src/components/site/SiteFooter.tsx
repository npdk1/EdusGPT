"use client";

import Link from "next/link";
import { useCopy } from "@/i18n/provider";

const COPY = {
  en: {
    product: "Product",
    linkLesson: "Lesson player",
    linkStudio: "Create Lesson",
    linkLibrary: "Saved lesson library",
    linkSetup: "API key setup",
    tagline:
      "Create a lesson, listen to it read aloud and scrub through it second by second. Runs on your machine — nothing is sent away.",
    runsLocally: "runs entirely on your machine.",
  },
  vi: {
    product: "Sản phẩm",
    linkLesson: "Trình phát bài giảng",
    linkStudio: "Tạo Bài Giảng",
    linkLibrary: "Thư viện bài đã lưu",
    linkSetup: "Cài API key",
    tagline:
      "Tạo bài giảng, đọc cho bạn nghe và tua lại từng giây. Chạy trên máy bạn, không gửi bài đi đâu.",
    runsLocally: "chạy hoàn toàn trên máy bạn.",
  },
};

type CopyKey = keyof typeof COPY.en;

const COLUMNS: { title: CopyKey; links: { href: string; label: CopyKey }[] }[] = [
  {
    title: "product",
    links: [
      { href: "/lesson", label: "linkLesson" },
      { href: "/studio", label: "linkStudio" },
      { href: "/library", label: "linkLibrary" },
      { href: "/setup", label: "linkSetup" },
    ],
  },
];

export function SiteFooter() {
  const t = useCopy(COPY);

  return (
    <footer className="mt-24 border-t border-ink-800 bg-ink-950/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Logo EdusGPT"
              width={36}
              height={36}
              className="h-9 w-9 rounded-xl object-cover"
            />
            <span className="text-sm font-bold text-mist-50">EdusGPT</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-mist-400">
            {t.tagline}
          </p>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mist-400">
              {t[column.title]}
            </p>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-mist-300 transition-colors hover:text-brand-200"
                  >
                    {t[link.label]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-ink-800/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-mist-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} EdusGPT · {t.runsLocally}</p>
        </div>
      </div>
    </footer>
  );
}