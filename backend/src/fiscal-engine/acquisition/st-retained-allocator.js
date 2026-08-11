/**
 * Rateio de ST retida — strategy pattern; PROPORTIONAL_QTY implementado.
 */
import { ST_ALLOCATION_METHOD } from '../types/st-allocation.js';
import { proportionalAllocate, toDecimal } from '../money/decimal.js';
import { formatFieldByPolicy } from '../money/decimal-field-policy.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';

/**
 * @typedef {object} StRetainedSourceValues
 * @property {string} [vBCSTRet]
 * @property {string} [vICMSSTRet]
 * @property {string} [pST]
 * @property {string} [vBCFCPSTRet]
 * @property {string} [vFCPSTRet]
 * @property {string} [pFCPSTRet]
 * @property {string} [vICMSSubstituto]
 */

/**
 * @param {object} params
 * @param {StRetainedSourceValues} params.purchaseValues
 * @param {string} params.purchaseTotalQty
 * @param {string} params.allocatedQty
 * @param {string} params.remainingQty
 * @param {StAllocationMethod} [params.method]
 * @param {string} [params.effectiveDate]
 */
export const allocateStRetainedValues = ({
  purchaseValues,
  purchaseTotalQty,
  allocatedQty,
  remainingQty,
  method = ST_ALLOCATION_METHOD.PROPORTIONAL_QTY,
  effectiveDate,
}) => {
  if (method === ST_ALLOCATION_METHOD.DIRECT_IDENTIFIED) {
    return {
      ok: true,
      allocationMethod: method,
      allocatedValues: { ...purchaseValues },
      audit: { method, ratio: '1/1' },
      issues: [],
    };
  }

  if (method === ST_ALLOCATION_METHOD.RULE_DEFINED || method === ST_ALLOCATION_METHOD.MANUAL_VALIDATED) {
    return {
      ok: false,
      allocationMethod: method,
      allocatedValues: null,
      audit: { method },
      issues: [createFiscalIssue(
        'ST_ALLOCATION_STRATEGY_MISSING',
        `Estratégia ${method} não implementada nesta fase — NEEDS_REVIEW`,
      )],
    };
  }

  if (method !== ST_ALLOCATION_METHOD.PROPORTIONAL_QTY) {
    return {
      ok: false,
      allocationMethod: method,
      allocatedValues: null,
      audit: {},
      issues: [createFiscalIssue(
        'ST_ALLOCATION_STRATEGY_MISSING',
        'Estratégia de rateio ST não definida',
      )],
    };
  }

  const total = toDecimal(purchaseTotalQty);
  if (total.isZero()) {
    return {
      ok: false,
      allocationMethod: method,
      allocatedValues: null,
      audit: {},
      issues: [createFiscalIssue('REQUIRED_FIELD_MISSING', 'Quantidade total da compra é zero')],
    };
  }

  const ratio = `${allocatedQty}/${purchaseTotalQty}`;
  const numericFields = ['vBCSTRet', 'vICMSSTRet', 'vBCFCPSTRet', 'vFCPSTRet', 'vICMSSubstituto'];
  const rateFields = ['pST', 'pFCPSTRet'];

  /** @type {Record<string, string>} */
  const allocatedValues = {};
  const roundingRecords = [];

  for (const field of numericFields) {
    const raw = purchaseValues?.[field];
    if (raw == null || raw === '') continue;
    const allocated = proportionalAllocate(raw, allocatedQty, purchaseTotalQty, 2);
    allocatedValues[field] = formatFieldByPolicy(allocated, 'vBC', effectiveDate);
    roundingRecords.push({ field, original: raw, allocated: allocatedValues[field], ratio });
  }

  for (const field of rateFields) {
    if (purchaseValues?.[field]) allocatedValues[field] = String(purchaseValues[field]);
  }

  return {
    ok: true,
    allocationMethod: ST_ALLOCATION_METHOD.PROPORTIONAL_QTY,
    allocatedValues,
    remainingQty: String(remainingQty),
    audit: {
      method: ST_ALLOCATION_METHOD.PROPORTIONAL_QTY,
      ratio,
      purchaseValues,
      roundingRecords,
    },
    issues: [],
  };
};
