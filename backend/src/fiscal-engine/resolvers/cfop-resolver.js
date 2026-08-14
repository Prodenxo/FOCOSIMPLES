/**
 * CfopResolver — CFOP por regra versionada (Fase 5).
 */
import { FISCAL_RULE_TYPE } from '../types/fiscal-rule.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { resolveFiscalRule } from '../rules/fiscal-rule-engine.js';
import { extractFactsFromContext } from '../resolution/fiscal-context-facts.js';

/**
 * @param {object} context
 * @param {import('../types/tax-treatment.js').TaxTreatment} treatment
 * @param {import('../types/fiscal-rule.js').FiscalRule[]} rules
 * @param {object} [options]
 */
export const resolveCfop = (context, treatment, rules, options = {}) => {
  const location = context.operacao?.localizacao ?? treatment.location;

  if (!location || location === 'UNKNOWN') {
    return {
      cfop: null,
      resolved: false,
      audit: { candidateRules: [], matchedRules: [], selectedRule: null, reason: 'location_unknown' },
      issues: [createFiscalIssue(
        'REQUIRED_FIELD_MISSING',
        'CFOP não pode ser resolvido com localização UNKNOWN.',
        { meta: { field: 'operacao.localizacao' }, severity: 'REVIEW', blocksEmission: true, overrideAllowed: true },
      )],
    };
  }

  const facts = extractFactsFromContext(context, treatment, options);
  const resolution = resolveFiscalRule(rules, FISCAL_RULE_TYPE.CFOP, facts, options);

  if (!resolution.ok) {
    const issues = [...(resolution.issues ?? [])];
    if (resolution.reason === 'NO_RULE') {
      issues.push(createFiscalIssue(
        'UNSUPPORTED_SCENARIO',
        'Nenhuma regra CFOP aplicável ao cenário.',
        { blocksEmission: true, overrideAllowed: true, severity: 'REVIEW' },
      ));
    }
    return {
      cfop: null,
      resolved: false,
      ruleRef: null,
      audit: resolution.audit,
      issues,
    };
  }

  return {
    cfop: resolution.result?.cfop ?? null,
    resolved: Boolean(resolution.result?.cfop),
    ruleRef: resolution.ruleRef,
    audit: resolution.audit,
    issues: resolution.issues,
    constraints: resolution.result?.cfopConstraints ?? null,
  };
};
