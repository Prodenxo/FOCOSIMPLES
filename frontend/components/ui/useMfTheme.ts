import { useMemo } from 'react';
import { getTheme, type Theme } from '../../lib/theme';
import { useThemeStore } from '../../store/themeStore';

export interface MfThemeContext {
  theme: Theme;
  isDarkMode: boolean;
}

/** Hook padrão para componentes MF Luxury — lê preferência do themeStore. */
export function useMfTheme(): MfThemeContext {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  return { theme, isDarkMode };
}
