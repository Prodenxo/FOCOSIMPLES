/**
 * Repositório Postgres — fiscal_engine_v3_rollouts.
 */
import { getPgPool } from '../../config/pg.js';
import { mapRolloutPolicyRow } from './rollout-policy-memory.repository.js';

/**
 * @param {string} empresaId
 */
export const fetchRolloutPolicyFromPg = async (empresaId) => {
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT mode, canary_percentage, enabled, engine_version,
            minimum_shadow_samples, readiness_required, reason
     FROM fiscal_engine_v3_rollouts
     WHERE empresa_id = $1
     LIMIT 1`,
    [empresaId],
  );
  if (!result.rows.length) {
    return mapRolloutPolicyRow(null, empresaId);
  }
  return mapRolloutPolicyRow(result.rows[0], empresaId);
};

/** @internal testes */
export const __ensureRolloutPolicySchemaForTests = async () => {
  const pool = getPgPool();
  await pool.query(`
    create table if not exists public.fiscal_engine_v3_rollouts (
      id uuid primary key default gen_random_uuid(),
      empresa_id uuid not null unique,
      mode varchar(32) not null default 'LEGACY',
      canary_percentage smallint not null default 0,
      enabled boolean not null default false,
      engine_version varchar(16) not null default '3.1.0',
      minimum_shadow_samples integer not null default 0,
      readiness_required boolean not null default true,
      reason text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
};

/** @internal testes */
export const __deleteRolloutPolicyForTests = async (empresaId) => {
  const pool = getPgPool();
  await pool.query('DELETE FROM fiscal_engine_v3_rollouts WHERE empresa_id = $1', [empresaId]);
};
