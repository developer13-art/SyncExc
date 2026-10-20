import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { STORAGE_KEYS, storage } from '../lib/utils/storage.util.js';

const ThemeContext = createContext(null);

function getSystemPreference() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(themePreference) {
  return themePreference === 'system' ? getSystemPreference() : themePreference;
}

function applyThemeClass(theme) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', theme === 'dark' ? '#0d1020' : '#ffffff');
  }
}

export function ThemeProvider({ children, defaultTheme = 'dark' }) {
  const [themePreference, setThemePreference] = useState(() => {
    const stored = storage.get(STORAGE_KEYS.THEME, null, { parse: false });
    return stored ?? defaultTheme;
  });
  const [theme, setThemeState] = useState(() => resolveTheme(
    storage.get(STORAGE_KEYS.THEME, null, { parse: false }) ?? defaultTheme,
  ));

  useEffect(() => {
    applyThemeClass(theme);
    storage.set(STORAGE_KEYS.THEME, themePreference, { stringify: false });
  }, [theme, themePreference]);

  useEffect(() => {
    if (themePreference !== 'system' || typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event) => setThemeState(event.matches ? 'dark' : 'light');
    if (media.addEventListener) {
      media.addEventListener('change', handler);
      return () => media.removeEventListener('change', handler);
    }
    media.addListener(handler);
    return () => media.removeListener(handler);
  }, [themePreference]);

  const setTheme = useCallback((next) => {
    setThemePreference(next);
    setThemeState(resolveTheme(next));
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === 'light' ? 'dark' : 'light';
    setThemePreference(next);
    setThemeState(next);
  }, [theme]);

  const value = useMemo(
    () => ({ theme, themePreference, setTheme, toggleTheme, isDark: theme === 'dark' }),
    [theme, themePreference, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}