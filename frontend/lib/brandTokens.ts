/**
 * Manual da Marca FocoMEI v1.0 — tokens para UI.
 * @see marcaa/Manual da Marca FocoMEI_v1.0.pdf
 */

export const brandColors = {
  primary: '#0D2B5E',
  secondary: '#00A86B',
  background: '#FFFFFF',
  surface: '#F4F4F4',
  alert: '#F4620F',
  textBody: '#333333',
} as const

export const brandDarkColors = {
  background: '#0D2B5E',
  surface: '#12356E',
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.72)',
} as const

/** Máx. 2 pesos Inter por tela (manual). */
export const brandFontFamily = 'Inter'

export const brandTypography = {
  hero: { fontSize: 32, fontWeight: '800' as const, lineHeight: 40 },
  title: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  metric: { fontSize: 28, fontWeight: '800' as const, lineHeight: 34 },
} as const

export function brandPrimaryTint (alpha = 0.12): string {
  return `rgba(13, 43, 94, ${alpha})`
}

export function brandSecondaryTint (alpha = 0.12): string {
  return `rgba(0, 168, 107, ${alpha})`
}
