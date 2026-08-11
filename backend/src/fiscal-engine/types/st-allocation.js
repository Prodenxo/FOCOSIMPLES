/**
 * Estratégias de rateio de ST retida — não fixar PROPORTIONAL_QTY como única opção.
 */

/** @typedef {'DIRECT_IDENTIFIED' | 'PROPORTIONAL_QTY' | 'RULE_DEFINED' | 'MANUAL_VALIDATED'} StAllocationMethod */

export const ST_ALLOCATION_METHOD = Object.freeze({
  DIRECT_IDENTIFIED: 'DIRECT_IDENTIFIED',
  PROPORTIONAL_QTY: 'PROPORTIONAL_QTY',
  RULE_DEFINED: 'RULE_DEFINED',
  MANUAL_VALIDATED: 'MANUAL_VALIDATED',
});

/**
 * @typedef {object} StRetainedAllocation
 * @property {string} purchaseItemId
 * @property {string} allocatedQty
 * @property {string} [purchaseTotalQty]
 * @property {string} [remainingQty]
 * @property {StAllocationMethod} allocationMethod
 * @property {Record<string, string>} [allocatedValues]
 * @property {Record<string, unknown>} [allocationAudit]
 */

/**
 * @typedef {object} PriorStStatus
 * @typedef {'RETAINED' | 'NO_ST_EVIDENCE' | 'UNKNOWN'} PriorStStatusValue
 */

export const PRIOR_ST_STATUS = Object.freeze({
  RETAINED: 'RETAINED',
  NO_ST_EVIDENCE: 'NO_ST_EVIDENCE',
  UNKNOWN: 'UNKNOWN',
});

export const CURRENT_OPERATION_ST = Object.freeze({
  DUE_BY_ISSUER: 'DUE_BY_ISSUER',
  NOT_DUE: 'NOT_DUE',
  UNKNOWN: 'UNKNOWN',
});

/**
 * @param {PriorStStatusValue} prior
 * @param {keyof typeof CURRENT_OPERATION_ST} current
 */
export const buildStScenarioKey = (prior, current) => `${prior}+${current}`;
