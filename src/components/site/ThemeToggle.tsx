"use client";

import { Monitor, Moon, Sun } from "lucide-react";
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
  },
  vi: {
    appearance: "Giao diện",
    appearanceHint:
      "Áp dụng cho toàn bộ web. Lần đầu mở, ứng dụng theo độ sáng của máy bạn; sau đó nó nhớ lựa chọn của bạn.",
    lightLabel: "Sáng",
    lightHint: "Giấy trắng, chữ đậm",
    darkLabel: "Tối",
    darkHint: "Nền xanh đậm, dịu mắt ban đêm",
  },
};

type CopyKey = keyof typeof COPY.en;

/** Each card's label and hint come out of `COPY`, keyed by the theme it sets. */
const OPTION_COPY: Record<Theme, { label: CopyKey; hint: CopyKey }> = {
  light: { label: "lightLabel", hint: "lightHint" },
  dark: { label: "darkLabel", hint: "darkHint" },
};

const OPTIONS: { value: Theme; Icon: typeof Sun }[] = [
  {
    value: "light",
    Icon: Sun,
  },
  {
    value: "dark",
    Icon: Moon,
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

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-mist-100">
            <Monitor className="h-4 w-4 text-brand-300" /> {t.appearance}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-mist-400">
            {t.appearanceHint}
          </p>
        </div>
      </div>

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
    </section>
  );
}