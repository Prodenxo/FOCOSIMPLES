import { badRequest } from '../utils/errors.js';
import {
  fetchCompanyFiscalProfile,
  upsertCompanyFiscalProfile,
  fetchProductFiscalProfile,
  upsertProductFiscalProfile,
  fetchCustomerTaxProfile,
  upsertCustomerTaxProfile,
  listTenantAccountantRules,
  createAccountantApprovedRuleDraft,
  updateAccountantApprovedRuleDraft,
  approveAccountantFiscalRule,
  suspendAccountantFiscalRule,
  revokeAccountantFiscalRule,
  createAccountantRuleNewVersion,
  previewAccountantFiscalRuleForDraft,
  previewRuleMatchForContext,
  getFiscalConfigurationReadiness,
} from '../fiscal-engine/fiscal-configuration/fiscal-configuration.service.js';
import {
  createFiscalProductGroup,
  updateFiscalProductGroup,
  listFiscalProductGroupsForTenant,
  assignProductsToFiscalGroup,
  listProductsByFiscalProductGroupId,
  removeProductFromFiscalGroup,
  listUnassignedFiscalProducts,
  createFiscalScenarioDraft,
} from '../fiscal-engine/fiscal-configuration/fiscal-product-group.service.js';
import { buildFiscalContextFromAllocation } from '../fiscal-engine/context/build-allocation-fiscal-context.js';

const tenantFromReq = (req) => {
  const { empresaId } = req.requesterContext || {};
  if (!empresaId) throw badRequest('Empresa não vinculada');
  return empresaId;
};

export const getCompanyProfile = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const profile = await fetchCompanyFiscalProfile({ tenantId });
    return res.json({ profile });
  } catch (err) {
    return next(err);
  }
};

export const putCompanyProfile = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const profile = await upsertCompanyFiscalProfile(
      { ...req.body, tenantId },
      req.actor,
      req.actorContext,
    );
    return res.json({ profile });
  } catch (err) {
    return next(err);
  }
};

export const getProductProfile = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const profile = await fetchProductFiscalProfile({ tenantId, productId: req.params.productId });
    return res.json({ profile });
  } catch (err) {
    return next(err);
  }
};

export const putProductProfile = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const profile = await upsertProductFiscalProfile(
      { ...req.body, tenantId, productId: req.params.productId },
      req.actor,
      req.actorContext,
    );
    return res.json({ profile });
  } catch (err) {
    return next(err);
  }
};

export const getCustomerProfile = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const profile = await fetchCustomerTaxProfile({ tenantId, customerId: req.params.customerId });
    return res.json({ profile });
  } catch (err) {
    return next(err);
  }
};

export const putCustomerProfile = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const profile = await upsertCustomerTaxProfile(
      { ...req.body, tenantId, customerId: req.params.customerId },
      req.actor,
      req.actorContext,
    );
    return res.json({ profile });
  } catch (err) {
    return next(err);
  }
};

export const listAccountantRules = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const rules = await listTenantAccountantRules(tenantId);
    return res.json({ rules });
  } catch (err) {
    return next(err);
  }
};

export const postRuleDraft = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const rule = await createAccountantApprovedRuleDraft(
      { ...req.body, tenantId },
      req.actor,
      req.actorContext,
    );
    return res.status(201).json({ rule });
  } catch (err) {
    if (err.code === 'ACCOUNTANT_RULE_VALIDATION_FAILED') {
      return res.status(422).json({ code: err.code, issues: err.issues });
    }
    return next(err);
  }
};

export const patchRuleDraft = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const version = Number(req.body.version ?? req.query.version ?? 1);
    const rule = await updateAccountantApprovedRuleDraft(
      tenantId,
      req.params.ruleId,
      version,
      req.body,
      req.actor,
      req.actorContext,
    );
    return res.json({ rule });
  } catch (err) {
    return next(err);
  }
};

export const postApproveRule = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const rule = await approveAccountantFiscalRule(
      tenantId,
      req.params.ruleId,
      req.actor,
      req.actorContext,
      req.body?.justification ?? null,
    );
    return res.json({ rule });
  } catch (err) {
    if (err.code === 'ACCOUNTANT_RULE_VALIDATION_FAILED') {
      return res.status(422).json({ code: err.code, issues: err.issues });
    }
    return next(err);
  }
};

export const postSuspendRule = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const rule = await suspendAccountantFiscalRule(tenantId, req.params.ruleId, req.actor, req.actorContext);
    return res.json({ rule });
  } catch (err) {
    return next(err);
  }
};

export const postRevokeRule = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const rule = await revokeAccountantFiscalRule(tenantId, req.params.ruleId, req.actor, req.actorContext);
    return res.json({ rule });
  } catch (err) {
    return next(err);
  }
};

export const postNewVersion = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const rule = await createAccountantRuleNewVersion(
      tenantId,
      req.params.ruleId,
      req.body,
      req.actor,
      req.actorContext,
    );
    return res.status(201).json({ rule });
  } catch (err) {
    return next(err);
  }
};

export const postPreviewRule = async (req, res, next) => {
  try {
    tenantFromReq(req);
    const preview = previewAccountantFiscalRuleForDraft(req.body?.rule ?? req.body);
    return res.json(preview);
  } catch (err) {
    return next(err);
  }
};

export const postPreviewMatch = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const context = req.body?.context ?? buildFiscalContextFromAllocation({
      empresaId: tenantId,
      ...req.body,
    });
    const match = await previewRuleMatchForContext(context, {
      approvedRules: req.body?.approvedRules,
    });
    return res.json({ match });
  } catch (err) {
    return next(err);
  }
};

export const getReadiness = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const readiness = await getFiscalConfigurationReadiness({ tenantId });
    return res.json(readiness);
  } catch (err) {
    return next(err);
  }
};

export const listProductGroups = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const groups = await listFiscalProductGroupsForTenant(tenantId);
    return res.json({ groups });
  } catch (err) {
    return next(err);
  }
};

export const postProductGroup = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const group = await createFiscalProductGroup(
      { ...req.body, tenantId },
      req.actor,
      req.actorContext,
    );
    return res.status(201).json({ group });
  } catch (err) {
    return next(err);
  }
};

export const patchProductGroup = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const group = await updateFiscalProductGroup(
      tenantId,
      req.params.id,
      req.body,
      req.actor,
      req.actorContext,
    );
    return res.json({ group });
  } catch (err) {
    return next(err);
  }
};

export const getProductGroupProducts = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const products = await listProductsByFiscalProductGroupId({
      tenantId,
      fiscalProductGroupId: req.params.id,
    });
    return res.json({ products });
  } catch (err) {
    return next(err);
  }
};

export const postProductGroupBulkAssign = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const result = await assignProductsToFiscalGroup({
      tenantId,
      fiscalProductGroupId: req.params.id,
      productIds: req.body?.productIds ?? [],
      replaceExisting: Boolean(req.body?.replaceExisting),
      actor: req.actor,
      actorContext: req.actorContext,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
};

export const deleteProductGroupProduct = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const result = await removeProductFromFiscalGroup({
      tenantId,
      fiscalProductGroupId: req.params.id,
      productId: req.params.productId,
      actor: req.actor,
      actorContext: req.actorContext,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
};

export const getUnassignedProducts = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const productIds = await listUnassignedFiscalProducts({
      tenantId,
      actor: req.actor,
      actorContext: req.actorContext,
    });
    return res.json({ productIds });
  } catch (err) {
    return next(err);
  }
};

export const postScenarioDraft = async (req, res, next) => {
  try {
    const tenantId = tenantFromReq(req);
    const rule = await createFiscalScenarioDraft(
      { ...req.body, tenantId },
      req.actor,
      req.actorContext,
    );
    return res.status(201).json({ rule });
  } catch (err) {
    return next(err);
  }
};
