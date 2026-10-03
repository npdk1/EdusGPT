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
  applyTheme,
  readStoredTheme,
  storeTheme,
  systemTheme,
  type Theme,
} from "@/lib/theme";

interface ThemeValue {
  /** null until the stored choice has been read, so nothing flashes. */
  theme: Theme | null;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeValue>({
  theme: null,
  setTheme: () => {},
});

/**
 * Holds the dark-mode choice for the app.
 *
 * The document already carries the right attribute before React wakes up (see
 * THEME_BOOTSTRAP_SCRIPT); this only keeps React in step so a switch repaints
 * everywhere at once and survives a reload.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme | null>(null);

  useEffect(() => {
    setThemeState(readStoredTheme() ?? systemTheme());
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    storeTheme(next);
    applyTheme(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}