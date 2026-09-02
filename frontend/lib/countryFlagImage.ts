/** Larguras suportadas pelo flagcdn (outras retornam 404). */
const FLAGCDN_WIDTHS = [20, 40, 80, 160, 320, 640] as const

function snapFlagCdnWidth(requestedPx: number): number {
  const target = Math.max(20, Math.round(requestedPx))
  for (const w of FLAGCDN_WIDTHS) {
    if (w >= target) return w
  }
  return FLAGCDN_WIDTHS[FLAGCDN_WIDTHS.length - 1]
}

/** URL PNG da bandeira (flagcdn — ISO 3166-1 alpha-2). */
export function getCountryFlagImageUrl(iso: string, height = 24): string {
  const code = iso.trim().toLowerCase()
  const width = snapFlagCdnWidth(Math.max(40, Math.round(height * 2)))
  return `https://flagcdn.com/w${width}/${code}.png`
}

export function getCountryFlagImageUrlBySize(iso: string, size = 32): string {
  const code = iso.trim().toLowerCase()
  const width = snapFlagCdnWidth(Math.max(40, Math.round(size * 2)))
  return `https://flagcdn.com/w${width}/${code}.png`
}

/** Fallback compacto — funciona para a maioria dos países no app nativo. */
export function getCountryFlagCompactPngUrl(iso: string): string {
  const code = iso.trim().toLowerCase()
  return `https://flagcdn.com/24x18/${code}.png`
}
