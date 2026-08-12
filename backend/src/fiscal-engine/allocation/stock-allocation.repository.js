/**
 * Repositório Postgres — alocação/reserva fiscal (Fase 3).
 */
import { randomUUID } from 'node:crypto';
import { getPgPool } from '../../config/pg.js';
import { toDecimal, formatDecimal } from '../money/decimal.js';
import { ensureFiscalPurchaseSchema, canAutoEnsureFiscalPurchaseSchema } from '../acquisition/fiscal-purchase.schema.js';
import { ALLOCATION_STATUS, ALLOCATION_REQUEST_STATUS } from './allocation-constants.js';
import {
  buildAllocationRequestFingerprint,
  matchesStoredAllocationRequest,
} from './allocation-idempotency.js';

const QTY_SCALE = 10;

const maybeEnsureSchema = async () => {
  if (canAutoEnsureFiscalPurchaseSchema()) {
    await ensureFiscalPurchaseSchema();
  }
};

const jsonValue = (value) => {
  if (value == null) return null;
  return JSON.stringify(value);
};

/**
 * @param {string} empresaId
 * @param {string} allocationRequestId
 */
export const findAllocationRequestByKey = async (empresaId, allocationRequestId) => {
  await maybeEnsureSchema();
  const pool = getPgPool();
  const req = await pool.query(
    `SELECT * FROM fiscal_stock_allocation_requests
     WHERE empresa_id = $1 AND allocation_request_id = $2
     LIMIT 1`,
    [empresaId, allocationRequestId],
  );
  if (!req.rows[0]) return null;

  const allocations = await pool.query(
    `SELECT * FROM fiscal_stock_allocations
     WHERE empresa_id = $1 AND allocation_request_uuid = $2
     ORDER BY created_at ASC, id ASC`,
    [empresaId, req.rows[0].id],
  );

  return {
    request: req.rows[0],
    allocations: allocations.rows,
  };
};

/** @internal — replay após corrida de insert idempotente */
const loadReplayOrIdempotencyConflict = async (pool, empresaId, allocationRequestId, fingerprint) => {
  const req = await pool.query(
    `SELECT * FROM fiscal_stock_allocation_requests
     WHERE empresa_id = $1 AND allocation_request_id = $2
     LIMIT 1`,
    [empresaId, allocationRequestId],
  );
  const stored = req.rows[0];
  if (!stored) {
    throw new Error('STOCK_ALLOCATION_IDEMPOTENCY_RACE_LOST');
  }
  if (!matchesStoredAllocationRequest(stored, fingerprint)) {
    return { idempotencyConflict: true };
  }
  const allocations = await pool.query(
    `SELECT * FROM fiscal_stock_allocations
     WHERE empresa_id = $1 AND allocation_request_uuid = $2
     ORDER BY created_at ASC, id ASC`,
    [empresaId, stored.id],
  );
  return {
    replay: true,
    request: stored,
    allocations: allocations.rows,
  };
};

const isAllocationRequestUniqueViolation = (err) => (
  err?.code === '23505'
  && String(err?.constraint ?? '').includes('fiscal_stock_allocation_requests_empresa_key_unique')
);

/** @internal — carrega ST ativo sob lock (após FOR UPDATE dos lotes). */
const loadActiveAllocationsByLotIds = async (client, empresaId, lotIds) => {
  /** @type {Map<string, object[]>} */
  const map = new Map();
  if (!lotIds.length) return map;
  const res = await client.query(
    `SELECT * FROM fiscal_stock_allocations
     WHERE empresa_id = $1
       AND stock_lot_id = ANY($2::uuid[])
       AND status IN ($3, $4)
     FOR UPDATE`,
    [empresaId, lotIds, ALLOCATION_STATUS.RESERVED, ALLOCATION_STATUS.CONSUMED],
  );
  for (const row of res.rows) {
    const list = map.get(row.stock_lot_id) ?? [];
    list.push(row);
    map.set(row.stock_lot_id, list);
  }
  return map;
};

/**
 * Executa alocação atômica: lock FIFO + persistência + reserva de saldo.
 * @param {object} params
 * @param {(lockedLots: object[]) => Promise<object>} params.planExecutor
 */
export const runStockAllocationAtomic = async ({
  empresaId,
  produtoCatalogoId,
  allocationRequestId,
  quantidadeSolicitada,
  commercialSaleId = null,
  commercialSaleItemId = null,
  planExecutor,
}) => {
  await maybeEnsureSchema();
  const pool = getPgPool();
  const client = await pool.connect();
  const fingerprint = buildAllocationRequestFingerprint({
    produtoCatalogoId,
    quantidade: quantidadeSolicitada,
    commercialSaleId,
    commercialSaleItemId,
  });

  try {
    await client.query('BEGIN');

    const existingReq = await client.query(
      `SELECT * FROM fiscal_stock_allocation_requests
       WHERE empresa_id = $1 AND allocation_request_id = $2
       FOR UPDATE`,
      [empresaId, allocationRequestId],
    );
    if (existingReq.rows[0]?.status === ALLOCATION_REQUEST_STATUS.COMPLETED) {
      if (!matchesStoredAllocationRequest(existingReq.rows[0], fingerprint)) {
        await client.query('ROLLBACK');
        return { idempotencyConflict: true };
      }
      const allocations = await client.query(
        `SELECT * FROM fiscal_stock_allocations
         WHERE empresa_id = $1 AND allocation_request_uuid = $2
         ORDER BY created_at ASC, id ASC`,
        [empresaId, existingReq.rows[0].id],
      );
      await client.query('COMMIT');
      return {
        replay: true,
        request: existingReq.rows[0],
        allocations: allocations.rows,
      };
    }

    const lockedLotsRes = await client.query(
      `SELECT l.*, i.purchase_invoice_id
       FROM fiscal_stock_lots l
       INNER JOIN fiscal_purchase_items i ON i.id = l.purchase_item_id
       WHERE l.empresa_id = $1
         AND l.produto_catalogo_id = $2
         AND l.status = 'USABLE'
         AND l.quantidade_disponivel > 0
       ORDER BY l.data_entrada ASC, l.id ASC
       FOR UPDATE`,
      [empresaId, produtoCatalogoId],
    );

    // Ordem transacional: lock FIFO dos lotes → lock ST ativo (FOR UPDATE) → cálculo → persistência → saldo
    const lotIds = lockedLotsRes.rows.map((l) => l.id);
    const activeAllocationsByLotId = await loadActiveAllocationsByLotIds(client, empresaId, lotIds);
    const planResult = await planExecutor(lockedLotsRes.rows, { activeAllocationsByLotId });
    if (!planResult.ok) {
      await client.query('ROLLBACK');
      return planResult;
    }

    const requestId = planResult.requestRow.id || randomUUID();
    await client.query(
      `INSERT INTO fiscal_stock_allocation_requests (
        id, empresa_id, allocation_request_id, commercial_sale_id, commercial_sale_item_id,
        produto_catalogo_id, quantidade_solicitada, status, resolution_status, issues_json,
        allocation_audit_json, engine_schema_version
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        requestId,
        planResult.requestRow.empresa_id,
        planResult.requestRow.allocation_request_id,
        planResult.requestRow.commercial_sale_id,
        planResult.requestRow.commercial_sale_item_id,
        planResult.requestRow.produto_catalogo_id,
        planResult.requestRow.quantidade_solicitada,
        planResult.requestRow.status,
        planResult.requestRow.resolution_status,
        jsonValue(planResult.requestRow.issues_json ?? []),
        jsonValue(planResult.requestRow.allocation_audit_json ?? {}),
        planResult.requestRow.engine_schema_version,
      ],
    );

    const savedAllocations = [];
    for (const row of planResult.allocationRows) {
      const allocId = row.id || randomUUID();
      await client.query(
        `INSERT INTO fiscal_stock_allocations (
          id, empresa_id, stock_lot_id, allocation_request_uuid, commercial_sale_id,
          commercial_sale_item_id, purchase_item_id, purchase_invoice_id, produto_catalogo_id,
          quantidade, allocation_method, st_allocation_json, reference_type, reference_id,
          status, origem_mercadoria, prior_st_status, prior_st_evidence_json, supplier_cest,
          stock_unit_resolution_json, base_unit, allocation_audit_json, engine_schema_version
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
        )`,
        [
          allocId,
          row.empresa_id,
          row.stock_lot_id,
          requestId,
          row.commercial_sale_id,
          row.commercial_sale_item_id,
          row.purchase_item_id,
          row.purchase_invoice_id,
          row.produto_catalogo_id,
          row.quantidade,
          row.allocation_method,
          jsonValue(row.st_allocation_json ?? {}),
          row.reference_type,
          row.reference_id,
          row.status,
          row.origem_mercadoria,
          row.prior_st_status,
          jsonValue(row.prior_st_evidence_json ?? {}),
          row.supplier_cest,
          jsonValue(row.stock_unit_resolution_json ?? {}),
          row.base_unit,
          jsonValue(row.allocation_audit_json ?? {}),
          row.engine_schema_version,
        ],
      );
      savedAllocations.push({ ...row, id: allocId, allocation_request_uuid: requestId });
    }

    for (const update of planResult.lotUpdates) {
      const qty = toDecimal(update.quantity);
      const updated = await client.query(
        `UPDATE fiscal_stock_lots
         SET quantidade_disponivel = quantidade_disponivel - $1,
             status = CASE WHEN quantidade_disponivel - $1 <= 0 THEN 'DEPLETED' ELSE status END,
             version = version + 1,
             updated_at = now()
         WHERE id = $2 AND empresa_id = $3 AND version = $4
           AND quantidade_disponivel >= $1
         RETURNING *`,
        [
          formatDecimal(qty, QTY_SCALE),
          update.lotId,
          update.empresaId,
          update.expectedVersion,
        ],
      );
      if (!updated.rows[0]) {
        throw new Error('STOCK_ALLOCATION_CONFLICT');
      }
    }

    await client.query('COMMIT');
    return {
      replay: false,
      request: { ...planResult.requestRow, id: requestId },
      allocations: savedAllocations,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    if (isAllocationRequestUniqueViolation(err)) {
      return loadReplayOrIdempotencyConflict(pool, empresaId, allocationRequestId, fingerprint);
    }
    throw err;
  } finally {
    client.release();
  }
};

/**
 * @param {string} empresaId
 * @param {string} allocationRequestId
 */
export const releaseAllocationRequest = async (empresaId, allocationRequestId) => {
  await maybeEnsureSchema();
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const req = await client.query(
      `SELECT * FROM fiscal_stock_allocation_requests
       WHERE empresa_id = $1 AND allocation_request_id = $2
       FOR UPDATE`,
      [empresaId, allocationRequestId],
    );
    const request = req.rows[0];
    if (!request) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Pedido de alocação não encontrado' };
    }

    const allocs = await client.query(
      `SELECT * FROM fiscal_stock_allocations
       WHERE empresa_id = $1 AND allocation_request_uuid = $2
       FOR UPDATE`,
      [empresaId, request.id],
    );

    const reserved = allocs.rows.filter((a) => a.status === ALLOCATION_STATUS.RESERVED);
    if (!reserved.length) {
      await client.query('ROLLBACK');
      if (allocs.rows.some((a) => a.status === ALLOCATION_STATUS.CONSUMED)) {
        return { ok: false, error: 'Transição inválida: allocation já consumida' };
      }
      return { ok: true, released: 0 };
    }

    for (const alloc of reserved) {
      await client.query(
        `UPDATE fiscal_stock_lots
         SET quantidade_disponivel = quantidade_disponivel + $1,
             status = CASE WHEN status = 'DEPLETED' THEN 'USABLE' ELSE status END,
             version = version + 1,
             updated_at = now()
         WHERE id = $2 AND empresa_id = $3`,
        [alloc.quantidade, alloc.stock_lot_id, empresaId],
      );
      const updated = await client.query(
        `UPDATE fiscal_stock_allocations
         SET status = $1, updated_at = now()
         WHERE id = $2 AND empresa_id = $3 AND status = $4
         RETURNING id`,
        [ALLOCATION_STATUS.RELEASED, alloc.id, empresaId, ALLOCATION_STATUS.RESERVED],
      );
      if (!updated.rows[0]) {
        throw new Error('STOCK_ALLOCATION_CONFLICT');
      }
    }

    await client.query('COMMIT');
    return { ok: true, released: reserved.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * @param {string} empresaId
 * @param {string} allocationRequestId
 */
export const consumeAllocationRequest = async (empresaId, allocationRequestId) => {
  await maybeEnsureSchema();
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const req = await client.query(
      `SELECT * FROM fiscal_stock_allocation_requests
       WHERE empresa_id = $1 AND allocation_request_id = $2
       FOR UPDATE`,
      [empresaId, allocationRequestId],
    );
    const request = req.rows[0];
    if (!request) {
      await client.query('ROLLBACK');
      return { ok: false, allocations: [], error: 'Pedido de alocação não encontrado' };
    }

    const res = await client.query(
      `UPDATE fiscal_stock_allocations a
       SET status = $1, updated_at = now()
       WHERE a.allocation_request_uuid = $2
         AND a.empresa_id = $3
         AND a.status = $4
       RETURNING a.*`,
      [ALLOCATION_STATUS.CONSUMED, request.id, empresaId, ALLOCATION_STATUS.RESERVED],
    );

    if (!res.rows.length) {
      const snapshot = await client.query(
        `SELECT status FROM fiscal_stock_allocations
         WHERE allocation_request_uuid = $1 AND empresa_id = $2`,
        [request.id, empresaId],
      );
      await client.query('ROLLBACK');
      if (snapshot.rows.some((r) => r.status === ALLOCATION_STATUS.RELEASED)) {
        return { ok: false, allocations: [], error: 'Transição inválida: allocation já liberada' };
      }
      if (snapshot.rows.some((r) => r.status === ALLOCATION_STATUS.CONSUMED)) {
        return { ok: false, allocations: [], error: 'Transição inválida: allocation já consumida' };
      }
      return { ok: false, allocations: [] };
    }

    await client.query('COMMIT');
    return { ok: true, allocations: res.rows };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/** @internal testes */
export const __deleteAllocationRequestForTests = async (empresaId, allocationRequestId) => {
  await maybeEnsureSchema();
  const pool = getPgPool();
  const req = await pool.query(
    `SELECT id FROM fiscal_stock_allocation_requests
     WHERE empresa_id = $1 AND allocation_request_id = $2`,
    [empresaId, allocationRequestId],
  );
  const requestId = req.rows[0]?.id;
  if (!requestId) return;
  await pool.query(
    `DELETE FROM fiscal_stock_allocations WHERE allocation_request_uuid = $1`,
    [requestId],
  );
  await pool.query(
    `DELETE FROM fiscal_stock_allocation_requests WHERE id = $1 AND empresa_id = $2`,
    [requestId, empresaId],
  );
};
