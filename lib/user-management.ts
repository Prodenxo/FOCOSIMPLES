import { supabase } from './supabase';
import { normalizeRoleValue, type UserRole } from './auth-roles';
import { apiClient } from './apiClient';
import { getMeiApiBaseUrl } from './runtimeEnv';

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

export const listUsers = async (search?: string): Promise<ManagedUser[]> => {
  const hasMeiApi = Boolean(getMeiApiBaseUrl());

  if (hasMeiApi) {
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

  const hasMeiApi = Boolean(getMeiApiBaseUrl());

  if (hasMeiApi) {
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

  console.log('[user-management] Invocando create-user (edge) com input:', {
    email: payload.email,
    hasPassword: !!payload.password,
    role: payload.role,
    empresaId: payload.empresaId,
    mei: payload.mei,
  });

  const { data, error } = await supabase.functions.invoke('create-user', { body: payload });
  
  if (error) {
    console.error('[user-management] Erro na edge function create-user:', {
      message: error.message,
      context: error.context,
      error: error,
      errorKeys: Object.keys(error || {}),
    });
    
    // Tenta extrair a mensagem de erro do body da resposta
    let errorMessage = 'Erro ao criar usuário';
    try {
      // Tenta acessar o context como Response
      const ctx = error.context as Response | undefined;
      if (ctx) {
        // Tenta ler como JSON
        try {
          const body = await ctx.json();
          console.log('[user-management] Body do erro (JSON):', body);
          if (typeof body?.error === 'string') {
            errorMessage = body.error;
          }
        } catch {
          // Se não for JSON, tenta como texto
          try {
            const text = await ctx.text();
            console.log('[user-management] Body do erro (text):', text);
            // Tenta parsear como JSON manualmente
            try {
              const parsed = JSON.parse(text);
              if (typeof parsed?.error === 'string') {
                errorMessage = parsed.error;
              }
            } catch {
              // Se não for JSON válido, usa o texto
              if (text) {
                errorMessage = text;
              }
            }
          } catch (textError) {
            console.warn('[user-management] Não foi possível ler como texto:', textError);
          }
        }
      }
      
      // Fallback: verifica se há mensagem direta no erro
      if (errorMessage === 'Erro ao criar usuário' && error?.message) {
        errorMessage = error.message;
      }
    } catch (parseError) {
      console.warn('[user-management] Erro ao processar erro:', parseError);
      if (error?.message) {
        errorMessage = error.message;
      }
    }
    
    console.error('[user-management] Mensagem de erro final:', errorMessage);
    throw new Error(errorMessage);
  }
  
  console.log('[user-management] Resposta da edge function:', {
    hasData: !!data,
    userId: data?.userId,
    email: data?.email,
    hasGeneratedPassword: !!data?.generatedPassword,
  });
  
  return data;
};

export const updateUser = async (
  userId: string,
  input: { role?: string; empresaId?: string; displayName?: string; phone?: string; email?: string; mei?: boolean; expiresAt?: string | null },
) => {
  const hasMeiApi = Boolean(getMeiApiBaseUrl());

  if (hasMeiApi) {
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

  console.log('[updateUser] payload (edge)', { userId, ...input });
  const { data, error } = await supabase.functions.invoke('update-user', {
    body: { userId, ...input },
  });
  if (error) {
    let msg = 'Erro ao atualizar usuário';
    try {
      const ctx = error.context as Response | undefined;
      if (ctx) {
        try {
          const body = await ctx.json();
          if (typeof body?.error === 'string') msg = body.error;
          else if (typeof body?.message === 'string') msg = body.message;
        } catch {
          const text = await ctx.text();
          if (text) {
            try {
              const parsed = JSON.parse(text);
              if (typeof parsed?.error === 'string') msg = parsed.error;
              else if (typeof parsed?.message === 'string') msg = parsed.message;
            } catch {
              msg = text;
            }
          }
        }
      } else if (error?.message) {
        msg = error.message;
      }
    } catch {
      if (error?.message) msg = error.message;
    }
    console.error('[updateUser] error', { message: error.message, extractedMessage: msg });
    throw new Error(formatManageUserError(msg));
  }
  console.log('[updateUser] response (edge)', data);
  return data;
};

export const banUser = async (userId: string) => {
  const { data, error } = await supabase.functions.invoke('ban-user', { body: { userId } });
  if (error) await handleFunctionError(error, 'Erro ao bloquear usuário');
  return data;
};

export const unbanUser = async (userId: string) => {
  const { data, error } = await supabase.functions.invoke('unban-user', { body: { userId } });
  if (error) await handleFunctionError(error, 'Erro ao desbloquear usuário');
  return data;
};

export const deleteUser = async (userId: string) => {
  const { data, error } = await supabase.functions.invoke('delete-user', { body: { userId } });
  if (error) await handleFunctionError(error, 'Erro ao excluir usuário');
  return data;
};

export const resetUserPassword = async (userId: string, password?: string) => {
  const { data, error } = await supabase.functions.invoke('reset-user-password', {
    body: { userId, password },
  });
  if (error) await handleFunctionError(error, 'Erro ao redefinir senha');
  return data as { userId: string; password: string };
};
