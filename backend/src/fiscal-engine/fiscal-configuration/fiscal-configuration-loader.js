/**
 * I/O async — carrega configuração fiscal via repository abstraction.
 * Domínio (matcher/resolução) permanece síncrono após o load.
 */
import {
  getCompanyFiscalProfile,
  listProductFiscalProfiles,
  listAccountantApprovedRulesForTenant,
} from './fiscal-configuration-repository.service.js';

/**
 * @param {string} tenantId
 */
export const loadAccountantApprovedRulesForTenant = async (tenantId) => (
  listAccountantApprovedRulesForTenant(tenantId)
);

/**
 * @param {string} tenantId
 */
export const loadFiscalConfigurationSnapshotForTenant = async (tenantId) => {
  const [company, products, approvedRules] = await Promise.all([
    getCompanyFiscalProfile({ tenantId }),
    listProductFiscalProfiles(tenantId),
    listAccountantApprovedRulesForTenant(tenantId),
  ]);
  return { company, products, approvedRules };
};
