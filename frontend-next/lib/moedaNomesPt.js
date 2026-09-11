import { POPULAR_MOEDAS } from './contaMoedaGlobalTypes';

export const MOEDA_NOMES_PT = {
  USD: 'Dólar americano',
  EUR: 'Euro',
  GBP: 'Libra esterlina',
  JPY: 'Iene japonês',
  BRL: 'Real brasileiro',
  ARS: 'Peso argentino',
  CAD: 'Dólar canadense',
  CHF: 'Franco suíço',
  AUD: 'Dólar australiano',
  CNY: 'Yuan chinês',
  MXN: 'Peso mexicano',
  CLP: 'Peso chileno',
  COP: 'Peso colombiano',
  PEN: 'Sol peruano',
  HKD: 'Dólar de Hong Kong',
  SGD: 'Dólar de Singapura',
  KRW: 'Won sul-coreano',
  INR: 'Rupia indiana',
  TRY: 'Lira turca',
  ZAR: 'Rand sul-africano',
  AED: 'Dirham dos Emirados',
  KWD: 'Dinar kuwaitiano',
  CRC: 'Colón costa-riquenho',
};

export const MOEDA_BUSCA_PT = {
  USD: ['dolar', 'dólar', 'americano', 'eua'],
  EUR: ['euro', 'europa'],
  GBP: ['libra', 'esterlina', 'reino unido'],
  JPY: ['iene', 'japao', 'japão'],
  BRL: ['real', 'brasil'],
  AED: ['dirham', 'emirados'],
  HKD: ['hong kong'],
  KWD: ['dinar', 'kuwait'],
};

let displayNames = null;

function getDisplayNames() {
  if (displayNames) return displayNames;
  try {
    if (typeof Intl !== 'undefined' && 'DisplayNames' in Intl) {
      displayNames = new Intl.DisplayNames(['pt-BR'], { type: 'currency' });
      return displayNames;
    }
  } catch {
    // Intl indisponível
  }
  return null;
}

export function getMoedaNomePt(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return '';
  const intl = getDisplayNames()?.of(c);
  if (intl && intl.toUpperCase() !== c) {
    return intl.charAt(0).toUpperCase() + intl.slice(1);
  }
  return MOEDA_NOMES_PT[c] ?? c;
}

export function localizeCurrencyCatalog(catalog) {
  const codes = new Set([
    ...Object.keys(catalog || {}),
    ...Object.keys(MOEDA_NOMES_PT),
    ...POPULAR_MOEDAS,
  ]);
  const out = {};
  for (const code of codes) {
    out[code] = getMoedaNomePt(code);
  }
  return out;
}

export function matchesMoedaSearch(code, name, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (code.toLowerCase().includes(q) || name.toLowerCase().includes(q)) return true;
  const aliases = MOEDA_BUSCA_PT[code.toUpperCase()];
  return aliases?.some((a) => a.includes(q) || q.includes(a)) ?? false;
}
