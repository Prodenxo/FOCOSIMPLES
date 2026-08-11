/**
 * Audit trail de decisões fiscais (Fase 1 — estrutura; persistência opcional).
 */
import { ENGINE_SCHEMA_VERSION } from '../constants.js';
import { deriveResolutionStatusFromIssues } from '../types/resolution-status.js';

/**
 * @typedef {object} FiscalDecision
 * @property {string} decisionId
 * @property {string} engineSchemaVersion
 * @property {string} createdAt
 * @property {import('../types/resolution-status.js').ResolutionStatus} status
 * @property {import('../types/fiscal-issue.js').FiscalIssue[]} issues
 * @property {Record<string, unknown>} [contextSnapshot]
 * @property {Record<string, unknown>} [automaticResult]
 * @property {Record<string, unknown>} [finalResult]
 * @property {string[]} [motivoCfop]
 * @property {string[]} [motivoCsosn]
 * @property {import('../rules/fiscal-rule-ref.js').FiscalRuleRef[]} [regrasAplicadas]
 */

/**
 * @param {object} params
 */
export const createFiscalDecisionLogEntry = ({
  decisionId,
  contextSnapshot = null,
  automaticResult = null,
  issues = [],
  motivoCfop = [],
  motivoCsosn = [],
  regrasAplicadas = [],
}) => {
  const list = Array.isArray(issues) ? issues : [];
  return {
    decisionId: String(decisionId || cryptoRandomId()),
    engineSchemaVersion: ENGINE_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    status: deriveResolutionStatusFromIssues(list),
    issues: list,
    contextSnapshot,
    automaticResult,
    finalResult: automaticResult,
    motivoCfop,
    motivoCsosn,
    regrasAplicadas,
  };
};

/**
 * @param {FiscalDecision} decision
 */
export const serializeFiscalDecision = (decision) => JSON.stringify(decision);

const cryptoRandomId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `fd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};
