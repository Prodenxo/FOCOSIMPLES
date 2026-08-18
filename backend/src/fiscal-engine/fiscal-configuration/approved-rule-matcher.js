/**
 * Matching determinístico de AccountantApprovedFiscalRule por especificidade.
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';
import {
  ACCOUNTANT_RULE_STATUS,
  APPROVED_RULE_MATCH_STATUS,
  APPROVED_RULE_SPECIFICITY_WEIGHTS,
} from './constants.js';
import { extractMatchingFactsFromContext } from './matching-facts.js';
import { getMatchConditionsFromRule } from './accountant-rule-conditions.js';

/**
 * @param {object} rule
 */
export const isApprovedRuleEffectiveOn = (rule, referenceDate) => {
  const ref = String(referenceDate ?? '').slice(0, 10);
  if (!ref) return false;
  if (rule.validFrom && ref < String(rule.validFrom).slice(0, 10)) return false;
  if (rule.validUntil && ref > String(rule.validUntil).slice(0, 10)) return false;
  return true;
};

/**
 * @param {object} rule
 * @param {Record<string, unknown>} facts
 */
export const computeApprovedRuleSpecificity = (rule, facts) => {
  const conditions = getMatchConditionsFromRule(rule);
  let score = Number(rule.baseSpecificity ?? 0);
  const matchReasons = [];

  for (const [key, expected] of Object.entries(conditions)) {
    if (expected == null) continue;
    if (Array.isArray(expected) && expected.length === 0) continue;

    const actual = facts[key];
    const weight = APPROVED_RULE_SPECIFICITY_WEIGHTS[key] ?? 5;

    if (Array.isArray(expected)) {
      if (expected.includes(actual)) {
        score += weight;
        matchReasons.push(`${key}=${actual}`);
      }
      continue;
    }

    if (actual === expected) {
      score += weight;
      matchReasons.push(`${key}=${actual}`);
    }
  }

  return { score, matchReasons };
};

/**
 * @param {object} rule
 * @param {Record<string, unknown>} facts
 */
export const approvedRuleMatchesFacts = (rule, facts) => {
  if (rule.status !== ACCOUNTANT_RULE_STATUS.APPROVED) return { matches: false, missingFacts: [], reasons: [] };

  if (rule.tenantId && rule.tenantId !== facts.tenantId) {
    return { matches: false, missingFacts: [], reasons: ['tenant_mismatch'] };
  }

  if (rule.establishmentId && rule.establishmentId !== facts.establishmentId) {
    return { matches: false, missingFacts: [], reasons: ['establishment_mismatch'] };
  }

  if (!isApprovedRuleEffectiveOn(rule, facts.referenceDate)) {
    return { matches: false, missingFacts: [], reasons: ['outside_validity'] };
  }

  const conditions = getMatchConditionsFromRule(rule);
  /** @type {string[]} */
  const missingFacts = [];
  /** @type {string[]} */
  const reasons = [];

  for (const [key, expected] of Object.entries(conditions)) {
    if (expected == null) continue;
    if (Array.isArray(expected) && expected.length === 0) continue;

    const actual = facts[key];

    if (key === 'fiscalProductGroupId' && actual === null) {
      return { matches: false, missingFacts: [], reasons: ['fiscalProductGroupId_absent'] };
    }

    if (actual == null || actual === '') {
      const ruleRequires = Array.isArray(expected) ? expected.length > 0 : expected != null;
      if (ruleRequires) {
        missingFacts.push(key);
      }
      continue;
    }

    if (actual === 'UNKNOWN') {
      const acceptsUnknown = Array.isArray(expected)
        ? expected.includes('UNKNOWN')
        : expected === 'UNKNOWN';
      if (!acceptsUnknown) {
        const ruleRequires = Array.isArray(expected) ? expected.length > 0 : expected != null;
        if (ruleRequires) {
          missingFacts.push(key);
        }
        continue;
      }
    }

    if (Array.isArray(expected)) {
      if (!expected.includes(actual)) {
        return { matches: false, missingFacts: [], reasons: [`${key}_mismatch`] };
      }
      reasons.push(`${key}=${actual}`);
      continue;
    }

    if (actual !== expected) {
      return { matches: false, missingFacts: [], reasons: [`${key}_mismatch`] };
    }
    reasons.push(`${key}=${actual}`);
  }

  if (missingFacts.length) {
    return { matches: false, missingFacts, reasons, incomplete: true };
  }

  return { matches: true, missingFacts: [], reasons, incomplete: false };
};

/**
 * @param {object} context
 * @param {object[]} approvedRules
 * @param {object} [options]
 */
export const resolveAccountantApprovedFiscalRule = (context, approvedRules, options = {}) => {
  const facts = options.matchingFacts
    ?? extractMatchingFactsFromContext(context, options.treatmentPartial ?? {});
  const referenceDate = facts.referenceDate;
  const list = Array.isArray(approvedRules) ? approvedRules : [];

  /** @type {Array<{ rule: object, specificity: number, matchReasons: string[] }>} */
  const matched = [];
  /** @type {Array<{ rule: object, missingFacts: string[] }>} */
  const incomplete = [];

  for (const rule of list) {
    const result = approvedRuleMatchesFacts(rule, facts);
    if (result.incomplete) {
      incomplete.push({ rule, missingFacts: result.missingFacts });
      continue;
    }
    if (!result.matches) continue;

    const { score, matchReasons } = computeApprovedRuleSpecificity(rule, facts);
    matched.push({ rule, specificity: score, matchReasons: [...result.reasons, ...matchReasons] });
  }

  if (matched.length === 0 && incomplete.length > 0) {
    const allMissing = [...new Set(incomplete.flatMap((i) => i.missingFacts))];
    return {
      status: APPROVED_RULE_MATCH_STATUS.INCOMPLETE_CONTEXT,
      rule: null,
      ruleId: null,
      version: null,
      specificity: null,
      matchReasons: [],
      missingFacts: allMissing,
      issues: [
        createFiscalIssue(
          'FISCAL_CONFIGURATION_INCOMPLETE',
          `Contexto incompleto para matching: ${allMissing.join(', ')}`,
          { severity: 'REVIEW', blocksEmission: true, overrideAllowed: false },
        ),
      ],
    };
  }

  if (matched.length === 0) {
    return {
      status: APPROVED_RULE_MATCH_STATUS.NO_MATCH,
      rule: null,
      ruleId: null,
      version: null,
      specificity: null,
      matchReasons: [],
      missingFacts: [],
      issues: [
        createFiscalIssue(
          'REQUIRES_ACCOUNTANT_REVIEW',
          'Nenhuma regra fiscal aprovada pelo contador corresponde ao contexto.',
          { severity: 'REVIEW', blocksEmission: true, overrideAllowed: false },
        ),
      ],
    };
  }

  matched.sort((a, b) => b.specificity - a.specificity || String(a.rule.id).localeCompare(String(b.rule.id)));

  const topScore = matched[0].specificity;
  const topMatches = matched.filter((m) => m.specificity === topScore);

  if (topMatches.length > 1) {
    const cfops = new Set(topMatches.map((m) => m.rule.approvedResult?.cfop).filter(Boolean));
    const csosns = new Set(topMatches.map((m) => m.rule.approvedResult?.csosn).filter(Boolean));
    if (cfops.size > 1 || csosns.size > 1) {
      return {
        status: APPROVED_RULE_MATCH_STATUS.CONFLICT,
        rule: null,
        ruleId: null,
        version: null,
        specificity: topScore,
        matchReasons: topMatches.flatMap((m) => m.matchReasons),
        conflictingRuleIds: topMatches.map((m) => m.rule.id),
        issues: [
          createFiscalIssue(
            'RULE_CONFLICT',
            `Regras aprovadas conflitantes no mesmo nível de especificidade: ${topMatches.map((m) => m.rule.id).join(', ')}`,
            { severity: 'ERROR', blocksEmission: true, overrideAllowed: false },
          ),
        ],
      };
    }
  }

  const selected = topMatches[0];
  return {
    status: APPROVED_RULE_MATCH_STATUS.MATCHED,
    rule: selected.rule,
    ruleId: selected.rule.id,
    version: selected.rule.version,
    specificity: selected.specificity,
    matchReasons: selected.matchReasons,
    matchedConditions: Object.keys(selected.rule.conditions ?? {}),
    approvedResult: selected.rule.approvedResult ?? {},
    approvedBy: selected.rule.approvedBy ?? null,
    approvedAt: selected.rule.approvedAt ?? null,
    legalSourceRefs: selected.rule.legalSourceRefs ?? [],
    issues: [],
  };
};
