/**
 * Readiness authoritative via configuração aprovada pelo contador — Fase 8F.1/8F.2.
 *
 * Async quando Postgres repository ativo; sync apenas em memory mode (testes).
 */
import {
  getCompanyFiscalProfile,
  getCompanyFiscalProfileSync,
  listAccountantApprovedRulesForTenant,
  listAccountantApprovedRulesForTenantSync,
} from '../fiscal-configuration/fiscal-configuration-repository.service.js';
import {
  ACCOUNTANT_RULE_STATUS,
  FISCAL_PROFILE_STATUS,
} from '../fiscal-configuration/constants.js';
import { evaluateAccountantRuleEngineCapability } from '../fiscal-configuration/fiscal-engine-capability.js';
import { isFiscalEnginePostgresEnabled } from '../config/fiscal-repository-mode.js';

/**
 * @param {object} rule
 */
const isExecutableApprovedAccountantRule = (rule) => (
  rule?.status === ACCOUNTANT_RULE_STATUS.APPROVED
  && evaluateAccountantRuleEngineCapability(rule).executable === true
);

/**
 * @param {object | null | undefined} company
 * @param {object[]} approvedRules
 */
const evaluateAccountantReadinessFromData = (company, approvedRules) => {
  if (!company || company.status !== FISCAL_PROFILE_STATUS.ACTIVE) {
    return false;
  }
  return approvedRules.some(isExecutableApprovedAccountantRule);
};

/**
 * @param {string} empresaId
 */
export const hasAuthoritativeAccountantConfigReadinessAsync = async (empresaId) => {
  const tenantId = String(empresaId ?? '').trim();
  if (!tenantId) return false;

  const company = await getCompanyFiscalProfile({ tenantId });
  const approvedRules = await listAccountantApprovedRulesForTenant(tenantId);
  return evaluateAccountantReadinessFromData(company, approvedRules);
};

/**
 * Sync — apenas memory mode. Lança se Postgres ativo.
 * @param {string} empresaId
 */
export const hasAuthoritativeAccountantConfigReadiness = (empresaId) => {
  if (isFiscalEnginePostgresEnabled()) {
    throw new Error('hasAuthoritativeAccountantConfigReadiness indisponível com Postgres — use async');
  }
  const tenantId = String(empresaId ?? '').trim();
  if (!tenantId) return false;

  const company = getCompanyFiscalProfileSync(tenantId);
  const approvedRules = listAccountantApprovedRulesForTenantSync(tenantId);
  return evaluateAccountantReadinessFromData(company, approvedRules);
};

/**
 * @param {string} empresaId
 */
export const countExecutableAccountantApprovedRulesAsync = async (empresaId) => {
  const tenantId = String(empresaId ?? '').trim();
  if (!tenantId) return 0;

  const company = await getCompanyFiscalProfile({ tenantId });
  if (!company || company.status !== FISCAL_PROFILE_STATUS.ACTIVE) {
    return 0;
  }

  const approvedRules = await listAccountantApprovedRulesForTenant(tenantId);
  return approvedRules.filter(isExecutableApprovedAccountantRule).length;
};

/**
 * @param {string} empresaId
 */
export const countExecutableAccountantApprovedRules = (empresaId) => {
  if (isFiscalEnginePostgresEnabled()) {
    throw new Error('countExecutableAccountantApprovedRules indisponível com Postgres — use async');
  }
  const tenantId = String(empresaId ?? '').trim();
  if (!tenantId) return 0;

  const company = getCompanyFiscalProfileSync(tenantId);
  if (!company || company.status !== FISCAL_PROFILE_STATUS.ACTIVE) {
    return 0;
  }

  return listAccountantApprovedRulesForTenantSync(tenantId)
    .filter(isExecutableApprovedAccountantRule).length;
};
