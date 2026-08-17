/**
 * Policy explícita para lote manual USABLE — sem falsificar authorization/signature de NF-e.
 */
import { STOCK_LOT_STATUS } from './constants.js';
import { FISCAL_LOT_SOURCE } from './manual-opening-lot.constants.js';
import { ORIGEM_FISCAL_SOURCE } from '../types/origem-mercadoria.js';
import { PRIOR_ST_STATUS } from '../types/st-allocation.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { normalizeOrigemMercadoriaCode } from '../types/origem-mercadoria.js';
import { toDecimal } from '../money/decimal.js';

const VALID_PRIOR_ST = new Set(Object.values(PRIOR_ST_STATUS));

/**
 * @param {object} input
 * @returns {{ ok: true, issues: [] } | { ok: false, issues: import('../types/fiscal-issue.js').FiscalIssue[] }}
 */
export const validateManualOpeningLotInput = (input = {}) => {
  const issues = [];

  if (!input.tenantId) {
    issues.push(createFiscalIssue('REQUIRED_FIELD_MISSING', 'tenantId obrigatório'));
  }
  if (!input.establishmentId) {
    issues.push(createFiscalIssue('REQUIRED_FIELD_MISSING', 'establishmentId obrigatório'));
  }
  if (!input.produtoCatalogoId) {
    issues.push(createFiscalIssue('REQUIRED_FIELD_MISSING', 'produtoCatalogoId obrigatório'));
  }
  if (!input.actorUserId) {
    issues.push(createFiscalIssue('REQUIRED_FIELD_MISSING', 'actor autenticado obrigatório'));
  }

  const qty = toDecimal(input.quantidade ?? '0');
  if (!qty.gt(0)) {
    issues.push(createFiscalIssue('REQUIRED_FIELD_MISSING', 'quantidade deve ser positiva'));
  }

  const origemCode = normalizeOrigemMercadoriaCode(input.origemMercadoria);
  if (input.origemMercadoria == null || String(input.origemMercadoria).trim() === '') {
    issues.push(createFiscalIssue('REQUIRED_FIELD_MISSING', 'origemMercadoria obrigatória'));
  } else if (origemCode === 'UNKNOWN') {
    issues.push(createFiscalIssue('REQUIRED_FIELD_MISSING', 'origemMercadoria inválida ou ausente'));
  }

  const prior = String(input.priorStStatus ?? '').trim().toUpperCase();
  if (!input.priorStStatus) {
    issues.push(createFiscalIssue('REQUIRED_FIELD_MISSING', 'priorStStatus obrigatório'));
  } else if (!VALID_PRIOR_ST.has(prior)) {
    issues.push(createFiscalIssue('REQUIRED_FIELD_MISSING', 'priorStStatus inválido'));
  }

  if (input.payloadActorUserId && input.payloadActorUserId !== input.actorUserId) {
    issues.push(createFiscalIssue(
      'FORBIDDEN',
      'createdByUserId do payload não pode sobrescrever actor autenticado',
    ));
  }

  return issues.length ? { ok: false, issues } : { ok: true, issues: [] };
};

/**
 * @param {object} params
 */
export const resolveManualOpeningLotStatus = (params) => {
  const validation = validateManualOpeningLotInput(params);
  if (!validation.ok) return STOCK_LOT_STATUS.NEEDS_REVIEW;
  if (!params.baseUnit?.trim()) return STOCK_LOT_STATUS.NEEDS_REVIEW;
  return STOCK_LOT_STATUS.USABLE;
};

/**
 * @param {object} lotRow
 */
export const isManualOpeningLotRow = (lotRow) => (
  lotRow?.lot_source === FISCAL_LOT_SOURCE.MANUAL_FISCAL_CONFIRMATION
  || lotRow?.lotSource === FISCAL_LOT_SOURCE.MANUAL_FISCAL_CONFIRMATION
);

export const manualOpeningOrigemSource = () => ORIGEM_FISCAL_SOURCE.MANUAL_FISCAL_CONFIRMATION;
