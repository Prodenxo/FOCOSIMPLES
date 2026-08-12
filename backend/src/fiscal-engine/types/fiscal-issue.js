/**
 * Problemas fiscais normalizados — separados de ResolutionStatus.
 */

/** @typedef {'INFO' | 'WARNING' | 'REVIEW' | 'ERROR'} FiscalIssueSeverity */

/**
 * @typedef {(
 *   | 'RULE_CONFLICT'
 *   | 'CEST_CONFLICT'
 *   | 'RULE_NOT_PRODUCTION_READY'
 *   | 'ORIGIN_UNKNOWN'
 *   | 'PRIOR_ST_UNKNOWN'
 *   | 'CURRENT_ST_UNKNOWN'
 *   | 'ITEM_SOURCE_UNKNOWN'
 *   | 'ICMS_TAXPAYER_STATUS_UNKNOWN'
 *   | 'REQUIRED_FIELD_MISSING'
 *   | 'CRT_INCOMPATIBLE'
 *   | 'UNSUPPORTED_SCENARIO'
 *   | 'ST_ALLOCATION_STRATEGY_MISSING'
 *   | 'SCHEMA_INVALID'
 *   | 'XML_INVALID'
 *   | 'FISCAL_COMBINATION_FORBIDDEN'
 *   | 'PURCHASE_RECIPIENT_MISMATCH'
 *   | 'SUPPLIER_CEST_EVIDENCE'
 *   | 'XML_SIGNATURE_INVALID'
 *   | 'XML_SIGNATURE_UNVERIFIED'
  | 'PROTOCOL_DIGEST_MISMATCH'
  | 'INSUFFICIENT_USABLE_FISCAL_STOCK'
  | 'STOCK_LOT_NOT_USABLE'
  | 'STOCK_ALLOCATION_CONFLICT'
  | 'ALLOCATION_IDEMPOTENCY_CONFLICT'
  | 'ALLOCATION_QUANTITY_PRECISION_INVALID'
  | 'CROSS_TENANT_ACCESS'
  | 'STOCK_UNIT_UNCONFIRMED'
 * )} FiscalIssueCode
 */

/**
 * @typedef {object} FiscalIssue
 * @property {FiscalIssueCode} code
 * @property {FiscalIssueSeverity} severity
 * @property {boolean} blocksEmission
 * @property {boolean} overrideAllowed
 * @property {string} message
 * @property {import('../rules/fiscal-rule-ref.js').FiscalRuleRef[]} [ruleRefs]
 * @property {Record<string, unknown>} [meta]
 */

/** Presets determinísticos por código (podem ser refinados por contexto). */
export const FISCAL_ISSUE_PRESETS = Object.freeze({
  RULE_CONFLICT: {
    severity: 'ERROR',
    blocksEmission: true,
    overrideAllowed: false,
  },
  CEST_CONFLICT: {
    severity: 'REVIEW',
    blocksEmission: true,
    overrideAllowed: true,
  },
  RULE_NOT_PRODUCTION_READY: {
    severity: 'ERROR',
    blocksEmission: true,
    overrideAllowed: false,
  },
  ORIGIN_UNKNOWN: {
    severity: 'REVIEW',
    blocksEmission: true,
    overrideAllowed: true,
  },
  PRIOR_ST_UNKNOWN: {
    severity: 'REVIEW',
    blocksEmission: true,
    overrideAllowed: true,
  },
  CURRENT_ST_UNKNOWN: {
    severity: 'REVIEW',
    blocksEmission: true,
    overrideAllowed: true,
  },
  ITEM_SOURCE_UNKNOWN: {
    severity: 'REVIEW',
    blocksEmission: true,
    overrideAllowed: true,
  },
  ICMS_TAXPAYER_STATUS_UNKNOWN: {
    severity: 'REVIEW',
    blocksEmission: true,
    overrideAllowed: true,
  },
  REQUIRED_FIELD_MISSING: {
    severity: 'ERROR',
    blocksEmission: true,
    overrideAllowed: false,
  },
  CRT_INCOMPATIBLE: {
    severity: 'ERROR',
    blocksEmission: true,
    overrideAllowed: false,
  },
  UNSUPPORTED_SCENARIO: {
    severity: 'ERROR',
    blocksEmission: true,
    overrideAllowed: false,
  },
  ST_ALLOCATION_STRATEGY_MISSING: {
    severity: 'REVIEW',
    blocksEmission: true,
    overrideAllowed: true,
  },
  SCHEMA_INVALID: {
    severity: 'ERROR',
    blocksEmission: true,
    overrideAllowed: false,
  },
  XML_INVALID: {
    severity: 'ERROR',
    blocksEmission: true,
    overrideAllowed: false,
  },
  FISCAL_COMBINATION_FORBIDDEN: {
    severity: 'ERROR',
    blocksEmission: true,
    overrideAllowed: false,
  },
  PURCHASE_RECIPIENT_MISMATCH: {
    severity: 'ERROR',
    blocksEmission: true,
    overrideAllowed: false,
  },
  SUPPLIER_CEST_EVIDENCE: {
    severity: 'INFO',
    blocksEmission: false,
    overrideAllowed: false,
  },
  XML_SIGNATURE_INVALID: {
    severity: 'ERROR',
    blocksEmission: true,
    overrideAllowed: false,
  },
  XML_SIGNATURE_UNVERIFIED: {
    severity: 'WARNING',
    blocksEmission: false,
    overrideAllowed: false,
  },
  PROTOCOL_DIGEST_MISMATCH: {
    severity: 'ERROR',
    blocksEmission: true,
    overrideAllowed: false,
  },
  INSUFFICIENT_USABLE_FISCAL_STOCK: {
    severity: 'ERROR',
    blocksEmission: true,
    overrideAllowed: false,
  },
  STOCK_LOT_NOT_USABLE: {
    severity: 'ERROR',
    blocksEmission: true,
    overrideAllowed: false,
  },
  STOCK_ALLOCATION_CONFLICT: {
    severity: 'ERROR',
    blocksEmission: true,
    overrideAllowed: false,
  },
  ALLOCATION_IDEMPOTENCY_CONFLICT: {
    severity: 'ERROR',
    blocksEmission: true,
    overrideAllowed: false,
  },
  ALLOCATION_QUANTITY_PRECISION_INVALID: {
    severity: 'ERROR',
    blocksEmission: true,
    overrideAllowed: false,
  },
  CROSS_TENANT_ACCESS: {
    severity: 'ERROR',
    blocksEmission: true,
    overrideAllowed: false,
  },
  STOCK_UNIT_UNCONFIRMED: {
    severity: 'ERROR',
    blocksEmission: true,
    overrideAllowed: false,
  },
});

/**
 * @param {FiscalIssueCode} code
 * @param {string} message
 * @param {Partial<FiscalIssue>} [overrides]
 * @returns {FiscalIssue}
 */
export const createFiscalIssue = (code, message, overrides = {}) => {
  const preset = FISCAL_ISSUE_PRESETS[code] || {
    severity: 'ERROR',
    blocksEmission: true,
    overrideAllowed: false,
  };
  return {
    code,
    message: String(message || code),
    severity: /** @type {FiscalIssueSeverity} */ (overrides.severity ?? preset.severity),
    blocksEmission: overrides.blocksEmission ?? preset.blocksEmission,
    overrideAllowed: overrides.overrideAllowed ?? preset.overrideAllowed,
    ruleRefs: overrides.ruleRefs ?? [],
    meta: overrides.meta,
  };
};

/**
 * @param {FiscalIssue[]} issues
 */
export const batchBlockedByIssues = (issues) => (
  (Array.isArray(issues) ? issues : []).some((issue) => issue?.blocksEmission === true)
);
