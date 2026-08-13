/**
 * Converte AccountantApprovedFiscalRule APPROVED em FiscalRule[] efêmeras
 * para reutilizar pipeline Phase 5/6 sem inventar tributação.
 *
 * IMPORTANTE: productionReady permanece FALSE — identidade própria via
 * sourceType=ACCOUNTANT_APPROVED_CONFIGURATION + accountantApproved=true.
 */
import { FISCAL_RULE_TYPE } from '../types/fiscal-rule.js';
import { OPERATION_SCOPE, FISCAL_RULE_SOURCE_TYPE } from './constants.js';
import { getMatchConditionsFromRule, getApprovedResultFromRule } from './accountant-rule-conditions.js';

/**
 * Traduz condições da regra aprovada pelo contador para chaves do fiscal-rule-engine.
 * @param {Record<string, unknown>} conditions
 */
export const translateApprovedConditionsToFiscalRuleConditions = (conditions = {}) => {
  /** @type {Record<string, unknown>} */
  const out = { ...conditions };

  if (Array.isArray(conditions.operationScope) && conditions.operationScope.length > 0) {
    const scope = conditions.operationScope[0];
    if (scope === OPERATION_SCOPE.INTERNAL) out.location = ['INTERNA'];
    if (scope === OPERATION_SCOPE.INTERSTATE) out.location = ['INTERESTADUAL'];
    if (scope === OPERATION_SCOPE.FOREIGN) out.location = ['EXTERIOR'];
  }

  delete out.operationScope;
  delete out.crt;
  delete out.productId;
  delete out.customerId;
  delete out.establishmentId;
  delete out.issuerUf;
  delete out.destinationUf;
  delete out.recipientPersonType;
  delete out.recipientFinalConsumer;
  delete out.operationPurpose;
  delete out.origem;
  delete out.cest;
  delete out.ncm;

  return out;
};

/**
 * @param {object} approvedRule
 * @returns {import('../types/fiscal-rule.js').FiscalRule[]}
 */
export const buildFiscalRulesFromApprovedRule = (approvedRule) => {
  const result = getApprovedResultFromRule(approvedRule);
  const matchConditions = getMatchConditionsFromRule(approvedRule);
  const conditions = translateApprovedConditionsToFiscalRuleConditions(matchConditions);
  const crt = approvedRule.conditions?.crt?.[0] ?? approvedRule.crt ?? 1;
  const effectiveFrom = approvedRule.validFrom ?? '2020-01-01';
  const effectiveTo = approvedRule.validUntil ?? undefined;
  const base = {
    schemaVersion: '1.0.0',
    rulePackageId: `accountant-approved-${approvedRule.id}`,
    applicableCrt: [crt],
    effectiveFrom,
    effectiveTo,
    productionReady: false,
    sourceType: FISCAL_RULE_SOURCE_TYPE.ACCOUNTANT_APPROVED_CONFIGURATION,
    accountantApproved: true,
    accountantApprovedRuleId: approvedRule.id,
    accountantApprovedRuleVersion: approvedRule.version ?? 1,
    enabled: true,
    empresaId: approvedRule.tenantId,
    sourceLegalReference: approvedRule.sourceLegalReference ?? `ACCOUNTANT:${approvedRule.id}`,
    sourceRefs: approvedRule.legalSourceRefs ?? [],
  };

  /** @type {import('../types/fiscal-rule.js').FiscalRule[]} */
  const rules = [];

  if (result.currentOperationSt) {
    rules.push({
      ...base,
      id: `${approvedRule.id}@current-st`,
      ruleType: FISCAL_RULE_TYPE.CURRENT_ST,
      priority: 200,
      specificity: approvedRule.baseSpecificity ?? 20,
      conditions: { ...conditions },
      result: { currentOperationSt: result.currentOperationSt },
    });
  }

  if (result.csosn) {
    rules.push({
      ...base,
      id: `${approvedRule.id}@csosn`,
      ruleType: FISCAL_RULE_TYPE.CSOSN,
      priority: 200,
      specificity: approvedRule.baseSpecificity ?? 20,
      conditions: {
        ...conditions,
        ...(result.priorStStatus ? { priorStStatus: [result.priorStStatus] } : {}),
      },
      result: {
        csosn: result.csosn,
        icmsGroup: result.icmsGroup ?? `ICMSSN${result.csosn}`,
        requiredXmlFields: Array.isArray(result.requiredXmlFields) ? result.requiredXmlFields : [],
      },
    });
  }

  if (result.cfop) {
    rules.push({
      ...base,
      id: `${approvedRule.id}@cfop`,
      ruleType: FISCAL_RULE_TYPE.CFOP,
      priority: 200,
      specificity: approvedRule.baseSpecificity ?? 20,
      conditions: { ...conditions },
      result: {
        cfop: result.cfop,
        cfopConstraints: result.cfopConstraints ?? {},
      },
    });
  }

  return rules;
};

/**
 * @param {import('../types/fiscal-rule.js').FiscalRule} rule
 */
export const isAccountantApprovedConfigurationRule = (rule) => (
  rule?.accountantApproved === true
  && rule?.sourceType === FISCAL_RULE_SOURCE_TYPE.ACCOUNTANT_APPROVED_CONFIGURATION
);
