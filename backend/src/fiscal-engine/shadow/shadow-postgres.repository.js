/**
 * Persistência Postgres de shadow comparisons (fail-open).
 */
import { query } from '../../config/pg.js';
import { ENGINE_SCHEMA_VERSION } from '../constants.js';

/**
 * @param {import('./shadow-types.js').FiscalShadowComparison} comparison
 * @param {object} [extras]
 */
export const insertShadowComparisonToPg = async (comparison, extras = {}) => {
  const legacySnapshot = extras.legacySnapshots ?? comparison.legacySnapshots ?? [];
  const v3Snapshot = extras.v3Snapshots ?? comparison.v3Snapshots ?? [];

  const { rows } = await query(
    `INSERT INTO fiscal_shadow_comparisons (
      comparison_id, empresa_id, user_id, correlation_id, emission_attempt_id,
      execution_status, engine_schema_version, legacy_version, v3_version,
      legacy_snapshot_json, v3_snapshot_json, differences_json, summary_json, issues_json, audit_json
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb
    )
    ON CONFLICT (empresa_id, correlation_id, emission_attempt_id) DO NOTHING
    RETURNING comparison_id`,
    [
      comparison.comparisonId,
      comparison.empresaId,
      comparison.userId ?? null,
      comparison.correlationId ?? comparison.emissionAttemptId ?? 'unknown',
      comparison.emissionAttemptId ?? comparison.correlationId ?? 'unknown',
      comparison.executionStatus,
      comparison.engineSchemaVersion ?? ENGINE_SCHEMA_VERSION,
      comparison.legacyVersion ?? null,
      comparison.v3Version ?? ENGINE_SCHEMA_VERSION,
      JSON.stringify(legacySnapshot),
      JSON.stringify(v3Snapshot),
      JSON.stringify(comparison.items ?? []),
      JSON.stringify(comparison.summary ?? {}),
      JSON.stringify(comparison.executionIssues ?? []),
      JSON.stringify({
        timestamp: comparison.timestamp,
        itemPlans: comparison.audit?.itemPlans ?? null,
      }),
    ],
  );

  return {
    persisted: rows.length > 0,
    duplicate: rows.length === 0,
  };
};

/**
 * @param {string} empresaId
 * @param {string} correlationId
 * @param {string} emissionAttemptId
 */
export const findShadowComparisonByIdempotencyKey = async (empresaId, correlationId, emissionAttemptId) => {
  const { rows } = await query(
    `SELECT comparison_id, execution_status, summary_json, created_at
     FROM fiscal_shadow_comparisons
     WHERE empresa_id = $1 AND correlation_id = $2 AND emission_attempt_id = $3
     LIMIT 1`,
    [empresaId, correlationId, emissionAttemptId],
  );
  return rows[0] ?? null;
};

/**
 * @param {string} comparisonId
 */
export const findShadowComparisonByComparisonId = async (comparisonId) => {
  const { rows } = await query(
    `SELECT * FROM fiscal_shadow_comparisons WHERE comparison_id = $1 LIMIT 1`,
    [comparisonId],
  );
  return rows[0] ?? null;
};

/** @internal */
export const __ensureShadowComparisonSchemaForTests = async () => {
  await query(`
    create table if not exists public.fiscal_shadow_comparisons (
      id uuid primary key default gen_random_uuid(),
      comparison_id text not null unique,
      empresa_id uuid not null,
      user_id uuid,
      correlation_id text not null,
      emission_attempt_id text not null,
      execution_status varchar(32) not null,
      engine_schema_version varchar(16) not null default '3.1.0',
      legacy_version varchar(64),
      v3_version varchar(16),
      legacy_snapshot_json jsonb not null default '{}'::jsonb,
      v3_snapshot_json jsonb not null default '{}'::jsonb,
      differences_json jsonb not null default '[]'::jsonb,
      summary_json jsonb not null default '{}'::jsonb,
      issues_json jsonb not null default '[]'::jsonb,
      audit_json jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      constraint fiscal_shadow_comparisons_idempotency
        unique (empresa_id, correlation_id, emission_attempt_id)
    )
  `);
};

/** @internal */
export const __deleteShadowComparisonForTests = async (comparisonId) => {
  await query(
    `DELETE FROM fiscal_shadow_comparisons WHERE comparison_id = $1`,
    [comparisonId],
  );
};
