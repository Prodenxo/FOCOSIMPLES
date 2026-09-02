import { supabase } from './supabase';
import { isLocalApiAuthMode } from './authMode';

export type UserRole = 'superadmin' | 'admin' | 'usuario' | 'outsider';

export const normalizeRoleValue = (role?: string | null): UserRole | null => {
  if (!role) return null;
  const normalized = String(role).trim().toLowerCase();
  if (normalized === 'user') return 'usuario';
  if (normalized === 'superadmin') return 'superadmin';
  if (normalized === 'admin') return 'admin';
  if (normalized === 'usuario') return 'usuario';
  if (normalized === 'outsider') return 'outsider';
  return null;
};

export const hasRole = (role: UserRole | null, allowed: UserRole[]) => {
  if (!role) return false;
  if (role === 'superadmin') return true;
  return allowed.includes(role);
};

export const roleToDbValue = (role?: UserRole | null): string | null => {
  if (!role) return null;
  if (role === 'usuario') return 'user';
  return role;
};

export const cleanPhone = (phone?: string | null) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
};

export const resolveRoleAndEmpresa = async (userId: string) => {
  if (!userId) {
    return { role: null as UserRole | null, empresaId: null as string | null, mei: null as boolean | null };
  }

  // Auth local: role/empresa já vêm do login/snapshot — não consultar Supabase.
  if (isLocalApiAuthMode()) {
    try {
      const { readLocalAuthSnapshot } = await import('./localAuthSession');
      const snap = await readLocalAuthSnapshot();
      if (snap?.user?.id === userId) {
        return {
          role: snap.role,
          empresaId: snap.empresaId,
          mei: snap.mei,
        };
      }
    } catch {
      // snapshot indisponível
    }
    return { role: null as UserRole | null, empresaId: null as string | null, mei: null as boolean | null };
  }

  try {
    const { data: linkData, error: linkError } = await supabase
      .from('role_x_user_x_empresa')
      .select('empresas_id, roles_id, status, expires_at, mei')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (linkError) {
      console.warn('[Auth] role_x_user_x_empresa lookup error:', linkError.message);
    }

    if (linkData?.status === false) {
      return { role: null as UserRole | null, empresaId: linkData.empresas_id || null, mei: null as boolean | null };
    }

    if (linkData?.roles_id) {
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('roles')
        .eq('id', linkData.roles_id)
        .maybeSingle();

      if (roleError) {
        console.warn('[Auth] roles lookup error:', roleError.message);
      }

      const normalizedRole = normalizeRoleValue(roleData?.roles);
      if (normalizedRole) {
        if (normalizedRole === 'usuario' && linkData.expires_at) {
          const expiresAt = new Date(linkData.expires_at);
          if (expiresAt.getTime() <= Date.now()) {
            throw new Error('Seu acesso expirou');
          }
        }
        return {
          role: normalizedRole,
          empresaId: linkData.empresas_id || null,
          mei: linkData.mei === true,
        };
      }
    }
  } catch (error: any) {
    if (error?.message === 'Seu perfil está bloqueado') {
      throw error;
    }
    console.warn('[Auth] link role resolution error:', error?.message || error);
  }

  return { role: null as UserRole | null, empresaId: null as string | null, mei: null as boolean | null };
};
