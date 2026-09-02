import type { Theme } from './theme';

/** Paleta MF Luxury — fatias e barras por categoria (sem cinza monocromático). */
const LIGHT_SLICE = [
  '#2563EB',
  '#10B981',
  '#F59E0B',
  '#0EA5E9',
  '#1E40AF',
  '#059669',
  '#DC2626',
  '#0284C7',
] as const;

const DARK_SLICE = [
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#38bdf8',
  '#93c5fd',
  '#6ee7b7',
  '#f87171',
  '#7dd3fc',
] as const;

export function getCategorySliceColor(index: number, isDarkMode: boolean): string {
  const palette = isDarkMode ? DARK_SLICE : LIGHT_SLICE;
  return palette[((index % palette.length) + palette.length) % palette.length];
}

export function getCategorySliceColorForId(categoryId: number | string, isDarkMode: boolean): string {
  const raw = String(categoryId);
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash + raw.charCodeAt(i) * (i + 1)) % 9973;
  }
  return getCategorySliceColor(hash, isDarkMode);
}

export function getDonutRemainderColor(theme: Theme, isDarkMode: boolean): string {
  return isDarkMode ? theme.border : theme.backgroundMuted;
}

export function getDonutOutflowColor(theme: Theme): string {
  return theme.financeOverdue;
}
