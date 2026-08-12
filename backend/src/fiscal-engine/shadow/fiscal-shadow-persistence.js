/**
 * Persistência shadow — in-memory + Postgres fail-open.
 */
import { createFiscalDecisionLogEntry } from '../audit/fiscal-decision-log.js';
import { ENGINE_SCHEMA_VERSION } from '../constants.js';
import { insertShadowComparisonToPg } from './shadow-postgres.repository.js';

/** @type {Map<string, import('./shadow-types.js').FiscalShadowComparison>} */
const comparisonStore = new Map();

/** @type {Set<string>} */
const idempotencyKeys = new Set();

let postgresPersistenceEnabled = true;

/** @internal */
export const __setShadowPostgresPersistenceEnabledForTests = (enabled) => {
  postgresPersistenceEnabled = enabled;
};

/**
 * @param {object} params
 */
export const buildShadowIdempotencyKey = ({
  empresaId,
  correlationId,
  emissionAttemptId,
}) => `${empresaId || 'unknown'}:${correlationId || 'unknown'}:${emissionAttemptId || correlationId || 'unknown'}`;

/**
 * @param {import('./shadow-types.js').FiscalShadowComparison} comparison
 * @param {object} [options]
 */
export const persistShadowComparison = async (comparison, options = {}) => {
  const idempotencyKey = buildShadowIdempotencyKey({
    empresaId: comparison.empresaId,
    correlationId: comparison.correlationId,
    emissionAttemptId: comparison.emissionAttemptId,
  });

  if (options.skipIfDuplicate !== false && idempotencyKeys.has(idempotencyKey)) {
    return {
      persisted: false,
      duplicate: true,
      idempotencyKey,
      storage: 'memory',
      postgres: { persisted: false, duplicate: true },
    };
  }

  comparisonStore.set(comparison.comparisonId, comparison);
  idempotencyKeys.add(idempotencyKey);

  const decisionLog = createFiscalDecisionLogEntry({
    decisionId: comparison.comparisonId,
    contextSnapshot: {
      empresaId: comparison.empresaId,
      correlationId: comparison.correlationId,
      engineSchemaVersion: ENGINE_SCHEMA_VERSION,
      shadowSummary: comparison.summary,
    },
    automaticResult: {
      legacyVersion: comparison.legacyVersion,
      v3Version: comparison.v3Version,
      items: comparison.items,
      legacySnapshots: comparison.legacySnapshots,
      v3Snapshots: comparison.v3Snapshots,
    },
    issues: comparison.executionIssues ?? [],
  });

  let pgResult = { persisted: false, duplicate: false, error: null };
  if (postgresPersistenceEnabled && comparison.empresaId) {
    try {
      pgResult = await insertShadowComparisonToPg(comparison, {
        legacySnapshots: comparison.legacySnapshots,
        v3Snapshots: comparison.v3Snapshots,
      });
    } catch (error) {
      pgResult = {
        persisted: false,
        duplicate: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    persisted: true,
    duplicate: false,
    idempotencyKey,
    decisionLog,
    postgres: pgResult,
    storage: pgResult.persisted ? 'postgres+memory' : 'memory',
  };
};

/**
 * @param {string} comparisonId
 */
export const getShadowComparisonById = (comparisonId) => (
  comparisonStore.get(comparisonId) ?? null
);

/** @internal */
export const __resetShadowPersistenceForTests = () => {
  comparisonStore.clear();
  idempotencyKeys.clear();
  postgresPersistenceEnabled = true;
};

/** @internal */
export const __listShadowComparisonsForTests = () => [...comparisonStore.values()];

/** @internal */
export const __hasShadowIdempotencyKeyForTests = (key) => idempotencyKeys.has(key);
