/**
 * Avalia elegibilidade de lote fiscal para alocação (Fase 3).
 */
import { STOCK_LOT_STATUS } from '../acquisition/constants.js';
import { isStockLotUsable } from '../acquisition/stock-lot.service.js';
import { stockUnitNeedsReview } from '../acquisition/stock-unit-resolution.js';
import { toDecimal, formatDecimal } from '../money/decimal.js';
import { LOT_REJECTION_REASON } from './allocation-constants.js';

const QTY_SCALE = 10;

/**
 * @param {object} lot
 * @param {object} criteria
 * @param {string} criteria.empresaId
 * @param {string} [criteria.establishmentId]
 * @param {string} criteria.produtoCatalogoId
 */
export const evaluateLotEligibility = (lot, {
  empresaId,
  establishmentId,
  produtoCatalogoId,
  allowLegacyUntaggedLots = false,
}) => {
  if (!lot) {
    return { eligible: false, reason: LOT_REJECTION_REASON.NOT_USABLE, availableQty: '0' };
  }

  if (lot.empresa_id !== empresaId) {
    return { eligible: false, reason: LOT_REJECTION_REASON.WRONG_TENANT, availableQty: '0' };
  }

  if (establishmentId) {
    const lotEstablishment = lot.establishment_id ?? lot.establishmentId ?? null;
    if (lotEstablishment && String(lotEstablishment) !== String(establishmentId)) {
      return {
        eligible: false,
        reason: LOT_REJECTION_REASON.WRONG_ESTABLISHMENT,
        availableQty: formatDecimal(lot.quantidade_disponivel ?? '0', QTY_SCALE),
      };
    }
    if (!lotEstablishment && establishmentId !== 'default' && !allowLegacyUntaggedLots) {
      return {
        eligible: false,
        reason: LOT_REJECTION_REASON.WRONG_ESTABLISHMENT,
        availableQty: formatDecimal(lot.quantidade_disponivel ?? '0', QTY_SCALE),
      };
    }
  }

  if (!produtoCatalogoId || lot.produto_catalogo_id !== produtoCatalogoId) {
    return { eligible: false, reason: LOT_REJECTION_REASON.WRONG_PRODUCT, availableQty: '0' };
  }

  if (!lot.produto_catalogo_id) {
    return { eligible: false, reason: LOT_REJECTION_REASON.MISSING_CATALOG, availableQty: '0' };
  }

  if (lot.status === STOCK_LOT_STATUS.BLOCKED) {
    return { eligible: false, reason: LOT_REJECTION_REASON.BLOCKED, availableQty: formatDecimal(lot.quantidade_disponivel ?? '0', QTY_SCALE) };
  }

  if (lot.status === STOCK_LOT_STATUS.NEEDS_REVIEW
    || lot.status === STOCK_LOT_STATUS.PENDING_CATALOG_MATCH) {
    return { eligible: false, reason: LOT_REJECTION_REASON.NEEDS_REVIEW, availableQty: formatDecimal(lot.quantidade_disponivel ?? '0', QTY_SCALE) };
  }

  if (!isStockLotUsable(lot.status)) {
    return { eligible: false, reason: LOT_REJECTION_REASON.NOT_USABLE, availableQty: formatDecimal(lot.quantidade_disponivel ?? '0', QTY_SCALE) };
  }

  const unitResolution = lot.stock_unit_resolution_json ?? {};
  if (stockUnitNeedsReview(unitResolution)) {
    return { eligible: false, reason: LOT_REJECTION_REASON.UNIT_UNCONFIRMED, availableQty: formatDecimal(lot.quantidade_disponivel ?? '0', QTY_SCALE) };
  }

  const available = toDecimal(lot.quantidade_disponivel ?? '0');
  if (!available.gt(0)) {
    return { eligible: false, reason: LOT_REJECTION_REASON.NO_BALANCE, availableQty: '0' };
  }

  return {
    eligible: true,
    reason: null,
    availableQty: formatDecimal(available, QTY_SCALE),
  };
};

/**
 * Ordenação FIFO determinística: data_entrada ASC, id ASC.
 * @param {object[]} lots
 */
export const sortLotsFifo = (lots) => [...lots].sort((a, b) => {
  const dateA = String(a.data_entrada || '');
  const dateB = String(b.data_entrada || '');
  if (dateA !== dateB) return dateA.localeCompare(dateB);
  return String(a.id).localeCompare(String(b.id));
});

/**
 * @param {object[]} lots — candidatos (não necessariamente filtrados)
 * @param {string} requestedQty — Decimal string
 * @param {object} criteria
 */
export const planFifoAllocation = (lots, requestedQty, criteria) => {
  const requested = toDecimal(requestedQty);
  if (!requested.gt(0)) {
    return {
      ok: false,
      allocations: [],
      rejectedLots: [],
      totalUsable: '0',
      remaining: formatDecimal(requested, QTY_SCALE),
    };
  }

  const sorted = sortLotsFifo(lots);
  /** @type {Array<{ lot: object, quantity: string, availableBefore: string }>} */
  const allocations = [];
  /** @type {Array<{ lotId: string, reason: string, availableQty: string }>} */
  const rejectedLots = [];
  let remaining = requested;
  let totalUsable = toDecimal(0);

  for (const lot of sorted) {
    const eligibility = evaluateLotEligibility(lot, criteria);
    if (!eligibility.eligible) {
      rejectedLots.push({
        lotId: lot.id,
        reason: eligibility.reason,
        availableQty: eligibility.availableQty,
        status: lot.status,
        dataEntrada: lot.data_entrada,
      });
      continue;
    }

    const available = toDecimal(eligibility.availableQty);
    totalUsable = totalUsable.plus(available);
    if (remaining.isZero()) continue;

    const take = remaining.lt(available) ? remaining : available;
    allocations.push({
      lot,
      quantity: formatDecimal(take, QTY_SCALE),
      availableBefore: formatDecimal(available, QTY_SCALE),
    });
    remaining = remaining.minus(take);
  }

  if (remaining.gt(0)) {
    return {
      ok: false,
      allocations,
      rejectedLots,
      totalUsable: formatDecimal(totalUsable, QTY_SCALE),
      remaining: formatDecimal(remaining, QTY_SCALE),
    };
  }

  return {
    ok: true,
    allocations,
    rejectedLots,
    totalUsable: formatDecimal(totalUsable, QTY_SCALE),
    remaining: '0',
  };
};
