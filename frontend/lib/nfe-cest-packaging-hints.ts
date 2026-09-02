/**
 * Sugestão de CEST a partir de NCM + descrição (embalagem PET, lata, etc.).
 * Apoio ao cadastro de produtos ST — o usuário pode confirmar ou editar o CEST.
 */

const onlyDigits = (value: string | null | undefined, max: number) =>
  String(value ?? '').replace(/\D/g, '').slice(0, max)

const normalizeText = (value: string | null | undefined) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

/** @typedef {{ ncmPrefix: string, keywords: string[], cest: string }} CestPackagingRule */

const CEST_PACKAGING_RULES: Array<{ ncmPrefix: string; keywords: string[]; cest: string }> = [
  {
    ncmPrefix: '2202',
    keywords: ['pet', 'garrafa', 'plastico', 'plastica', 'retornavel', 'descartavel'],
    cest: '0300100',
  },
  {
    ncmPrefix: '2202',
    keywords: ['lata', 'aluminio', 'aluminica'],
    cest: '0300200',
  },
  {
    ncmPrefix: '2203',
    keywords: ['lata', 'long neck', 'longneck', 'garrafa', 'pet'],
    cest: '0300300',
  },
  {
    ncmPrefix: '2204',
    keywords: ['garrafa', 'pet', 'vidro'],
    cest: '0300400',
  },
]

/**
 * Infere CEST (7 dígitos) quando a descrição indica embalagem (PET, lata, etc.).
 * Retorna null se não houver correspondência confiável.
 */
export function inferCestFromProductDescription(
  ncm: string | null | undefined,
  descricao: string | null | undefined,
): string | null {
  const ncmNorm = onlyDigits(ncm, 8)
  if (ncmNorm.length !== 8) return null

  const text = normalizeText(descricao)
  if (!text.trim()) return null

  for (const rule of CEST_PACKAGING_RULES) {
    if (!ncmNorm.startsWith(rule.ncmPrefix)) continue
    if (rule.keywords.some((kw) => text.includes(kw))) {
      return rule.cest
    }
  }

  return null
}

export function normalizeCestInput(value: string | null | undefined): string {
  return onlyDigits(value, 7)
}

/** Alias — CEST no XML: 7 dígitos sem pontuação. */
export function normalizeCestForPlugnotas(value: string | null | undefined): string | null {
  const digits = normalizeCestInput(value)
  return digits.length === 7 ? digits : null
}
