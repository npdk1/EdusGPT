"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import type { Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; hint: string; Icon: typeof Sun }[] = [
  {
    value: "light",
    label: "Sáng",
    hint: "Giấy trắng, chữ đậm",
    Icon: Sun,
  },
  {
    value: "dark",
    label: "Tối",
    hint: "Nền xanh đậm, dịu mắt ban đêm",
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
  const { theme, setTheme } = useTheme();

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-mist-100">
            <Monitor className="h-4 w-4 text-brand-300" /> Giao diện
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-mist-400">
            Áp dụng cho toàn bộ web. Lần đầu mở, ứng dụng theo độ sáng của máy
            bạn; sau đó nó nhớ lựa chọn của bạn.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {OPTIONS.map(({ value, label, hint, Icon }) => {
          const active = theme === value;
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