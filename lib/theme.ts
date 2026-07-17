import type { TextStyle, ViewStyle } from 'react-native';
import { brandColors, brandDarkColors, brandPrimaryTint, brandSecondaryTint } from './brandTokens';

/** Raio e espaçamento — FocoMEI (Manual da Marca v1.0). */
export const mfRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const mfSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const mfTypography = {
  caption: { fontSize: 11, fontWeight: '500' as const, lineHeight: 14 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodyStrong: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
  subtitle: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  title: { fontSize: 20, fontWeight: '700' as const, lineHeight: 26 },
  titleLarge: { fontSize: 24, fontWeight: '700' as const, lineHeight: 30 },
  money: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34, letterSpacing: -0.5 },
  moneyLarge: { fontSize: 32, fontWeight: '700' as const, lineHeight: 38, letterSpacing: -0.6 },
} as const;

export type FinanceSemantic = 'open' | 'received' | 'overdue' | 'forecast';

export interface Theme {
  background: string;
  /** Áreas secundárias (listas, inputs agrupados) — não substitui o fundo principal em light premium. */
  backgroundMuted: string;
  surface: string;
  card: string;

  text: string;
  textSecondary: string;
  textTertiary: string;

  border: string;
  borderLight: string;

  primary: string;
  primaryLight: string;
  primaryDark: string;

  success: string;
  successLight: string;
  error: string;
  errorLight: string;
  warning: string;

  /** Semântica financeira (referência Assessor, paleta MF). */
  financeOpen: string;
  financeOpenLight: string;
  financeReceived: string;
  financeReceivedLight: string;
  financeOverdue: string;
  financeOverdueLight: string;
  financeForecast: string;
  financeForecastLight: string;

  inputBackground: string;
  inputBorder: string;
  inputText: string;
  placeholder: string;

  calendarBackground: string;
  calendarText: string;
  calendarSelected: string;
  calendarToday: string;

  tabBarBackground: string;
  tabBarBorder: string;
  tabActive: string;
  tabInactive: string;

  /** Cor base para sombras de card (light: slate suave; dark: preto). */
  shadowColor: string;
}

/** Light: fundo branco, azul institucional + verde crescimento. */
export const lightTheme: Theme = {
  background: brandColors.background,
  backgroundMuted: brandColors.surface,
  surface: brandColors.background,
  card: brandColors.background,

  text: brandColors.textBody,
  textSecondary: '#5C6670',
  textTertiary: '#8A939C',

  border: '#E0E3E8',
  borderLight: brandColors.surface,

  primary: brandColors.primary,
  primaryLight: brandPrimaryTint(0.1),
  primaryDark: '#071830',

  success: brandColors.secondary,
  successLight: brandSecondaryTint(0.14),
  error: '#DC2626',
  errorLight: '#FEE2E2',
  warning: brandColors.alert,

  financeOpen: brandColors.primary,
  financeOpenLight: brandPrimaryTint(0.08),
  financeReceived: brandColors.secondary,
  financeReceivedLight: brandSecondaryTint(0.14),
  financeOverdue: '#DC2626',
  financeOverdueLight: '#FEE2E2',
  financeForecast: brandColors.primary,
  financeForecastLight: brandPrimaryTint(0.08),

  inputBackground: brandColors.background,
  inputBorder: '#D8DCE2',
  inputText: brandColors.textBody,
  placeholder: '#8A939C',

  calendarBackground: brandColors.background,
  calendarText: brandColors.textBody,
  calendarSelected: brandColors.secondary,
  calendarToday: brandColors.primary,

  tabBarBackground: brandColors.background,
  tabBarBorder: '#E0E3E8',
  tabActive: brandColors.secondary,
  tabInactive: '#8A939C',

  shadowColor: brandColors.primary,
};

/**
 * Dark: fundo azul institucional; CTAs e métricas em verde.
 */
export const darkTheme: Theme = {
  background: brandDarkColors.background,
  backgroundMuted: '#0A2248',
  surface: brandDarkColors.surface,
  card: brandDarkColors.surface,

  text: brandDarkColors.text,
  textSecondary: brandDarkColors.textMuted,
  textTertiary: 'rgba(255, 255, 255, 0.5)',

  border: 'rgba(255, 255, 255, 0.12)',
  borderLight: 'rgba(255, 255, 255, 0.08)',

  primary: brandColors.secondary,
  primaryLight: brandSecondaryTint(0.22),
  primaryDark: '#008F5A',

  success: brandColors.secondary,
  successLight: brandSecondaryTint(0.18),
  error: '#F87171',
  errorLight: 'rgba(248, 113, 113, 0.16)',
  warning: brandColors.alert,

  financeOpen: '#7EB8FF',
  financeOpenLight: brandPrimaryTint(0.25),
  financeReceived: brandColors.secondary,
  financeReceivedLight: brandSecondaryTint(0.18),
  financeOverdue: '#F87171',
  financeOverdueLight: 'rgba(248, 113, 113, 0.16)',
  financeForecast: '#7EB8FF',
  financeForecastLight: brandPrimaryTint(0.2),

  inputBackground: '#0A2248',
  inputBorder: 'rgba(255, 255, 255, 0.14)',
  inputText: brandDarkColors.text,
  placeholder: 'rgba(255, 255, 255, 0.45)',

  calendarBackground: brandDarkColors.surface,
  calendarText: brandDarkColors.text,
  calendarSelected: brandColors.secondary,
  calendarToday: brandColors.secondary,

  tabBarBackground: brandDarkColors.background,
  tabBarBorder: 'rgba(255, 255, 255, 0.1)',
  tabActive: brandColors.secondary,
  tabInactive: 'rgba(255, 255, 255, 0.45)',

  shadowColor: '#000000',
};

export const getTheme = (isDarkMode: boolean): Theme => {
  return isDarkMode ? darkTheme : lightTheme;
};

export function getFinanceSemanticColor(theme: Theme, semantic: FinanceSemantic): string {
  switch (semantic) {
    case 'open':
      return theme.financeOpen;
    case 'received':
      return theme.financeReceived;
    case 'overdue':
      return theme.financeOverdue;
    case 'forecast':
      return theme.financeForecast;
    default:
      return theme.primary;
  }
}

export function getFinanceSemanticTint(theme: Theme, semantic: FinanceSemantic): string {
  switch (semantic) {
    case 'open':
      return theme.financeOpenLight;
    case 'received':
      return theme.financeReceivedLight;
    case 'overdue':
      return theme.financeOverdueLight;
    case 'forecast':
      return theme.financeForecastLight;
    default:
      return theme.primaryLight;
  }
}

/** Sombra difusa para MfCard — light premium vs dark elevado. */
export function mfCardElevation(theme: Theme, isDarkMode: boolean): Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
> {
  if (isDarkMode) {
    return {
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 14,
      elevation: 6,
    };
  }
  return {
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  };
}

/** Agenda / modais — sombra visível (overflow não corta no web). */
export function mfAgendaPanelChrome(isDarkMode: boolean): ViewStyle {
  const chrome: ViewStyle = { overflow: 'visible' };
  if (typeof document !== 'undefined') {
    chrome.boxShadow = isDarkMode
      ? '0 12px 48px rgba(0, 0, 0, 0.55), 0 4px 16px rgba(0, 0, 0, 0.42)'
      : '0 8px 32px rgba(15, 23, 42, 0.14), 0 2px 10px rgba(15, 23, 42, 0.08)';
  }
  return chrome;
}

export function mfMoneyTextStyle(theme: Theme, size: 'default' | 'large' = 'default'): TextStyle {
  return {
    ...(size === 'large' ? mfTypography.moneyLarge : mfTypography.money),
    color: theme.text,
    fontVariant: ['tabular-nums'],
  };
}
