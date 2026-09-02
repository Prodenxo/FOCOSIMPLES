import { getCountryFlagImageUrlBySize, getCountryFlagCompactPngUrl } from './countryFlagImage'
import { getMoedaCountryIso } from './moedaCountryIso'

/**
 * circle-flags usa slugs diferentes do ISO em alguns casos.
 * `eu.svg` no repositório não é imagem — aponta para `european_union.svg`.
 */
const CIRCLE_FLAG_SLUG: Record<string, string> = {
  eu: 'european_union',
}

/** flagcdn não tem `eu.svg` confiável no RN — usar PNG. */
const FLAG_RASTER_FALLBACK: Record<string, string> = {
  eu: 'https://flagcdn.com/w80/eu.png',
}

/** Bandeira circular SVG (Wise-style) — funciona no web/Windows. */
export function getMoedaCircleFlagSvgUrl(countryIso: string): string {
  const code = countryIso.trim().toLowerCase()
  const slug = CIRCLE_FLAG_SLUG[code] ?? code
  return `https://cdn.jsdelivr.net/gh/HatScripts/circle-flags@gh-pages/flags/${slug}.svg`
}

export function getMoedaFlagPngUrl(countryIso: string, size: number): string {
  const code = countryIso.trim().toLowerCase()
  const fallback = FLAG_RASTER_FALLBACK[code]
  if (fallback) return fallback
  return getCountryFlagImageUrlBySize(countryIso, size)
}

export function getMoedaFlagNativeUrls(countryIso: string, size: number): string[] {
  const code = countryIso.trim().toLowerCase()
  const primary = getMoedaFlagPngUrl(countryIso, size)
  const compact = getCountryFlagCompactPngUrl(code)
  return primary === compact ? [primary] : [primary, compact]
}

export function getMoedaFlagUrls(moeda: string, size: number): string[] {
  const iso = getMoedaCountryIso(moeda)
  if (!iso) return []
  return [getMoedaCircleFlagSvgUrl(iso), getMoedaFlagPngUrl(iso, size)]
}
