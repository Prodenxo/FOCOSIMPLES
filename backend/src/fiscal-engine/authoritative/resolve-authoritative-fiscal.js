/**
 * Resolução fiscal authoritative — única via AccountantApprovedFiscalRule.
 * Sem fallback para regras automáticas / productionReady genéricas.
 */
import { resolveFiscalFromContextWithAccountantConfig } from '../fiscal-configuration/resolve-with-accountant-config.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { APPROVED_RULE_MATCH_STATUS } from '../fiscal-configuration/constants.js';

/**
 * @param {object[]} contexts
 * @param {object} [options]
 */
export const resolveAuthoritativeFiscalFromContexts = async (contexts, options = {}) => {
  const list = Array.isArray(contexts) ? contexts : [];
  /** @type {import('../types/fiscal-result.js').FiscalResult[]} */
  const results = [];

  for (const context of list) {
    const result = await resolveFiscalFromContextWithAccountantConfig(context, options);
    results.push(result);
  }

  return results;
};

/**
 * Valida que cada resultado authoritative veio de configuração contador.
 * @param {import('../types/fiscal-result.js').FiscalResult} result
 */
export const collectAuthoritativeAccountantConfigIssues = (result) => {
  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */
  const issues = [];
  const config = result.audit?.accountantConfig;

  if (!config?.accountantApprovedRuleId) {
    issues.push(createFiscalIssue(
      'REQUIRES_ACCOUNTANT_REVIEW',
      'Preflight authoritative exige AccountantApprovedFiscalRule — nenhuma regra contador aplicada.',
      { severity: 'ERROR', blocksEmission: true, overrideAllowed: false },
    ));
    return issues;
  }

  if (config.matchStatus && config.matchStatus !== APPROVED_RULE_MATCH_STATUS.MATCHED) {
    issues.push(createFiscalIssue(
      'REQUIRES_ACCOUNTANT_REVIEW',
      `Matching contador incompleto ou ausente: ${config.matchStatus}`,
      { severity: 'ERROR', blocksEmission: true, overrideAllowed: false },
    ));
  }

  return issues;
};
