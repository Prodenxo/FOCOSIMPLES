/**
 * Avaliador de prontidão — domínio puro + load async para runtime.
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';
import {
  ACCOUNTANT_RULE_STATUS,
  FISCAL_CONFIGURATION_READINESS,
  FISCAL_TRAFFIC_LIGHT,
  FISCAL_PROFILE_STATUS,
} from './constants.js';
import { resolveAccountantApprovedFiscalRule } from './approved-rule-matcher.js';
import { APPROVED_RULE_MATCH_STATUS } from './constants.js';
import { loadFiscalConfigurationSnapshotForTenant } from './fiscal-configuration-loader.js';
import {
  getCompanyFiscalProfileSync,
  listProductFiscalProfilesSync,
  listAccountantApprovedRulesForTenantSync,
} from './fiscal-configuration-repository.service.js';

/**
 * @param {string | null} matchStatus
 */
export const mapMatchStatusToTrafficLight = (matchStatus, hasIncompleteFacts = false) => {
  if (matchStatus === APPROVED_RULE_MATCH_STATUS.CONFLICT) {
    return FISCAL_TRAFFIC_LIGHT.FISCAL_RULE_CONFLICT;
  }
  if (matchStatus === APPROVED_RULE_MATCH_STATUS.INCOMPLETE_CONTEXT || hasIncompleteFacts) {
    return FISCAL_TRAFFIC_LIGHT.FISCAL_CONFIGURATION_INCOMPLETE;
  }
  if (matchStatus === APPROVED_RULE_MATCH_STATUS.NO_MATCH) {
    return FISCAL_TRAFFIC_LIGHT.REQUIRES_ACCOUNTANT_REVIEW;
  }
  if (matchStatus === APPROVED_RULE_MATCH_STATUS.MATCHED) {
    return FISCAL_TRAFFIC_LIGHT.FISCAL_VALIDATED;
  }
  return FISCAL_TRAFFIC_LIGHT.REQUIRES_ACCOUNTANT_REVIEW;
};

/**
 * Avaliação pura — dados já carregados (sem I/O).
 * @param {object} params
 */
export const evaluateFiscalConfigurationReadinessFromData = ({
  tenantId,
  company = null,
  products = [],
  approvedRules = [],
  context = null,
  treatmentPartial = {},
}) => {
  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */
  const issues = [];
  /** @type {string[]} */
  const warnings = [];
  /** @type {string[]} */
  const missingFacts = [];
  /** @type {string[]} */
  const configuredScenarios = [];
  /** @type {string[]} */
  const unconfiguredScenarios = [];

  if (!company) {
    missingFacts.push('companyFiscalProfile');
    unconfiguredScenarios.push('company_profile_missing');
  } else if (company.status !== FISCAL_PROFILE_STATUS.ACTIVE) {
    warnings.push(`company_profile_${company.status}`);
  } else {
    configuredScenarios.push('company_profile_active');
    if (!company.crt) missingFacts.push('company.crt');
    if (!company.issuerUf) missingFacts.push('company.issuerUf');
  }

  if (products.length === 0) {
    warnings.push('no_product_profiles');
  }

  const activeApprovedRules = approvedRules
    .filter((r) => r.status === ACCOUNTANT_RULE_STATUS.APPROVED);
  if (activeApprovedRules.length === 0) {
    unconfiguredScenarios.push('no_approved_rules');
  } else {
    configuredScenarios.push(`${activeApprovedRules.length}_approved_rules`);
  }

  let matchResult = null;
  if (context) {
    matchResult = resolveAccountantApprovedFiscalRule(context, activeApprovedRules, { treatmentPartial });
    if (matchResult.missingFacts?.length) {
      missingFacts.push(...matchResult.missingFacts);
    }
    if (matchResult.status === APPROVED_RULE_MATCH_STATUS.NO_MATCH) {
      unconfiguredScenarios.push('context_no_matching_rule');
    }
    if (matchResult.status === APPROVED_RULE_MATCH_STATUS.MATCHED) {
      configuredScenarios.push(`matched_rule:${matchResult.ruleId}`);
    }
    issues.push(...(matchResult.issues ?? []));
  }

  let readiness = FISCAL_CONFIGURATION_READINESS.READY;
  if (matchResult?.status === APPROVED_RULE_MATCH_STATUS.CONFLICT
    || activeApprovedRules.some((r) => r.status === ACCOUNTANT_RULE_STATUS.APPROVED && r._conflictMarker)) {
    readiness = FISCAL_CONFIGURATION_READINESS.CONFLICT;
  } else if (missingFacts.length || matchResult?.status === APPROVED_RULE_MATCH_STATUS.INCOMPLETE_CONTEXT) {
    readiness = FISCAL_CONFIGURATION_READINESS.INCOMPLETE;
  } else if (!company || activeApprovedRules.length === 0 || matchResult?.status === APPROVED_RULE_MATCH_STATUS.NO_MATCH) {
    readiness = FISCAL_CONFIGURATION_READINESS.PARTIAL;
  }

  const trafficLight = mapMatchStatusToTrafficLight(
    matchResult?.status ?? null,
    missingFacts.length > 0,
  );

  if (readiness !== FISCAL_CONFIGURATION_READINESS.READY) {
    issues.push(createFiscalIssue(
      trafficLight,
      `Configuração fiscal ${readiness}`,
      { severity: 'REVIEW', blocksEmission: readiness === FISCAL_CONFIGURATION_READINESS.CONFLICT, overrideAllowed: false },
    ));
  }

  return {
    readiness,
    trafficLight,
    missingFacts: [...new Set(missingFacts)],
    issues,
    warnings,
    configuredScenarios,
    unconfiguredScenarios,
    matchResult,
    tenantId,
  };
};

/**
 * Runtime async — carrega snapshot via repository abstraction.
 * @param {object} params
 */
export const evaluateFiscalConfigurationReadinessForTenant = async ({
  tenantId,
  context = null,
  treatmentPartial = {},
}) => {
  const { company, products, approvedRules } = await loadFiscalConfigurationSnapshotForTenant(tenantId);
  return evaluateFiscalConfigurationReadinessFromData({
    tenantId,
    company,
    products,
    approvedRules,
    context,
    treatmentPartial,
  });
};

/**
 * Sync memory-only — lança se usePostgres=true.
 * @deprecated Prefer evaluateFiscalConfigurationReadinessForTenant em runtime.
 */
export const evaluateFiscalConfigurationReadiness = ({
  tenantId,
  context = null,
  treatmentPartial = {},
}) => evaluateFiscalConfigurationReadinessFromData({
  tenantId,
  company: getCompanyFiscalProfileSync(tenantId),
  products: listProductFiscalProfilesSync(tenantId),
  approvedRules: listAccountantApprovedRulesForTenantSync(tenantId),
  context,
  treatmentPartial,
});
