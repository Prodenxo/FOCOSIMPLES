import { apiClient } from '@/lib/apiClient';

function clientBase(empresaId) {
  return `/accountant/clients/${encodeURIComponent(empresaId)}`;
}

export async function listAccountantClients() {
  const data = await apiClient.get('/accountant/clients');
  return data?.clients || data || [];
}

export async function listAccountantProducts(empresaId, options = {}) {
  const params = new URLSearchParams();
  if (options.q) params.set('q', options.q);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.documentType) params.set('documentType', options.documentType);
  if (options.emitterUserId) params.set('emitterUserId', options.emitterUserId);
  const qs = params.toString();
  const data = await apiClient.get(`${clientBase(empresaId)}/products${qs ? `?${qs}` : ''}`);
  return data?.products || data?.items || [];
}

export async function listAccountantEstablishments(empresaId) {
  const data = await apiClient.get(`${clientBase(empresaId)}/establishments`);
  if (data?.establishments) return data;
  return {
    establishments: Array.isArray(data) ? data : [],
    status: data?.status ?? 'OK',
  };
}

function fiscalConfigBase(empresaId) {
  return `${clientBase(empresaId)}/fiscal-configuration`;
}

export class FiscalConfigurationApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function isFiscalForbiddenError(error) {
  return error instanceof FiscalConfigurationApiError && error.status === 403;
}

export async function createAccountantClientProduct(empresaId, body, options = {}) {
  const params = new URLSearchParams();
  if (options.emitterUserId) params.set('emitterUserId', options.emitterUserId);
  const qs = params.toString();
  const data = await apiClient.post(
    `${clientBase(empresaId)}/products${qs ? `?${qs}` : ''}`,
    body,
  );
  return data?.product ?? data;
}

export async function updateAccountantClientProduct(empresaId, productId, body) {
  const data = await apiClient.patch(
    `${clientBase(empresaId)}/products/${encodeURIComponent(productId)}`,
    body,
  );
  return data?.product ?? data;
}

export async function listAccountantFiscalRules(empresaId) {
  const data = await apiClient.get(`${fiscalConfigBase(empresaId)}/rules`);
  return data?.rules ?? [];
}

export async function createAccountantRuleDraft(empresaId, rule) {
  const data = await apiClient.post(`${fiscalConfigBase(empresaId)}/rules`, rule);
  return data?.rule ?? data;
}

export async function updateAccountantRuleDraft(empresaId, ruleId, version, patch) {
  const data = await apiClient.patch(
    `${fiscalConfigBase(empresaId)}/rules/${encodeURIComponent(ruleId)}`,
    { ...patch, version },
  );
  return data?.rule ?? data;
}

export async function approveAccountantRule(empresaId, ruleId, justification) {
  const data = await apiClient.post(
    `${fiscalConfigBase(empresaId)}/rules/${encodeURIComponent(ruleId)}/approve`,
    { justification: justification ?? undefined },
  );
  return data?.rule ?? data;
}

export async function createAccountantRuleNewVersion(empresaId, ruleId, updates) {
  const data = await apiClient.post(
    `${fiscalConfigBase(empresaId)}/rules/${encodeURIComponent(ruleId)}/versions`,
    updates,
  );
  return data?.rule ?? data;
}

export async function previewAccountantRuleDraft(empresaId, rule) {
  return apiClient.post(`${fiscalConfigBase(empresaId)}/rules/preview`, { rule });
}

export async function fetchFiscalConfigurationReadiness(empresaId, establishmentId) {
  const qs = establishmentId ? `?establishmentId=${encodeURIComponent(establishmentId)}` : '';
  return apiClient.get(`${fiscalConfigBase(empresaId)}/readiness${qs}`);
}

export async function listFiscalProductGroups(empresaId) {
  const data = await apiClient.get(`${fiscalConfigBase(empresaId)}/product-groups`);
  return data?.groups ?? [];
}

export async function createFiscalProductGroup(empresaId, input) {
  const data = await apiClient.post(`${fiscalConfigBase(empresaId)}/product-groups`, input);
  return data?.group ?? data;
}

export async function updateFiscalProductGroup(empresaId, groupId, input) {
  const data = await apiClient.patch(
    `${fiscalConfigBase(empresaId)}/product-groups/${encodeURIComponent(groupId)}`,
    input,
  );
  return data?.group ?? data;
}

export async function listFiscalProductGroupProducts(empresaId, groupId) {
  const data = await apiClient.get(
    `${fiscalConfigBase(empresaId)}/product-groups/${encodeURIComponent(groupId)}/products`,
  );
  return data?.products ?? [];
}

export async function assignProductsToFiscalGroup(empresaId, groupId, productIds, replaceExisting = false) {
  return apiClient.post(
    `${fiscalConfigBase(empresaId)}/product-groups/${encodeURIComponent(groupId)}/products/bulk-assign`,
    { productIds, replaceExisting },
  );
}

export async function removeProductFromFiscalGroup(empresaId, groupId, productId) {
  return apiClient.delete(
    `${fiscalConfigBase(empresaId)}/product-groups/${encodeURIComponent(groupId)}/products/${encodeURIComponent(productId)}`,
  );
}

export async function fetchProductFiscalProfile(empresaId, productId, establishmentId) {
  const qs = establishmentId ? `?establishmentId=${encodeURIComponent(establishmentId)}` : '';
  const data = await apiClient.get(
    `${fiscalConfigBase(empresaId)}/products/${encodeURIComponent(productId)}/profile${qs}`,
  );
  return data?.profile ?? data ?? null;
}

export async function fetchCompanyFiscalProfile(empresaId, establishmentId) {
  const qs = establishmentId ? `?establishmentId=${encodeURIComponent(establishmentId)}` : '';
  const data = await apiClient.get(`${clientBase(empresaId)}/fiscal-configuration/company-profile${qs}`);
  return data?.profile ?? data ?? null;
}

export async function saveCompanyFiscalProfile(empresaId, establishmentId, profile) {
  const qs = establishmentId ? `?establishmentId=${encodeURIComponent(establishmentId)}` : '';
  return apiClient.put(`${clientBase(empresaId)}/fiscal-configuration/company-profile${qs}`, { profile });
}

export async function saveProductFiscalProfile(empresaId, productId, establishmentId, profile) {
  const qs = establishmentId ? `?establishmentId=${encodeURIComponent(establishmentId)}` : '';
  return apiClient.put(
    `${clientBase(empresaId)}/fiscal-configuration/products/${encodeURIComponent(productId)}/profile${qs}`,
    { profile },
  );
}

export async function fetchFiscalReadiness(empresaId, establishmentId) {
  return fetchFiscalConfigurationReadiness(empresaId, establishmentId);
}
