"use client";

import { useLang, useSetLang, LANG_LABEL, LANGS } from "@/i18n/provider";

/**
 * The language switch: two buttons that name themselves in their own script,
 * with the current one pressed.
 *
 * Vietnamese first in the reading order, because the app was written in it and
 * that is the way round people here expect to find their own language.
 */
export function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const lang = useLang();
  const setLang = useSetLang();

  if (compact) {
    const next = lang === "en" ? "vi" : "en";
    return (
      <button
        type="button"
        onClick={() => setLang(next)}
        className="btn-ghost px-3 py-1.5 text-xs"
        title={`Switch to ${LANG_LABEL[next].own}`}
      >
        {LANG_LABEL[next].own}
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Language / Ngôn ngữ"
      className="inline-flex items-center gap-0.5 rounded-lg border border-ink-700 bg-ink-900/80 p-0.5"
    >
      {LANGS.map((item) => {
        const active = item === lang;
        return (
          <button
            key={item}
            type="button"
            onClick={() => setLang(item)}
            aria-pressed={active}
            className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-brand-500/15 text-brand-200"
                : "text-mist-400 hover:text-mist-100"
            }`}
          >
            {LANG_LABEL[item].own}
          </button>
        );
      })}
    </div>
  );
}