/**
 * Repositório Postgres — fiscal_engine_v3_rollouts.
 */
import { getPgPool } from '../../config/pg.js';
import { mapRolloutPolicyRow } from './rollout-policy-memory.repository.js';

/**
 * @param {string} empresaId
 * @param {string | null} [establishmentId]
 */
export const fetchRolloutPolicyFromPg = async (empresaId, establishmentId = null) => {
  const pool = getPgPool();
  if (establishmentId) {
    const exact = await pool.query(
      `SELECT mode, canary_percentage, enabled, engine_version,
              minimum_shadow_samples, readiness_required, reason, establishment_id
       FROM fiscal_engine_v3_rollouts
       WHERE empresa_id = $1 AND establishment_id = $2
       LIMIT 1`,
      [empresaId, establishmentId],
    );
    if (exact.rows.length) {
      return mapRolloutPolicyRow(exact.rows[0], empresaId, establishmentId);
    }
    return mapRolloutPolicyRow(null, empresaId, establishmentId);
  }

  const result = await pool.query(
    `SELECT mode, canary_percentage, enabled, engine_version,
            minimum_shadow_samples, readiness_required, reason, establishment_id
     FROM fiscal_engine_v3_rollouts
     WHERE empresa_id = $1 AND establishment_id = 'default'
     LIMIT 1`,
    [empresaId],
  );
  if (!result.rows.length) {
    return mapRolloutPolicyRow(null, empresaId, 'default');
  }
  return mapRolloutPolicyRow(result.rows[0], empresaId, 'default');
};

/** @internal testes */
export const __upsertRolloutPolicyForTests = async (empresaId, policy) => {
  const pool = getPgPool();
  const establishmentId = policy.establishmentId ?? 'default';
  await pool.query(
    `INSERT INTO fiscal_engine_v3_rollouts (
      empresa_id, establishment_id, mode, canary_percentage, enabled, engine_version,
      minimum_shadow_samples, readiness_required, reason
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (empresa_id, establishment_id) DO UPDATE SET
      mode = EXCLUDED.mode,
      canary_percentage = EXCLUDED.canary_percentage,
      enabled = EXCLUDED.enabled,
      engine_version = EXCLUDED.engine_version,
      minimum_shadow_samples = EXCLUDED.minimum_shadow_samples,
      readiness_required = EXCLUDED.readiness_required,
      reason = EXCLUDED.reason,
      updated_at = now()`,
    [
      empresaId,
      establishmentId,
      policy.mode ?? 'LEGACY',
      policy.canaryPercentage ?? 0,
      policy.enabled ?? false,
      policy.engineVersion ?? '3.1.0',
      policy.minimumShadowSamples ?? 0,
      policy.readinessRequired ?? true,
      policy.reason ?? null,
    ],
  );
};

/** @internal testes */
export const __ensureRolloutPolicySchemaForTests = async () => {
  const pool = getPgPool();
  await pool.query(`
    create table if not exists public.fiscal_engine_v3_rollouts (
      id uuid primary key default gen_random_uuid(),
      empresa_id uuid not null,
      establishment_id text not null default 'default',
      mode varchar(32) not null default 'LEGACY',
      canary_percentage smallint not null default 0,
      enabled boolean not null default false,
      engine_version varchar(16) not null default '3.1.0',
      minimum_shadow_samples integer not null default 0,
      readiness_required boolean not null default true,
      reason text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (empresa_id, establishment_id)
    )
  `);
  await pool.query(`
    alter table public.fiscal_engine_v3_rollouts
      add column if not exists establishment_id text not null default 'default'
  `);
  await pool.query(`
    alter table public.fiscal_engine_v3_rollouts
      drop constraint if exists fiscal_engine_v3_rollouts_empresa_id_key
  `);
  await pool.query(`
    create unique index if not exists fiscal_engine_v3_rollouts_empresa_establishment_uidx
      on public.fiscal_engine_v3_rollouts (empresa_id, establishment_id)
  `);
};

/** @internal testes */
export const __deleteRolloutPolicyForTests = async (empresaId) => {
  const pool = getPgPool();
  await pool.query('DELETE FROM fiscal_engine_v3_rollouts WHERE empresa_id = $1', [empresaId]);
};
