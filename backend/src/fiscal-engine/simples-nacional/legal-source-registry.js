/**
 * Registry de fontes legais oficiais — Fase 8B.
 * Toda regra productionReady=true deve referenciar entradas validadas aqui.
 */

/** @typedef {'DRAFT' | 'REVIEWED' | 'APPROVED' | 'DEPRECATED'} FiscalLegalReviewStatus */

/**
 * @typedef {object} FiscalLegalSource
 * @property {string} id
 * @property {string} authority
 * @property {string} jurisdiction
 * @property {string} documentType
 * @property {string} documentNumber
 * @property {string} [publicationDate]
 * @property {string} effectiveFrom
 * @property {string} [effectiveTo]
 * @property {string} sourceUrl
 * @property {string} [checksum]
 * @property {string} reviewedAt
 * @property {FiscalLegalReviewStatus} reviewStatus
 * @property {string} [articleClause]
 * @property {string} [ruleVersion]
 */

/** Fontes oficiais pré-cadastradas para pacote Phase 8B (research fixtures — não promover regra sem review). */
export const PHASE8B_OFFICIAL_LEGAL_SOURCES = Object.freeze([
  {
    id: 'lc-123-2006',
    authority: 'CONGRESSO_NACIONAL',
    jurisdiction: 'BR',
    documentType: 'LEI_COMPLEMENTAR',
    documentNumber: '123/2006',
    publicationDate: '2006-12-14',
    effectiveFrom: '2007-01-01',
    sourceUrl: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm',
    reviewedAt: '2026-08-12',
    reviewStatus: 'REVIEWED',
    articleClause: 'Art. 25 e Anexo I',
    ruleVersion: '2026-08-12',
  },
  {
    id: 'cgsn-resolucao-140-2018',
    authority: 'CGSN',
    jurisdiction: 'BR',
    documentType: 'RESOLUCAO',
    documentNumber: '140/2018',
    effectiveFrom: '2018-01-01',
    sourceUrl: 'https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/simples-nacional',
    reviewedAt: '2026-08-12',
    reviewStatus: 'REVIEWED',
    ruleVersion: '2026-08-12',
  },
  {
    id: 'ajuste-sinief-3-2010',
    authority: 'CONFAZ',
    jurisdiction: 'BR',
    documentType: 'AJUSTE_SINIEF',
    documentNumber: '3/2010',
    publicationDate: '2010-07-30',
    effectiveFrom: '2010-10-01',
    sourceUrl: 'https://www.confaz.fazenda.gov.br/legislacao/ajustes/2010/ajuste-sinief-3-10',
    reviewedAt: '2026-08-13',
    reviewStatus: 'REVIEWED',
    articleClause: 'Introdução CRT/CSOSN na NF-e — efeitos 01/10/2010',
    ruleVersion: '2026-08-13',
  },
  {
    id: 'ajuste-sinief-7-2005',
    authority: 'CONFAZ',
    jurisdiction: 'BR',
    documentType: 'AJUSTE_SINIEF',
    documentNumber: '7/2005',
    publicationDate: '2005-09-30',
    effectiveFrom: '2006-04-01',
    sourceUrl: 'https://www.confaz.fazenda.gov.br/legislacao/ajustes/2005/ajuste-sinief-7-05',
    reviewedAt: '2026-08-13',
    reviewStatus: 'REVIEWED',
    articleClause: 'NF-e — base procedimental (referência histórica CSOSN)',
    ruleVersion: '2026-08-13',
  },
  {
    id: 'sinief-ajuste-39-2023',
    authority: 'CONFAZ',
    jurisdiction: 'BR',
    documentType: 'AJUSTE_SINIEF',
    documentNumber: '39/2023',
    publicationDate: '2023-10-04',
    effectiveFrom: '2023-12-01',
    sourceUrl: 'https://www.confaz.fazenda.gov.br/legislacao/ajustes/2023/ajuste-sinief-39-23',
    reviewedAt: '2026-08-13',
    reviewStatus: 'REVIEWED',
    articleClause: 'Cláusula terceira II — demais dispositivos (2º mês após DOU 04/10/2023)',
    ruleVersion: '2026-08-13',
  },
  {
    id: 'encat-manual-csosn',
    authority: 'ENCAT',
    jurisdiction: 'BR',
    documentType: 'MANUAL_TECNICO',
    documentNumber: 'CSOSN-NFE',
    effectiveFrom: '2010-10-01',
    sourceUrl: 'https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=04/09/02/03',
    reviewedAt: '2026-08-13',
    reviewStatus: 'REVIEWED',
    ruleVersion: '2026-08-13',
  },
  {
    id: 'confaz-convenio-142-2018',
    authority: 'CONFAZ',
    jurisdiction: 'BR',
    documentType: 'CONVENIO',
    documentNumber: '142/2018',
    effectiveFrom: '2018-09-01',
    sourceUrl: 'https://www.confaz.fazenda.gov.br/legislacao/convenios',
    reviewedAt: '2026-08-12',
    reviewStatus: 'REVIEWED',
    ruleVersion: '2026-08-12',
  },
]);

/** @type {Map<string, FiscalLegalSource>} */
const registry = new Map(PHASE8B_OFFICIAL_LEGAL_SOURCES.map((s) => [s.id, { ...s }]));

/**
 * @param {FiscalLegalSource} source
 */
export const validateFiscalLegalSource = (source) => {
  const errors = [];
  if (!source?.id) errors.push('id obrigatório');
  if (!source?.authority) errors.push('authority obrigatório');
  if (!source?.jurisdiction) errors.push('jurisdiction obrigatório');
  if (!source?.documentType) errors.push('documentType obrigatório');
  if (!source?.documentNumber) errors.push('documentNumber obrigatório');
  if (!source?.effectiveFrom) errors.push('effectiveFrom obrigatório');
  if (!source?.sourceUrl) errors.push('sourceUrl obrigatório');
  if (!source?.reviewedAt) errors.push('reviewedAt obrigatório');
  if (!['DRAFT', 'REVIEWED', 'APPROVED', 'DEPRECATED'].includes(String(source?.reviewStatus))) {
    errors.push('reviewStatus inválido');
  }
  return errors.length ? { ok: false, errors } : { ok: true };
};

/**
 * @param {FiscalLegalSource[]} sources
 */
export const registerFiscalLegalSources = (sources) => {
  for (const source of sources ?? []) {
    const v = validateFiscalLegalSource(source);
    if (!v.ok) throw new Error(`Fonte legal inválida ${source?.id}: ${v.errors.join(' ')}`);
    registry.set(source.id, source);
  }
};

/** @param {string} id */
export const getFiscalLegalSource = (id) => registry.get(id) ?? null;

/** @param {string} referenceDate */
export const isLegalSourceEffectiveOn = (source, referenceDate) => {
  if (!source) return false;
  const ref = String(referenceDate ?? '').slice(0, 10);
  if (ref < source.effectiveFrom) return false;
  if (source.effectiveTo && ref > source.effectiveTo) return false;
  return true;
};

export const __resetLegalSourceRegistryForTests = () => {
  registry.clear();
  for (const s of PHASE8B_OFFICIAL_LEGAL_SOURCES) registry.set(s.id, { ...s });
};

export const listFiscalLegalSources = () => [...registry.values()];
