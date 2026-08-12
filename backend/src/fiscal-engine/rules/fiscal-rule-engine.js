/**
 * Motor de seleção determinística de regras fiscais versionadas.
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { fiscalRuleRef } from './fiscal-rule-ref.js';
import { validateFiscalRuleShape } from '../schemas/validate-shapes.js';
import { normalizeResolverOptions } from './fiscal-rule-execution-policy.js';

/**
 * @param {import('../types/fiscal-rule.js').FiscalRule} rule
 */
export const computeRuleSpecificity = (rule) => {
  const base = Number(rule.specificity ?? 0);
  const conditions = rule.conditions && typeof rule.conditions === 'object'
    ? rule.conditions
    : {};
  let conditionCount = 0;
  for (const value of Object.values(conditions)) {
    if (value == null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    conditionCount += 1;
  }
  return base + conditionCount;
};

/**
 * @param {import('../types/fiscal-rule.js').FiscalRule} rule
 * @param {string | null | undefined} referenceDate
 */
export const isRuleEffectiveOn = (rule, referenceDate) => {
  const ref = String(referenceDate ?? '').slice(0, 10);
  if (!ref) return false;
  if (rule.effectiveFrom && ref < String(rule.effectiveFrom).slice(0, 10)) return false;
  if (rule.effectiveTo && ref > String(rule.effectiveTo).slice(0, 10)) return false;
  return true;
};

/**
 * @param {import('../types/fiscal-rule.js').FiscalRule} rule
 * @param {Record<string, unknown>} facts
 */
export const ruleMatchesFacts = (rule, facts) => {
  if (rule.enabled === false) return false;
  if (!isRuleEffectiveOn(rule, /** @type {string} */ (facts.referenceDate))) return false;
  if (!Array.isArray(rule.applicableCrt) || !rule.applicableCrt.includes(/** @type {number} */ (facts.crt))) {
    return false;
  }

  const ruleEmpresaId = rule.empresaId ?? null;
  const factEmpresaId = facts.empresaId ?? null;
  if (ruleEmpresaId && ruleEmpresaId !== factEmpresaId) return false;

  const conditions = rule.conditions && typeof rule.conditions === 'object'
    ? rule.conditions
    : {};

  for (const [key, expected] of Object.entries(conditions)) {
    const actual = facts[key];
    if (expected == null) continue;
    if (Array.isArray(expected)) {
      if (!expected.includes(actual)) return false;
      continue;
    }
    if (typeof expected === 'boolean') {
      if (Boolean(actual) !== expected) return false;
      continue;
    }
    if (actual !== expected) return false;
  }

  return true;
};

/**
 * @param {import('../types/fiscal-rule.js').FiscalRule[]} rules
 * @param {import('../types/fiscal-rule.js').FiscalRuleType} ruleType
 * @param {Record<string, unknown>} facts
 * @param {object} [options]
 * @param {boolean} [options.allowNonProductionRules]
 */
export const resolveFiscalRule = (rules, ruleType, facts, options = {}) => {
  const { allowNonProductionRules } = normalizeResolverOptions(options);

  /** @type {import('../types/fiscal-rule.js').RuleResolutionAudit & { rejectedNonProductionRules?: string[] }} */
  const audit = {
    candidateRules: [],
    matchedRules: [],
    selectedRule: null,
    priority: null,
    specificity: null,
    reason: null,
    rejectedNonProductionRules: [],
  };

  const list = Array.isArray(rules) ? rules : [];
  const candidates = list.filter((rule) => {
    const shape = validateFiscalRuleShape(rule);
    return shape.ok && rule.ruleType === ruleType;
  });

  audit.candidateRules = candidates.map((rule) => rule.id);

  const matchedAll = candidates.filter((rule) => ruleMatchesFacts(rule, facts));
  audit.matchedRulesAll = matchedAll.map((rule) => rule.id);

  let matched;
  if (allowNonProductionRules) {
    matched = matchedAll;
  } else {
    matched = matchedAll.filter((rule) => rule.productionReady === true);
    audit.rejectedNonProductionRules = matchedAll
      .filter((rule) => rule.productionReady !== true)
      .map((rule) => rule.id);
  }

  audit.matchedRules = matched.map((rule) => rule.id);

  if (matched.length === 0) {
    if (matchedAll.length > 0 && !allowNonProductionRules) {
      return {
        ok: false,
        reason: 'NO_PRODUCTION_RULE',
        audit: {
          ...audit,
          reason: 'non_production_rules_rejected',
        },
        issues: [
          createFiscalIssue(
            'RULE_NOT_PRODUCTION_READY',
            'Regras candidatas existem, porém nenhuma está productionReady — resolução bloqueada em modo SAFE.',
            {
              severity: 'REVIEW',
              blocksEmission: true,
              overrideAllowed: false,
              ruleRefs: matchedAll.map((rule) => fiscalRuleRef({
                id: rule.id,
                ruleType: rule.ruleType,
                rulePackageId: rule.rulePackageId,
                sourceLegalReference: rule.sourceLegalReference,
                productionReady: rule.productionReady,
              })),
              meta: { ruleType, rejectedNonProductionRules: audit.rejectedNonProductionRules },
            },
          ),
        ],
      };
    }

    return {
      ok: false,
      reason: 'NO_RULE',
      audit,
      issues: [],
    };
  }

  const sorted = [...matched].sort((a, b) => {
    const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
    if (priorityDiff !== 0) return priorityDiff;
    const specificityDiff = computeRuleSpecificity(b) - computeRuleSpecificity(a);
    if (specificityDiff !== 0) return specificityDiff;
    return String(a.id).localeCompare(String(b.id));
  });

  const top = sorted[0];
  const topPriority = top.priority ?? 0;
  const topSpecificity = computeRuleSpecificity(top);
  const topTier = sorted.filter((rule) => (
    (rule.priority ?? 0) === topPriority
    && computeRuleSpecificity(rule) === topSpecificity
  ));

  const resultKey = ruleType === 'CURRENT_ST'
    ? 'currentOperationSt'
    : ruleType === 'CSOSN'
      ? 'csosn'
      : ruleType === 'CFOP'
        ? 'cfop'
        : 'icmsGroup';

  const topResults = new Set(topTier.map((rule) => JSON.stringify(rule.result?.[resultKey] ?? rule.result)));
  if (topTier.length > 1 && topResults.size > 1) {
    return {
      ok: false,
      reason: 'RULE_CONFLICT',
      audit: {
        ...audit,
        selectedRule: null,
        reason: 'incompatible_top_tier',
      },
      issues: [
        createFiscalIssue(
          'RULE_CONFLICT',
          `Conflito entre regras ${ruleType} igualmente prioritárias.`,
          {
            ruleRefs: topTier.map((rule) => fiscalRuleRef({
              id: rule.id,
              ruleType: rule.ruleType,
              rulePackageId: rule.rulePackageId,
              sourceLegalReference: rule.sourceLegalReference,
              productionReady: rule.productionReady,
            })),
            meta: { ruleType, topTier: topTier.map((rule) => rule.id) },
          },
        ),
      ],
    };
  }

  audit.selectedRule = top.id;
  audit.priority = topPriority;
  audit.specificity = topSpecificity;
  audit.reason = 'highest_priority_specificity';

  const issues = [];
  if (allowNonProductionRules && !top.productionReady) {
    issues.push(createFiscalIssue(
      'RULE_NOT_PRODUCTION_READY',
      `Regra ${top.id} aplicada em modo experimental (allowNonProductionRules).`,
      {
        severity: 'INFO',
        blocksEmission: false,
        overrideAllowed: false,
        ruleRefs: [fiscalRuleRef({
          id: top.id,
          ruleType: top.ruleType,
          rulePackageId: top.rulePackageId,
          sourceLegalReference: top.sourceLegalReference,
          productionReady: top.productionReady,
        })],
      },
    ));
  }

  return {
    ok: true,
    rule: top,
    result: top.result ?? {},
    audit,
    issues,
    ruleRef: fiscalRuleRef({
      id: top.id,
      ruleType: top.ruleType,
      rulePackageId: top.rulePackageId,
      sourceLegalReference: top.sourceLegalReference,
      productionReady: top.productionReady,
    }),
  };
};

/**
 * @param {import('../types/fiscal-rule.js').FiscalRule[]} rules
 * @param {import('../types/fiscal-rule.js').FiscalRuleType} ruleType
 * @param {Record<string, unknown>} facts
 * @param {string | null | undefined} referenceDate
 */
export const filterRulesByEffectiveDate = (rules, ruleType, facts, referenceDate) => {
  const ref = String(referenceDate ?? facts.referenceDate ?? '').slice(0, 10);
  return (Array.isArray(rules) ? rules : [])
    .filter((rule) => rule.ruleType === ruleType)
    .filter((rule) => {
      if (!ref) return false;
      if (rule.effectiveFrom && ref < String(rule.effectiveFrom).slice(0, 10)) return false;
      if (rule.effectiveTo && ref > String(rule.effectiveTo).slice(0, 10)) return false;
      return true;
    });
};
