/**
 * Repositório Postgres — fiscal_v3_emission_attempts.
 */
import { createHash } from 'node:crypto';
import { getPgPool } from '../../config/pg.js';

export const hashPayloadForAudit = (payload) => {
  const json = JSON.stringify(payload ?? {});
  return createHash('sha256').update(json).digest('hex').slice(0, 64);
};

/**
 * @param {object} row
 */
export const insertEmissionAttemptPg = async (row) => {
  const pool = getPgPool();
  await pool.query(
    `INSERT INTO fiscal_v3_emission_attempts (
      attempt_id, empresa_id, mei_nota_record_id, id_integracao, emission_stable_id,
      document_type, authority_engine, rollout_mode, canary_selected, attempt_status,
      preflight_id, allocation_request_ids, candidate_payload_hash,
      authority_decision_json, preflight_result_json, issues_json, engine_version
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    ON CONFLICT (attempt_id) DO NOTHING`,
    [
      row.attemptId,
      row.empresaId,
      row.meiNotaRecordId ?? null,
      row.idIntegracao ?? null,
      row.emissionStableId,
      row.documentType,
      row.authorityEngine,
      row.rolloutMode ?? null,
      row.canarySelected ?? null,
      row.attemptStatus,
      row.preflightId ?? null,
      JSON.stringify(row.allocationRequestIds ?? []),
      row.candidatePayloadHash ?? null,
      JSON.stringify(row.authorityDecision ?? {}),
      JSON.stringify(row.preflightResult ?? {}),
      JSON.stringify(row.issues ?? []),
      row.engineVersion ?? '3.1.0',
    ],
  );
};

/**
 * @param {string} attemptId
 * @param {object} patch
 */
export const updateEmissionAttemptPg = async (attemptId, patch) => {
  const pool = getPgPool();
  await pool.query(
    `UPDATE fiscal_v3_emission_attempts
     SET attempt_status = COALESCE($2, attempt_status),
         mei_nota_record_id = COALESCE($3, mei_nota_record_id),
         candidate_payload_hash = COALESCE($4, candidate_payload_hash),
         preflight_result_json = COALESCE($5, preflight_result_json),
         issues_json = COALESCE($6, issues_json),
         updated_at = now()
     WHERE attempt_id = $1`,
    [
      attemptId,
      patch.attemptStatus ?? null,
      patch.meiNotaRecordId ?? null,
      patch.candidatePayloadHash ?? null,
      patch.preflightResult ? JSON.stringify(patch.preflightResult) : null,
      patch.issues ? JSON.stringify(patch.issues) : null,
    ],
  );
};

/** @internal testes */
export const __ensureEmissionAttemptSchemaForTests = async () => {
  const pool = getPgPool();
  await pool.query(`
    create table if not exists public.fiscal_v3_emission_attempts (
      id uuid primary key default gen_random_uuid(),
      attempt_id text not null unique,
      empresa_id uuid not null,
      mei_nota_record_id uuid,
      id_integracao text,
      emission_stable_id text not null,
      document_type varchar(16) not null,
      authority_engine varchar(16) not null default 'LEGACY',
      rollout_mode varchar(32),
      canary_selected boolean,
      attempt_status varchar(32) not null,
      preflight_id text,
      allocation_request_ids jsonb not null default '[]'::jsonb,
      candidate_payload_hash text,
      authority_decision_json jsonb not null default '{}'::jsonb,
      preflight_result_json jsonb not null default '{}'::jsonb,
      issues_json jsonb not null default '[]'::jsonb,
      engine_version varchar(16) not null default '3.1.0',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
};

/** @internal testes */
export const __deleteEmissionAttemptsForTests = async (empresaId) => {
  const pool = getPgPool();
  await pool.query('DELETE FROM fiscal_v3_emission_attempts WHERE empresa_id = $1', [empresaId]);
};
