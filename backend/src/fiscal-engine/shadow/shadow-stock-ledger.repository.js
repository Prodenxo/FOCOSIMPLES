/**
 * Persistência Postgres do ledger virtual shadow (fail-open).
 */
import { query, getPgPool } from '../../config/pg.js';
import { SHADOW_LEDGER_STATUS } from './shadow-constants.js';

/** @internal */
export const __ensureShadowStockLedgerSchemaForTests = async () => {
  await query(`
    create table if not exists public.fiscal_shadow_stock_allocations (
      id uuid primary key default gen_random_uuid(),
      empresa_id uuid not null,
      shadow_emission_identity text not null,
      comparison_id text,
      mei_nota_record_id uuid,
      commercial_sale_item_id text,
      item_index integer not null default 0,
      fifo_order integer not null default 0,
      stock_lot_id uuid not null,
      quantity numeric(20, 10) not null,
      origem_mercadoria varchar(1),
      prior_st_status varchar(32),
      status varchar(16) not null default 'CONFIRMED',
      created_at timestamptz not null default now(),
      constraint fiscal_shadow_stock_allocations_emission_lot_unique
        unique (empresa_id, shadow_emission_identity, stock_lot_id, item_index, fifo_order),
      constraint fiscal_shadow_stock_allocations_status_check
        check (status in ('PLANNED', 'PENDING_CONFIRMATION', 'CONFIRMED', 'VOIDED'))
    )
  `);
};

/**
 * @param {string} empresaId
 * @param {string[]} lotIds
 */
export const fetchConfirmedConsumedByLotIdsFromPg = async (empresaId, lotIds) => {
  if (!empresaId || !Array.isArray(lotIds) || lotIds.length === 0) return new Map();

  const { rows } = await query(
    `SELECT stock_lot_id, SUM(quantity)::text AS consumed
     FROM fiscal_shadow_stock_allocations
     WHERE empresa_id = $1
       AND stock_lot_id = ANY($2::uuid[])
       AND status = $3
     GROUP BY stock_lot_id`,
    [empresaId, lotIds, SHADOW_LEDGER_STATUS.CONFIRMED],
  );

  return new Map(rows.map((r) => [r.stock_lot_id, String(r.consumed ?? '0')]));
};

/**
 * Commitments PENDING ativos — reduzem disponibilidade de planning, não consumo CONFIRMED.
 * @param {string} empresaId
 * @param {string[]} lotIds
 */
export const fetchPendingCommitmentsByLotIdsFromPg = async (empresaId, lotIds) => {
  if (!empresaId || !Array.isArray(lotIds) || lotIds.length === 0) return new Map();

  const { rows } = await query(
    `SELECT stock_lot_id, SUM(quantity)::text AS pending
     FROM fiscal_shadow_stock_allocations
     WHERE empresa_id = $1
       AND stock_lot_id = ANY($2::uuid[])
       AND status = $3
     GROUP BY stock_lot_id`,
    [empresaId, lotIds, SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION],
  );

  return new Map(rows.map((r) => [r.stock_lot_id, String(r.pending ?? '0')]));
};

/**
 * @param {string} empresaId
 * @param {string} shadowEmissionIdentity
 */
export const hasPendingShadowEmissionInPg = async (empresaId, shadowEmissionIdentity) => {
  const { rows } = await query(
    `SELECT 1 FROM fiscal_shadow_stock_allocations
     WHERE empresa_id = $1 AND shadow_emission_identity = $2 AND status = $3
     LIMIT 1`,
    [empresaId, shadowEmissionIdentity, SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION],
  );
  return rows.length > 0;
};

/**
 * @param {string} empresaId
 * @param {string} shadowEmissionIdentity
 */
export const hasConfirmedShadowEmissionInPg = async (empresaId, shadowEmissionIdentity) => {
  const { rows } = await query(
    `SELECT 1 FROM fiscal_shadow_stock_allocations
     WHERE empresa_id = $1 AND shadow_emission_identity = $2 AND status = $3
     LIMIT 1`,
    [empresaId, shadowEmissionIdentity, SHADOW_LEDGER_STATUS.CONFIRMED],
  );
  return rows.length > 0;
};

/**
 * Session-level advisory lock por tenant — cobre read+plan+confirm (multi-instance).
 * @param {string} empresaId
 * @param {() => Promise<T>} fn
 * @template T
 */
export const withShadowTenantPgPlanningLock = async (empresaId, fn) => {
  const pool = getPgPool();
  const client = await pool.connect();
  const lockKey = Math.abs(
    [...`${empresaId}:shadow-planning`].reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0),
  ) % 2147483647;

  try {
    await client.query('SELECT pg_advisory_lock($1)', [lockKey]);
    try {
      return await fn({ pgClient: client });
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
    }
  } finally {
    client.release();
  }
};

/**
 * @param {object} params
 */
export const insertShadowStockAllocationsPg = async (params) => {
  const ledgerStatus = params.status ?? SHADOW_LEDGER_STATUS.CONFIRMED;
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const lockKey = Math.abs(
      [...`${params.empresaId}:shadow-ledger`].reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0),
    ) % 2147483647;
    await client.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

    if (ledgerStatus === SHADOW_LEDGER_STATUS.CONFIRMED) {
      const existing = await client.query(
        `SELECT 1 FROM fiscal_shadow_stock_allocations
         WHERE empresa_id = $1 AND shadow_emission_identity = $2 AND status = $3
         LIMIT 1`,
        [params.empresaId, params.shadowEmissionIdentity, SHADOW_LEDGER_STATUS.CONFIRMED],
      );

      if (existing.rows.length > 0) {
        await client.query('COMMIT');
        return { confirmed: false, duplicate: true, inserted: 0 };
      }
    }

    if (ledgerStatus === SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION) {
      const existing = await client.query(
        `SELECT 1 FROM fiscal_shadow_stock_allocations
         WHERE empresa_id = $1 AND shadow_emission_identity = $2
           AND status IN ($3, $4)
         LIMIT 1`,
        [
          params.empresaId,
          params.shadowEmissionIdentity,
          SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION,
          SHADOW_LEDGER_STATUS.CONFIRMED,
        ],
      );

      if (existing.rows.length > 0) {
        await client.query('COMMIT');
        return { confirmed: false, duplicate: true, inserted: 0 };
      }
    }

    let inserted = 0;
    for (const row of params.rows ?? []) {
      const result = await client.query(
        `INSERT INTO fiscal_shadow_stock_allocations (
          empresa_id, shadow_emission_identity, comparison_id, mei_nota_record_id,
          commercial_sale_item_id, item_index, fifo_order, stock_lot_id, quantity,
          origem_mercadoria, prior_st_status, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (empresa_id, shadow_emission_identity, stock_lot_id, item_index, fifo_order) DO NOTHING
        RETURNING id`,
        [
          params.empresaId,
          params.shadowEmissionIdentity,
          params.comparisonId ?? null,
          params.meiNotaRecordId ?? null,
          row.commercialSaleItemId ?? null,
          row.itemIndex ?? 0,
          row.fifoOrder ?? 0,
          row.stockLotId,
          row.quantity,
          row.origem ?? null,
          row.priorStStatus ?? null,
          ledgerStatus,
        ],
      );
      if (result.rows.length > 0) inserted += 1;
    }

    await client.query('COMMIT');
    return { confirmed: inserted > 0, duplicate: false, inserted };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * PENDING_CONFIRMATION → CONFIRMED (mesmas quantidades, idempotente).
 * @param {string} empresaId
 * @param {string} shadowEmissionIdentity
 */
export const promotePendingShadowLedgerToConfirmedPg = async (empresaId, shadowEmissionIdentity) => {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const lockKey = Math.abs(
      [...`${empresaId}:shadow-ledger`].reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0),
    ) % 2147483647;
    await client.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

    const existingConfirmed = await client.query(
      `SELECT 1 FROM fiscal_shadow_stock_allocations
       WHERE empresa_id = $1 AND shadow_emission_identity = $2 AND status = $3
       LIMIT 1`,
      [empresaId, shadowEmissionIdentity, SHADOW_LEDGER_STATUS.CONFIRMED],
    );

    if (existingConfirmed.rows.length > 0) {
      await client.query('COMMIT');
      return { promoted: false, duplicate: true, updated: 0 };
    }

    const result = await client.query(
      `UPDATE fiscal_shadow_stock_allocations
       SET status = $3
       WHERE empresa_id = $1
         AND shadow_emission_identity = $2
         AND status = $4
       RETURNING id`,
      [
        empresaId,
        shadowEmissionIdentity,
        SHADOW_LEDGER_STATUS.CONFIRMED,
        SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION,
      ],
    );

    await client.query('COMMIT');
    return { promoted: result.rowCount > 0, duplicate: false, updated: result.rowCount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * PENDING_CONFIRMATION → VOIDED (libera commitment).
 * @param {string} empresaId
 * @param {string} shadowEmissionIdentity
 */
export const voidPendingShadowLedgerCommitmentsPg = async (empresaId, shadowEmissionIdentity) => {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const lockKey = Math.abs(
      [...`${empresaId}:shadow-ledger`].reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0),
    ) % 2147483647;
    await client.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

    const result = await client.query(
      `UPDATE fiscal_shadow_stock_allocations
       SET status = $3
       WHERE empresa_id = $1
         AND shadow_emission_identity = $2
         AND status = $4
       RETURNING id`,
      [
        empresaId,
        shadowEmissionIdentity,
        SHADOW_LEDGER_STATUS.VOIDED,
        SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION,
      ],
    );

    await client.query('COMMIT');
    return { voided: result.rowCount > 0, updated: result.rowCount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * @param {string} empresaId
 * @param {string} shadowEmissionIdentity
 */
export const fetchShadowStockAllocationsByEmission = async (empresaId, shadowEmissionIdentity) => {
  const { rows } = await query(
    `SELECT * FROM fiscal_shadow_stock_allocations
     WHERE empresa_id = $1 AND shadow_emission_identity = $2
     ORDER BY item_index, fifo_order`,
    [empresaId, shadowEmissionIdentity],
  );
  return rows;
};

/** @internal */
export const __deleteShadowStockLedgerForTests = async (empresaId, shadowEmissionIdentity) => {
  await query(
    `DELETE FROM fiscal_shadow_stock_allocations
     WHERE empresa_id = $1 AND shadow_emission_identity = $2`,
    [empresaId, shadowEmissionIdentity],
  );
};

/** @internal */
export const __deleteShadowStockLedgerByEmpresaForTests = async (empresaId) => {
  await query(
    `DELETE FROM fiscal_shadow_stock_allocations WHERE empresa_id = $1`,
    [empresaId],
  );
};
