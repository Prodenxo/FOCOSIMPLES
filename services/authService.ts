import { apiClient } from '../lib/apiClient';
import type { UserRole } from '../lib/auth-roles';

export interface ImpersonateResult {
  email: string;
  token_hash: string;
  redirect_to?: string;
}

export interface LocalAuthResult {
  user: {
    id: string;
    email?: string | null;
    phone?: string | null;
    user_metadata?: { phone?: string | null; display_name?: string | null };
  };
  userId: string | null;
  phone: string | null;
  displayName: string | null;
  role: UserRole | null;
  empresaId: string | null;
  mei: boolean | null;
  session: {
    access_token: string;
    user: LocalAuthResult['user'];
  } | null;
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

export async function signInWithApi(
  email: string,
  password: string,
): Promise<LocalAuthResult> {
  return apiClient.postPublic<LocalAuthResult>('/auth/signin', {
    email: email.trim().toLowerCase(),
    password,
  });
}

export async function signUpWithApi(body: {
  email: string;
  password: string;
  phone?: string | null;
  displayName?: string | null;
  inviteToken?: string | null;
}): Promise<LocalAuthResult> {
  return apiClient.postPublic<LocalAuthResult>('/auth/signup', {
    email: body.email.trim().toLowerCase(),
    password: body.password,
    phone: body.phone || null,
    displayName: body.displayName || null,
    inviteToken: body.inviteToken || null,
  });
}

/** Sessão atual (role / empresa / mei) — usado para atualizar flags sem novo login. */
export async function fetchAuthSession(): Promise<{
  role: UserRole | null;
  empresaId: string | null;
  mei: boolean | null;
  user?: { id?: string; email?: string | null; phone?: string | null; displayName?: string | null };
}> {
  const data = await apiClient.get<{
    session: {
      role: UserRole | null;
      empresaId: string | null;
      mei: boolean | null;
      user?: { id?: string; email?: string | null; phone?: string | null; displayName?: string | null };
    } | null;
  }>('/auth/session');
  if (!data?.session) {
    throw new Error('Sessão inválida');
  }
  return data.session;
}
