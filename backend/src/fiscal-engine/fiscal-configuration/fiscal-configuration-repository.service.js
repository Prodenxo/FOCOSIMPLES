/**

 * Única porta de acesso à configuração fiscal — memory ou Postgres.

 * Consumidores de negócio NÃO devem importar memory.repository diretamente.

 */

import { randomUUID } from 'node:crypto';
import * as memoryRepo from './fiscal-configuration-memory.repository.js';

import * as pgRepo from './fiscal-configuration.repository.js';

import { ACCOUNTANT_RULE_STATUS } from './constants.js';
import {
  FISCAL_REPOSITORY_MODE,
  isFiscalEnginePostgresEnabled,
  __setFiscalRepositoryModeForTests,
  __resetFiscalRepositoryModeForTests,
} from '../config/fiscal-repository-mode.js';

/** @internal */
export const __setFiscalConfigurationPostgresEnabledForTests = (enabled) => {
  __setFiscalRepositoryModeForTests(
    enabled ? FISCAL_REPOSITORY_MODE.POSTGRES : FISCAL_REPOSITORY_MODE.MEMORY,
  );
};

/** @internal */
export const __isFiscalConfigurationPostgresEnabledForTests = () => isFiscalEnginePostgresEnabled();

/** @internal */
export const __resetFiscalConfigurationRepositoryServiceForTests = () => {
  __resetFiscalRepositoryModeForTests();
  memoryRepo.resetFiscalConfigurationRepository();
};



export const resetFiscalConfigurationRepository = memoryRepo.resetFiscalConfigurationRepository;



const assertPostgresMode = () => {
  if (!isFiscalEnginePostgresEnabled()) {
    throw new Error('Operação disponível apenas com Postgres repository ativo');
  }
};

const route = (memoryFn, pgFn) => async (...args) => (
  isFiscalEnginePostgresEnabled() ? pgFn(...args) : memoryFn(...args)
);



// --- Company ---

export const getCompanyFiscalProfile = route(

  ({ tenantId, establishmentId = 'default' }) => (

    memoryRepo.getCompanyFiscalProfile(tenantId, establishmentId)

  ),

  pgRepo.fetchCompanyFiscalProfilePg,

);



export const saveCompanyFiscalProfile = route(

  memoryRepo.saveCompanyFiscalProfile,

  pgRepo.upsertCompanyFiscalProfilePg,

);



export const listCompanyFiscalProfiles = route(

  memoryRepo.listCompanyFiscalProfiles,

  async (tenantId) => {

    const pool = (await import('../../config/pg.js')).getPgPool();

    const result = await pool.query(

      'SELECT * FROM company_fiscal_profiles WHERE tenant_id = $1 ORDER BY establishment_id',

      [tenantId],

    );

    return result.rows.map((row) => ({

      id: row.id,

      tenantId: row.tenant_id,

      establishmentId: row.establishment_id,

      crt: row.crt,

      status: row.status,

    }));

  },

);



// --- Product ---

export const getProductFiscalProfile = route(

  ({ tenantId, productId }) => memoryRepo.getProductFiscalProfile(tenantId, productId),

  pgRepo.fetchProductFiscalProfilePg,

);



export const saveProductFiscalProfile = route(

  memoryRepo.saveProductFiscalProfile,

  pgRepo.upsertProductFiscalProfilePg,

);



export const listProductFiscalProfiles = route(

  memoryRepo.listProductFiscalProfiles,

  pgRepo.listProductFiscalProfilesPg,

);



// --- Customer ---

export const getCustomerTaxProfile = route(

  ({ tenantId, customerId }) => memoryRepo.getCustomerTaxProfile(tenantId, customerId),

  pgRepo.fetchCustomerTaxProfilePg,

);



export const saveCustomerTaxProfile = route(

  memoryRepo.saveCustomerTaxProfile,

  pgRepo.upsertCustomerTaxProfilePg,

);



export const listCustomerTaxProfiles = route(

  memoryRepo.listCustomerTaxProfiles,

  pgRepo.listCustomerTaxProfilesPg,

);



// --- Accountant Rules ---

export const listAccountantApprovedRulesForTenant = route(

  memoryRepo.listAccountantApprovedRulesForTenant,

  pgRepo.fetchAccountantRulesForTenantPg,

);



export const getAccountantApprovedRule = route(

  ({ tenantId, ruleId, version }) => (

    memoryRepo.getAccountantApprovedRule(tenantId, ruleId, version)

  ),

  pgRepo.fetchAccountantRulePg,

);



export const saveAccountantApprovedRuleDraft = async (rule) => {

  if (rule.status === ACCOUNTANT_RULE_STATUS.APPROVED) {

    throw new Error('Use approveAccountantRuleAtomic para status APPROVED');

  }

  const draft = { ...rule, status: ACCOUNTANT_RULE_STATUS.DRAFT };

  if (isFiscalEnginePostgresEnabled() && !pgRepo.isValidPgUuid(draft.id)) {
    draft.id = randomUUID();
  }

  if (isFiscalEnginePostgresEnabled()) return pgRepo.upsertAccountantRuleDraftPg(draft);

  return memoryRepo.saveAccountantApprovedRule(draft);

};



export const updateAccountantApprovedRuleDraft = async (tenantId, ruleId, version, patch) => {

  if (isFiscalEnginePostgresEnabled()) {

    const existing = await pgRepo.fetchAccountantRulePg({ tenantId, ruleId, version });

    if (!existing) throw new Error(`Regra ${ruleId} v${version} não encontrada`);

    if (existing.status !== ACCOUNTANT_RULE_STATUS.DRAFT) {

      throw new Error('ACCOUNTANT_RULE_IMMUTABLE: apenas DRAFT pode ser editado');

    }

    return pgRepo.upsertAccountantRuleDraftPg({ ...existing, ...patch });

  }

  return memoryRepo.updateAccountantApprovedRuleDraft(tenantId, ruleId, version, patch);

};



export const approveAccountantRuleAtomic = async (params) => {

  if (isFiscalEnginePostgresEnabled()) return pgRepo.approveAccountantRulePg(params);

  return memoryRepo.approveAccountantRuleMemory(params);

};



export const suspendAccountantRule = async (params) => {

  if (isFiscalEnginePostgresEnabled()) return pgRepo.suspendAccountantRulePg(params);

  return memoryRepo.suspendAccountantRuleMemory(params);

};



export const revokeAccountantRule = async (params) => {

  if (isFiscalEnginePostgresEnabled()) return pgRepo.revokeAccountantRulePg(params);

  return memoryRepo.revokeAccountantRuleMemory(params);

};



export const createAccountantRuleNewVersion = async (rule) => {

  if (isFiscalEnginePostgresEnabled()) return pgRepo.createAccountantRuleNewVersionPg(rule);

  return memoryRepo.createAccountantRuleNewVersionMemory(rule);

};



// --- Templates (global) ---

export const getFiscalRuleTemplate = route(
  (arg) => memoryRepo.getFiscalRuleTemplate(typeof arg === 'string' ? arg : arg?.id),
  (arg) => pgRepo.fetchFiscalRuleTemplatePg(typeof arg === 'string' ? arg : arg?.id),
);

export const saveFiscalRuleTemplate = route(
  memoryRepo.saveFiscalRuleTemplate,
  pgRepo.upsertFiscalRuleTemplatePg,
);

export const listFiscalRuleTemplates = route(
  memoryRepo.listFiscalRuleTemplates,
  pgRepo.listFiscalRuleTemplatesPg,
);

// --- Tax Catalog (global central) ---
export const getTaxCatalogEntry = route(
  (arg) => memoryRepo.getTaxCatalogEntry(typeof arg === 'string' ? arg : arg?.id),
  (arg) => pgRepo.fetchTaxCatalogEntryPg(typeof arg === 'string' ? arg : arg?.id),
);



export const saveTaxCatalogEntry = route(

  memoryRepo.saveTaxCatalogEntry,

  pgRepo.upsertTaxCatalogEntryPg,

);



export const listTaxCatalogEntries = route(

  memoryRepo.listTaxCatalogEntries,

  pgRepo.listTaxCatalogEntriesPg,

);



// --- Fiscal Product Groups (Phase 8D) ---

export const saveFiscalProductGroup = route(
  memoryRepo.saveFiscalProductGroupMemory,
  pgRepo.upsertFiscalProductGroupPg,
);

export const getFiscalProductGroup = route(
  ({ tenantId, id }) => memoryRepo.getFiscalProductGroupMemory(tenantId, id),
  pgRepo.fetchFiscalProductGroupPg,
);

export const listFiscalProductGroups = route(
  memoryRepo.listFiscalProductGroupsMemory,
  pgRepo.listFiscalProductGroupsPg,
);

export const getFiscalProductGroupMembership = route(
  ({ tenantId, productId }) => memoryRepo.getFiscalProductGroupMembershipMemory(tenantId, productId),
  pgRepo.fetchFiscalProductGroupMembershipPg,
);

export const listProductsByFiscalProductGroup = route(
  ({ tenantId, fiscalProductGroupId }) => (
    memoryRepo.listFiscalProductGroupMembershipsByGroupMemory(tenantId, fiscalProductGroupId)
  ),
  pgRepo.listFiscalProductGroupMembershipsByGroupPg,
);

export const listFiscalProductGroupMemberships = route(
  memoryRepo.listFiscalProductGroupMembershipsMemory,
  pgRepo.listFiscalProductGroupMembershipsPg,
);

export const removeFiscalProductGroupMembership = route(
  ({ tenantId, productId }) => memoryRepo.removeFiscalProductGroupMembershipMemory(tenantId, productId),
  pgRepo.removeFiscalProductGroupMembershipPg,
);

export const bulkAssignProductsToFiscalGroup = async (params) => (
  isFiscalEnginePostgresEnabled()
    ? pgRepo.bulkAssignProductsToFiscalGroupPg(params)
    : memoryRepo.bulkAssignProductsToFiscalGroupMemory(params)
);

/**
 * Retorna fiscalProductGroupId apenas se grupo ACTIVE.
 */
export const getActiveFiscalProductGroupIdForProduct = async ({ tenantId, productId }) => {
  if (!tenantId || !productId) return null;
  if (isFiscalEnginePostgresEnabled() && !pgRepo.isValidPgUuid(productId)) return null;
  const membership = await getFiscalProductGroupMembership({ tenantId, productId });
  if (!membership?.fiscalProductGroupId) return null;
  const group = await getFiscalProductGroup({ tenantId, id: membership.fiscalProductGroupId });
  if (!group || group.status !== 'ACTIVE') return null;
  return membership.fiscalProductGroupId;
};



/**

 * Sync accessor — apenas memory mode. Lança se Postgres ativo (zero fallback).

 */

export const getCompanyFiscalProfileSync = (tenantId, establishmentId = 'default') => {
  if (isFiscalEnginePostgresEnabled()) {
    throw new Error('getCompanyFiscalProfileSync indisponível com Postgres — use async');
  }
  return memoryRepo.getCompanyFiscalProfile(tenantId, establishmentId);
};

export const listProductFiscalProfilesSync = (tenantId) => {
  if (isFiscalEnginePostgresEnabled()) {
    throw new Error('listProductFiscalProfilesSync indisponível com Postgres — use async');
  }
  return memoryRepo.listProductFiscalProfiles(tenantId);
};

export const listAccountantApprovedRulesForTenantSync = (tenantId) => {
  if (isFiscalEnginePostgresEnabled()) {
    throw new Error('listAccountantApprovedRulesForTenantSync indisponível com Postgres — use async');
  }
  return memoryRepo.listAccountantApprovedRulesForTenant(tenantId);
};

export const getAccountantApprovedRuleSync = (tenantId, ruleId, version) => {
  if (isFiscalEnginePostgresEnabled()) {
    throw new Error('getAccountantApprovedRuleSync indisponível com Postgres — use async');
  }
  return memoryRepo.getAccountantApprovedRule(tenantId, ruleId, version);

};



export { stripActorFieldsFromPayload } from './fiscal-configuration-payload.js';

export { __getFiscalConfigurationStoreForTests } from './fiscal-configuration-memory.repository.js';

export { insertApprovedRuleForFixture } from './fiscal-configuration-memory.repository.js';



export {

  __ensureFiscalConfigurationSchemaForTests,

  __deleteFiscalConfigurationForTenantTests,

  __deleteGlobalFiscalConfigurationForTests,

} from './fiscal-configuration.repository.js';



export { assertPostgresMode };
