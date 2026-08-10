/**
 * CEST — normalização e inferência por embalagem (NF-e/NFC-e).
 */

const onlyDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);

const normalizeText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** @type {Array<{ ncmPrefix: string, keywords: string[], cest: string }>} */
const CEST_PACKAGING_RULES = [
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
];

/** CEST no XML PlugNotas/SEFAZ: 7 dígitos sem pontuação (ex.: 0300100). */
export const normalizeCestForPlugnotas = (value) => {
  const digits = onlyDigits(value, 7);
  return digits.length === 7 ? digits : null;
};

export const inferCestFromProductDescription = (ncm, descricao) => {
  const ncmNorm = onlyDigits(ncm, 8);
  if (ncmNorm.length !== 8) return null;

  const text = normalizeText(descricao);
  if (!text.trim()) return null;

  for (const rule of CEST_PACKAGING_RULES) {
    if (!ncmNorm.startsWith(rule.ncmPrefix)) continue;
    if (rule.keywords.some((kw) => text.includes(kw))) {
      return rule.cest;
    }
  }

  return null;
};

export const itemHasStIcms = (item) => {
  if (!item || typeof item !== 'object') return false;
  const tributos = item.tributos && typeof item.tributos === 'object' ? item.tributos : {};
  const icms = tributos.icms && typeof tributos.icms === 'object' ? tributos.icms : {};
  const csosn = onlyDigits(icms.csosn, 3);
  if (csosn) return csosn === '500';
  const cst = onlyDigits(icms.cst, 3);
  return cst === '500';
};

/**
 * Resolve CEST do item (campo explícito ou inferência pela descrição).
 * @returns {string|null}
 */
export const resolveItemCestForPlugnotas = (item) => {
  if (!item || typeof item !== 'object') return null;
  if (!itemHasStIcms(item)) return null;
  const fromField = normalizeCestForPlugnotas(item.cest);
  if (fromField) return fromField;
  return inferCestFromProductDescription(item.ncm, item.descricao);
};

/**
 * Valida metadata_json de produto NF-e/NFC-e (cest, hasSt).
 * @param {object|null|undefined} metadata
 * @param {{ discriminacao?: string }} [context]
 */
export const validateNfeCatalogProdutoMetadata = (metadata, context = {}) => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return;

  const cest = normalizeCestForPlugnotas(metadata.cest);
  if (metadata.cest != null && String(metadata.cest).trim() && !cest) {
    throw new Error('CEST do produto deve ter 7 dígitos (ex.: 0300100).');
  }

  const csosn = onlyDigits(metadata.icmsCsosn ?? metadata.icms_csosn, 3);
  if (csosn === '500' && !cest) {
    const discriminacao = String(context.discriminacao || '').trim();
    const ncm = onlyDigits(metadata.ncm, 8);
    const inferred = inferCestFromProductDescription(ncm, discriminacao);
    if (!inferred) {
      throw new Error(
        'Produtos com CSOSN 500 exigem CEST no cadastro ou embalagem na descrição (ex.: PET, lata).',
      );
    }
  }
};
