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
export const mapEmissionAttemptPgRow = (row) => {
  if (!row) return null;
  return {
    attemptId: row.attempt_id,
    empresaId: row.empresa_id,
    meiNotaRecordId: row.mei_nota_record_id ?? null,
    idIntegracao: row.id_integracao ?? null,
    emissionStableId: row.emission_stable_id,
    documentType: row.document_type,
    authorityEngine: row.authority_engine,
    rolloutMode: row.rollout_mode ?? null,
    canarySelected: row.canary_selected ?? null,
    attemptStatus: row.attempt_status,
    preflightId: row.preflight_id ?? null,
    allocationRequestIds: row.allocation_request_ids ?? [],
    candidatePayloadHash: row.candidate_payload_hash ?? null,
    authorityDecision: row.authority_decision_json ?? {},
    preflightResult: row.preflight_result_json ?? {},
    issues: row.issues_json ?? [],
    engineVersion: row.engine_version ?? '3.1.0',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
         id_integracao = COALESCE($4, id_integracao),
         candidate_payload_hash = COALESCE($5, candidate_payload_hash),
         preflight_result_json = COALESCE($6, preflight_result_json),
         issues_json = COALESCE($7, issues_json),
         authority_engine = COALESCE($8, authority_engine),
         updated_at = now()
     WHERE attempt_id = $1`,
    [
      attemptId,
      patch.attemptStatus ?? null,
      patch.meiNotaRecordId ?? null,
      patch.idIntegracao ?? null,
      patch.candidatePayloadHash ?? null,
      patch.preflightResult ? JSON.stringify(patch.preflightResult) : null,
      patch.issues ? JSON.stringify(patch.issues) : null,
      patch.authorityEngine ?? null,
    ],
  );
};

/**
 * @param {string} attemptId
 */
export const findEmissionAttemptPg = async (attemptId) => {
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT attempt_id, empresa_id, mei_nota_record_id, id_integracao, emission_stable_id,
            document_type, authority_engine, rollout_mode, canary_selected, attempt_status,
            preflight_id, allocation_request_ids, candidate_payload_hash,
            authority_decision_json, preflight_result_json, issues_json, engine_version,
            created_at, updated_at
     FROM fiscal_v3_emission_attempts
     WHERE attempt_id = $1
     LIMIT 1`,
    [attemptId],
  );
  return mapEmissionAttemptPgRow(result.rows[0] ?? null);
};

/**
 * @param {string} empresaId
 * @param {string} idIntegracao
 */
export const findEmissionAttemptByIdIntegracaoPg = async (empresaId, idIntegracao) => {
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT attempt_id, empresa_id, mei_nota_record_id, id_integracao, emission_stable_id,
            document_type, authority_engine, rollout_mode, canary_selected, attempt_status,
            preflight_id, allocation_request_ids, candidate_payload_hash,
            authority_decision_json, preflight_result_json, issues_json, engine_version,
            created_at, updated_at
     FROM fiscal_v3_emission_attempts
     WHERE empresa_id = $1 AND id_integracao = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [empresaId, idIntegracao],
  );
  return mapEmissionAttemptPgRow(result.rows[0] ?? null);
};

/**
 * @param {string} empresaId
 * @param {string} meiNotaRecordId
 */
export const findEmissionAttemptsByMeiNotaPg = async (empresaId, meiNotaRecordId) => {
  const pool = getPgPool();
  const result = await pool.query(
    `SELECT attempt_id, empresa_id, mei_nota_record_id, id_integracao, emission_stable_id,
            document_type, authority_engine, rollout_mode, canary_selected, attempt_status,
            preflight_id, allocation_request_ids, candidate_payload_hash,
            authority_decision_json, preflight_result_json, issues_json, engine_version,
            created_at, updated_at
     FROM fiscal_v3_emission_attempts
     WHERE empresa_id = $1 AND mei_nota_record_id = $2
     ORDER BY created_at DESC`,
    [empresaId, meiNotaRecordId],
  );
  return result.rows.map(mapEmissionAttemptPgRow);
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
  await pool.query(`
    alter table public.fiscal_v3_emission_attempts
      drop constraint if exists fiscal_v3_emission_attempts_engine_check
  `);
  await pool.query(`
    alter table public.fiscal_v3_emission_attempts
      add constraint fiscal_v3_emission_attempts_engine_check
      check (authority_engine in ('LEGACY', 'V3', 'BLOCKED'))
  `);
};

/** @internal testes */
export const __deleteEmissionAttemptsForTests = async (empresaId) => {
  const pool = getPgPool();
  await pool.query('DELETE FROM fiscal_v3_emission_attempts WHERE empresa_id = $1', [empresaId]);
};
