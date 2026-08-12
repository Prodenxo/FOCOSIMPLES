/**
 * Métricas internas do shadow mode (Fase 7A) — agregação futura.
 */

/** @type {Record<string, number>} */
const counters = Object.create(null);

const inc = (key, delta = 1) => {
  counters[key] = (counters[key] ?? 0) + delta;
};

/**
 * @param {import('./shadow-types.js').FiscalShadowComparison} comparison
 */
export const recordShadowComparisonMetrics = (comparison) => {
  if (comparison.executionStatus === 'ERROR') {
    inc('shadowFailed');
    return;
  }
  if (comparison.executionStatus === 'SKIPPED') return;

  inc('shadowExecuted');
  const summary = comparison.summary ?? {};

  inc('exactMatch', summary.exactMatches ?? 0);
  inc('differenceCount', summary.differences ?? 0);
  inc('v3Unresolved', summary.v3Unresolved ?? 0);
  inc('v3Blocked', summary.v3Blocked ?? 0);
  inc('cfopDifference', summary.cfopDifference ?? 0);
  inc('csosnDifference', summary.csosnDifference ?? 0);
  inc('stDifference', summary.stDifference ?? 0);
  inc('splitDifference', summary.splitDifference ?? 0);

  for (const item of comparison.items ?? []) {
    const resolved = item.v3Items?.some((v) => v.cfop || v.csosn);
    if (resolved) inc('v3Resolved');
    else inc('v3Unresolved');
  }
};

export const getShadowMetricsSnapshot = () => ({ ...counters });

/** @internal */
export const __resetShadowMetricsForTests = () => {
  for (const key of Object.keys(counters)) delete counters[key];
};
