/**
 * Readiness authoritative via configuração aprovada pelo contador — Fase 8F.1.
 *
 * Separado de productionReady generic engine rules.
 */
import {
  getCompanyFiscalProfileSync,
  listAccountantApprovedRulesForTenantSync,
} from '../fiscal-configuration/fiscal-configuration-repository.service.js';
import {
  ACCOUNTANT_RULE_STATUS,
  FISCAL_PROFILE_STATUS,
} from '../fiscal-configuration/constants.js';
import { evaluateAccountantRuleEngineCapability } from '../fiscal-configuration/fiscal-engine-capability.js';

/**
 * @param {object} rule
 */
const isExecutableApprovedAccountantRule = (rule) => (
  rule?.status === ACCOUNTANT_RULE_STATUS.APPROVED
  && evaluateAccountantRuleEngineCapability(rule).executable === true
);

/**
 * Tenant pronto para roteamento authoritative quando:
 * - perfil fiscal da empresa ACTIVE
 * - ao menos uma AccountantApprovedFiscalRule APPROVED executável pelo engine
 *
 * @param {string} empresaId
 */
export const hasAuthoritativeAccountantConfigReadiness = (empresaId) => {
  const tenantId = String(empresaId ?? '').trim();
  if (!tenantId) return false;

  const company = getCompanyFiscalProfileSync(tenantId);
  if (!company || company.status !== FISCAL_PROFILE_STATUS.ACTIVE) {
    return false;
  }

  const approvedRules = listAccountantApprovedRulesForTenantSync(tenantId);
  return approvedRules.some(isExecutableApprovedAccountantRule);
};

/**
 * @param {string} empresaId
 */
export const countExecutableAccountantApprovedRules = (empresaId) => {
  const tenantId = String(empresaId ?? '').trim();
  if (!tenantId) return 0;

  const company = getCompanyFiscalProfileSync(tenantId);
  if (!company || company.status !== FISCAL_PROFILE_STATUS.ACTIVE) {
    return 0;
  }

  return listAccountantApprovedRulesForTenantSync(tenantId)
    .filter(isExecutableApprovedAccountantRule).length;
};
