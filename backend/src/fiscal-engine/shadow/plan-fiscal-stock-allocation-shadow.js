/**
 * Planning read-only de alocação fiscal — shadow mode (sem side effects).
 */
import { planFifoAllocation } from '../allocation/stock-allocation-eligibility.js';
import { buildAllocationRowFromLot } from '../allocation/stock-allocation-builder.js';
import { SHADOW_ALLOCATION_PLANNED_STATUS } from './shadow-constants.js';
import { randomUUID } from 'node:crypto';

/**
 * @param {object[]} lots
 * @param {string} requestedQty
 * @param {object} criteria
 */
export const planFiscalStockAllocationForShadow = (lots, requestedQty, criteria) => (
  planFifoAllocation(lots, requestedQty, criteria)
);

/**
 * Converte plano FIFO em linhas de alocação PLANNED (nunca RESERVED/CONSUMED).
 * @param {object} params
 */
export const buildPlannedAllocationRowsForShadow = ({
  plan,
  commercialSaleItem,
  allocationRequestId = `shadow-${randomUUID()}`,
}) => {
  if (!Array.isArray(plan?.allocations) || plan.allocations.length === 0) return [];

  return plan.allocations.map((entry, fifoOrder) => {
    const row = buildAllocationRowFromLot({
      lot: entry.lot,
      purchaseInvoiceId: entry.lot.purchase_invoice_id ?? entry.lot._purchase_invoice_id ?? null,
      quantity: entry.quantity,
      availableBefore: entry.availableBefore,
      allocationRequestUuid: allocationRequestId,
      commercialSaleItem: {
        commercialSaleId: commercialSaleItem.commercialSaleId ?? null,
        commercialSaleItemId: commercialSaleItem.commercialSaleItemId ?? null,
        allocationRequestId,
      },
      fifoOrder,
    });
    return {
      ...row,
      status: SHADOW_ALLOCATION_PLANNED_STATUS,
      allocation_audit_json: {
        ...(row.allocation_audit_json ?? {}),
        shadowMode: true,
        plannedOnly: true,
      },
    };
  });
};

/**
 * Captura saldos dos lotes antes do planning (para prova de não mutação).
 * @param {object[]} lots
 */
export const snapshotLotBalances = (lots) => (
  (Array.isArray(lots) ? lots : []).map((lot) => ({
    lotId: lot.id,
    quantidade_disponivel: String(lot.quantidade_disponivel ?? '0'),
  }))
);

/**
 * @param {object[]} before
 * @param {object[]} after
 */
export const lotBalancesUnchanged = (before, after) => {
  if (before.length !== after.length) return false;
  const afterMap = new Map(after.map((b) => [b.lotId, b.quantidade_disponivel]));
  return before.every((b) => afterMap.get(b.lotId) === b.quantidade_disponivel);
};
