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
import { filterAccountantRulesForEstablishment } from '../establishment/fiscal-establishment-id.js';

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
 * @param {string} [establishmentId='default']
 */
export const hasAuthoritativeAccountantConfigReadinessAsync = async (
  empresaId,
  establishmentId = 'default',
) => {
  const tenantId = String(empresaId ?? '').trim();
  const scopedEstablishmentId = String(establishmentId ?? 'default').trim() || 'default';
  if (!tenantId) return false;

  const company = await getCompanyFiscalProfile({ tenantId, establishmentId: scopedEstablishmentId });
  const allRules = await listAccountantApprovedRulesForTenant(tenantId);
  const approvedRules = filterAccountantRulesForEstablishment(
    allRules,
    scopedEstablishmentId,
    { requireExact: scopedEstablishmentId !== 'default' },
  );
  return evaluateAccountantReadinessFromData(company, approvedRules);
};

/**
 * Sync — apenas memory mode. Lança se Postgres ativo.
 * @param {string} empresaId
 * @param {string} [establishmentId='default']
 */
export const hasAuthoritativeAccountantConfigReadiness = (
  empresaId,
  establishmentId = 'default',
) => {
  if (isFiscalEnginePostgresEnabled()) {
    throw new Error('hasAuthoritativeAccountantConfigReadiness indisponível com Postgres — use async');
  }
  const tenantId = String(empresaId ?? '').trim();
  const scopedEstablishmentId = String(establishmentId ?? 'default').trim() || 'default';
  if (!tenantId) return false;

  const company = getCompanyFiscalProfileSync(tenantId, scopedEstablishmentId);
  const allRules = listAccountantApprovedRulesForTenantSync(tenantId);
  const approvedRules = filterAccountantRulesForEstablishment(
    allRules,
    scopedEstablishmentId,
    { requireExact: scopedEstablishmentId !== 'default' },
  );
  return evaluateAccountantReadinessFromData(company, approvedRules);
};

/**
 * @param {string} empresaId
 * @param {string} [establishmentId='default']
 */
export const countExecutableAccountantApprovedRulesAsync = async (
  empresaId,
  establishmentId = 'default',
) => {
  const tenantId = String(empresaId ?? '').trim();
  const scopedEstablishmentId = String(establishmentId ?? 'default').trim() || 'default';
  if (!tenantId) return 0;

  const company = await getCompanyFiscalProfile({ tenantId, establishmentId: scopedEstablishmentId });
  if (!company || company.status !== FISCAL_PROFILE_STATUS.ACTIVE) {
    return 0;
  }

  const allRules = await listAccountantApprovedRulesForTenant(tenantId);
  const approvedRules = filterAccountantRulesForEstablishment(
    allRules,
    scopedEstablishmentId,
    { requireExact: scopedEstablishmentId !== 'default' },
  );
  return approvedRules.filter(isExecutableApprovedAccountantRule).length;
};

/**
 * @param {string} empresaId
 * @param {string} [establishmentId='default']
 */
export const countExecutableAccountantApprovedRules = (
  empresaId,
  establishmentId = 'default',
) => {
  if (isFiscalEnginePostgresEnabled()) {
    throw new Error('countExecutableAccountantApprovedRules indisponível com Postgres — use async');
  }
  const tenantId = String(empresaId ?? '').trim();
  const scopedEstablishmentId = String(establishmentId ?? 'default').trim() || 'default';
  if (!tenantId) return 0;

  const company = getCompanyFiscalProfileSync(tenantId, scopedEstablishmentId);
  if (!company || company.status !== FISCAL_PROFILE_STATUS.ACTIVE) {
    return 0;
  }

  const allRules = listAccountantApprovedRulesForTenantSync(tenantId);
  return filterAccountantRulesForEstablishment(
    allRules,
    scopedEstablishmentId,
    { requireExact: scopedEstablishmentId !== 'default' },
  ).filter(isExecutableApprovedAccountantRule).length;
};
