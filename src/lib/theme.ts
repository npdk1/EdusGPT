/**
 * Dark mode, the small part.
 *
 * The whole app names colours by role ("bg-ink-900", "text-mist-300"), and
 * every ramp in globals.css is written so that turning it around repaints all
 * of it. So the switch is one attribute on <html> — nothing else has to know.
 *
 * The choice is stored, but a machine that has never chosen follows the
 * operating system, which is what a person opening the app at night expects.
 */
export type Theme = "light" | "dark";

export const THEME_KEY = "edusgpt.theme.v1";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/** Put the theme on the document. Called before first paint by the inline script. */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

/** The stored choice, or the system one the first time. */
export function readStoredTheme(): Theme | null {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return isTheme(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* a blocked storage must not stop the page from repainting */
  }
}

/** No stored choice yet: follow the operating system. */
export function systemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * The same decision, as a string the layout can run inline before hydration.
 *
 * Written out rather than imported: it has to run in the document's first
 * milliseconds, before any module has loaded, or the page paints light and
 * then flips.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(
  THEME_KEY,
)};var s=localStorage.getItem(k);var t=(s==="light"||s==="dark")?s:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=t;}catch(e){}})();`;