import { apiClient } from './apiClient';
import {
  fetchExchangeRateApiToBrlDirect,
  fetchFrankfurterCurrenciesDirect,
  fetchFrankfurterRatesToBrlDirect,
  mergeCurrencyCatalog,
} from './frankfurterCurrenciesFallback';

const BACKEND_TIMEOUT_MS = 3500;
const RATE_CACHE_TTL_MS = 60 * 60 * 1000;

const rateCache = new Map();
let lastRateMeta = { updatedAt: null, source: null };

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function getLastRateMeta() {
  return lastRateMeta;
}

export async function fetchMoedasGlobaisCurrencies() {
  try {
    const direct = await fetchFrankfurterCurrenciesDirect();
    if (Object.keys(direct).length > 0) {
      return mergeCurrencyCatalog(direct);
    }
  } catch {
    // tenta backend
  }

  try {
    const res = await withTimeout(
      apiClient.get('/moedas-globais/currencies'),
      BACKEND_TIMEOUT_MS,
    );
    if (res?.currencies && Object.keys(res.currencies).length > 0) {
      return mergeCurrencyCatalog(res.currencies);
    }
  } catch {
    // fallback local
  }

  return mergeCurrencyCatalog({});
}

export async function fetchMoedasGlobaisCotacoes(codes) {
  const unique = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  if (!unique.length) return { rates: {}, updatedAt: null };

  const now = Date.now();
  const out = {};
  const missing = [];

  for (const code of unique) {
    if (code === 'BRL') {
      out.BRL = 1;
      continue;
    }
    const cached = rateCache.get(code);
    if (cached && now - cached.at < RATE_CACHE_TTL_MS) {
      out[code] = cached.rate;
    } else {
      missing.push(code);
    }
  }

  if (!missing.length) {
    return { rates: out, updatedAt: lastRateMeta.updatedAt };
  }

  let fetched = {};
  let rateDate = null;
  let source = 'frankfurter';

  try {
    const result = await fetchFrankfurterRatesToBrlDirect(missing);
    fetched = result.rates;
    rateDate = result.rateDate;
  } catch {
    fetched = {};
  }

  const stillMissing = missing.filter((code) => fetched[code] == null);

  if (stillMissing.length > 0) {
    try {
      const extra = await fetchExchangeRateApiToBrlDirect(stillMissing);
      fetched = { ...fetched, ...extra.rates };
      if (!rateDate && extra.rateDate) {
        rateDate = extra.rateDate;
        source = 'open.er-api.com';
      }
    } catch {
      // continua
    }
  }

  const stillMissingAfterApi = missing.filter((code) => fetched[code] == null);

  if (stillMissingAfterApi.length > 0) {
    try {
      const qs = encodeURIComponent(stillMissingAfterApi.join(','));
      const res = await withTimeout(
        apiClient.get(`/moedas-globais/cotacoes?codes=${qs}`),
        BACKEND_TIMEOUT_MS,
      );
      if (res?.rates) {
        fetched = { ...fetched, ...res.rates };
        if (res.updatedAt) {
          lastRateMeta = { updatedAt: res.updatedAt, source: 'backend' };
        }
      }
    } catch {
      // backend offline
    }
  }

  for (const code of missing) {
    const rate = fetched[code];
    if (rate != null && Number.isFinite(rate) && rate > 0) {
      rateCache.set(code, { at: now, rate });
      out[code] = rate;
    }
  }

  if (rateDate && !lastRateMeta.updatedAt) {
    lastRateMeta = {
      updatedAt: typeof rateDate === 'string' && rateDate.length === 10
        ? `${rateDate}T12:00:00.000Z`
        : rateDate,
      source,
    };
  }

  return { rates: out, updatedAt: lastRateMeta.updatedAt };
}

export function prefetchMoedaCotacao(code) {
  const normalized = code.trim().toUpperCase();
  if (!normalized || normalized === 'BRL') return;
  void fetchMoedasGlobaisCotacoes([normalized]).catch(() => {});
}
