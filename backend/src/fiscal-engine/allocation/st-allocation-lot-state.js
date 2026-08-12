/**
 * Estado acumulado de ST por lote — apenas allocations RESERVED/CONSUMED.
 */
import { toDecimal, sumDecimals, formatDecimal } from '../money/decimal.js';
import { ALLOCATION_STATUS } from './allocation-constants.js';

const QTY_SCALE = 10;

export const ST_NUMERIC_FIELDS = Object.freeze([
  'vBCSTRet',
  'vICMSSTRet',
  'vBCFCPSTRet',
  'vFCPSTRet',
  'vICMSSubstituto',
]);

const parseStAllocationJson = (allocation) => {
  const raw = allocation?.st_allocation_json;
  if (raw == null) return {};
  if (typeof raw === 'string') return JSON.parse(raw);
  return raw;
};

const isActiveAllocation = (allocation) => (
  allocation?.status === ALLOCATION_STATUS.RESERVED
  || allocation?.status === ALLOCATION_STATUS.CONSUMED
);

/**
 * Agrega qty e valores ST já atribuídos ao lote (RESERVED + CONSUMED).
 * RELEASED não entra no orçamento fiscal ativo.
 * @param {object[]} allocations
 */
export const aggregateActiveLotStState = (allocations) => {
  const active = (allocations ?? []).filter(isActiveAllocation);
  const priorActiveAllocatedQty = formatDecimal(
    sumDecimals(active.map((a) => a.quantidade)),
    QTY_SCALE,
  );
  /** @type {Record<string, string>} */
  const priorActiveAllocatedValues = {};
  for (const field of ST_NUMERIC_FIELDS) {
    const parts = active
      .map((a) => parseStAllocationJson(a)?.allocatedValues?.[field])
      .filter((v) => v != null && v !== '');
    if (parts.length) {
      priorActiveAllocatedValues[field] = formatDecimal(sumDecimals(parts), 2);
    }
  }
  return { priorActiveAllocatedQty, priorActiveAllocatedValues };
};

/**
 * @param {Map<string, object[]>|Record<string, object[]>} activeAllocationsByLotId
 */
export const buildPriorLotStateMap = (activeAllocationsByLotId) => {
  const map = new Map();
  if (!activeAllocationsByLotId) return map;
  const entries = activeAllocationsByLotId instanceof Map
    ? activeAllocationsByLotId.entries()
    : Object.entries(activeAllocationsByLotId);
  for (const [lotId, allocations] of entries) {
    map.set(lotId, aggregateActiveLotStState(allocations));
  }
  return map;
};

/**
 * Acumula estado após uma allocation recém-montada (mesmo request, mesmo lote).
 * @param {{ priorActiveAllocatedQty: string, priorActiveAllocatedValues: Record<string, string> }} base
 * @param {object} allocationRow
 */
export const mergeLotStStateAfterRow = (base, allocationRow) => {
  const st = allocationRow.st_allocation_json ?? {};
  const values = st.allocatedValues ?? {};
  const nextValues = { ...base.priorActiveAllocatedValues };
  for (const field of ST_NUMERIC_FIELDS) {
    if (values[field] != null && values[field] !== '') {
      nextValues[field] = formatDecimal(
        toDecimal(base.priorActiveAllocatedValues[field] ?? '0').plus(toDecimal(values[field])),
        2,
      );
    }
  }
  return {
    priorActiveAllocatedQty: formatDecimal(
      toDecimal(base.priorActiveAllocatedQty).plus(toDecimal(allocationRow.quantidade)),
      QTY_SCALE,
    ),
    priorActiveAllocatedValues: nextValues,
  };
};

/**
 * Soma ST ativa de um campo para validação/invariantes.
 * @param {object[]} allocations
 * @param {string} field
 */
export const sumActiveStField = (allocations, field) => {
  const active = (allocations ?? []).filter(isActiveAllocation);
  const parts = active
    .map((a) => parseStAllocationJson(a)?.allocatedValues?.[field])
    .filter((v) => v != null && v !== '');
  if (!parts.length) return toDecimal(0);
  return sumDecimals(parts);
};
