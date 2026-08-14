/**

 * Serviços Phase 8C — configuração fiscal aprovada pelo contador.

 * Actor/auditoria derivados do contexto autenticado — nunca do payload.

 */

import { createFiscalIssue } from '../types/fiscal-issue.js';

import { checkActorPermission } from '../../services/rbac-catalog.service.js';

import {

  ACCOUNTANT_RULE_STATUS,

  FISCAL_CONFIG_PERMISSIONS,

  ACTOR_DERIVED_AUDIT_FIELDS,

} from './constants.js';

import * as repo from './fiscal-configuration-repository.service.js';

import { stripActorFieldsFromPayload } from './fiscal-configuration-payload.js';

import { previewAccountantRuleMatch } from './resolve-with-accountant-config.js';

import { evaluateFiscalConfigurationReadinessForTenant } from './configuration-readiness.js';

import {

  validateAccountantRuleForApproval,

  previewAccountantFiscalRule,

} from './accountant-rule-validation.js';



export const assertActorPermission = (actorContext, permission) => {

  const check = checkActorPermission(actorContext, permission);

  if (!check.allowed) {

    const error = new Error(check.reason ?? 'Permissão negada');

    error.code = 'FISCAL_CONFIG_FORBIDDEN';

    throw error;

  }

  return check;

};



const stripAuditFromPayload = (payload) => {

  const copy = stripActorFieldsFromPayload(payload);

  for (const field of ACTOR_DERIVED_AUDIT_FIELDS) delete copy[field];

  return copy;

};



export const upsertCompanyFiscalProfile = async (profile, actor, actorContext) => {

  assertActorPermission(actorContext, FISCAL_CONFIG_PERMISSIONS.EDIT_DRAFT);

  return repo.saveCompanyFiscalProfile({

    ...stripAuditFromPayload(profile),

    configuredBy: actor?.userId ?? null,

    configuredAt: new Date().toISOString(),

  });

};



export const fetchCompanyFiscalProfile = async ({ tenantId, establishmentId = 'default' }) => (

  repo.getCompanyFiscalProfile({ tenantId, establishmentId })

);



export const fetchCompanyFiscalProfiles = async (tenantId) => (

  repo.listCompanyFiscalProfiles(tenantId)

);



export const upsertProductFiscalProfile = async (profile, actor, actorContext) => {

  assertActorPermission(actorContext, FISCAL_CONFIG_PERMISSIONS.EDIT_DRAFT);

  return repo.saveProductFiscalProfile({

    ...stripAuditFromPayload(profile),

    configuredBy: actor?.userId ?? null,

    configuredAt: new Date().toISOString(),

  });

};



export const fetchProductFiscalProfile = async ({ tenantId, productId }) => (

  repo.getProductFiscalProfile({ tenantId, productId })

);



export const fetchProductFiscalProfiles = async (tenantId) => (

  repo.listProductFiscalProfiles(tenantId)

);



export const upsertCustomerTaxProfile = async (profile, actor, actorContext) => {

  assertActorPermission(actorContext, FISCAL_CONFIG_PERMISSIONS.EDIT_DRAFT);

  return repo.saveCustomerTaxProfile({

    ...stripAuditFromPayload(profile),

    configuredBy: actor?.userId ?? null,

    configuredAt: new Date().toISOString(),

  });

};



export const fetchCustomerTaxProfile = async ({ tenantId, customerId }) => (

  repo.getCustomerTaxProfile({ tenantId, customerId })

);



export const fetchCustomerTaxProfiles = async (tenantId) => (

  repo.listCustomerTaxProfiles(tenantId)

);



export const createAccountantApprovedRuleDraft = async (rule, actor, actorContext) => {

  assertActorPermission(actorContext, FISCAL_CONFIG_PERMISSIONS.EDIT_DRAFT);

  if (rule.tenantId && actor?.empresaId && rule.tenantId !== actor.empresaId) {

    throw new Error('Cross-tenant: tenantId não corresponde ao actor');

  }

  return repo.saveAccountantApprovedRuleDraft({

    ...stripAuditFromPayload(rule),

    tenantId: rule.tenantId ?? actor?.empresaId,

    status: ACCOUNTANT_RULE_STATUS.DRAFT,

    version: rule.version ?? 1,

    name: rule.name ?? null,

    description: rule.description ?? null,

    authoringType: rule.authoringType ?? 'DIRECT_RULE',

    configuredBy: actor?.userId ?? null,

    configuredAt: new Date().toISOString(),

  });

};



export const updateAccountantApprovedRuleDraft = async (tenantId, ruleId, version, patch, actor, actorContext) => {

  assertActorPermission(actorContext, FISCAL_CONFIG_PERMISSIONS.EDIT_DRAFT);

  if (tenantId !== actor?.empresaId) throw new Error('Cross-tenant negado');

  const existing = await repo.getAccountantApprovedRule({ tenantId, ruleId, version });

  if (!existing) throw new Error(`Regra ${ruleId} v${version} não encontrada`);

  if (existing.status !== ACCOUNTANT_RULE_STATUS.DRAFT) {

    throw new Error('ACCOUNTANT_RULE_IMMUTABLE: apenas DRAFT pode ser editado');

  }

  return repo.saveAccountantApprovedRuleDraft({

    ...existing,

    ...stripAuditFromPayload(patch),

    configuredBy: actor?.userId ?? null,

    configuredAt: new Date().toISOString(),

  });

};



export const approveAccountantFiscalRule = async (tenantId, ruleId, actor, actorContext, justification = null) => {

  assertActorPermission(actorContext, FISCAL_CONFIG_PERMISSIONS.APPROVE);

  if (tenantId !== actor?.empresaId) throw new Error('Cross-tenant negado');



  const existing = await repo.getAccountantApprovedRule({ tenantId, ruleId });

  if (!existing) throw new Error(`Regra ${ruleId} não encontrada para tenant ${tenantId}`);

  if (existing.status !== ACCOUNTANT_RULE_STATUS.DRAFT) {

    throw new Error(`Apenas regras DRAFT podem ser aprovadas (atual: ${existing.status})`);

  }



  const validation = validateAccountantRuleForApproval(existing);

  if (!validation.ok) {

    const error = new Error('ACCOUNTANT_RULE_VALIDATION_FAILED');

    error.code = 'ACCOUNTANT_RULE_VALIDATION_FAILED';

    error.issues = validation.issues;

    throw error;

  }



  return repo.approveAccountantRuleAtomic({

    tenantId,

    ruleId,

    version: existing.version,

    approvedBy: actor?.userId ?? null,

    approvedAt: new Date().toISOString(),

    justification,

  });

};



export const suspendAccountantFiscalRule = async (tenantId, ruleId, actor, actorContext) => {

  assertActorPermission(actorContext, FISCAL_CONFIG_PERMISSIONS.SUSPEND);

  if (tenantId !== actor?.empresaId) throw new Error('Cross-tenant negado');

  return repo.suspendAccountantRule({

    tenantId,

    ruleId,

    suspendedBy: actor?.userId ?? null,

    suspendedAt: new Date().toISOString(),

  });

};



export const revokeAccountantFiscalRule = async (tenantId, ruleId, actor, actorContext) => {

  assertActorPermission(actorContext, FISCAL_CONFIG_PERMISSIONS.REVOKE);

  if (tenantId !== actor?.empresaId) throw new Error('Cross-tenant negado');

  return repo.revokeAccountantRule({

    tenantId,

    ruleId,

    revokedBy: actor?.userId ?? null,

    revokedAt: new Date().toISOString(),

  });

};



export const createAccountantRuleNewVersion = async (tenantId, ruleId, updates, actor, actorContext) => {

  assertActorPermission(actorContext, FISCAL_CONFIG_PERMISSIONS.EDIT_DRAFT);

  if (tenantId !== actor?.empresaId) throw new Error('Cross-tenant negado');

  const existing = await repo.getAccountantApprovedRule({ tenantId, ruleId });

  if (!existing) throw new Error(`Regra ${ruleId} não encontrada`);

  const nextVersion = (existing.version ?? 1) + 1;

  return repo.createAccountantRuleNewVersion({

    ...existing,

    ...stripAuditFromPayload(updates),

    id: existing.id,

    tenantId,

    version: nextVersion,

    status: ACCOUNTANT_RULE_STATUS.DRAFT,

    validFrom: updates.validFrom ?? existing.validFrom,

    validUntil: updates.validUntil ?? existing.validUntil,

    configuredBy: actor?.userId ?? null,

    configuredAt: new Date().toISOString(),

    approvedBy: null,

    approvedAt: null,

    suspendedBy: null,

    suspendedAt: null,

    revokedBy: null,

    revokedAt: null,

  });

};



export const listTenantAccountantRules = async (tenantId) => (

  repo.listAccountantApprovedRulesForTenant(tenantId)

);



export const listTenantAccountantRulesSync = repo.listAccountantApprovedRulesForTenantSync;



export const previewRuleMatchForContext = previewAccountantRuleMatch;

export const previewAccountantFiscalRuleForDraft = previewAccountantFiscalRule;

export const getFiscalConfigurationReadiness = evaluateFiscalConfigurationReadinessForTenant;



export const registerFiscalRuleTemplate = async (template) => (

  repo.saveFiscalRuleTemplate({

    ...template,

    authoritativeForTenant: template.authoritativeForTenant ?? false,

    productionReady: template.productionReady ?? false,

  })

);



export const getFiscalRuleTemplates = async () => repo.listFiscalRuleTemplates();

export const getFiscalRuleTemplateById = async (id) => repo.getFiscalRuleTemplate({ id });

export const registerTaxCatalogEntry = async (entry) => repo.saveTaxCatalogEntry(entry);

export const getTaxCatalog = async () => repo.listTaxCatalogEntries();



export const validateAccountantRuleForAuthoritativeUse = (rule) => {

  const issues = [];

  if (rule.status !== ACCOUNTANT_RULE_STATUS.APPROVED) {

    issues.push(createFiscalIssue(

      'REQUIRES_ACCOUNTANT_REVIEW',

      `Regra ${rule.id} status ${rule.status} — apenas APPROVED pode ser aplicada.`,

      { blocksEmission: true, overrideAllowed: false },

    ));

  }

  return { ok: issues.length === 0, issues };

};



export { validateAccountantRuleForApproval, previewAccountantFiscalRule };
