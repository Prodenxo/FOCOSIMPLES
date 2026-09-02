import { POPULAR_MOEDAS } from './contaMoedaGlobalTypes'
import { getMoedaNomePt, localizeCurrencyCatalog, matchesMoedaSearch } from './moedaNomesPt'

const FRANKFURTER_BASE = 'https://api.frankfurter.dev'
const FRANKFURTER_CURRENCIES_URL = `${FRANKFURTER_BASE}/v1/currencies`
const FRANKFURTER_CURRENCIES_TIMEOUT_MS = 8_000
const FRANKFURTER_RATES_TIMEOUT_MS = 4_000

/** Códigos mínimos quando tudo falhar. */
export const FALLBACK_CURRENCY_CODES = [...POPULAR_MOEDAS, 'BRL', 'CLP', 'COP', 'PEN'] as const

export async function fetchFrankfurterCurrenciesDirect(): Promise<Record<string, string>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FRANKFURTER_CURRENCIES_TIMEOUT_MS)
  try {
    const res = await fetch(FRANKFURTER_CURRENCIES_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error('Frankfurter indisponível')
    const json = (await res.json()) as Record<string, string>
    const codes = Object.keys(json).map((c) => c.toUpperCase())
    return localizeCurrencyCatalog(Object.fromEntries(codes.map((c) => [c, c])))
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Cotação: 1 unidade da moeda = X BRL.
 * Uma chamada Frankfurter (base BRL) para todas as moedas pedidas.
 */
export async function fetchFrankfurterRatesToBrlDirect(
  codesInput: string[],
): Promise<Record<string, number>> {
  const codes = [...new Set(codesInput.map((c) => c.trim().toUpperCase()).filter(Boolean))]
  const out: Record<string, number> = {}

  for (const code of codes) {
    if (code === 'BRL') out.BRL = 1
  }

  const foreign = codes.filter((c) => c !== 'BRL')
  if (!foreign.length) return out

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FRANKFURTER_RATES_TIMEOUT_MS)
  try {
    const symbols = encodeURIComponent(foreign.join(','))
    const res = await fetch(`${FRANKFURTER_BASE}/v1/latest?base=BRL&symbols=${symbols}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error('Cotações indisponíveis')
    const json = (await res.json()) as { rates?: Record<string, number> }
    for (const code of foreign) {
      const unitsPerBrl = Number(json.rates?.[code])
      if (Number.isFinite(unitsPerBrl) && unitsPerBrl > 0) {
        out[code] = 1 / unitsPerBrl
      }
    }
  } finally {
    clearTimeout(timeout)
  }

  return out
}

const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest/BRL'
const EXCHANGE_RATE_API_TIMEOUT_MS = 5_000

/**
 * Fallback: moedas que o Frankfurter não cobre (ex.: CRC, CLP).
 * 1 unidade da moeda = X BRL.
 */
export async function fetchExchangeRateApiToBrlDirect(
  codesInput: string[],
): Promise<Record<string, number>> {
  const codes = [...new Set(codesInput.map((c) => c.trim().toUpperCase()).filter(Boolean))]
  const foreign = codes.filter((c) => c !== 'BRL')
  if (!foreign.length) return {}

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), EXCHANGE_RATE_API_TIMEOUT_MS)
  try {
    const res = await fetch(EXCHANGE_RATE_API_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error('Cotações indisponíveis')
    const json = (await res.json()) as { rates?: Record<string, number> }
    const out: Record<string, number> = {}
    for (const code of foreign) {
      const unitsPerBrl = Number(json.rates?.[code])
      if (Number.isFinite(unitsPerBrl) && unitsPerBrl > 0) {
        out[code] = 1 / unitsPerBrl
      }
    }
    return out
  } finally {
    clearTimeout(timeout)
  }
}

export function mergeCurrencyCatalog(
  ...sources: Array<Record<string, string> | null | undefined>
): Record<string, string> {
  const codeSet = new Set<string>(FALLBACK_CURRENCY_CODES as unknown as string[])
  for (const src of sources) {
    if (!src) continue
    Object.keys(src).forEach((c) => codeSet.add(c.toUpperCase()))
  }
  return localizeCurrencyCatalog(Object.fromEntries([...codeSet].map((c) => [c, c])))
}

export function filterCurrencyOptions(
  catalog: Record<string, string>,
  search: string,
): Array<{ code: string; name: string }> {
  const q = search.trim()
  const entries = Object.entries(catalog)
  if (!q) {
    const popular = POPULAR_MOEDAS.filter((code) => catalog[code])
    const rest = entries
      .map(([code]) => code)
      .filter((code) => !POPULAR_MOEDAS.includes(code as (typeof POPULAR_MOEDAS)[number]))
      .sort()
    return [...popular, ...rest].map((code) => ({
      code,
      name: catalog[code] || getMoedaNomePt(code),
    }))
  }
  return entries
    .filter(([code, name]) => matchesMoedaSearch(code, name, q))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, name]) => ({ code, name }))
}

export function getCurrencyLabel(catalog: Record<string, string>, code: string): string {
  const c = code.toUpperCase()
  const name = catalog[c] || getMoedaNomePt(c)
  return `${c} — ${name}`
}
