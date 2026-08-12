/**
 * Normaliza FiscalResult v3 para comparação shadow.
 */
import { resolveLegacyCorrelation, buildLegacyCorrelationKey } from './legacy-fiscal-snapshot.js';
import { CORRELATION_CONFIDENCE } from './shadow-constants.js';

/**
 * @param {import('../types/fiscal-result.js').FiscalResult} fiscalResult
 * @param {object} [meta]
 * @param {number} [meta.itemIndex]
 * @param {object} [meta.sourceItem]
 */
export const buildV3FiscalSnapshotFromResult = (fiscalResult, meta = {}) => {
  const ctx = fiscalResult?.context ?? {};
  const resolutions = fiscalResult?.resolutions ?? {};
  const xmlFields = resolutions.xmlFields ?? null;
  const icmsFields = xmlFields?.taxes?.icms?.fields ?? {};
  const icmsGroup = xmlFields?.taxes?.icms?.group ?? null;
  const sourceItem = meta.sourceItem ?? {};

  const correlation = ctx.commercialSaleItemId
    ? { key: `csi:${ctx.commercialSaleItemId}`, confidence: CORRELATION_CONFIDENCE.EXACT }
    : ctx.produto?.produtoCatalogoId
      ? { key: `prod:${ctx.produto.produtoCatalogoId}`, confidence: CORRELATION_CONFIDENCE.STRONG }
      : resolveLegacyCorrelation(sourceItem, meta.itemIndex ?? 0);

  return {
    allocationId: ctx.allocationId ?? ctx.decisionId ?? null,
    commercialSaleItemId: ctx.commercialSaleItemId ?? null,
    productId: ctx.produto?.produtoCatalogoId ?? sourceItem?.codigo ?? null,
    correlationKey: correlation.key,
    correlationConfidence: correlation.confidence,
    quantity: ctx.item?.quantidade ?? ctx.allocation?.quantidade ?? ctx.allocation?.quantity ?? null,
    cfop: resolutions.cfop ?? xmlFields?.product?.cfop ?? null,
    csosn: resolutions.csosn ?? icmsFields.CSOSN ?? null,
    cst: resolutions.cst ?? icmsFields.CST ?? null,
    origem: icmsFields.orig ?? ctx.allocation?.origem ?? ctx.estoque?.origemMercadoria ?? null,
    currentOperationSt: resolutions.currentSt ?? fiscalResult?.treatment?.currentOperationSt ?? null,
    priorStStatus: fiscalResult?.treatment?.priorStStatus
      ?? ctx.estoque?.priorStStatus
      ?? ctx.allocation?.priorStStatus
      ?? null,
    icmsGroup,
    issues: fiscalResult?.issues ?? [],
    resolutionStatus: fiscalResult?.resolutionStatus ?? 'UNKNOWN',
    blocked: fiscalResult?.blocked ?? false,
    ruleRefs: fiscalResult?.ruleRefs ?? [],
  };
};

/**
 * @param {import('../types/fiscal-result.js').FiscalResult[]} results
 * @param {object[]} [sourceItems]
 * @returns {import('./shadow-types.js').V3FiscalSnapshot[]}
 */
export const buildV3FiscalSnapshotsFromResults = (results, sourceItems = []) => (
  (Array.isArray(results) ? results : []).map((result, index) => {
    const ctx = result?.context ?? {};
    const itemIndex = ctx.item?.itemIndex ?? 0;
    return buildV3FiscalSnapshotFromResult(result, {
      itemIndex,
      sourceItem: sourceItems[itemIndex] ?? sourceItems[0] ?? {},
    });
  })
);
