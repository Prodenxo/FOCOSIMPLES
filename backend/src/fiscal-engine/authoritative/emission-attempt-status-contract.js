/**
 * Contrato attempt_status — valores persistidos pela Fase 8A vs migration PostgreSQL.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { EMISSION_ATTEMPT_STATUS } from '../rollout/rollout-constants.js';

/** Status efetivamente gravados em attempt_status pelo código Phase 8A. */
export const PERSISTED_EMISSION_ATTEMPT_STATUSES = Object.freeze([
  EMISSION_ATTEMPT_STATUS.ROUTING_LEGACY,
  EMISSION_ATTEMPT_STATUS.PREFLIGHT_FAILED,
  EMISSION_ATTEMPT_STATUS.AUTHORITATIVE_NOT_ELIGIBLE,
  EMISSION_ATTEMPT_STATUS.AUTHORITY_ASSUMED_V3,
  EMISSION_ATTEMPT_STATUS.PREPARED,
  EMISSION_ATTEMPT_STATUS.EMITTED,
  EMISSION_ATTEMPT_STATUS.REJECTED,
  EMISSION_ATTEMPT_STATUS.REQUEST_OUTCOME_UNKNOWN,
  EMISSION_ATTEMPT_STATUS.CONSUMED,
  EMISSION_ATTEMPT_STATUS.RELEASED,
]);

/** Definidos em EMISSION_ATTEMPT_STATUS mas nunca persistidos em attempt_status. */
export const UNPERSISTED_EMISSION_ATTEMPT_STATUSES = Object.freeze([
  EMISSION_ATTEMPT_STATUS.RESERVED,
]);

const MIGRATION_RELATIVE = join(
  '..',
  '..',
  '..',
  'supabase',
  'migrations',
  '20260813140000_fiscal_v3_emission_attempts.sql',
);

/**
 * Extrai valores do CHECK constraint attempt_status da migration local.
 * @param {string} [migrationPath]
 */
export const readMigrationAttemptStatusCheckValues = (migrationPath = null) => {
  const baseDir = dirname(fileURLToPath(import.meta.url));
  const path = migrationPath ?? join(baseDir, MIGRATION_RELATIVE);
  const sql = readFileSync(path, 'utf8');
  const match = sql.match(/attempt_status in \(([\s\S]*?)\)\s*\)/i);
  if (!match) return [];
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
};

/**
 * @param {string[]} migrationStatuses
 */
export const validatePersistedStatusesAgainstMigration = (migrationStatuses) => {
  const missing = PERSISTED_EMISSION_ATTEMPT_STATUSES.filter((s) => !migrationStatuses.includes(s));
  return {
    ok: missing.length === 0,
    missingInMigration: missing,
    migrationStatuses,
    persistedStatuses: [...PERSISTED_EMISSION_ATTEMPT_STATUSES],
    unpersistedDefinedStatuses: [...UNPERSISTED_EMISSION_ATTEMPT_STATUSES],
  };
};
