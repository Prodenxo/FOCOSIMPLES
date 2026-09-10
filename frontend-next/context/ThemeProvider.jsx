'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export const THEME_STORAGE_KEY = '@financas_pessoais:theme';

const ThemeContext = createContext(null);

function resolveIsDark(preference) {
  if (preference === 'dark') return true;
  if (preference === 'light') return false;
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

function applyDomTheme(isDark) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
}

function readStoredPreference() {
  if (typeof window === 'undefined') return 'system';
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'dark' || raw === 'light' || raw === 'system') return raw;
  } catch {
    /* ignore */
  }
  return 'system';
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState('system');
  const [isDark, setIsDark] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const pref = readStoredPreference();
    setPreferenceState(pref);
    setIsDark(resolveIsDark(pref));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return undefined;
    applyDomTheme(isDark);
  }, [isDark, hydrated]);

  useEffect(() => {
    if (!hydrated || preference !== 'system') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setIsDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference, hydrated]);

  const setPreference = useCallback((next) => {
    const normalized = next === 'dark' || next === 'light' || next === 'system' ? next : 'system';
    setPreferenceState(normalized);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, normalized);
    } catch {
      /* ignore */
    }
    setIsDark(resolveIsDark(normalized));
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference(isDark ? 'light' : 'dark');
  }, [isDark, setPreference]);

  const value = useMemo(
    () => ({ preference, isDark, setPreference, toggleTheme, hydrated }),
    [preference, isDark, setPreference, toggleTheme, hydrated],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  return ctx;
}
