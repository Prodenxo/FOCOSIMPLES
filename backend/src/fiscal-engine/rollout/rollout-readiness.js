/**
 * Agregação operacional de readiness — shadow match NÃO prova correção jurídica.
 */
import { SHADOW_DIFFERENCE_CODE } from '../shadow/shadow-constants.js';
import { SHADOW_EXECUTION_STATUS } from '../shadow/shadow-constants.js';
import { FISCAL_ENGINE_SCHEMA_VERSION } from '../constants.js';

/** @type {import('../shadow/fiscal-shadow-persistence.js').ShadowComparisonRecord[]} */
let inMemoryComparisons = [];

/** @internal */
export const __seedShadowComparisonsForReadinessTests = (rows) => {
  inMemoryComparisons = Array.isArray(rows) ? [...rows] : [];
};

/** @internal */
export const __resetReadinessDataForTests = () => {
  inMemoryComparisons = [];
};

/**
 * @param {object} comparison
 */
const classifyComparison = (comparison) => {
  const executionStatus = String(comparison.executionStatus ?? comparison.execution_status ?? '');
  if (executionStatus === SHADOW_EXECUTION_STATUS.ERROR) return 'execution_errors';
  if (executionStatus === SHADOW_EXECUTION_STATUS.TIMEOUT) return 'execution_errors';
  if (executionStatus === SHADOW_EXECUTION_STATUS.SKIPPED) return 'skipped';

  const diffCodes = (comparison.differences ?? comparison.differences_json ?? [])
    .map((d) => d.code ?? d);
  const issues = comparison.issues ?? comparison.issues_json ?? [];

  if (diffCodes.includes(SHADOW_DIFFERENCE_CODE.V3_BLOCKED)) return 'blocked';
  if (diffCodes.includes(SHADOW_DIFFERENCE_CODE.V3_UNRESOLVED)) return 'unresolved';
  if (diffCodes.includes(SHADOW_DIFFERENCE_CODE.SHADOW_ALLOCATION_UNAVAILABLE)) return 'allocation_unavailable';
  if (diffCodes.includes(SHADOW_DIFFERENCE_CODE.ITEM_SPLIT_DIFFERENT)) return 'splits';
  if (issues.some((i) => i.code === 'RULE_CONFLICT')) return 'rule_conflicts';

  const fiscalDiffs = diffCodes.filter((c) => (
    c !== SHADOW_DIFFERENCE_CODE.EXACT_MATCH
    && c !== SHADOW_DIFFERENCE_CODE.ROUNDING_ONLY_DIFFERENCE
  ));
  if (fiscalDiffs.length) return 'divergences';

  return 'resolved';
};

/**
 * @param {string} empresaId
 * @param {object} [options]
 */
export const evaluateFiscalV3RolloutReadiness = async (empresaId, options = {}) => {
  const windowDays = Number(options.windowDays ?? 30);
  const since = options.since ?? new Date(Date.now() - windowDays * 86400000).toISOString();

  const rows = inMemoryComparisons.filter((row) => {
    if (String(row.empresaId ?? row.empresa_id) !== String(empresaId)) return false;
    const created = row.createdAt ?? row.created_at;
    if (created && created < since) return false;
    return true;
  });

  const stats = {
    totalComparisons: rows.length,
    resolved: 0,
    unresolved: 0,
    blocked: 0,
    executionErrors: 0,
    ruleConflicts: 0,
    allocationUnavailable: 0,
    divergences: 0,
    splits: 0,
    skipped: 0,
    engineVersionObserved: FISCAL_ENGINE_SCHEMA_VERSION,
    windowDays,
    since,
  };

  for (const row of rows) {
    const bucket = classifyComparison(row);
    if (bucket === 'resolved') stats.resolved += 1;
    else if (bucket === 'unresolved') stats.unresolved += 1;
    else if (bucket === 'blocked') stats.blocked += 1;
    else if (bucket === 'execution_errors') stats.executionErrors += 1;
    else if (bucket === 'rule_conflicts') stats.ruleConflicts += 1;
    else if (bucket === 'allocation_unavailable') stats.allocationUnavailable += 1;
    else if (bucket === 'divergences') stats.divergences += 1;
    else if (bucket === 'splits') stats.splits += 1;
    else if (bucket === 'skipped') stats.skipped += 1;

    const v = row.v3Version ?? row.v3_version ?? row.engineSchemaVersion;
    if (v) stats.engineVersionObserved = String(v);
  }

  return {
    empresaId,
    stats,
    ready: false,
    reasons: [],
  };
};

/**
 * Gate operacional — não certifica legalidade.
 * @param {object} readiness
 * @param {object} policy
 */
export const assessReadinessGate = (readiness, policy) => {
  const reasons = [];
  const minSamples = Number(policy.minimumShadowSamples ?? 0);

  if (policy.readinessRequired !== false && minSamples > 0) {
    if (readiness.stats.totalComparisons < minSamples) {
      reasons.push(`INSUFFICIENT_SHADOW_SAMPLES:${readiness.stats.totalComparisons}<${minSamples}`);
    }
  }

  if (readiness.stats.executionErrors > 0) {
    reasons.push(`EXECUTION_ERRORS:${readiness.stats.executionErrors}`);
  }

  if (readiness.stats.blocked > 0) {
    reasons.push(`BLOCKED_COMPARISONS:${readiness.stats.blocked}`);
  }

  const ready = reasons.length === 0;
  return { ready, reasons };
};
