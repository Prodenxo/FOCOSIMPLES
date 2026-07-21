import { supabase } from './supabase';
import { normalizeRoleValue, type UserRole } from './auth-roles';
import { apiClient } from './apiClient';
import { getMeiApiBaseUrl } from './runtimeEnv';
import { isLocalApiAuthMode } from './authMode';

export interface ManagedUser {
  id: string;
  email: string | null;
  displayName: string | null;
  phone: string | null;
  role: UserRole;
  empresaId: string | null;
  empresaName?: string | null;
  status?: boolean | null;
  mei?: boolean | null;
  expiresAt?: string | null;
  productLine?: string | null;
}

export interface EmpresaOption {
  id: string;
  empresa: string;
}

export function formatManageUserError(message: string): string {
  const text = message.trim();
  if (text.includes('Limite de MEI atingido')) {
    return 'Esta empresa já atingiu o limite de vagas MEI. Desative o MEI de outro usuário ou aumente o limite da empresa.';
  }
  if (text.includes('Limite de usuarios nao MEI')) {
    return 'Esta empresa já atingiu o limite de usuários PF / Outros.';
  }
  if (text.includes('Edge Function returned a non-2xx')) {
    return 'Não foi possível salvar no servidor. Tente novamente em instantes.';
  }
  return text;
}

export const handleFunctionError = async (error: any, fallbackMessage: string) => {
  let msg = fallbackMessage;
  
  // Tenta extrair a mensagem do body da resposta
  try {
    const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } })?.context;
    if (ctx?.json) {
      const body = await ctx.json();
      if (typeof body?.error === 'string') {
        msg = body.error;
      }
    }
  } catch {
    // Se não conseguir extrair do body, usa a mensagem do erro
    if (error?.message) {
      msg = error.message;
    }
  }
  
  console.error('[handleFunctionError] Erro tratado:', { originalError: error, finalMessage: msg });
  throw new Error(msg);
};

const useBackendApi = () => Boolean(getMeiApiBaseUrl()) || isLocalApiAuthMode();

export const listUsers = async (search?: string): Promise<ManagedUser[]> => {
  if (useBackendApi()) {
    const q = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
    const result = await apiClient.get<{ users: ManagedUser[] }>(`/users${q}`);
    const users = (result?.users || []) as ManagedUser[];
    return users.map((user) => ({
      ...user,
      role: normalizeRoleValue(user.role) || user.role,
      mei: typeof user.mei === 'boolean' ? user.mei : null,
    }));
  }

  const { data, error } = await supabase.functions.invoke('list-users');
  if (error) await handleFunctionError(error, 'Erro ao listar usuários');
  const users = (data?.users || []) as ManagedUser[];
  return users.map((user) => ({
    ...user,
    role: normalizeRoleValue(user.role) || user.role,
    mei: typeof user.mei === 'boolean' ? user.mei : null,
  }));
};

export const listEmpresas = async (): Promise<EmpresaOption[]> => {
  if (useBackendApi()) {
    const result = await apiClient.get<{ empresas?: EmpresaOption[] }>('/users/empresas');
    return (result?.empresas || []) as EmpresaOption[];
  }

  const { data, error } = await supabase.functions.invoke('list-empresas');
  if (error) await handleFunctionError(error, 'Erro ao listar empresas');
  return (data?.empresas || []) as EmpresaOption[];
};

export const createUser = async (input: {
  email: string;
  password?: string;
  displayName?: string;
  phone?: string;
  role?: 'admin' | 'usuario' | 'outsider';
  empresaId?: string;
  /** Só `true` se o admin ligar explicitamente; default sempre false. */
  mei?: boolean;
  expiresAt?: string | null;
}) => {
  const payload = {
    ...input,
    mei: input.mei === true,
  };

  if (useBackendApi()) {
    try {
      return await apiClient.post<{
        userId: string;
        email: string;
        role: string;
        empresaId: string;
        generatedPassword: string | null;
      }>('/users', payload);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar usuário';
      throw new Error(formatManageUserError(message));
    }
  }

  const { data, error } = await supabase.functions.invoke('create-user', { body: payload });
  if (error) await handleFunctionError(error, 'Erro ao criar usuário');
  return data;
};

export const updateUser = async (
  userId: string,
  input: { role?: string; empresaId?: string; displayName?: string; phone?: string; email?: string; mei?: boolean; expiresAt?: string | null },
) => {
  if (useBackendApi()) {
    try {
      return await apiClient.put<{ userId: string; role: string; empresaId: string }>(
        `/users/${encodeURIComponent(userId)}`,
        input,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar usuário';
      throw new Error(formatManageUserError(message));
    }
  }

  const { data, error } = await supabase.functions.invoke('update-user', {
    body: { userId, ...input },
  });
  if (error) await handleFunctionError(error, 'Erro ao atualizar usuário');
  return data;
};

export const banUser = async (userId: string) => {
  if (useBackendApi()) {
    return apiClient.post(`/users/${encodeURIComponent(userId)}/ban`, { status: false });
  }
  const { data, error } = await supabase.functions.invoke('ban-user', { body: { userId } });
  if (error) await handleFunctionError(error, 'Erro ao bloquear usuário');
  return data;
};

export const unbanUser = async (userId: string) => {
  if (useBackendApi()) {
    return apiClient.post(`/users/${encodeURIComponent(userId)}/unban`, {});
  }
  const { data, error } = await supabase.functions.invoke('unban-user', { body: { userId } });
  if (error) await handleFunctionError(error, 'Erro ao desbloquear usuário');
  return data;
};

export const deleteUser = async (userId: string) => {
  if (useBackendApi()) {
    return apiClient.delete(`/users/${encodeURIComponent(userId)}`);
  }
  const { data, error } = await supabase.functions.invoke('delete-user', { body: { userId } });
  if (error) await handleFunctionError(error, 'Erro ao excluir usuário');
  return data;
};

export const resetUserPassword = async (userId: string, password?: string) => {
  if (useBackendApi()) {
    return apiClient.post<{ userId: string; password: string }>(
      `/users/${encodeURIComponent(userId)}/reset-password`,
      { password },
    );
  }
  const { data, error } = await supabase.functions.invoke('reset-user-password', {
    body: { userId, password },
  });
  if (error) await handleFunctionError(error, 'Erro ao redefinir senha');
  return data as { userId: string; password: string };
};
