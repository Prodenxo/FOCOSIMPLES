/**
 * FiscalNFeItem — estrutura extensível para ICMS + futuro IBS/CBS.
 * Fase 0/1: contrato; resolução completa nas fases seguintes.
 */

/**
 * @typedef {object} FiscalTaxesBlock
 * @property {Record<string, unknown>} [icms]
 * @property {Record<string, unknown>} [pis]
 * @property {Record<string, unknown>} [cofins]
 * @property {Record<string, unknown>} [ipi]
 * @property {Record<string, unknown>} [ibsCbs]
 */

/**
 * @typedef {object} FiscalNFeItem
 * @property {string} nfeItemKey
 * @property {string} [commercialLineId]
 * @property {string} descricao
 * @property {string} ncm
 * @property {string | null} [cest]
 * @property {string | null} [cfop]
 * @property {string} quantidade
 * @property {string} valorUnitario
 * @property {string} valorTotal
 * @property {import('./origem-mercadoria.js').OrigemMercadoriaCode} origemMercadoria
 * @property {import('./item-source.js').ItemSource} itemSource
 * @property {FiscalTaxesBlock} taxes
 * @property {import('./resolution-status.js').ResolutionStatus} status
 * @property {import('./fiscal-issue.js').FiscalIssue[]} issues
 */

/**
 * @param {Partial<FiscalNFeItem>} [partial]
 * @returns {FiscalNFeItem}
 */
export const emptyFiscalNFeItem = (partial = {}) => ({
  nfeItemKey: partial.nfeItemKey || '',
  commercialLineId: partial.commercialLineId,
  descricao: partial.descricao || '',
  ncm: partial.ncm || '',
  cest: partial.cest ?? null,
  cfop: partial.cfop ?? null,
  quantidade: partial.quantidade || '0',
  valorUnitario: partial.valorUnitario || '0',
  valorTotal: partial.valorTotal || '0',
  origemMercadoria: partial.origemMercadoria || 'UNKNOWN',
  itemSource: partial.itemSource || 'UNKNOWN',
  taxes: {
    icms: partial.taxes?.icms,
    pis: partial.taxes?.pis,
    cofins: partial.taxes?.cofins,
    ipi: partial.taxes?.ipi,
    ibsCbs: partial.taxes?.ibsCbs,
  },
  status: partial.status || 'OK',
  issues: partial.issues || [],
});

/**
 * @typedef {object} FiscalBatchResult
 * @property {boolean} blocked
 * @property {FiscalNFeItem[]} items
 * @property {import('./fiscal-issue.js').FiscalIssue[]} issues
 * @property {import('../constants.js').ENGINE_SCHEMA_VERSION extends string ? string : string} engineSchemaVersion
 */

/**
 * @param {FiscalNFeItem[]} items
 */
export const computeFiscalBatchBlocked = (items) => {
  const list = Array.isArray(items) ? items : [];
  const allIssues = list.flatMap((item) => item?.issues || []);
  return allIssues.some((issue) => issue?.blocksEmission === true);
};
