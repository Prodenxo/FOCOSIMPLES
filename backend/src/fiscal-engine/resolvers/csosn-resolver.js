/**
 * CsosnResolver — CSOSN por regra versionada (Fase 5).
 */
import { FISCAL_RULE_TYPE } from '../types/fiscal-rule.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { CRT, crtSupportsCsosn, getCrtProfile } from '../types/crt.js';
import { resolveFiscalRule } from '../rules/fiscal-rule-engine.js';
import { extractFactsFromContext } from '../resolution/fiscal-context-facts.js';
import { CURRENT_OPERATION_ST } from '../types/st-allocation.js';

/**
 * @param {object} context
 * @param {import('../types/tax-treatment.js').TaxTreatment} treatment
 * @param {import('../types/fiscal-rule.js').FiscalRule[]} rules
 * @param {object} [options]
 */
export const resolveCsosn = (context, treatment, rules, options = {}) => {
  const crt = context.emitente?.crt;

  if (crt === CRT.REGIME_NORMAL) {
    return {
      csosn: null,
      cst: null,
      icmsGroup: null,
      resolved: false,
      audit: { candidateRules: [], matchedRules: [], selectedRule: null, reason: 'crt3_no_csosn' },
      issues: [createFiscalIssue('UNSUPPORTED_SCENARIO', 'CRT 3 (Regime Normal) não utiliza CSOSN.')],
    };
  }

  if (crt === CRT.SIMPLES_EXCESSO) {
    return {
      csosn: null,
      cst: null,
      icmsGroup: null,
      resolved: false,
      audit: { candidateRules: [], matchedRules: [], selectedRule: null, reason: 'crt2_unsupported' },
      issues: [createFiscalIssue('UNSUPPORTED_SCENARIO', 'CRT 2 ainda não suportado para CSOSN.')],
    };
  }

  if (!crtSupportsCsosn(/** @type {import('../types/crt.js').Crt} */ (crt))) {
    return {
      csosn: null,
      cst: null,
      icmsGroup: null,
      resolved: false,
      audit: { candidateRules: [], matchedRules: [], selectedRule: null, reason: 'crt_incompatible' },
      issues: [createFiscalIssue('CRT_INCOMPATIBLE', 'CRT incompatível com CSOSN.')],
    };
  }

  if (crt === CRT.MEI && getCrtProfile(CRT.MEI).rulesetId !== 'crt-4-mei') {
    // sanity — MEI ruleset próprio
  }

  if (treatment.currentOperationSt === CURRENT_OPERATION_ST.UNKNOWN) {
    return {
      csosn: null,
      cst: null,
      icmsGroup: null,
      resolved: false,
      audit: { candidateRules: [], matchedRules: [], selectedRule: null, reason: 'current_st_unknown' },
      issues: [createFiscalIssue(
        'CURRENT_ST_UNKNOWN',
        'CSOSN não pode ser resolvido com currentOperationSt UNKNOWN.',
        { blocksEmission: true, overrideAllowed: true, severity: 'REVIEW' },
      )],
    };
  }

  const facts = extractFactsFromContext(context, treatment);
  const resolution = resolveFiscalRule(rules, FISCAL_RULE_TYPE.CSOSN, facts, options);

  if (!resolution.ok) {
    const issues = [...(resolution.issues ?? [])];
    if (resolution.reason === 'NO_RULE') {
      issues.push(createFiscalIssue(
        'UNSUPPORTED_SCENARIO',
        'Nenhuma regra CSOSN aplicável ao cenário.',
        { blocksEmission: true, overrideAllowed: true, severity: 'REVIEW' },
      ));
    }
    return {
      csosn: null,
      cst: null,
      icmsGroup: null,
      resolved: false,
      ruleRef: null,
      audit: resolution.audit,
      issues,
    };
  }

  return {
    csosn: resolution.result?.csosn ?? null,
    cst: resolution.result?.cst ?? null,
    icmsGroup: resolution.result?.icmsGroup ?? null,
    requiredXmlFields: Array.isArray(resolution.result?.requiredXmlFields)
      ? resolution.result.requiredXmlFields
      : [],
    resolved: Boolean(resolution.result?.csosn || resolution.result?.cst),
    ruleRef: resolution.ruleRef,
    audit: resolution.audit,
    issues: resolution.issues,
    constraints: resolution.result?.csosnConstraints ?? null,
  };
};
