import { apiClient } from '@/lib/apiClient';

export async function createInvite(body = {}) {
  return apiClient.post('/invites', body);
}

export async function listPendingInvites(params = {}) {
  const q = params.empresas_id
    ? `?empresas_id=${encodeURIComponent(params.empresas_id)}`
    : '';
  const data = await apiClient.get(`/invites${q}`);
  return data?.invites || [];
}

export async function revokeInvite(inviteId) {
  return apiClient.post(`/invites/${encodeURIComponent(inviteId)}/revoke`, {});
}
