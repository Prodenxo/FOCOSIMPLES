import { apiClient } from '../lib/apiClient'
import {
  fetchFrankfurterCurrenciesDirect,
  fetchFrankfurterRatesToBrlDirect,
  fetchExchangeRateApiToBrlDirect,
  mergeCurrencyCatalog,
} from '../lib/frankfurterCurrenciesFallback'

const BACKEND_TIMEOUT_MS = 3_500
const RATE_CACHE_TTL_MS = 60 * 60 * 1000

const rateCache = new Map<string, { at: number; rate: number }>()

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export async function fetchMoedasGlobaisCurrencies(): Promise<Record<string, string>> {
  try {
    const direct = await fetchFrankfurterCurrenciesDirect()
    if (Object.keys(direct).length > 0) {
      return mergeCurrencyCatalog(direct)
    }
  } catch {
    // Frankfurter indisponível — tenta backend
  }

  try {
    const res = await withTimeout(
      apiClient.get<{ currencies: Record<string, string> }>('/moedas-globais/currencies'),
      BACKEND_TIMEOUT_MS,
    )
    if (res?.currencies && Object.keys(res.currencies).length > 0) {
      return mergeCurrencyCatalog(res.currencies)
    }
  } catch {
    // backend indisponível
  }

  return mergeCurrencyCatalog({})
}

export async function fetchMoedasGlobaisCotacoes(codes: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))]
  if (!unique.length) return {}

  const now = Date.now()
  const out: Record<string, number> = {}
  const missing: string[] = []

  for (const code of unique) {
    if (code === 'BRL') {
      out.BRL = 1
      continue
    }
    const cached = rateCache.get(code)
    if (cached && now - cached.at < RATE_CACHE_TTL_MS) {
      out[code] = cached.rate
    } else {
      missing.push(code)
    }
  }

  if (!missing.length) return out

  let fetched: Record<string, number> = {}

  try {
    fetched = await fetchFrankfurterRatesToBrlDirect(missing)
  } catch {
    fetched = {}
  }

  const stillMissing = missing.filter((code) => fetched[code] == null)

  if (stillMissing.length > 0) {
    try {
      const extra = await fetchExchangeRateApiToBrlDirect(stillMissing)
      fetched = { ...fetched, ...extra }
    } catch {
      // fallback secundário indisponível
    }
  }

  const stillMissingAfterApi = missing.filter((code) => fetched[code] == null)

  if (stillMissingAfterApi.length > 0) {
    try {
      const qs = encodeURIComponent(stillMissingAfterApi.join(','))
      const res = await withTimeout(
        apiClient.get<{ rates: Record<string, number> }>(`/moedas-globais/cotacoes?codes=${qs}`),
        BACKEND_TIMEOUT_MS,
      )
      if (res?.rates) {
        fetched = { ...fetched, ...res.rates }
      }
    } catch {
      // backend lento ou offline
    }
  }

  for (const code of missing) {
    const rate = fetched[code]
    if (rate != null && Number.isFinite(rate) && rate > 0) {
      rateCache.set(code, { at: now, rate })
      out[code] = rate
    }
  }

  return out
}

/** Pré-carrega cotação em cache (fire-and-forget). */
export function prefetchMoedaCotacao(code: string): void {
  const normalized = code.trim().toUpperCase()
  if (!normalized || normalized === 'BRL') return
  void fetchMoedasGlobaisCotacoes([normalized]).catch(() => {})
}
