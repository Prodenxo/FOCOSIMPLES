import { badRequest, serviceUnavailable } from '../utils/errors.js';

const FRANKFURTER_BASE = 'https://api.frankfurter.dev';
const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest/BRL';
const CACHE_TTL_MS = 60 * 60 * 1000;

/** @type {{ at: number, data: Record<string, string> } | null} */
let currenciesCache = null;

/** @type {Map<string, { at: number, rate: number }>} */
const rateCache = new Map();

const normalizeCode = (code) => String(code || '').trim().toUpperCase();

const fetchJson = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw badRequest('Serviço de câmbio indisponível no momento.');
    }
    return await res.json();
  } catch (err) {
    if (err?.status) throw err;
    throw serviceUnavailable('Não foi possível consultar cotações. Tente novamente em instantes.');
  } finally {
    clearTimeout(timeout);
  }
};

export const listFrankfurterCurrencies = async () => {
  const now = Date.now();
  if (currenciesCache && now - currenciesCache.at < CACHE_TTL_MS) {
    return currenciesCache.data;
  }
  const json = await fetchJson(`${FRANKFURTER_BASE}/v1/currencies`);
  if (!json || typeof json !== 'object') {
    throw serviceUnavailable('Lista de moedas indisponível.');
  }
  const data = Object.fromEntries(
    Object.keys(json).map((code) => [normalizeCode(code), normalizeCode(code)]),
  );
  currenciesCache = { at: now, data };
  return data;
};

/**
 * Taxa: 1 unidade de `code` = X BRL.
 * Usa base BRL + inversão (uma chamada para várias moedas).
 */
export const getRatesToBrl = async (codesInput) => {
  const codes = [...new Set((codesInput || []).map(normalizeCode).filter(Boolean))];
  const out = {};
  const now = Date.now();

  for (const code of codes) {
    if (code === 'BRL') out.BRL = 1;
  }

  const foreign = codes.filter((c) => c !== 'BRL');
  const needFetch = foreign.filter((code) => {
    const cached = rateCache.get(code);
    if (cached && now - cached.at < CACHE_TTL_MS) {
      out[code] = cached.rate;
      return false;
    }
    return true;
  });

  if (needFetch.length > 0) {
    const symbols = needFetch.map(encodeURIComponent).join(',');
    const json = await fetchJson(`${FRANKFURTER_BASE}/v1/latest?base=BRL&symbols=${symbols}`);
    for (const code of needFetch) {
      const unitsPerBrl = Number(json?.rates?.[code]);
      if (Number.isFinite(unitsPerBrl) && unitsPerBrl > 0) {
        const rate = 1 / unitsPerBrl;
        rateCache.set(code, { at: now, rate });
        out[code] = rate;
      }
    }

    const stillMissing = needFetch.filter((code) => out[code] == null);
    if (stillMissing.length > 0) {
      try {
        const fallbackJson = await fetchJson(EXCHANGE_RATE_API_URL);
        for (const code of stillMissing) {
          const unitsPerBrl = Number(fallbackJson?.rates?.[code]);
          if (Number.isFinite(unitsPerBrl) && unitsPerBrl > 0) {
            const rate = 1 / unitsPerBrl;
            rateCache.set(code, { at: now, rate });
            out[code] = rate;
          }
        }
      } catch {
        // mantém só as cotações já obtidas
      }
    }
  }

  return out;
};

/** @deprecated Use getRatesToBrl — mantido para compatibilidade. */
export const getRateToBrl = async (codeInput) => {
  const code = normalizeCode(codeInput);
  const rates = await getRatesToBrl([code]);
  const rate = rates[code];
  if (rate == null) {
    throw badRequest(`Cotação indisponível para ${code}.`);
  }
  return rate;
};
