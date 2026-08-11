/**
 * Status normalizado do motor fiscal (workflow).
 * Problemas específicos são FiscalIssue — não statuses adicionais.
 */

/** @typedef {'OK' | 'NEEDS_REVIEW' | 'UNSUPPORTED_SCENARIO' | 'ERROR'} ResolutionStatus */

export const RESOLUTION_STATUS = Object.freeze({
  OK: 'OK',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  UNSUPPORTED_SCENARIO: 'UNSUPPORTED_SCENARIO',
  ERROR: 'ERROR',
});

/** @param {unknown} value */
export const isResolutionStatus = (value) => (
  Object.values(RESOLUTION_STATUS).includes(String(value))
);

/**
 * Deriva ResolutionStatus a partir de issues (prioridade decrescente).
 * @param {import('./fiscal-issue.js').FiscalIssue[]} issues
 * @returns {ResolutionStatus}
 */
export const deriveResolutionStatusFromIssues = (issues) => {
  const list = Array.isArray(issues) ? issues : [];
  if (list.some((issue) => issue?.severity === 'ERROR' && issue?.blocksEmission)) {
    return RESOLUTION_STATUS.ERROR;
  }
  if (list.some((issue) => issue?.severity === 'REVIEW' && issue?.blocksEmission)) {
    return RESOLUTION_STATUS.NEEDS_REVIEW;
  }
  if (list.some((issue) => issue?.code === 'UNSUPPORTED_SCENARIO')) {
    return RESOLUTION_STATUS.UNSUPPORTED_SCENARIO;
  }
  if (list.some((issue) => issue?.blocksEmission)) {
    return RESOLUTION_STATUS.NEEDS_REVIEW;
  }
  return RESOLUTION_STATUS.OK;
};
