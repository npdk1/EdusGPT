"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LANG,
  readStoredLang,
  storeLang,
  type Lang,
} from "./config";

/**
 * Two languages, no framework.
 *
 * English is the primary language and Vietnamese the second, so English is
 * both the default and the shape every translation has to match: a file
 * declares `{ en: {...}, vi: {...} }` and `useCopy` only accepts the pair when
 * the two agree key for key. A missing or misspelled Vietnamese string is a
 * type error rather than an English word left sitting in a Vietnamese screen.
 *
 * Dictionaries stay in the file that uses them. That keeps a translation next
 * to the sentence it replaces — which is how you actually check a translation —
 * and means two people editing two screens never touch the same file.
 */
export * from "./config";

interface LangValue {
  lang: Lang;
  setLang: (next: Lang) => void;
}

const LangContext = createContext<LangValue>({
  lang: DEFAULT_LANG,
  setLang: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    const stored = readStoredLang();
    if (!stored) return;
    setLangState(stored);
    document.documentElement.lang = stored;
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    storeLang(next);
    document.documentElement.lang = next;
  }, []);

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): Lang {
  return useContext(LangContext).lang;
}

export function useSetLang(): (next: Lang) => void {
  return useContext(LangContext).setLang;
}

/**
 * The strings for the language on screen, out of the file's own dictionary.
 *
 * A sentence that carries a number keeps a `{name}` hole rather than a
 * function: translators move words around, and the hole moves with them.
 */
export function useCopy<T extends Record<string, string>>(copy: {
  en: T;
  vi: T;
}): T {
  return copy[useLang()];
}

/** Puts the values into a dictionary sentence: "Tốc độ: {value}x". */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (hole, key: string) =>
    key in values ? String(values[key]) : hole,
  );
}