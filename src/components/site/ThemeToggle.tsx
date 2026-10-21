"use client";

import { useState } from "react";
import { IconChevronDown, IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";
import { useTheme } from "./ThemeProvider";
import { useCopy } from "@/i18n/provider";
import type { Theme } from "@/lib/theme";

const COPY = {
  en: {
    appearance: "Appearance",
    appearanceHint:
      "Applies to the whole site. On your first visit the app follows your device brightness; after that it remembers your choice.",
    lightLabel: "Light",
    lightHint: "White paper, strong text",
    darkLabel: "Dark",
    darkHint: "Deep blue background, easy on the eyes at night",
    collapse: "Collapse",
    expand: "Expand",
  },
  vi: {
    appearance: "Giao diện",
    appearanceHint:
      "Áp dụng cho toàn bộ web. Lần đầu mở, ứng dụng theo độ sáng của máy bạn; sau đó nó nhớ lựa chọn của bạn.",
    lightLabel: "Sáng",
    lightHint: "Giấy trắng, chữ đậm",
    darkLabel: "Tối",
    darkHint: "Nền xanh đậm, dịu mắt ban đêm",
    collapse: "Thu gọn",
    expand: "Mở rộng",
  },
};

type CopyKey = keyof typeof COPY.en;

/** Each card's label and hint come out of `COPY`, keyed by the theme it sets. */
const OPTION_COPY: Record<Theme, { label: CopyKey; hint: CopyKey }> = {
  light: { label: "lightLabel", hint: "lightHint" },
  dark: { label: "darkLabel", hint: "darkHint" },
};

const OPTIONS: { value: Theme; Icon: typeof IconSun }[] = [
  {
    value: "light",
    Icon: IconSun,
  },
  {
    value: "dark",
    Icon: IconMoon,
  },
];

/**
 * The appearance setting: paper or midnight.
 *
 * Two cards rather than a switch, because "which one am I on" is a question
 * worth answering by looking, not by remembering where a toggle was left.
 */
export function ThemeToggle() {
  const t = useCopy(COPY);
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(true);

  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-mist-100">
            <IconDeviceDesktop className="h-4 w-4 text-brand-300" /> {t.appearance}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-mist-400">
            {t.appearanceHint}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-ink-700 bg-ink-900/60 text-mist-400 transition-transform duration-200 hover:text-mist-100 ${
            open ? "rotate-0 text-mist-200" : "-rotate-90 text-mist-500"
          }`}
          title={open ? t.collapse : t.expand}
          aria-expanded={open}
        >
          <IconChevronDown className="h-4 w-4" />
        </button>
      </div>

      {open ? (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {OPTIONS.map(({ value, Icon }) => {
            const active = theme === value;
            const label = t[OPTION_COPY[value].label];
            const hint = t[OPTION_COPY[value].hint];
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                aria-pressed={active}
                className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                  active
                    ? "border-brand-500/70 bg-brand-500/10"
                    : "border-ink-600 bg-ink-900 hover:border-brand-400"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    active
                      ? "bg-brand-500/20 text-brand-200"
                      : "bg-ink-800 text-mist-300"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-mist-50">
                    {label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-mist-400">
                    {hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}