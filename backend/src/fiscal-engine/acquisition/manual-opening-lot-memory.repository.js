/**
 * Repositório in-memory — lote fiscal inicial manual (Phase 8F.5 tests).
 */
import { randomUUID } from 'node:crypto';
import { formatDecimal, toDecimal } from '../money/decimal.js';
import { FISCAL_LOT_SOURCE, MANUAL_OPENING_REASON } from './manual-opening-lot.constants.js';
import { manualOpeningOrigemSource } from './manual-opening-lot.policy.js';
import { ORIGEM_FISCAL_SOURCE } from '../types/origem-mercadoria.js';
import { STOCK_LOT_STATUS } from './constants.js';
import {
  STOCK_UNIT_RESOLUTION_STATUS,
  STOCK_UNIT_SOURCE,
} from './stock-unit-resolution.js';

/** @type {Map<string, object>} */
const lotsById = new Map();

export const __resetManualOpeningLotMemoryRepo = () => {
  lotsById.clear();
};

export const __getManualOpeningLotsMap = () => lotsById;

export const findManualOpeningLotByConfirmationRequestIdMemory = ({
  tenantId,
  establishmentId,
  confirmationRequestId,
}) => {
  if (!confirmationRequestId) return null;
  for (const lot of lotsById.values()) {
    if (lot.empresa_id !== tenantId) continue;
    if (String(lot.establishment_id) !== String(establishmentId)) continue;
    if (lot.lot_source !== FISCAL_LOT_SOURCE.MANUAL_FISCAL_CONFIRMATION) continue;
    if (lot.manual_confirmation_json?.confirmationRequestId === confirmationRequestId) {
      return lot;
    }
  }
  return null;
};

export const insertManualOpeningLotMemory = ({
  tenantId,
  establishmentId,
  produtoCatalogoId,
  quantidade,
  origemMercadoria,
  priorStStatus,
  createdByUserId,
  observacao = null,
  confirmationRequestId = null,
  baseUnit = 'UN',
  dataEntrada = null,
}) => {
  const qty = formatDecimal(toDecimal(quantidade), 10);
  const lotId = randomUUID();
  const lot = {
    id: lotId,
    empresa_id: tenantId,
    establishment_id: establishmentId,
    produto_catalogo_id: produtoCatalogoId,
    purchase_item_id: null,
    purchase_invoice_id: null,
    lot_source: FISCAL_LOT_SOURCE.MANUAL_FISCAL_CONFIRMATION,
    origem_mercadoria: origemMercadoria,
    origem_mercadoria_source: manualOpeningOrigemSource(),
    prior_st_status: priorStStatus,
    prior_st_evidence_json: {
      manualOrigemConfirmed: true,
      origemSource: ORIGEM_FISCAL_SOURCE.MANUAL_FISCAL_CONFIRMATION,
      priorStConfirmedManually: true,
    },
    base_unit: baseUnit,
    quantidade_inicial: qty,
    quantidade_disponivel: qty,
    stock_unit_resolution_json: {
      baseUnit,
      baseQty: qty,
      source: STOCK_UNIT_SOURCE.CATALOG_CONFIRMED,
      status: STOCK_UNIT_RESOLUTION_STATUS.CONFIRMED,
      unitConversionEvidence: { sameUnit: true, manualOpening: true },
    },
    manual_confirmation_json: {
      confirmedAt: new Date().toISOString(),
      reason: MANUAL_OPENING_REASON.OPENING_FISCAL_BALANCE,
      ...(observacao ? { note: String(observacao) } : {}),
      ...(confirmationRequestId ? { confirmationRequestId: String(confirmationRequestId) } : {}),
    },
    created_by_user_id: createdByUserId,
    data_entrada: dataEntrada || new Date().toISOString().slice(0, 10),
    status: STOCK_LOT_STATUS.USABLE,
    version: 0,
    supplier_cest: null,
    st_retained_values_json: {},
  };
  lotsById.set(lotId, lot);
  return lot;
};
