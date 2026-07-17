import { apiClient } from '../lib/apiClient';

export interface ImpersonateResult {
  email: string;
  token_hash: string;
  redirect_to?: string;
}

/** Solicita token de impersonação (admin/superadmin). */
export async function impersonateUser(userId: string): Promise<ImpersonateResult> {
  return apiClient.post<ImpersonateResult>('/auth/impersonate', { userId });
}

/** Atualiza telefone WhatsApp (perfil + n8n_link para o robô). */
export async function updatePhone(phone: string): Promise<string> {
  const result = await apiClient.post<{ phone: string }>('/auth/update-phone', { phone });
  return result.phone;
}

/** Solicita e-mail de recuperação de senha (redirect fixo via FRONTEND_URL do backend). */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiClient.postPublic<{ success: boolean }>('/auth/reset-password', {
    email: email.trim().toLowerCase(),
  });
}
