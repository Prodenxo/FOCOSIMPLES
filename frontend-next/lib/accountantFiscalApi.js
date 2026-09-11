import { apiClient } from '@/lib/apiClient';

function clientBase(empresaId) {
  return `/accountant/clients/${encodeURIComponent(empresaId)}`;
}

export async function listAccountantClients() {
  const data = await apiClient.get('/accountant/clients');
  return data?.clients || data || [];
}

export async function listAccountantProducts(empresaId) {
  const data = await apiClient.get(`${clientBase(empresaId)}/products`);
  return data?.products || data?.items || [];
}

export async function listAccountantEstablishments(empresaId) {
  const data = await apiClient.get(`${clientBase(empresaId)}/establishments`);
  return data?.establishments || [];
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

export async function fetchProductFiscalProfile(empresaId, productId, establishmentId) {
  const qs = establishmentId ? `?establishmentId=${encodeURIComponent(establishmentId)}` : '';
  const data = await apiClient.get(
    `${clientBase(empresaId)}/fiscal-configuration/products/${encodeURIComponent(productId)}/profile${qs}`,
  );
  return data?.profile ?? data ?? null;
}

export async function saveProductFiscalProfile(empresaId, productId, establishmentId, profile) {
  const qs = establishmentId ? `?establishmentId=${encodeURIComponent(establishmentId)}` : '';
  return apiClient.put(
    `${clientBase(empresaId)}/fiscal-configuration/products/${encodeURIComponent(productId)}/profile${qs}`,
    { profile },
  );
}

export async function fetchFiscalReadiness(empresaId, establishmentId) {
  const qs = establishmentId ? `?establishmentId=${encodeURIComponent(establishmentId)}` : '';
  return apiClient.get(`${clientBase(empresaId)}/fiscal-configuration/readiness${qs}`);
}
