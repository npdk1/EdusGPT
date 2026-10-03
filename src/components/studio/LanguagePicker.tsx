"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  AUTO_LANGUAGE,
  LESSON_LANGUAGES,
  languageLabel,
} from "@/lib/lesson/lesson-languages";
import { useLang } from "@/i18n/provider";

const COPY = {
  en: {
    label: "Lesson language",
    auto: "Detect from my brief",
    search: "Search a language…",
    empty: "No language matches that.",
    open: "Choose the lesson language",
  },
  vi: {
    label: "Ngôn ngữ bài giảng",
    auto: "Tự nhận từ nội dung",
    search: "Tìm một ngôn ngữ…",
    empty: "Không có ngôn ngữ nào khớp.",
    open: "Chọn ngôn ngữ bài giảng",
  },
} satisfies Record<string, Record<string, string>>;

/**
 * Which language the lesson is written in.
 *
 * A searchable list rather than a plain `<select>`: nineteen languages, each
 * named in its own script, in two interface languages — a dropdown you have to
 * scroll is worse than one you can type into. The default is "detect", which
 * hands the decision to the brief itself; picking a language overrides that,
 * which is what a teacher with an English document but an English-class
 * assignment needs.
 */
export function LanguagePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const screenLang = useLang();
  const t = COPY[screenLang];
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Clicking anywhere else, or pressing Escape, closes the list — the same
  // contract every menu on this site already follows.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    searchRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const needle = query.trim().toLowerCase();
  const matches = LESSON_LANGUAGES.filter(
    (language) =>
      !needle ||
      language.native.toLowerCase().includes(needle) ||
      language.en.toLowerCase().includes(needle) ||
      language.vi.toLowerCase().includes(needle) ||
      language.id.toLowerCase().includes(needle),
  );

  const chosen =
    value === AUTO_LANGUAGE
      ? t.auto
      : languageLabel(value, screenLang) +
        (value === LESSON_LANGUAGES[0]?.id ? "" : ` · ${value}`);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t.open}
        title={t.open}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-ink-600 bg-ink-950 px-3 py-2 text-left text-sm text-mist-100 hover:border-brand-500"
      >
        <span className="min-w-0 flex-1 truncate">{chosen}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-mist-400" />
      </button>

      {open ? (
        <div className="absolute z-40 mt-1.5 w-full min-w-56 overflow-hidden rounded-xl border border-ink-600 bg-ink-950 shadow-xl">
          <div className="flex items-center gap-2 border-b border-ink-700 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-mist-500" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.search}
              aria-label={t.search}
              className="min-w-0 flex-1 bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500"
            />
          </div>
          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            <li role="option" aria-selected={value === AUTO_LANGUAGE}>
              <button
                type="button"
                onClick={() => {
                  onChange(AUTO_LANGUAGE);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-mist-200 hover:bg-brand-500/10"
              >
                <Check
                  className={`h-3.5 w-3.5 shrink-0 ${value === AUTO_LANGUAGE ? "text-brand-400" : "text-transparent"}`}
                />
                <span className="min-w-0 flex-1 truncate">{t.auto}</span>
              </button>
            </li>
            {matches.map((language) => (
              <li key={language.id} role="option" aria-selected={value === language.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(language.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-mist-200 hover:bg-brand-500/10"
                >
                  <Check
                    className={`h-3.5 w-3.5 shrink-0 ${value === language.id ? "text-brand-400" : "text-transparent"}`}
                  />
                  <span className="min-w-0 flex-1 truncate">{language.native}</span>
                  <span className="shrink-0 font-mono text-[10px] text-mist-500">
                    {language.id}
                  </span>
                </button>
              </li>
            ))}
            {matches.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-mist-500">
                {t.empty}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}