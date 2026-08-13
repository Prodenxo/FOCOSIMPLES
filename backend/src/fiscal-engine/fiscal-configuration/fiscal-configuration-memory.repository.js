/**

 * Repositório in-memory Phase 8C — implementação interna do repository abstraction.

 * Consumidores de negócio devem usar fiscal-configuration-repository.service.js.

 */

import { ACCOUNTANT_RULE_STATUS } from './constants.js';

import { assertValidAccountantRuleStatusTransition } from './accountant-rule-status-transitions.js';

import { stripActorFieldsFromPayload } from './fiscal-configuration-payload.js';



/** @type {Map<string, object>} */

const companyProfiles = new Map();

/** @type {Map<string, object>} */

const productProfiles = new Map();

/** @type {Map<string, object>} */

const customerProfiles = new Map();

/** @type {Map<string, object[]>} */

const approvedRulesByTenant = new Map();

/** @type {Map<string, object>} */

const ruleTemplates = new Map();

/** @type {Map<string, object>} */

const taxCatalogEntries = new Map();



const tenantKey = (tenantId) => String(tenantId ?? '');



export const resetFiscalConfigurationRepository = () => {

  companyProfiles.clear();

  productProfiles.clear();

  customerProfiles.clear();

  approvedRulesByTenant.clear();

  ruleTemplates.clear();

  taxCatalogEntries.clear();

};



export { stripActorFieldsFromPayload };



// --- Company Fiscal Profile ---

export const saveCompanyFiscalProfile = (profile) => {

  const key = `${tenantKey(profile.tenantId)}:${profile.establishmentId ?? 'default'}`;

  companyProfiles.set(key, { ...profile, updatedAt: new Date().toISOString() });

  return companyProfiles.get(key);

};



export const getCompanyFiscalProfile = (tenantId, establishmentId = 'default') => (

  companyProfiles.get(`${tenantKey(tenantId)}:${establishmentId}`) ?? null

);



export const listCompanyFiscalProfiles = (tenantId) => (

  [...companyProfiles.values()].filter((p) => p.tenantId === tenantId)

);



// --- Product Fiscal Profile ---

export const saveProductFiscalProfile = (profile) => {

  const key = `${tenantKey(profile.tenantId)}:${profile.productId}`;

  productProfiles.set(key, { ...profile, updatedAt: new Date().toISOString() });

  return productProfiles.get(key);

};



export const getProductFiscalProfile = (tenantId, productId) => (

  productProfiles.get(`${tenantKey(tenantId)}:${productId}`) ?? null

);



export const listProductFiscalProfiles = (tenantId) => (

  [...productProfiles.values()].filter((p) => p.tenantId === tenantId)

);



// --- Customer Tax Profile ---

export const saveCustomerTaxProfile = (profile) => {

  const key = `${tenantKey(profile.tenantId)}:${profile.customerId}`;

  customerProfiles.set(key, { ...profile, updatedAt: new Date().toISOString() });

  return customerProfiles.get(key);

};



export const getCustomerTaxProfile = (tenantId, customerId) => (

  customerProfiles.get(`${tenantKey(tenantId)}:${customerId}`) ?? null

);



export const listCustomerTaxProfiles = (tenantId) => (

  [...customerProfiles.values()].filter((p) => p.tenantId === tenantId)

);



// --- Accountant Approved Rules ---

const persistRuleEntry = (tenant, entry) => {

  const list = approvedRulesByTenant.get(tenant) ?? [];

  const idx = list.findIndex((r) => r.id === entry.id && r.version === entry.version);

  const stored = { ...entry, updatedAt: new Date().toISOString() };

  if (idx >= 0) list[idx] = stored;

  else list.push(stored);

  approvedRulesByTenant.set(tenant, list);

  return stored;

};



export const saveAccountantApprovedRule = (rule) => {

  if (rule.status && rule.status !== ACCOUNTANT_RULE_STATUS.DRAFT) {

    throw new Error('Use operações explícitas de transição para status não-DRAFT');

  }

  const tenant = tenantKey(rule.tenantId);

  const existing = getAccountantApprovedRule(rule.tenantId, rule.id, rule.version);

  if (existing?.status === ACCOUNTANT_RULE_STATUS.APPROVED) {

    throw new Error('ACCOUNTANT_RULE_IMMUTABLE: versão APPROVED não pode ser editada diretamente');

  }

  return persistRuleEntry(tenant, { ...rule, status: ACCOUNTANT_RULE_STATUS.DRAFT });

};



export const updateAccountantApprovedRuleDraft = (tenantId, ruleId, version, patch) => {

  const existing = getAccountantApprovedRule(tenantId, ruleId, version);

  if (!existing) throw new Error(`Regra ${ruleId} v${version} não encontrada`);

  if (existing.status !== ACCOUNTANT_RULE_STATUS.DRAFT) {

    throw new Error('ACCOUNTANT_RULE_IMMUTABLE: apenas DRAFT pode ser editado');

  }

  return saveAccountantApprovedRule({ ...existing, ...stripActorFieldsFromPayload(patch) });

};



export const approveAccountantRuleMemory = ({

  tenantId, ruleId, version, approvedBy, approvedAt, justification,

}) => {

  const existing = getAccountantApprovedRule(tenantId, ruleId, version);

  if (!existing) throw new Error('Regra não encontrada');

  assertValidAccountantRuleStatusTransition(existing.status, ACCOUNTANT_RULE_STATUS.APPROVED);

  return persistRuleEntry(tenantKey(tenantId), {

    ...existing,

    status: ACCOUNTANT_RULE_STATUS.APPROVED,

    approvedBy,

    approvedAt,

    justification: justification ?? existing.justification ?? null,

  });

};



export const suspendAccountantRuleMemory = ({

  tenantId, ruleId, suspendedBy, suspendedAt,

}) => {

  const existing = getAccountantApprovedRule(tenantId, ruleId);

  if (!existing) throw new Error('Regra não encontrada');

  assertValidAccountantRuleStatusTransition(existing.status, ACCOUNTANT_RULE_STATUS.SUSPENDED);

  return persistRuleEntry(tenantKey(tenantId), {

    ...existing,

    status: ACCOUNTANT_RULE_STATUS.SUSPENDED,

    suspendedBy,

    suspendedAt,

  });

};



export const revokeAccountantRuleMemory = ({

  tenantId, ruleId, revokedBy, revokedAt,

}) => {

  const existing = getAccountantApprovedRule(tenantId, ruleId);

  if (!existing) throw new Error('Regra não encontrada');

  assertValidAccountantRuleStatusTransition(existing.status, ACCOUNTANT_RULE_STATUS.REVOKED);

  return persistRuleEntry(tenantKey(tenantId), {

    ...existing,

    status: ACCOUNTANT_RULE_STATUS.REVOKED,

    revokedBy,

    revokedAt,

  });

};



export const createAccountantRuleNewVersionMemory = (rule) => {

  const tenant = tenantKey(rule.tenantId);

  const list = approvedRulesByTenant.get(tenant) ?? [];

  if (list.some((r) => r.id === rule.id && r.version === rule.version)) {

    throw new Error(`Versão ${rule.version} já existe para regra ${rule.id}`);

  }

  return persistRuleEntry(tenant, {

    ...rule,

    status: ACCOUNTANT_RULE_STATUS.DRAFT,

    approvedBy: null,

    approvedAt: null,

    suspendedBy: null,

    suspendedAt: null,

    revokedBy: null,

    revokedAt: null,

  });

};



/** @internal — apenas fixtures de teste */

export const insertApprovedRuleForFixture = (rule) => (

  persistRuleEntry(tenantKey(rule.tenantId), {

    ...rule,

    status: ACCOUNTANT_RULE_STATUS.APPROVED,

  })

);



export const listAccountantApprovedRulesForTenant = (tenantId) => (

  [...(approvedRulesByTenant.get(tenantKey(tenantId)) ?? [])]

);



export const getAccountantApprovedRule = (tenantId, ruleId, version) => {

  const list = listAccountantApprovedRulesForTenant(tenantId);

  if (version != null) {

    return list.find((r) => r.id === ruleId && r.version === version) ?? null;

  }

  return list

    .filter((r) => r.id === ruleId)

    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0] ?? null;

};



// --- Templates (global — não tenant-scoped) ---

export const saveFiscalRuleTemplate = (template) => {

  ruleTemplates.set(template.id, {

    ...template,

    authoritativeForTenant: template.authoritativeForTenant ?? false,

    productionReady: template.productionReady ?? false,

    updatedAt: new Date().toISOString(),

  });

  return ruleTemplates.get(template.id);

};



export const listFiscalRuleTemplates = () => [...ruleTemplates.values()];



export const getFiscalRuleTemplate = (id) => ruleTemplates.get(id) ?? null;



// --- Tax Catalog (global — catálogo central de apoio) ---

export const saveTaxCatalogEntry = (entry) => {

  taxCatalogEntries.set(entry.id, { ...entry, updatedAt: new Date().toISOString() });

  return taxCatalogEntries.get(entry.id);

};



export const listTaxCatalogEntries = () => [...taxCatalogEntries.values()];



export const getTaxCatalogEntry = (id) => taxCatalogEntries.get(id) ?? null;



export const __getFiscalConfigurationStoreForTests = () => ({

  companyProfiles,

  productProfiles,

  customerProfiles,

  approvedRulesByTenant,

  ruleTemplates,

  taxCatalogEntries,

});
