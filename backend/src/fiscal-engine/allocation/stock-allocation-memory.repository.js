/**
 * Repositório in-memory — alocação fiscal (Fase 3, unit tests).
 */
import { randomUUID } from 'node:crypto';
import { toDecimal, formatDecimal } from '../money/decimal.js';
import { ALLOCATION_STATUS, ALLOCATION_REQUEST_STATUS } from './allocation-constants.js';
import {
  buildAllocationRequestFingerprint,
  matchesStoredAllocationRequest,
} from './allocation-idempotency.js';

const QTY_SCALE = 10;

/** @type {Map<string, object>} */
const requestsById = new Map();
/** @type {Map<string, string>} */
const requestIdByKey = new Map();
/** @type {Map<string, object[]>} */
const allocationsByRequestId = new Map();

/** @type {Map<string, object>} */
let externalLotsById = null;

export const __resetStockAllocationMemoryRepo = () => {
  requestsById.clear();
  requestIdByKey.clear();
  allocationsByRequestId.clear();
  externalLotsById = null;
};

/** @internal */
export const __bindStockAllocationLotsMap = (lotsByIdMap) => {
  externalLotsById = lotsByIdMap;
};

const requestKey = (empresaId, allocationRequestId) => `${empresaId}:${allocationRequestId}`;

export const findAllocationRequestByKey = async (empresaId, allocationRequestId) => {
  const id = requestIdByKey.get(requestKey(empresaId, allocationRequestId));
  if (!id) return null;
  return {
    request: requestsById.get(id),
    allocations: [...(allocationsByRequestId.get(id) || [])],
  };
};

const lockLotsInMemory = (empresaId, produtoCatalogoId, establishmentId = null) => {
  if (!externalLotsById) return [];
  return [...externalLotsById.values()]
    .filter((l) => l.empresa_id === empresaId
      && l.produto_catalogo_id === produtoCatalogoId
      && l.status === 'USABLE'
      && toDecimal(l.quantidade_disponivel).gt(0)
      && (!establishmentId || String(l.establishment_id ?? l.establishmentId ?? '') === String(establishmentId)
        || (!l.establishment_id && !l.establishmentId && establishmentId === 'default')))
    .sort((a, b) => {
      const d = String(a.data_entrada).localeCompare(String(b.data_entrada));
      if (d !== 0) return d;
      return String(a.id).localeCompare(String(b.id));
    })
    .map((lot) => ({
      ...lot,
      purchase_invoice_id: lot.purchase_invoice_id ?? lot._purchase_invoice_id ?? null,
    }));
};

const loadActiveAllocationsByLotIds = (empresaId, lotIds) => {
  /** @type {Map<string, object[]>} */
  const map = new Map();
  const lotIdSet = new Set(lotIds);
  for (const allocs of allocationsByRequestId.values()) {
    for (const alloc of allocs) {
      if (alloc.empresa_id !== empresaId) continue;
      if (!lotIdSet.has(alloc.stock_lot_id)) continue;
      if (alloc.status !== ALLOCATION_STATUS.RESERVED && alloc.status !== ALLOCATION_STATUS.CONSUMED) continue;
      const list = map.get(alloc.stock_lot_id) ?? [];
      list.push(alloc);
      map.set(alloc.stock_lot_id, list);
    }
  }
  return map;
};

export const runStockAllocationAtomic = async ({
  empresaId,
  establishmentId = null,
  produtoCatalogoId,
  allocationRequestId,
  quantidadeSolicitada,
  commercialSaleId = null,
  commercialSaleItemId = null,
  planExecutor,
}) => {
  const key = requestKey(empresaId, allocationRequestId);
  const fingerprint = buildAllocationRequestFingerprint({
    produtoCatalogoId,
    quantidade: quantidadeSolicitada,
    commercialSaleId,
    commercialSaleItemId,
  });
  const existingId = requestIdByKey.get(key);
  if (existingId) {
    const request = requestsById.get(existingId);
    if (request?.status === ALLOCATION_REQUEST_STATUS.COMPLETED) {
      if (!matchesStoredAllocationRequest(request, fingerprint)) {
        return { idempotencyConflict: true };
      }
      return {
        replay: true,
        request,
        allocations: [...(allocationsByRequestId.get(existingId) || [])],
      };
    }
  }

  const lockedLots = lockLotsInMemory(empresaId, produtoCatalogoId, establishmentId);
  const lotIds = lockedLots.map((l) => l.id);
  const activeAllocationsByLotId = loadActiveAllocationsByLotIds(empresaId, lotIds);
  const planResult = await planExecutor(lockedLots, { activeAllocationsByLotId });
  if (!planResult.ok) {
    return planResult;
  }

  if (requestIdByKey.has(key)) {
    const request = requestsById.get(requestIdByKey.get(key));
    if (!matchesStoredAllocationRequest(request, fingerprint)) {
      return { idempotencyConflict: true };
    }
    return {
      replay: true,
      request,
      allocations: [...(allocationsByRequestId.get(requestIdByKey.get(key)) || [])],
    };
  }

  for (const update of planResult.lotUpdates) {
    const lot = externalLotsById?.get(update.lotId);
    if (!lot || lot.empresa_id !== update.empresaId) {
      throw new Error('STOCK_ALLOCATION_CONFLICT');
    }
    if ((lot.version ?? 0) !== update.expectedVersion) {
      throw new Error('STOCK_ALLOCATION_CONFLICT');
    }
    const available = toDecimal(lot.quantidade_disponivel);
    const qty = toDecimal(update.quantity);
    if (available.lt(qty)) {
      throw new Error('STOCK_ALLOCATION_CONFLICT');
    }
    const next = available.minus(qty);
    externalLotsById.set(update.lotId, {
      ...lot,
      quantidade_disponivel: formatDecimal(next, QTY_SCALE),
      version: (lot.version ?? 0) + 1,
      status: next.isZero() ? 'DEPLETED' : lot.status,
    });
  }

  const requestId = planResult.requestRow.id || randomUUID();
  const savedRequest = { ...planResult.requestRow, id: requestId };
  requestsById.set(requestId, savedRequest);
  requestIdByKey.set(key, requestId);

  const savedAllocations = planResult.allocationRows.map((row) => ({
    ...row,
    id: row.id || randomUUID(),
    allocation_request_uuid: requestId,
  }));
  allocationsByRequestId.set(requestId, savedAllocations);

  return { replay: false, request: savedRequest, allocations: savedAllocations };
};

export const releaseAllocationRequest = async (empresaId, allocationRequestId) => {
  const existing = await findAllocationRequestByKey(empresaId, allocationRequestId);
  if (!existing) return { ok: false, error: 'Pedido de alocação não encontrado' };

  const reserved = existing.allocations.filter((a) => a.status === ALLOCATION_STATUS.RESERVED);
  if (!reserved.length) {
    if (existing.allocations.some((a) => a.status === ALLOCATION_STATUS.CONSUMED)) {
      return { ok: false, error: 'Transição inválida: allocation já consumida' };
    }
    return { ok: true, released: 0 };
  }

  let released = 0;
  for (const alloc of reserved) {
    const lot = externalLotsById?.get(alloc.stock_lot_id);
    if (lot) {
      const next = toDecimal(lot.quantidade_disponivel).plus(toDecimal(alloc.quantidade));
      externalLotsById.set(alloc.stock_lot_id, {
        ...lot,
        quantidade_disponivel: formatDecimal(next, QTY_SCALE),
        status: lot.status === 'DEPLETED' ? 'USABLE' : lot.status,
        version: (lot.version ?? 0) + 1,
      });
    }
    alloc.status = ALLOCATION_STATUS.RELEASED;
    released += 1;
  }
  allocationsByRequestId.set(existing.request.id, existing.allocations);
  return { ok: true, released };
};

export const consumeAllocationRequest = async (empresaId, allocationRequestId) => {
  const existing = await findAllocationRequestByKey(empresaId, allocationRequestId);
  if (!existing) return { ok: false, allocations: [], error: 'Pedido de alocação não encontrado' };

  const reserved = existing.allocations.filter((a) => a.status === ALLOCATION_STATUS.RESERVED);
  if (!reserved.length) {
    if (existing.allocations.some((a) => a.status === ALLOCATION_STATUS.RELEASED)) {
      return { ok: false, allocations: [], error: 'Transição inválida: allocation já liberada' };
    }
    if (existing.allocations.some((a) => a.status === ALLOCATION_STATUS.CONSUMED)) {
      return { ok: false, allocations: [], error: 'Transição inválida: allocation já consumida' };
    }
    return { ok: false, allocations: [] };
  }

  for (const alloc of reserved) {
    alloc.status = ALLOCATION_STATUS.CONSUMED;
  }
  allocationsByRequestId.set(existing.request.id, existing.allocations);
  return { ok: true, allocations: reserved };
};

export const __deleteAllocationRequestForTests = async (empresaId, allocationRequestId) => {
  const existing = await findAllocationRequestByKey(empresaId, allocationRequestId);
  if (!existing) return;
  allocationsByRequestId.delete(existing.request.id);
  requestsById.delete(existing.request.id);
  requestIdByKey.delete(requestKey(empresaId, allocationRequestId));
};
