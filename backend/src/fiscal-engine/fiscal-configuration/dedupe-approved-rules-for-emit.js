/**
 * Evita CONFLICT na emissão quando há várias regras APPROVED para o mesmo escopo.
 * Mantém a regra mais recente (approvedAt / updatedAt).
 */
import { ACCOUNTANT_RULE_STATUS } from './constants.js';
import { getMatchConditionsFromRule } from './accountant-rule-conditions.js';

const firstConditionValue = (value) => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

/**
 * @param {object} rule
 */
export const buildAccountantRuleEmitScopeKey = (rule) => {
  const conditions = getMatchConditionsFromRule(rule) ?? rule?.conditions ?? {};
  const productId = firstConditionValue(conditions.productId);
  const operationScope = firstConditionValue(conditions.operationScope);
  const establishmentId = String(rule?.establishmentId ?? '').replace(/\D/g, '');
  return `${establishmentId}|${productId ?? ''}|${operationScope ?? ''}`;
};

const ruleRecencyMs = (rule) => {
  const candidates = [
    rule?.approvedAt,
    rule?.updatedAt,
    rule?.configuredAt,
    rule?.validFrom,
  ];
  for (const value of candidates) {
    const ms = Date.parse(String(value ?? ''));
    if (Number.isFinite(ms)) return ms;
  }
  return 0;
};

/**
 * @param {object[]} rules
 * @returns {object[]}
 */
export const dedupeApprovedAccountantRulesForEmit = (rules) => {
  const list = Array.isArray(rules) ? rules : [];
  /** @type {Map<string, object>} */
  const winners = new Map();

  for (const rule of list) {
    if (rule?.status !== ACCOUNTANT_RULE_STATUS.APPROVED) continue;
    const key = buildAccountantRuleEmitScopeKey(rule);
    const prev = winners.get(key);
    if (!prev || ruleRecencyMs(rule) >= ruleRecencyMs(prev)) {
      winners.set(key, rule);
    }
  }

  return [...winners.values()];
};

/**
 * @param {object[]} rules
 * @param {object} targetRule
 */
export const findSupersededApprovedRulesForScope = (rules, targetRule) => {
  if (!targetRule || targetRule.status !== ACCOUNTANT_RULE_STATUS.APPROVED) return [];
  const key = buildAccountantRuleEmitScopeKey(targetRule);
  return (Array.isArray(rules) ? rules : []).filter((rule) => {
    if (rule.status !== ACCOUNTANT_RULE_STATUS.APPROVED) return false;
    if (rule.id === targetRule.id && rule.version === targetRule.version) return false;
    return buildAccountantRuleEmitScopeKey(rule) === key;
  });
};
