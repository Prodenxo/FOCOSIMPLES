/**
 * Service Phase 8D — FiscalProductGroup + membership (sem segundo motor fiscal).
 */
import * as repo from './fiscal-configuration-repository.service.js';
import {
  FISCAL_PRODUCT_GROUP_STATUS,
  ACCOUNTANT_RULE_AUTHORING_TYPE,
  FISCAL_CONFIG_PERMISSIONS,
} from './constants.js';
import { assertActorPermission } from './fiscal-configuration.service.js';
import {
  validateProductsBelongToTenant,
  listCatalogProductIdsForUser,
} from './fiscal-product-catalog.port.js';
import { randomUUID } from 'node:crypto';

const assertTenant = (tenantId, actor) => {
  if (tenantId !== actor?.empresaId) throw new Error('Cross-tenant negado');
};

export const createFiscalProductGroup = async (payload, actor, actorContext) => {
  assertActorPermission(actorContext, FISCAL_CONFIG_PERMISSIONS.EDIT_DRAFT);
  const tenantId = payload.tenantId ?? actor?.empresaId;
  assertTenant(tenantId, actor);
  if (!payload.name?.trim()) throw new Error('FISCAL_PRODUCT_GROUP_NAME_REQUIRED');

  const existing = (await repo.listFiscalProductGroups(tenantId))
    .find((g) => g.name === payload.name.trim());
  if (existing) {
    const err = new Error('FISCAL_PRODUCT_GROUP_DUPLICATE_NAME');
    err.code = 'FISCAL_PRODUCT_GROUP_DUPLICATE_NAME';
    throw err;
  }

  return repo.saveFiscalProductGroup({
    id: payload.id ?? randomUUID(),
    tenantId,
    name: payload.name.trim(),
    description: payload.description ?? null,
    status: payload.status ?? FISCAL_PRODUCT_GROUP_STATUS.ACTIVE,
    createdBy: actor?.userId ?? null,
    createdAt: new Date().toISOString(),
    updatedBy: actor?.userId ?? null,
  });
};

export const updateFiscalProductGroup = async (tenantId, groupId, patch, actor, actorContext) => {
  assertActorPermission(actorContext, FISCAL_CONFIG_PERMISSIONS.EDIT_DRAFT);
  assertTenant(tenantId, actor);
  const existing = await repo.getFiscalProductGroup({ tenantId, id: groupId });
  if (!existing) throw new Error('FISCAL_PRODUCT_GROUP_NOT_FOUND');

  if (patch.name && patch.name !== existing.name) {
    const dup = (await repo.listFiscalProductGroups(tenantId))
      .find((g) => g.name === patch.name.trim() && g.id !== groupId);
    if (dup) {
      const err = new Error('FISCAL_PRODUCT_GROUP_DUPLICATE_NAME');
      err.code = 'FISCAL_PRODUCT_GROUP_DUPLICATE_NAME';
      throw err;
    }
  }

  return repo.saveFiscalProductGroup({
    ...existing,
    ...patch,
    id: groupId,
    tenantId,
    name: patch.name?.trim() ?? existing.name,
    updatedBy: actor?.userId ?? null,
  });
};

export const listFiscalProductGroupsForTenant = async (tenantId) => (
  repo.listFiscalProductGroups(tenantId)
);

export const getFiscalProductGroupForProduct = async ({ tenantId, productId }) => {
  const membership = await repo.getFiscalProductGroupMembership({ tenantId, productId });
  if (!membership) return null;
  const group = await repo.getFiscalProductGroup({ tenantId, id: membership.fiscalProductGroupId });
  return group ? { group, membership } : null;
};

export const listProductsByFiscalProductGroupId = async ({ tenantId, fiscalProductGroupId }) => (
  repo.listProductsByFiscalProductGroup({ tenantId, fiscalProductGroupId })
);

export const removeProductFromFiscalGroup = async ({
  tenantId, fiscalProductGroupId, productId, actor, actorContext,
}) => {
  assertActorPermission(actorContext, FISCAL_CONFIG_PERMISSIONS.EDIT_DRAFT);
  assertTenant(tenantId, actor);
  const membership = await repo.getFiscalProductGroupMembership({ tenantId, productId });
  if (!membership || membership.fiscalProductGroupId !== fiscalProductGroupId) {
    throw new Error('FISCAL_PRODUCT_GROUP_MEMBERSHIP_NOT_FOUND');
  }
  await repo.removeFiscalProductGroupMembership({ tenantId, productId });
  return { removed: true, productId };
};

export const assignProductsToFiscalGroup = async ({
  tenantId,
  fiscalProductGroupId,
  productIds,
  replaceExisting = false,
  actor,
  actorContext,
}) => {
  assertActorPermission(actorContext, FISCAL_CONFIG_PERMISSIONS.EDIT_DRAFT);
  assertTenant(tenantId, actor);

  const group = await repo.getFiscalProductGroup({ tenantId, id: fiscalProductGroupId });
  if (!group) throw new Error('FISCAL_PRODUCT_GROUP_NOT_FOUND');
  if (group.status !== FISCAL_PRODUCT_GROUP_STATUS.ACTIVE) {
    throw new Error('FISCAL_PRODUCT_GROUP_NOT_ACTIVE');
  }

  const deduped = [...new Set((productIds ?? []).map(String))];
  if (deduped.length === 0) throw new Error('PRODUCT_IDS_REQUIRED');

  await validateProductsBelongToTenant({
    userId: actor.userId,
    tenantId,
    productIds: deduped,
  });

  return repo.bulkAssignProductsToFiscalGroup({
    tenantId,
    fiscalProductGroupId,
    productIds: deduped,
    replaceExisting: Boolean(replaceExisting),
    assignedBy: actor?.userId ?? null,
  });
};

export const listUnassignedFiscalProducts = async ({ tenantId, actor, actorContext }) => {
  assertActorPermission(actorContext, FISCAL_CONFIG_PERMISSIONS.VIEW);
  assertTenant(tenantId, actor);
  const catalogIds = await listCatalogProductIdsForUser(actor.userId);
  const memberships = await repo.listFiscalProductGroupMemberships(tenantId);
  const assigned = new Set(memberships.map((m) => String(m.productId)));
  return catalogIds.filter((id) => !assigned.has(String(id)));
};

/** Cria DRAFT de cenário fiscal — AccountantApprovedFiscalRule com metadata. */
export const createFiscalScenarioDraft = async (payload, actor, actorContext) => {
  const { createAccountantApprovedRuleDraft } = await import('./fiscal-configuration.service.js');
  return createAccountantApprovedRuleDraft({
    ...payload,
    authoringType: ACCOUNTANT_RULE_AUTHORING_TYPE.FISCAL_SCENARIO,
    name: payload.name,
    description: payload.description,
  }, actor, actorContext);
};

export {
  ACCOUNTANT_RULE_AUTHORING_TYPE,
  FISCAL_PRODUCT_GROUP_STATUS,
};
