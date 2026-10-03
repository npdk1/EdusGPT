/**
 * The language settings, in a plain module.
 *
 * No "use client" here on purpose: the layout is a server component and has to
 * be able to run the same decision inline, before the first paint, or a
 * Vietnamese reader gets a flash of English while React wakes up.
 */
export type Lang = "en" | "vi";

export const LANGS: Lang[] = ["en", "vi"];

/** English is the primary language of the app; Vietnamese is the second. */
export const DEFAULT_LANG: Lang = "en";

export const LANG_KEY = "edusgpt.lang.v1";

/** Each language is labelled in its own script and offers the other one. */
export const LANG_LABEL: Record<Lang, { own: string; other: string }> = {
  en: { own: "English", other: "Tiếng Việt" },
  vi: { own: "Tiếng Việt", other: "English" },
};

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "vi";
}

/** The stored choice, or null when this machine has never chosen. */
export function readStoredLang(): Lang | null {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    return isLang(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function storeLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* a blocked storage only costs the choice next time */
  }
}

/**
 * The same decision, as a string the layout can run in the document's first
 * milliseconds — before any module has loaded.
 *
 * It only sets `lang` on <html>: that is what the browser, search engines and
 * assistive technology read, and it is correct before the first paint. The
 * visible text is React's job, and it lands with hydration.
 */
export const LANG_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(
  LANG_KEY,
)};var s=localStorage.getItem(k);document.documentElement.lang=(s==="vi"||s==="en")?s:${JSON.stringify(
  DEFAULT_LANG,
)};}catch(e){}})();`;