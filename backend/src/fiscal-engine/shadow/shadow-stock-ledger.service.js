/**
 * Ledger virtual shadow — simula estoque fiscal disponível entre emissões observadas.
 * NÃO altera fiscal_stock_lots real.
 */
import { toDecimal, formatDecimal } from '../money/decimal.js';
import { SHADOW_LEDGER_STATUS, SHADOW_LEDGER_ISSUE_CODE } from './shadow-constants.js';
import { resolveShadowEmissionIdentity } from './shadow-emission-identity.js';
import {
  fetchConfirmedConsumedByLotIdsFromPg,
  fetchPendingCommitmentsByLotIdsFromPg,
  hasConfirmedShadowEmissionInPg,
  hasPendingShadowEmissionInPg,
  insertShadowStockAllocationsPg,
  promotePendingShadowLedgerToConfirmedPg,
  voidPendingShadowLedgerCommitmentsPg,
  withShadowTenantPgPlanningLock,
} from './shadow-stock-ledger.repository.js';

const QTY_SCALE = 10;

/** @type {Map<string, Promise<void>>} */
const ledgerConfirmLocks = new Map();

const hashEmpresaLockKey = (empresaId) => Math.abs(
  [...`${empresaId}:shadow-planning`].reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0),
) % 2147483647;

/**
 * Lock in-memory por tenant — otimização local; Postgres lock cobre multi-instance.
 * @param {string} empresaId
 * @param {() => Promise<T>} fn
 * @template T
 */
export const withShadowTenantPlanningLock = async (empresaId, fn) => {
  if (!empresaId) return fn();

  if (postgresLedgerEnabled) {
    return withShadowTenantPgPlanningLock(empresaId, fn);
  }

  const prev = ledgerConfirmLocks.get(empresaId) ?? Promise.resolve();
  let release = () => {};
  const gate = new Promise((resolve) => { release = resolve; });
  ledgerConfirmLocks.set(empresaId, prev.then(() => gate));
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
};

/** @type {Map<string, { rows: object[] }>} */
const inMemoryLedgerByEmission = new Map();

/** @type {boolean} */
let postgresLedgerEnabled = true;

/** @internal */
export const __setShadowStockLedgerPostgresEnabledForTests = (enabled) => {
  postgresLedgerEnabled = enabled;
};

/** @internal */
export const __resetShadowStockLedgerForTests = () => {
  inMemoryLedgerByEmission.clear();
  ledgerConfirmLocks.clear();
  postgresLedgerEnabled = true;
};

const aggregateInMemoryByStatus = (empresaId, lotIds, statusFilter) => {
  const totals = new Map(lotIds.map((id) => [id, toDecimal(0)]));
  for (const [key, entry] of inMemoryLedgerByEmission.entries()) {
    if (!key.startsWith(`${empresaId}:`)) continue;
    if (!key.endsWith(`:${statusFilter}`)) continue;
    for (const row of entry.rows) {
      if (!totals.has(row.stockLotId)) continue;
      totals.set(row.stockLotId, totals.get(row.stockLotId).plus(toDecimal(row.quantity ?? '0')));
    }
  }
  return new Map([...totals.entries()].map(([id, dec]) => [id, formatDecimal(dec, QTY_SCALE)]));
};

const aggregateInMemoryConsumed = (empresaId, lotIds) => (
  aggregateInMemoryByStatus(empresaId, lotIds, SHADOW_LEDGER_STATUS.CONFIRMED)
);

const aggregateInMemoryPending = (empresaId, lotIds) => (
  aggregateInMemoryByStatus(empresaId, lotIds, SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION)
);

/**
 * Soma dois maps de quantidade Decimal-string por lote.
 * @param {Map<string, string>} left
 * @param {Map<string, string>} right
 */
export const mergeShadowQuantityMaps = (left, right) => {
  const lotIds = new Set([...(left?.keys() ?? []), ...(right?.keys() ?? [])]);
  const merged = new Map();
  for (const lotId of lotIds) {
    const sum = toDecimal(left?.get(lotId) ?? '0').plus(toDecimal(right?.get(lotId) ?? '0'));
    merged.set(lotId, formatDecimal(sum, QTY_SCALE));
  }
  return merged;
};

/**
 * effectiveShadowAvailable = fiscalStockAvailable - previousSuccessfulShadowConsumption
 * @param {string} empresaId
 * @param {string[]} lotIds
 * @param {object} [options]
 */
export const getShadowVirtualConsumedByLotIds = async (empresaId, lotIds, options = {}) => {
  if (!empresaId || !Array.isArray(lotIds) || lotIds.length === 0) return new Map();

  if (options.inMemoryLedger !== undefined) {
    return aggregateInMemoryConsumed(empresaId, lotIds);
  }

  if (postgresLedgerEnabled) {
    try {
      return await fetchConfirmedConsumedByLotIdsFromPg(empresaId, lotIds);
    } catch {
      return aggregateInMemoryConsumed(empresaId, lotIds);
    }
  }

  return aggregateInMemoryConsumed(empresaId, lotIds);
};

/**
 * Commitments PENDING ativos por lote (planning only).
 * @param {string} empresaId
 * @param {string[]} lotIds
 * @param {object} [options]
 */
export const getShadowVirtualPendingCommitmentsByLotIds = async (empresaId, lotIds, options = {}) => {
  if (!empresaId || !Array.isArray(lotIds) || lotIds.length === 0) return new Map();

  if (options.inMemoryLedger !== undefined) {
    return aggregateInMemoryPending(empresaId, lotIds);
  }

  if (postgresLedgerEnabled) {
    try {
      return await fetchPendingCommitmentsByLotIdsFromPg(empresaId, lotIds);
    } catch {
      return aggregateInMemoryPending(empresaId, lotIds);
    }
  }

  return aggregateInMemoryPending(empresaId, lotIds);
};

/**
 * physical - CONFIRMED - PENDING = disponibilidade para novo planning.
 * @param {string} empresaId
 * @param {string[]} lotIds
 */
export const getShadowVirtualPlanningDeductionByLotIds = async (empresaId, lotIds) => {
  const [confirmed, pending] = await Promise.all([
    getShadowVirtualConsumedByLotIds(empresaId, lotIds),
    getShadowVirtualPendingCommitmentsByLotIds(empresaId, lotIds),
  ]);
  return mergeShadowQuantityMaps(confirmed, pending);
};

/**
 * Clona lotes e reduz quantidade_disponivel pelo consumo virtual confirmado.
 * @param {object[]} lots
 * @param {Map<string, string>} consumedByLotId
 */
export const applyShadowVirtualAvailabilityToLots = (lots, consumedByLotId) => (
  (Array.isArray(lots) ? lots : []).map((lot) => {
    const consumed = consumedByLotId.get(lot.id) ?? '0';
    const original = toDecimal(lot.quantidade_disponivel ?? '0');
    const effective = original.minus(toDecimal(consumed));
    const clamped = effective.lt(0) ? toDecimal(0) : effective;
    return {
      ...lot,
      quantidade_disponivel: formatDecimal(clamped, QTY_SCALE),
      _shadowOriginalAvailable: formatDecimal(original, QTY_SCALE),
      _shadowVirtualConsumed: consumed,
    };
  })
);

/**
 * Calcula saldo virtual restante por lote.
 * @param {object[]} realLots
 * @param {Map<string, string>} consumedByLotId
 */
export const computeShadowVirtualRemainingByLot = (realLots, consumedByLotId) => {
  const result = new Map();
  for (const lot of realLots ?? []) {
    const original = toDecimal(lot.quantidade_disponivel ?? '0');
    const consumed = toDecimal(consumedByLotId.get(lot.id) ?? '0');
    const remaining = original.minus(consumed);
    result.set(lot.id, formatDecimal(remaining.lt(0) ? toDecimal(0) : remaining, QTY_SCALE));
  }
  return result;
};

const buildLedgerRowsFromItemPlans = (itemPlans) => {
  /** @type {object[]} */
  const rows = [];
  for (const plan of itemPlans ?? []) {
    for (const allocation of plan.plannedAllocations ?? []) {
      rows.push({
        stockLotId: allocation.stock_lot_id,
        quantity: allocation.quantidade,
        origem: allocation.origem_mercadoria,
        priorStStatus: allocation.prior_st_status,
        commercialSaleItemId: allocation.commercial_sale_item_id ?? plan.commercialItem?.commercialSaleItemId ?? null,
        itemIndex: plan.itemIndex ?? 0,
        fifoOrder: allocation.allocation_audit_json?.fifoOrder ?? 0,
      });
    }
  }
  return rows;
};

/**
 * Agrega quantidades planejadas por lote.
 * @param {object[]} itemPlans
 */
export const aggregatePlannedQuantitiesByLot = (itemPlans) => {
  const totals = new Map();
  for (const row of buildLedgerRowsFromItemPlans(itemPlans)) {
    const prev = toDecimal(totals.get(row.stockLotId) ?? '0');
    totals.set(row.stockLotId, formatDecimal(prev.plus(toDecimal(row.quantity ?? '0')), QTY_SCALE));
  }
  return totals;
};

/**
 * Invariante: confirmed === planned (sem clip silencioso).
 * @param {object[]} itemPlans
 * @param {object[]} confirmedRows
 */
export const assertPlannedMatchesConfirmedLedger = (itemPlans, confirmedRows) => {
  const planned = aggregatePlannedQuantitiesByLot(itemPlans);
  const confirmed = new Map();
  for (const row of confirmedRows ?? []) {
    const prev = toDecimal(confirmed.get(row.stockLotId) ?? '0');
    confirmed.set(row.stockLotId, formatDecimal(prev.plus(toDecimal(row.quantity ?? '0')), QTY_SCALE));
  }

  const lotIds = new Set([...planned.keys(), ...confirmed.keys()]);
  for (const lotId of lotIds) {
    const p = planned.get(lotId) ?? '0.0000000000';
    const c = confirmed.get(lotId) ?? '0.0000000000';
    if (p !== c) {
      return {
        ok: false,
        lotId,
        planned: p,
        confirmed: c,
        code: SHADOW_LEDGER_ISSUE_CODE.PLAN_STALE,
      };
    }
  }
  return { ok: true };
};

/**
 * Persiste ledger virtual exatamente como planejado — sem clip.
 * @param {object} params
 */
export const persistShadowStockLedgerFromPlans = async (params) => {
  const empresaId = params.empresaId ?? null;
  const shadowEmissionIdentity = resolveShadowEmissionIdentity({
    shadowEmissionIdentity: params.shadowEmissionIdentity,
    meiNotaRecordId: params.meiNotaRecordId,
    idIntegracao: params.idIntegracao,
    correlationId: params.correlationId,
  });
  const ledgerStatus = params.ledgerStatus ?? SHADOW_LEDGER_STATUS.CONFIRMED;

  if (!empresaId || !shadowEmissionIdentity) {
    return { persisted: false, reason: 'missing_identity' };
  }

  const plannedRows = buildLedgerRowsFromItemPlans(params.itemPlans);
  if (plannedRows.length === 0 && ledgerStatus === SHADOW_LEDGER_STATUS.CONFIRMED) {
    return { persisted: false, reason: 'no_allocations' };
  }

  const memoryKey = `${empresaId}:${shadowEmissionIdentity}:${ledgerStatus}`;

  if (ledgerStatus === SHADOW_LEDGER_STATUS.CONFIRMED) {
    const existingConfirmedKey = `${empresaId}:${shadowEmissionIdentity}:${SHADOW_LEDGER_STATUS.CONFIRMED}`;
    if (inMemoryLedgerByEmission.has(existingConfirmedKey)) {
      return { persisted: false, duplicate: true, storage: 'memory' };
    }
  }

  if (ledgerStatus === SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION) {
    const pendingKey = `${empresaId}:${shadowEmissionIdentity}:${SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION}`;
    const confirmedKey = `${empresaId}:${shadowEmissionIdentity}:${SHADOW_LEDGER_STATUS.CONFIRMED}`;
    if (inMemoryLedgerByEmission.has(pendingKey) || inMemoryLedgerByEmission.has(confirmedKey)) {
      return { persisted: false, duplicate: true, storage: 'memory' };
    }
  }

  const invariant = assertPlannedMatchesConfirmedLedger(params.itemPlans, plannedRows);
  if (!invariant.ok) {
    return {
      persisted: false,
      reason: 'plan_mismatch',
      invariant,
      code: SHADOW_LEDGER_ISSUE_CODE.PLAN_STALE,
    };
  }

  inMemoryLedgerByEmission.set(memoryKey, {
    rows: plannedRows.map((r) => ({
      ...r,
      status: ledgerStatus,
      shadowEmissionIdentity,
      empresaId,
      comparisonId: params.comparisonId ?? null,
    })),
  });

  if (ledgerStatus === SHADOW_LEDGER_STATUS.CONFIRMED) {
    inMemoryLedgerByEmission.set(`${empresaId}:${shadowEmissionIdentity}:${SHADOW_LEDGER_STATUS.CONFIRMED}`, {
      rows: plannedRows.map((r) => ({
        ...r,
        status: ledgerStatus,
        shadowEmissionIdentity,
        empresaId,
        comparisonId: params.comparisonId ?? null,
      })),
    });
    inMemoryLedgerByEmission.delete(`${empresaId}:${shadowEmissionIdentity}:${SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION}`);
  }

  let pgResult = { confirmed: false, duplicate: false, inserted: 0 };
  if (postgresLedgerEnabled) {
    try {
      pgResult = await insertShadowStockAllocationsPg({
        empresaId,
        shadowEmissionIdentity,
        comparisonId: params.comparisonId ?? null,
        meiNotaRecordId: params.meiNotaRecordId ?? null,
        rows: plannedRows,
        status: ledgerStatus,
      });
    } catch (error) {
      pgResult = {
        confirmed: false,
        duplicate: false,
        inserted: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    persisted: plannedRows.length > 0 || pgResult.inserted > 0,
    duplicate: pgResult.duplicate === true,
    inserted: pgResult.inserted ?? plannedRows.length,
    storage: pgResult.confirmed ? 'postgres+memory' : 'memory',
    postgres: pgResult,
    ledgerStatus,
  };
};

/**
 * @deprecated Use persistShadowStockLedgerFromPlans dentro de withShadowTenantPlanningLock
 */
export const confirmShadowStockLedgerFromComparison = async (params) => (
  persistShadowStockLedgerFromPlans({
    ...params,
    ledgerStatus: SHADOW_LEDGER_STATUS.CONFIRMED,
  })
);

/**
 * @param {string} empresaId
 * @param {string} shadowEmissionIdentity
 */
export const hasConfirmedShadowEmission = async (empresaId, shadowEmissionIdentity) => {
  const memoryKey = `${empresaId}:${shadowEmissionIdentity}:${SHADOW_LEDGER_STATUS.CONFIRMED}`;
  if (inMemoryLedgerByEmission.has(memoryKey)) return true;

  if (postgresLedgerEnabled) {
    try {
      return await hasConfirmedShadowEmissionInPg(empresaId, shadowEmissionIdentity);
    } catch {
      return false;
    }
  }
  return false;
};

/**
 * @param {string} empresaId
 * @param {string} shadowEmissionIdentity
 */
export const hasPendingShadowEmission = async (empresaId, shadowEmissionIdentity) => {
  const memoryKey = `${empresaId}:${shadowEmissionIdentity}:${SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION}`;
  if (inMemoryLedgerByEmission.has(memoryKey)) return true;

  if (postgresLedgerEnabled) {
    try {
      return await hasPendingShadowEmissionInPg(empresaId, shadowEmissionIdentity);
    } catch {
      return false;
    }
  }
  return false;
};

/**
 * PENDING_CONFIRMATION → CONFIRMED (mesmo plano persistido).
 * @param {object} params
 */
export const promotePendingShadowLedgerToConfirmed = async (params) => {
  const empresaId = params.empresaId ?? null;
  const shadowEmissionIdentity = resolveShadowEmissionIdentity({
    shadowEmissionIdentity: params.shadowEmissionIdentity,
    meiNotaRecordId: params.meiNotaRecordId,
  });

  if (!empresaId || !shadowEmissionIdentity) {
    return { reconciled: false, reason: 'missing_identity' };
  }

  return withShadowTenantPlanningLock(empresaId, async () => {
    if (await hasConfirmedShadowEmission(empresaId, shadowEmissionIdentity)) {
      return { reconciled: true, promoted: false, duplicate: true, ledgerStatus: SHADOW_LEDGER_STATUS.CONFIRMED };
    }

    const pendingKey = `${empresaId}:${shadowEmissionIdentity}:${SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION}`;
    const pendingEntry = inMemoryLedgerByEmission.get(pendingKey);

    if (pendingEntry?.rows?.length) {
      inMemoryLedgerByEmission.set(`${empresaId}:${shadowEmissionIdentity}:${SHADOW_LEDGER_STATUS.CONFIRMED}`, {
        rows: pendingEntry.rows.map((r) => ({ ...r, status: SHADOW_LEDGER_STATUS.CONFIRMED })),
      });
      inMemoryLedgerByEmission.delete(pendingKey);
    }

    let pgResult = { promoted: false, duplicate: false, updated: 0 };
    if (postgresLedgerEnabled) {
      try {
        pgResult = await promotePendingShadowLedgerToConfirmedPg(empresaId, shadowEmissionIdentity);
      } catch (error) {
        pgResult = {
          promoted: false,
          duplicate: false,
          updated: 0,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    const promoted = Boolean(pendingEntry?.rows?.length) || pgResult.promoted === true;
    return {
      reconciled: promoted || pgResult.duplicate === true,
      promoted,
      duplicate: pgResult.duplicate === true,
      ledgerStatus: SHADOW_LEDGER_STATUS.CONFIRMED,
      postgres: pgResult,
    };
  });
};

/**
 * PENDING_CONFIRMATION → VOIDED (libera commitment).
 * @param {object} params
 */
export const voidPendingShadowLedgerCommitments = async (params) => {
  const empresaId = params.empresaId ?? null;
  const shadowEmissionIdentity = resolveShadowEmissionIdentity({
    shadowEmissionIdentity: params.shadowEmissionIdentity,
    meiNotaRecordId: params.meiNotaRecordId,
  });

  if (!empresaId || !shadowEmissionIdentity) {
    return { reconciled: false, reason: 'missing_identity' };
  }

  return withShadowTenantPlanningLock(empresaId, async () => {
    const pendingKey = `${empresaId}:${shadowEmissionIdentity}:${SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION}`;
    const pendingEntry = inMemoryLedgerByEmission.get(pendingKey);

    if (pendingEntry?.rows?.length) {
      inMemoryLedgerByEmission.set(`${empresaId}:${shadowEmissionIdentity}:${SHADOW_LEDGER_STATUS.VOIDED}`, {
        rows: pendingEntry.rows.map((r) => ({ ...r, status: SHADOW_LEDGER_STATUS.VOIDED })),
      });
      inMemoryLedgerByEmission.delete(pendingKey);
    }

    let pgResult = { voided: false, updated: 0 };
    if (postgresLedgerEnabled) {
      try {
        pgResult = await voidPendingShadowLedgerCommitmentsPg(empresaId, shadowEmissionIdentity);
      } catch (error) {
        pgResult = {
          voided: false,
          updated: 0,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    const voided = Boolean(pendingEntry?.rows?.length) || pgResult.voided === true;
    return {
      reconciled: voided,
      voided,
      ledgerStatus: SHADOW_LEDGER_STATUS.VOIDED,
      postgres: pgResult,
    };
  });
};

/** @internal */
export const __getInMemoryShadowLedgerSnapshotForTests = () => {
  const allRows = [];
  for (const entry of inMemoryLedgerByEmission.values()) {
    allRows.push(...entry.rows);
  }
  return allRows;
};

/** @internal */
export const __listInMemoryShadowLedgerByEmissionForTests = (empresaId, shadowEmissionIdentity, status = SHADOW_LEDGER_STATUS.CONFIRMED) => (
  inMemoryLedgerByEmission.get(`${empresaId}:${shadowEmissionIdentity}:${status}`)?.rows ?? []
);

/** @internal */
export const __getShadowTenantLockKeyForTests = (empresaId) => hashEmpresaLockKey(empresaId);
