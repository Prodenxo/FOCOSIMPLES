/**
 * CurrentStLiabilityResolver — ST da operação atual (Fase 5).
 */
import { FISCAL_RULE_TYPE } from '../types/fiscal-rule.js';
import { CURRENT_OPERATION_ST } from '../types/st-allocation.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { CRT, crtSupportsCsosn } from '../types/crt.js';
import { resolveFiscalRule } from '../rules/fiscal-rule-engine.js';
import { extractFactsFromContext } from '../resolution/fiscal-context-facts.js';

/**
 * @param {object} context
 * @param {import('../types/fiscal-rule.js').FiscalRule[]} rules
 * @param {object} [options]
 */
export const resolveCurrentStLiability = (context, rules, options = {}) => {
  const crt = context.emitente?.crt;
  const issues = [];

  if (crt === CRT.SIMPLES_EXCESSO || crt === CRT.REGIME_NORMAL) {
    return {
      currentOperationSt: CURRENT_OPERATION_ST.UNKNOWN,
      resolved: false,
      ruleRef: null,
      audit: { candidateRules: [], matchedRules: [], selectedRule: null, reason: 'crt_unsupported' },
      issues: [
        createFiscalIssue(
          'UNSUPPORTED_SCENARIO',
          `CRT ${crt} ainda não suportado para resolução de ST atual.`,
        ),
      ],
    };
  }

  const facts = extractFactsFromContext(context, {}, options);

  if (facts.supplierCest || facts.catalogCest) {
    // CEST é fato — nunca inferir ST atual a partir dele.
  }

  const resolution = resolveFiscalRule(
    rules,
    FISCAL_RULE_TYPE.CURRENT_ST,
    facts,
    options,
  );

  if (!resolution.ok) {
    if (resolution.reason === 'RULE_CONFLICT') {
      return {
        currentOperationSt: CURRENT_OPERATION_ST.UNKNOWN,
        resolved: false,
        ruleRef: null,
        audit: resolution.audit,
        issues: resolution.issues,
      };
    }

    issues.push(...resolution.issues);
    issues.push(createFiscalIssue(
      'CURRENT_ST_UNKNOWN',
      'ST da operação atual não pôde ser determinada por regra fiscal aplicável.',
    ));

    return {
      currentOperationSt: CURRENT_OPERATION_ST.UNKNOWN,
      resolved: false,
      ruleRef: null,
      audit: resolution.audit,
      issues,
    };
  }

  const currentOperationSt = resolution.result?.currentOperationSt ?? CURRENT_OPERATION_ST.UNKNOWN;
  if (!Object.values(CURRENT_OPERATION_ST).includes(currentOperationSt)) {
    issues.push(createFiscalIssue(
      'CURRENT_ST_UNKNOWN',
      'Regra CURRENT_ST retornou valor inválido.',
    ));
    return {
      currentOperationSt: CURRENT_OPERATION_ST.UNKNOWN,
      resolved: false,
      ruleRef: resolution.ruleRef,
      audit: resolution.audit,
      issues: [...issues, ...resolution.issues],
    };
  }

  return {
    currentOperationSt,
    resolved: currentOperationSt !== CURRENT_OPERATION_ST.UNKNOWN,
    ruleRef: resolution.ruleRef,
    audit: resolution.audit,
    issues: resolution.issues,
  };
};

/** Guard rail export for tests */
export const crtMayResolveCurrentSt = (crt) => crt === CRT.SIMPLES_NACIONAL
  || crt === CRT.MEI
  || crtSupportsCsosn(/** @type {import('../types/crt.js').Crt} */ (crt));
