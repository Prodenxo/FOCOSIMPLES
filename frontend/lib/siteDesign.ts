import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native'
import { mfRadius, mfSpacing } from './theme'
import { brandColors, brandDarkColors, brandPrimaryTint, brandSecondaryTint } from './brandTokens'

/**
 * Paleta premium/neon do Site — `designTokens` + `card-premium` / `btn-premium` / `bg-grid-pattern`.
 * @see Site/shared/theme/tokens.ts
 * @see Site/frontend/src/index.css
 */
export type SiteTokens = {
  neon: string
  neonHover: string
  neonGlow: string
  neonDim: string
  neonBorder: string
  primary: string
  primarySoft: string
  background: string
  panelBg: string
  panelBorder: string
  inputBg: string
  inputBorder: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  divider: string
  glassShadow: string
}

const PREMIUM = {
  neon: brandColors.secondary,
  neonHover: '#00C07A',
  neonGlow: brandSecondaryTint(0.5),
  neonDim: brandSecondaryTint(0.1),
  neonBorder: brandSecondaryTint(0.32),
  bgApp: brandDarkColors.background,
  card: brandDarkColors.surface,
  cardMuted: '#0A2248',
  borderGlass: 'rgba(255, 255, 255, 0.08)',
  borderSubtle: 'rgba(255, 255, 255, 0.12)',
  textPrimary: brandDarkColors.text,
  textMuted: brandDarkColors.textMuted,
  glassShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.32)',
  neonShadow: `0 0 15px ${brandSecondaryTint(0.4)}`,
} as const

export function getSiteTokens (isDarkMode: boolean): SiteTokens {
  if (isDarkMode) {
    return {
      neon: PREMIUM.neon,
      neonHover: PREMIUM.neonHover,
      neonGlow: PREMIUM.neonGlow,
      neonDim: PREMIUM.neonDim,
      neonBorder: PREMIUM.neonBorder,
      primary: PREMIUM.neon,
      primarySoft: PREMIUM.neonDim,
      background: PREMIUM.bgApp,
      panelBg: PREMIUM.card,
      panelBorder: PREMIUM.borderGlass,
      inputBg: PREMIUM.cardMuted,
      inputBorder: 'rgba(59, 130, 246, 0.18)',
      textPrimary: PREMIUM.textPrimary,
      textSecondary: PREMIUM.textMuted,
      textMuted: '#64748B',
      divider: 'rgba(255, 255, 255, 0.06)',
      glassShadow: PREMIUM.glassShadow,
    }
  }

  return {
    neon: brandColors.secondary,
    neonHover: '#00C07A',
    neonGlow: brandSecondaryTint(0.35),
    neonDim: brandSecondaryTint(0.1),
    neonBorder: brandSecondaryTint(0.28),
    primary: brandColors.primary,
    primarySoft: brandPrimaryTint(0.08),
    background: brandColors.surface,
    panelBg: 'rgba(255, 255, 255, 0.9)',
    panelBorder: brandPrimaryTint(0.12),
    inputBg: brandColors.background,
    inputBorder: brandPrimaryTint(0.14),
    textPrimary: brandColors.textBody,
    textSecondary: '#5C6670',
    textMuted: '#8A939C',
    divider: brandPrimaryTint(0.08),
    glassShadow: '0 8px 30px rgba(13, 43, 94, 0.08)',
  }
}

/** `card-premium` — glass + borda sutil + fundo card do Site. */
export function mfSitePanel (isDarkMode: boolean): ViewStyle {
  const t = getSiteTokens(isDarkMode)
  return {
    borderRadius: mfRadius.lg,
    borderWidth: 1,
    borderColor: isDarkMode ? t.panelBorder : t.panelBorder,
    borderLeftWidth: 2,
    borderLeftColor: t.neonBorder,
    backgroundColor: t.panelBg,
    padding: mfSpacing.lg,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: isDarkMode
            ? `${t.glassShadow}, inset 0 1px 0 rgba(255,255,255,0.04)`
            : t.glassShadow,
        } as ViewStyle)
      : null),
  }
}

export function mfSiteInput (isDarkMode: boolean): ViewStyle {
  const t = getSiteTokens(isDarkMode)
  return {
    borderWidth: 1,
    borderColor: t.inputBorder,
    backgroundColor: t.inputBg,
    borderRadius: mfRadius.md,
  }
}

/** `btn-premium` — CTA neon outline com glow. */
export function mfSiteNeonBtn (isDarkMode: boolean): ViewStyle {
  const t = getSiteTokens(isDarkMode)
  return {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: mfSpacing.sm,
    paddingVertical: mfSpacing.sm,
    paddingHorizontal: mfSpacing.md,
    borderRadius: mfRadius.pill,
    borderWidth: 1,
    borderColor: t.neonBorder,
    backgroundColor: t.neonDim,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: PREMIUM.neonShadow } as ViewStyle)
      : null),
  }
}

export function mfSiteSecondaryBtn (isDarkMode: boolean): ViewStyle {
  return mfSiteNeonBtn(isDarkMode)
}

/** Botão sólido neon para ação principal. */
export function mfSitePrimaryBtn (isDarkMode: boolean, pressed?: boolean): ViewStyle {
  const t = getSiteTokens(isDarkMode)
  return {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: mfSpacing.lg,
    borderRadius: mfRadius.pill,
    backgroundColor: t.neon,
    opacity: pressed ? 0.92 : 1,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: PREMIUM.neonShadow } as ViewStyle)
      : null),
  }
}

export function getSiteCanvasStyle (isDarkMode: boolean): ViewStyle {
  if (!isDarkMode) {
    return Platform.OS === 'web'
      ? ({
          backgroundColor: brandColors.surface,
          backgroundImage: `linear-gradient(180deg, ${brandColors.surface} 0%, ${brandColors.background} 55%, ${brandColors.surface} 100%)`,
        } as ViewStyle)
      : { backgroundColor: brandColors.surface }
  }

  if (Platform.OS === 'web') {
    return {
      backgroundColor: PREMIUM.bgApp,
      backgroundImage: [
        'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px)',
        'linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
        `radial-gradient(ellipse 90% 55% at 50% -15%, ${brandSecondaryTint(0.16)}, transparent 58%)`,
        `radial-gradient(ellipse 50% 40% at 100% 0%, ${brandPrimaryTint(0.14)}, transparent 50%)`,
      ].join(', '),
      backgroundSize: '40px 40px, 40px 40px, auto, auto',
    } as ViewStyle
  }

  return { backgroundColor: PREMIUM.bgApp }
}

export const siteHeadingStyle: TextStyle = {
  fontSize: 24,
  fontWeight: '600',
  letterSpacing: -0.4,
}

export const siteLeadStyle: TextStyle = {
  fontSize: 14,
  lineHeight: 20,
}

export const sitePanelTitleStyle: TextStyle = {
  fontSize: 16,
  fontWeight: '600',
}

export const siteFieldLabelStyle: TextStyle = {
  fontSize: 13,
  fontWeight: '500',
}

export const siteHintStyle: TextStyle = {
  fontSize: 12,
  lineHeight: 16,
}

export const siteNeonBtnText: TextStyle = {
  fontSize: 14,
  fontWeight: '600',
}
