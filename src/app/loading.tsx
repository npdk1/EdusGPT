"use client";

import { IconPlayerPlay } from "@tabler/icons-react";
import { Sparkles } from "lucide-react";
import { useLang } from "@/i18n/provider";

/**
 * Global Next.js App Router route transition loading screen.
 *
 * Automatically rendered inside Suspense during route transitions, ensuring
 * students experience a smooth, engaging, and professional loading animation
 * rather than a frozen or blank screen. Fully bilingual (vi/en).
 */
export default function Loading() {
  const lang = useLang();
  const isVi = lang === "vi";

  return (
    <div className="flex min-h-[65vh] w-full flex-col items-center justify-center px-4 py-16">
      <div className="relative flex items-center justify-center">
        {/* Ambient glowing backlight */}
        <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-red-600/20 via-brand-500/20 to-gold-500/20 blur-xl animate-pulse" />

        {/* Orbit spinning ring */}
        <div className="relative h-20 w-20 rounded-full border-2 border-brand-500/20 border-t-red-500 border-r-brand-400 animate-spin" />

        {/* Center brand logo icon */}
        <div className="absolute flex h-12 w-12 items-center justify-center rounded-xl bg-ink-900 border border-ink-700 shadow-xl">
          <IconPlayerPlay className="h-6 w-6 text-brand-300 animate-bounce" />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-mist-100">
        <Sparkles className="h-4 w-4 text-gold-400 animate-spin" />
        <span>{isVi ? "Đang tải dữ liệu bài giảng" : "Loading lesson data"}</span>
        <span className="inline-flex gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-bounce [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-gold-400 animate-bounce" />
        </span>
      </div>

      <p className="mt-2 text-xs text-mist-400 font-mono">
        {isVi
          ? "EdusGPT · Trình phát bài giảng tương tác thông minh"
          : "EdusGPT · Smart Interactive Lesson Player"}
      </p>
    </div>
  );
}
