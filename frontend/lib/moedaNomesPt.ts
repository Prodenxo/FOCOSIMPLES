import { POPULAR_MOEDAS } from './contaMoedaGlobalTypes'

/** Nomes em pt-BR quando Intl não estiver disponível (Hermes antigo). */
export const MOEDA_NOMES_PT: Record<string, string> = {
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
  UYU: 'Peso uruguaio',
  PYG: 'Guarani paraguaio',
  BOB: 'Boliviano',
  HKD: 'Dólar de Hong Kong',
  SGD: 'Dólar de Singapura',
  KRW: 'Won sul-coreano',
  INR: 'Rupia indiana',
  TRY: 'Lira turca',
  ZAR: 'Rand sul-africano',
  NOK: 'Coroa norueguesa',
  SEK: 'Coroa sueca',
  DKK: 'Coroa dinamarquesa',
  PLN: 'Zloty polonês',
  CZK: 'Coroa tcheca',
  HUF: 'Forint húngaro',
  ILS: 'Novo shekel israelense',
  THB: 'Baht tailandês',
  PHP: 'Peso filipino',
  IDR: 'Rupia indonésia',
  MYR: 'Ringgit malaio',
  NZD: 'Dólar neozelandês',
  RON: 'Leu romeno',
  BGN: 'Lev búlgaro',
  ISK: 'Coroa islandesa',
  RUB: 'Rublo russo',
  UAH: 'Hryvnia ucraniana',
  AED: 'Dirham dos Emirados',
  SAR: 'Riyal saudita',
  QAR: 'Riyal do Catar',
  KWD: 'Dinar kuwaitiano',
  EGP: 'Libra egípcia',
  MAD: 'Dirham marroquino',
  TWD: 'Dólar taiwanês',
  VND: 'Dong vietnamita',
  PKR: 'Rupia paquistanesa',
  BDT: 'Taka bengali',
  NGN: 'Naira nigeriana',
  KES: 'Xelim queniano',
  GHS: 'Cedi ganês',
  CRC: 'Colón costa-riquenho',
  DOP: 'Peso dominicano',
  GTQ: 'Quetzal guatemalteco',
  HNL: 'Lempira hondurenha',
  NIO: 'Córdoba nicaraguense',
  PAB: 'Balboa panamenho',
  VES: 'Bolívar venezuelano',
}

/** Termos extras para busca em português. */
export const MOEDA_BUSCA_PT: Record<string, string[]> = {
  USD: ['dolar', 'dólar', 'americano', 'eua', 'usa'],
  EUR: ['euro', 'europa'],
  GBP: ['libra', 'sterling', 'esterlina', 'reino unido'],
  JPY: ['iene', 'japao', 'japão'],
  BRL: ['real', 'brasil'],
  ARS: ['peso', 'argentina'],
  CAD: ['canadense', 'canada', 'canadá'],
  AUD: ['australiano', 'australia', 'austrália'],
  CHF: ['franco', 'suica', 'suíça'],
  CNY: ['yuan', 'china'],
  MXN: ['mexicano', 'mexico', 'méxico'],
}

let displayNames: Intl.DisplayNames | null = null

function getDisplayNames(): Intl.DisplayNames | null {
  if (displayNames) return displayNames
  try {
    if (typeof Intl !== 'undefined' && 'DisplayNames' in Intl) {
      displayNames = new Intl.DisplayNames(['pt-BR'], { type: 'currency' })
      return displayNames
    }
  } catch {
    // Intl indisponível no runtime
  }
  return null
}

export function getMoedaNomePt(code: string): string {
  const c = String(code || '').trim().toUpperCase()
  if (!c) return ''
  const intl = getDisplayNames()?.of(c)
  if (intl && intl.toUpperCase() !== c) {
    return intl.charAt(0).toUpperCase() + intl.slice(1)
  }
  return MOEDA_NOMES_PT[c] ?? c
}

export function localizeCurrencyCatalog(catalog: Record<string, string>): Record<string, string> {
  const codes = new Set([
    ...Object.keys(catalog),
    ...Object.keys(MOEDA_NOMES_PT),
    ...POPULAR_MOEDAS,
  ])
  const out: Record<string, string> = {}
  for (const code of codes) {
    out[code] = getMoedaNomePt(code)
  }
  return out
}

export function matchesMoedaSearch(code: string, name: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (code.toLowerCase().includes(q) || name.toLowerCase().includes(q)) return true
  const aliases = MOEDA_BUSCA_PT[code.toUpperCase()]
  return aliases?.some((a) => a.includes(q) || q.includes(a)) ?? false
}
