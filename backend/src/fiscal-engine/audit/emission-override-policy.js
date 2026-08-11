/**
 * Política de override de emissão (Fase 1).
 * Permitido apenas para NEEDS_REVIEW revisável — nunca RULE_CONFLICT.
 */
import { RESOLUTION_STATUS } from '../types/resolution-status.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';

export const EMISSION_OVERRIDE_PERMISSION = 'FISCAL_REVIEW_OVERRIDE';

/** Códigos que nunca permitem override */
const NON_OVERRIDABLE_CODES = new Set([
  'RULE_CONFLICT',
  'SCHEMA_INVALID',
  'XML_INVALID',
  'REQUIRED_FIELD_MISSING',
  'FISCAL_COMBINATION_FORBIDDEN',
  'CRT_INCOMPATIBLE',
  'UNSUPPORTED_SCENARIO',
  'RULE_NOT_PRODUCTION_READY',
]);

/**
 * @param {import('../types/fiscal-issue.js').FiscalIssue[]} issues
 */
export const canOverrideFiscalResult = (issues) => {
  const list = Array.isArray(issues) ? issues : [];
  if (list.length === 0) return false;
  if (list.some((issue) => NON_OVERRIDABLE_CODES.has(String(issue?.code)))) return false;
  if (list.some((issue) => issue?.overrideAllowed === false)) return false;
  return list.every((issue) => issue?.overrideAllowed === true);
};

/**
 * @param {object} params
 * @param {import('../audit/fiscal-decision-log.js').FiscalDecision} params.originalDecision
 * @param {import('../audit/fiscal-decision-log.js').FiscalDecision} params.finalDecision
 * @param {string} params.userId
 * @param {string} params.justification
 * @param {string} [params.permission]
 */
export const validateEmissionOverride = ({
  originalDecision,
  finalDecision,
  userId,
  justification,
  permission,
}) => {
  const errors = [];

  if (!userId) errors.push('userId obrigatório para override');
  if (!String(justification || '').trim()) errors.push('justificativa obrigatória');
  if (permission !== EMISSION_OVERRIDE_PERMISSION) {
    errors.push(`permissão ${EMISSION_OVERRIDE_PERMISSION} necessária`);
  }

  const originalIssues = originalDecision?.issues || [];
  if (originalDecision?.status === RESOLUTION_STATUS.ERROR
    && originalIssues.some((i) => i.code === 'RULE_CONFLICT')) {
    errors.push(createFiscalIssue(
      'RULE_CONFLICT',
      'Override proibido para RULE_CONFLICT.',
    ));
  }

  if (!canOverrideFiscalResult(originalIssues)) {
    errors.push(createFiscalIssue(
      'FISCAL_COMBINATION_FORBIDDEN',
      'Issues atuais não permitem override.',
    ));
  }

  if (!finalDecision) errors.push('finalDecision obrigatório');

  return {
    ok: errors.length === 0,
    errors,
    auditEntry: errors.length === 0 ? {
      userId,
      timestamp: new Date().toISOString(),
      originalDecision,
      finalDecision,
      justification: String(justification).trim(),
      rulesInvolved: [
        ...(originalDecision?.regrasAplicadas || []),
        ...(finalDecision?.regrasAplicadas || []),
      ],
      permission,
    } : null,
  };
};
