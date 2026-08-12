/**
 * FiscalResult — saída interna do pipeline Fases 5+6.
 */
import { batchBlockedByIssues } from './fiscal-issue.js';
import { deriveResolutionStatusFromIssues } from './resolution-status.js';

/**
 * @typedef {object} FiscalResolutionBlock
 * @property {import('./st-allocation.js').CURRENT_OPERATION_ST[keyof import('./st-allocation.js').CURRENT_OPERATION_ST] | null} [currentSt]
 * @property {string | null} [csosn]
 * @property {string | null} [cst]
 * @property {string | null} [cfop]
 * @property {Record<string, unknown> | null} [xmlFields]
 */

/**
 * @typedef {object} FiscalResult
 * @property {object} context
 * @property {import('./tax-treatment.js').TaxTreatment | null} treatment
 * @property {FiscalResolutionBlock} resolutions
 * @property {import('./fiscal-nfe-item.js').FiscalNFeItem | null} fiscalNFeItem
 * @property {import('../rules/fiscal-rule-ref.js').FiscalRuleRef[]} ruleRefs
 * @property {import('./fiscal-issue.js').FiscalIssue[]} issues
 * @property {import('./resolution-status.js').ResolutionStatus} resolutionStatus
 * @property {boolean} blocked
 * @property {Record<string, unknown>} audit
 */

/**
 * @param {Partial<FiscalResult>} partial
 * @returns {FiscalResult}
 */
export const buildFiscalResult = (partial = {}) => {
  const issues = Array.isArray(partial.issues) ? partial.issues : [];
  const resolutionStatus = partial.resolutionStatus
    ?? deriveResolutionStatusFromIssues(issues);

  return {
    context: partial.context ?? {},
    treatment: partial.treatment ?? null,
    resolutions: partial.resolutions ?? {},
    fiscalNFeItem: partial.fiscalNFeItem ?? null,
    ruleRefs: partial.ruleRefs ?? [],
    issues,
    resolutionStatus,
    blocked: partial.blocked ?? batchBlockedByIssues(issues),
    audit: partial.audit ?? {},
  };
};
