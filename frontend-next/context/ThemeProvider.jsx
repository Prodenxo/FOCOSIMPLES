'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = '@financas_pessoais:theme';

const ThemeContext = createContext(null);

function readStoredPreference() {
  if (typeof window === 'undefined') return 'light';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'dark' || raw === 'light') return raw;
    /* Migra preferência "system" antiga para claro (referência aprovada). */
    if (raw === 'system') return 'light';
  } catch {
    /* ignore */
  }
  return 'light';
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState('light');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const pref = readStoredPreference();
    setPreferenceState(pref);
    setIsDark(pref === 'dark');
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.dataset.theme = isDark ? 'dark' : 'light';
  }, [isDark]);

  const setPreference = useCallback((next) => {
    const normalized = next === 'dark' ? 'dark' : 'light';
    setPreferenceState(normalized);
    localStorage.setItem(STORAGE_KEY, normalized);
    setIsDark(normalized === 'dark');
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference(preference === 'dark' ? 'light' : 'dark');
  }, [preference, setPreference]);

  const value = useMemo(
    () => ({ preference, isDark, setPreference, toggleTheme }),
    [preference, isDark, setPreference, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  return ctx;
}
