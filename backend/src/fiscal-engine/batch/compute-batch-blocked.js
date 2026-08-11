/**
 * Batch — bloqueio derivado exclusivamente de issues.blocksEmission.
 */
import { batchBlockedByIssues } from '../types/fiscal-issue.js';
import { deriveResolutionStatusFromIssues } from '../types/resolution-status.js';
import { computeFiscalBatchBlocked } from '../types/fiscal-nfe-item.js';
import { ENGINE_SCHEMA_VERSION } from '../constants.js';

/**
 * @typedef {import('../types/fiscal-nfe-item.js').FiscalNFeItem} FiscalNFeItem
 */

/**
 * @param {FiscalNFeItem[]} items
 */
export const buildFiscalBatchResult = (items) => {
  const list = Array.isArray(items) ? items : [];
  const issues = list.flatMap((item) => item?.issues || []);
  const blocked = computeFiscalBatchBlocked(list);
  const status = deriveResolutionStatusFromIssues(issues);

  return {
    blocked,
    items: list,
    issues,
    status,
    engineSchemaVersion: ENGINE_SCHEMA_VERSION,
  };
};

export { batchBlockedByIssues, computeFiscalBatchBlocked };
