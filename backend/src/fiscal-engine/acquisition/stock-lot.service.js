/**
 * Serviço de lotes fiscais — criação e resolução de status.
 */
import { STOCK_LOT_STATUS, AUTHORIZATION_STATUS, SIGNATURE_STATUS } from './constants.js';
import { buildPriorStEvidence, explainPriorStRetained } from './acquisition-classifier.js';
import { stockUnitNeedsReview } from './stock-unit-resolution.js';
import { isCatalogMatchConfident } from './catalog-match.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';
import * as pgRepo from './fiscal-purchase.repository.js';

export const isStockLotUsable = (status) => status === STOCK_LOT_STATUS.USABLE;

/**
 * @param {object} params
 */
export const resolveStockLotStatus = ({
  authorizationStatus,
  eventStatus,
  signatureStatus,
  catalogMatchStatus,
  stockUnitResolution,
  blockingIssues = [],
}) => {
  if (signatureStatus === SIGNATURE_STATUS.INVALID) {
    return STOCK_LOT_STATUS.BLOCKED;
  }
  if (authorizationStatus === AUTHORIZATION_STATUS.NOT_AUTHORIZED) {
    return STOCK_LOT_STATUS.BLOCKED;
  }
  if (eventStatus === 'CANCELED') {
    return STOCK_LOT_STATUS.BLOCKED;
  }
  if (authorizationStatus === AUTHORIZATION_STATUS.UNKNOWN) {
    return STOCK_LOT_STATUS.NEEDS_REVIEW;
  }
  if (!isCatalogMatchConfident(catalogMatchStatus)) {
    return STOCK_LOT_STATUS.PENDING_CATALOG_MATCH;
  }
  if (signatureStatus === SIGNATURE_STATUS.UNVERIFIED) {
    return STOCK_LOT_STATUS.NEEDS_REVIEW;
  }
  if (stockUnitNeedsReview(stockUnitResolution)) {
    return STOCK_LOT_STATUS.NEEDS_REVIEW;
  }
  if (blockingIssues.some((i) => i.blocksEmission)) {
    return STOCK_LOT_STATUS.NEEDS_REVIEW;
  }
  if (authorizationStatus === AUTHORIZATION_STATUS.AUTHORIZED
    && signatureStatus === SIGNATURE_STATUS.VALID) {
    return STOCK_LOT_STATUS.USABLE;
  }
  if (authorizationStatus === AUTHORIZATION_STATUS.AUTHORIZED) {
    return STOCK_LOT_STATUS.NEEDS_REVIEW;
  }
  return STOCK_LOT_STATUS.NEEDS_REVIEW;
};

/**
 * @param {object} params
 */
export const buildStockLotFromPurchaseItem = ({
  empresaId,
  establishmentId = null,
  purchaseItem,
  priorStEvidence,
  catalogMatch,
  authorizationStatus,
  eventStatus,
  signatureStatus,
  stockUnitResolution,
  dataEntrada,
  blockingIssues = [],
}) => {
  const issues = [...blockingIssues];
  if (stockUnitNeedsReview(stockUnitResolution)) {
    issues.push(createFiscalIssue(
      'REQUIRED_FIELD_MISSING',
      'Unidade de estoque não confirmada — conversão ou cadastro necessário',
    ));
  }

  const status = resolveStockLotStatus({
    authorizationStatus,
    eventStatus,
    signatureStatus,
    catalogMatchStatus: catalogMatch.status,
    stockUnitResolution,
    blockingIssues: issues,
  });

  const stValues = priorStEvidence.priorRetained || priorStEvidence.operationSt || {};

  return {
    empresa_id: empresaId,
    establishment_id: establishmentId,
    produto_catalogo_id: catalogMatch.produtoCatalogoId,
    origem_mercadoria: purchaseItem.origem,
    base_unit: stockUnitResolution.baseUnit,
    quantidade_inicial: stockUnitResolution.baseQty,
    quantidade_disponivel: stockUnitResolution.baseQty,
    prior_st_status: purchaseItem.prior_st_status,
    prior_st_evidence_json: priorStEvidence,
    supplier_cest: purchaseItem.supplier_cest,
    st_retained_values_json: stValues,
    stock_unit_resolution_json: stockUnitResolution,
    data_entrada: dataEntrada,
    status,
    version: 0,
    audit_explain: purchaseItem.prior_st_status === 'RETAINED'
      ? explainPriorStRetained(priorStEvidence)
      : null,
  };
};

export const findInvoiceByChave = pgRepo.findInvoiceByChave;
export const savePurchaseImport = pgRepo.savePurchaseImport;
export const consumeStockLotQuantity = pgRepo.consumeStockLotQuantity;
export const getEmpresaFiscalDoc = pgRepo.getEmpresaFiscalDoc;

export { buildPriorStEvidence, explainPriorStRetained };
