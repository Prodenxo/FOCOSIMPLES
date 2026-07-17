import Constants from 'expo-constants';
import { apiClient, getMeiApiUrl } from '../lib/apiClient';
import { getMeiApiBaseUrl } from '../lib/runtimeEnv';

export type InviteValidationStatus =
  | 'valid'
  | 'expired'
  | 'revoked'
  | 'used'
  | 'invalid';

export type InviteValidationResult = {
  status: InviteValidationStatus;
  empresaName?: string | null;
};

/**
 * US-INV-05: valida o token de convite sem Authorization (endpoint público).
 * Espelha Site/services/invitesService.ts validateInviteTokenPublic.
 */
export async function validateInviteTokenPublic(rawToken: string): Promise<InviteValidationResult> {
  const t = rawToken?.trim();
  if (!t) {
    return { status: 'invalid' };
  }

  const url = getMeiApiUrl(`/invites/validate?token=${encodeURIComponent(t)}`);
  const response = await fetch(url, { method: 'GET' });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Resposta inesperada do servidor (${response.status}).`);
  }

  const payload = await response.json();
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || `Falha ao validar convite (${response.status}).`);
  }
  const data = (payload?.data ?? payload) as InviteValidationResult;
  return {
    status: data?.status ?? 'invalid',
    empresaName: data?.empresaName ?? null,
  };
}

/**
 * US-INV-03: após signUp/signIn, chama POST /invites/accept com Bearer para vincular o usuário à empresa.
 * Espelha Site/services/invitesService.ts acceptInviteRequest.
 */
export async function acceptInviteRequest(body: { token: string; mei?: boolean }) {
  return apiClient.post<unknown>('/invites/accept', body);
}

export type EmpresaInviteRow = {
  id: string;
  empresas_id: string;
  created_at: string;
  expires_at: string;
  created_by: string;
  invited_email?: string | null;
  is_reusable?: boolean;
  uses_count?: number;
  raw_token?: string | null;
};

export type CreateInviteResponse = {
  inviteUrl: string;
  invite: Pick<EmpresaInviteRow, 'id' | 'empresas_id' | 'expires_at' | 'created_at' | 'invited_email'>;
};

/** Admin: corpo vazio. Superadmin: `{ empresas_id }` obrigatório. */
export async function createInvite(body: {
  empresas_id?: string;
  invited_email?: string | null;
  is_reusable?: boolean;
} = {}) {
  return apiClient.post<CreateInviteResponse>('/invites', body);
}

export async function listPendingInvites(params?: { empresas_id?: string }) {
  const q = params?.empresas_id
    ? `?empresas_id=${encodeURIComponent(params.empresas_id)}`
    : '';
  return apiClient.get<{ invites: EmpresaInviteRow[] }>(`/invites${q}`);
}

export async function revokeInvite(inviteId: string) {
  return apiClient.post<{ id: string; revoked_at: string }>(`/invites/${inviteId}/revoke`, {});
}

/** Apenas para verificar se a integração MEI API está configurada. */
export function isMeiApiConfigured(): boolean {
  const configured =
    getMeiApiBaseUrl() || Constants.expoConfig?.extra?.meiApiUrl;
  return Boolean(configured);
}
