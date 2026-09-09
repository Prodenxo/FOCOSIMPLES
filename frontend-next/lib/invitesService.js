import { getApiBaseUrl } from './env';
import { apiClient } from './apiClient';

export async function validateInviteTokenPublic(rawToken) {
  const t = rawToken?.trim();
  if (!t) return { status: 'invalid' };

  const base = getApiBaseUrl();
  const url = `${base}/api/invites/validate?token=${encodeURIComponent(t)}`;
  const response = await fetch(url, { method: 'GET' });
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    throw new Error(`Resposta inesperada do servidor (${response.status}).`);
  }

  const payload = await response.json();
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || `Falha ao validar convite (${response.status}).`);
  }

  const data = payload?.data ?? payload;
  return {
    status: data?.status ?? 'invalid',
    empresaName: data?.empresaName ?? null,
  };
}

export async function acceptInviteRequest(body) {
  return apiClient.post('/invites/accept', body);
}
