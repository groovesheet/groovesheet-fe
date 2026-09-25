/**
 * Dark/light theme. Dark is the default and what the server renders.
 *
 * The saved choice lives in localStorage ('theme-mode'), which the server
 * cannot read, so THEME_BOOT_SCRIPT from lib/theme-boot (inlined in the root
 * layout's <head>)
 * applies it before first paint. The provider then only has to keep React
 * state in step with what the script already did.
 */
'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { DARK_VARS, LIGHT_VARS, THEME_STORAGE_KEY as STORAGE_KEY } from '@/lib/theme-boot';

interface ThemeContextValue {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(darkMode: boolean): void {
  const root = document.documentElement;
  // The explicit attribute is what [data-theme='light'] selectors in the CSS key off.
  root.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  const vars = darkMode ? DARK_VARS : LIGHT_VARS;
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* storage unavailable: keep the default */
    }
    const darkMode = saved !== 'light';
    // Syncing React state to what the boot script already applied before paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDarkMode(darkMode);
    applyTheme(darkMode);
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDarkMode((prevMode) => {
      const newMode = !prevMode;
      applyTheme(newMode);
      try {
        localStorage.setItem(STORAGE_KEY, newMode ? 'dark' : 'light');
      } catch {
        /* the toggle still applies for this page view */
      }
      return newMode;
    });
  }, []);

  const value = useMemo(() => ({ isDarkMode, toggleTheme }), [isDarkMode, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
