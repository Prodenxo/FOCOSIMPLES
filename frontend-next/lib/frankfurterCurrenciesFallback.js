import { POPULAR_MOEDAS } from './contaMoedaGlobalTypes';
import { getMoedaNomePt, localizeCurrencyCatalog, matchesMoedaSearch } from './moedaNomesPt';

const FRANKFURTER_BASE = 'https://api.frankfurter.dev';
const FRANKFURTER_CURRENCIES_URL = `${FRANKFURTER_BASE}/v1/currencies`;
const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest/BRL';

export const FALLBACK_CURRENCY_CODES = [...POPULAR_MOEDAS, 'BRL', 'CLP', 'COP', 'PEN', 'AED', 'HKD', 'KWD'];

export async function fetchFrankfurterCurrenciesDirect() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(FRANKFURTER_CURRENCIES_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('Frankfurter indisponível');
    const json = await res.json();
    const codes = Object.keys(json).map((c) => c.toUpperCase());
    return localizeCurrencyCatalog(Object.fromEntries(codes.map((c) => [c, c])));
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchFrankfurterRatesToBrlDirect(codesInput) {
  const codes = [...new Set(codesInput.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  const out = {};
  for (const code of codes) {
    if (code === 'BRL') out.BRL = 1;
  }
  const foreign = codes.filter((c) => c !== 'BRL');
  if (!foreign.length) return { rates: out, rateDate: null };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const symbols = encodeURIComponent(foreign.join(','));
    const res = await fetch(`${FRANKFURTER_BASE}/v1/latest?base=BRL&symbols=${symbols}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('Cotações indisponíveis');
    const json = await res.json();
    for (const code of foreign) {
      const unitsPerBrl = Number(json.rates?.[code]);
      if (Number.isFinite(unitsPerBrl) && unitsPerBrl > 0) {
        out[code] = 1 / unitsPerBrl;
      }
    }
    return { rates: out, rateDate: json.date ?? null };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchExchangeRateApiToBrlDirect(codesInput) {
  const codes = [...new Set(codesInput.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  const foreign = codes.filter((c) => c !== 'BRL');
  if (!foreign.length) return { rates: {}, rateDate: null };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(EXCHANGE_RATE_API_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('Cotações indisponíveis');
    const json = await res.json();
    const out = {};
    for (const code of foreign) {
      const unitsPerBrl = Number(json.rates?.[code]);
      if (Number.isFinite(unitsPerBrl) && unitsPerBrl > 0) {
        out[code] = 1 / unitsPerBrl;
      }
    }
    const ts = json.time_last_update_unix ? new Date(json.time_last_update_unix * 1000) : null;
    return {
      rates: out,
      rateDate: ts ? ts.toISOString().slice(0, 10) : null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function mergeCurrencyCatalog(...sources) {
  const codeSet = new Set(FALLBACK_CURRENCY_CODES);
  for (const src of sources) {
    if (!src) continue;
    Object.keys(src).forEach((c) => codeSet.add(c.toUpperCase()));
  }
  return localizeCurrencyCatalog(Object.fromEntries([...codeSet].map((c) => [c, c])));
}

export function filterCurrencyOptions(catalog, search) {
  const q = search.trim();
  return Object.entries(catalog)
    .map(([code, name]) => ({ code, name: name || getMoedaNomePt(code) }))
    .filter(({ code, name }) => matchesMoedaSearch(code, name, q))
    .sort((a, b) => a.code.localeCompare(b.code));
}
