/**
 * Tokens de autenticação — alinhados ao design system tech (`techDesign.ts` / system.md).
 */

import { APP_BRAND_NAME, APP_BRAND_TAGLINE } from '@/lib/appBrand'
import { brandColors } from '@/lib/brandTokens'
import { getTechTokens } from '../../lib/techDesign'
import { mfRadius, mfSpacing } from '../../lib/theme'

export const AUTH_ILLUSTRATION_URL = ''

export const AUTH_BREAKPOINT_MD = 768
export const AUTH_BREAKPOINT_LG = 1024
/** Coluna da página no canvas (não é um card único). */
export const AUTH_PAGE_MAX_WIDTH = 1120
/** Painel do formulário — flutuante à direita no desktop (login). */
export const AUTH_FORM_PANEL_MAX_WIDTH = 440
/** Formulários longos (cadastro franqueado, onboarding). */
export const AUTH_FORM_WIDE_PANEL_MAX_WIDTH = 720
/** Largura mínima da viewport para grid em 2 colunas. */
export const AUTH_FORM_TWO_COL_MIN_WIDTH = 560

export const AUTH_ILLUSTRATION_HEADLINE = APP_BRAND_NAME
export const AUTH_ILLUSTRATION_SUBHEADLINE = APP_BRAND_TAGLINE

export type AuthPalette = {
  bgCanvas: string
  cardBg: string
  cardBorder: string
  cardShadow: string
  titleText: string
  subtitleText: string
  labelText: string
  iconNeutral: string
  inputBorder: string
  inputBg: string
  inputText: string
  inputPlaceholder: string
  inputBorderFocus: string
  inputRingFocus: string
  primaryButton: string
  primaryButtonHover: string
  primaryButtonText: string
  linkText: string
  linkHoverText: string
  footerText: string
  alertErrorBg: string
  alertErrorBorder: string
  alertErrorText: string
  alertSuccessBg: string
  alertSuccessBorder: string
  alertSuccessText: string
  alertSuccessTitle: string
  eyebrowDot: string
  eyebrowText: string
}

function buildPalette (isDarkMode: boolean): AuthPalette {
  const t = getTechTokens(isDarkMode)

  if (isDarkMode) {
    return {
      bgCanvas: t.canvasBase,
      cardBg: t.panelFill,
      cardBorder: t.panelBorder,
      cardShadow: t.panelShadow,
      titleText: '#f1f5f9',
      subtitleText: '#94a3b8',
      labelText: '#e2e8f0',
      iconNeutral: '#64748b',
      inputBorder: t.insetBorder,
      inputBg: t.insetFill,
      inputText: '#f1f5f9',
      inputPlaceholder: '#64748b',
      inputBorderFocus: t.accentMuted,
      inputRingFocus: t.accentGlow,
      primaryButton: brandColors.secondary,
      primaryButtonHover: '#00C07A',
      primaryButtonText: '#FFFFFF',
      linkText: brandColors.secondary,
      linkHoverText: '#7EEAB8',
      footerText: '#94a3b8',
      alertErrorBg: 'rgba(76, 5, 25, 0.35)',
      alertErrorBorder: 'rgba(244, 63, 94, 0.35)',
      alertErrorText: '#fecdd3',
      alertSuccessBg: 'rgba(6, 78, 59, 0.35)',
      alertSuccessBorder: 'rgba(16, 185, 129, 0.4)',
      alertSuccessText: '#a7f3d0',
      alertSuccessTitle: '#a7f3d0',
      eyebrowDot: t.accent,
      eyebrowText: '#94a3b8',
    }
  }

  return {
    bgCanvas: t.canvasBase,
    cardBg: t.panelFill,
    cardBorder: t.panelBorder,
    cardShadow: t.panelShadow,
    titleText: brandColors.textBody,
    subtitleText: '#5C6670',
    labelText: brandColors.textBody,
    iconNeutral: '#94a3b8',
    inputBorder: t.insetBorder,
    inputBg: t.insetFill,
    inputText: '#0f172a',
    inputPlaceholder: '#64748b',
    inputBorderFocus: t.accentMuted,
    inputRingFocus: t.accentGlow,
      primaryButton: brandColors.secondary,
      primaryButtonHover: '#00C07A',
      primaryButtonText: '#FFFFFF',
      linkText: brandColors.secondary,
      linkHoverText: '#008F5A',
    footerText: '#64748b',
    alertErrorBg: 'rgba(255, 241, 242, 0.9)',
    alertErrorBorder: 'rgba(254, 205, 211, 0.85)',
    alertErrorText: '#881337',
    alertSuccessBg: '#d1fae5',
    alertSuccessBorder: '#86efac',
    alertSuccessText: '#065f46',
    alertSuccessTitle: '#065f46',
    eyebrowDot: t.accent,
    eyebrowText: '#64748b',
  }
}

export const authSpacing = {
  outerPadding: mfSpacing.md,
  cardPaddingHDesktop: mfSpacing.lg,
  cardPaddingHMobile: mfSpacing.xl,
  cardPaddingVDesktop: mfSpacing.lg,
  cardPaddingVMobile: mfSpacing.lg,
  headerMarginBottomDesktop: mfSpacing.lg,
  headerMarginBottomMobile: mfSpacing.md,
  fieldGap: mfSpacing.md,
  labelMarginBottom: mfSpacing.sm,
  inputPaddingH: mfSpacing.md,
  inputPaddingV: 12,
  buttonMarginTop: mfSpacing.xs,
  footerMarginTop: mfSpacing.md,
} as const

export const authRadius = {
  card: mfRadius.xl,
  input: mfRadius.md,
  button: mfRadius.pill,
  alert: mfRadius.lg,
} as const

export const authTypography = {
  titleSize: 26,
  titleWeight: '700' as const,
  titleLineHeight: 32,
  subtitleSize: 14,
  subtitleWeight: '400' as const,
  subtitleLineHeight: 20,
  labelSize: 14,
  labelWeight: '600' as const,
  inputSize: 15,
  inputWeight: '400' as const,
  buttonSize: 15,
  buttonWeight: '700' as const,
  footerSize: 12,
  footerWeight: '400' as const,
  heroTitleSize: 28,
  heroSubtitleSize: 15,
} as const

export const authShadows = {
  focusRing: '0 0 0 3px',
  imageDrop: 'drop-shadow(0 20px 32px rgba(0, 0, 0, 0.28))',
} as const

export function getAuthPalette (isDarkMode: boolean): AuthPalette {
  return buildPalette(isDarkMode)
}
