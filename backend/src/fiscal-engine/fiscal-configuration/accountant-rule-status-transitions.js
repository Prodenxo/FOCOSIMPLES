/**
 * Transições válidas de status — AccountantApprovedFiscalRule.
 */
import { ACCOUNTANT_RULE_STATUS } from './constants.js';

const VALID_TRANSITIONS = Object.freeze({
  [ACCOUNTANT_RULE_STATUS.DRAFT]: new Set([ACCOUNTANT_RULE_STATUS.APPROVED]),
  [ACCOUNTANT_RULE_STATUS.APPROVED]: new Set([
    ACCOUNTANT_RULE_STATUS.SUSPENDED,
    ACCOUNTANT_RULE_STATUS.REVOKED,
    ACCOUNTANT_RULE_STATUS.EXPIRED,
  ]),
  [ACCOUNTANT_RULE_STATUS.SUSPENDED]: new Set([
    ACCOUNTANT_RULE_STATUS.APPROVED,
    ACCOUNTANT_RULE_STATUS.REVOKED,
  ]),
  [ACCOUNTANT_RULE_STATUS.REVOKED]: new Set([]),
  [ACCOUNTANT_RULE_STATUS.EXPIRED]: new Set([]),
});

/**
 * @param {string} fromStatus
 * @param {string} toStatus
 */
export const isValidAccountantRuleStatusTransition = (fromStatus, toStatus) => (
  VALID_TRANSITIONS[fromStatus]?.has(toStatus) ?? false
);

/**
 * @param {string} fromStatus
 * @param {string} toStatus
 */
export const assertValidAccountantRuleStatusTransition = (fromStatus, toStatus) => {
  if (!isValidAccountantRuleStatusTransition(fromStatus, toStatus)) {
    throw new Error(
      `Transição inválida: ${fromStatus} → ${toStatus}`,
    );
  }
};
