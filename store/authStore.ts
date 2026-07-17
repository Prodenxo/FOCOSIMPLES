import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { clearSupabaseAuthStorage, supabase } from '../lib/supabase';
import { cleanPhone, resolveRoleAndEmpresa, type UserRole } from '../lib/auth-roles';
import { resetSessionActivationSkip } from '../lib/activationSession';
import {
  getErrorMessage,
  isAuthBlockOrExpiryMessage,
  isBenignSignOutError,
  isInvalidRefreshTokenMessage,
} from '../lib/errors';
import { getSupabaseAuthMessagePt } from '../lib/authErrors';
import { requestPasswordReset } from '../services/authService';
import {
  backupAdminSession,
  clearBackedUpAdminSession,
  hasBackedUpAdminSession,
  readBackedUpAdminSession,
} from '../lib/auth-session-backup';
import { impersonateUser, updatePhone as updatePhoneApi } from '../services/authService';
import { signupOriginMetadata } from '../lib/appOrigin';
import {
  AUTH_BOOT_TIMEOUT_MS,
  applyMinimalSessionState,
  withTimeout,
} from '../lib/authBootGuard';

export type SignUpResult =
  | { needsEmailConfirmation: true; email: string }
  | { needsEmailConfirmation: false };

// Função auxiliar para sincronizar número de telefone na tabela n8n_link
const syncPhoneToN8nLink = async (userId: string | null | undefined, phoneNumber: string): Promise<void> => {
  // Se não temos userId, tentar obter da sessão atual
  let finalUserId = userId;
  if (!finalUserId) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      finalUserId = session?.user?.id || null;
    } catch (error) {
      console.error('Erro ao obter sessão para salvar telefone na tabela n8n_link:', error);
    }
  }

  // Se ainda não temos userId, não podemos salvar
  if (!finalUserId) {
    console.warn('Não foi possível salvar telefone na tabela n8n_link: userId não disponível');
    return;
  }

  const cleanedPhone = cleanPhone(phoneNumber) || '';

  try {
    // Preferir Edge Function se existir (operações privilegiadas)
    const { error: functionError } = await supabase.functions.invoke('sync-phone', {
      body: { phone: cleanedPhone },
    });
    if (!functionError) {
      return;
    }
    console.warn('Edge Function sync-phone falhou, tentando upsert direto:', functionError.message);
  } catch (error) {
    console.warn('Erro ao chamar Edge Function sync-phone:', error);
  }

  const { error } = await supabase
    .from('n8n_link')
    .upsert(
      {
        user_id: finalUserId,
        user_number: cleanedPhone,
      },
      {
        onConflict: 'user_id',
      }
    );

  if (error) {
    console.error('Erro ao salvar telefone na tabela n8n_link:', error);
    throw new Error(
      'Não foi possível vincular o WhatsApp. Tente salvar de novo ou use o site meiinfinito.com.br/configuracoes.',
    );
  }
};

const CLEARED_AUTH_STATE = {
  user: null,
  phone: null,
  displayName: null,
  userId: null,
  role: null,
  mei: null,
  empresaId: null,
  isImpersonating: false,
};

async function clearLocalAuthSession(set: (partial: Partial<AuthState>) => void): Promise<void> {
  await clearBackedUpAdminSession();
  await clearSupabaseAuthStorage();
  set(CLEARED_AUTH_STATE);
}

async function getStoredSessionOrClear(set: (partial: Partial<AuthState>) => void) {
  try {
    return await supabase.auth.getSession();
  } catch (error: unknown) {
    if (isInvalidRefreshTokenMessage(getErrorMessage(error))) {
      await clearLocalAuthSession(set);
      return { data: { session: null }, error: null };
    }
    throw error;
  }
}

async function applySessionToStore(
  session: Session,
  set: (partial: Partial<AuthState>) => void,
  isImpersonating: boolean,
): Promise<void> {
  const phone = session.user.user_metadata?.phone || null;
  const displayName = session.user.user_metadata?.display_name || null;
  let role: UserRole | null = null;
  let empresaId: string | null = null;
  let mei: boolean | null = null;
  try {
    const resolved = await resolveRoleAndEmpresa(session.user.id);
    role = resolved.role;
    empresaId = resolved.empresaId;
    mei = resolved.mei ?? null;
  } catch (resolveError: unknown) {
    const msg = getErrorMessage(resolveError);
    if (isAuthBlockOrExpiryMessage(msg)) {
      await supabase.auth.signOut();
      set({
        user: null,
        phone: null,
        displayName: null,
        userId: null,
        role: null,
        mei: null,
        empresaId: null,
        isImpersonating: false,
      });
      throw resolveError instanceof Error ? resolveError : new Error(msg);
    }
  }
  set({
    user: session.user,
    phone,
    displayName,
    userId: session.user.id || null,
    role,
    mei,
    empresaId,
    isImpersonating,
  });
}

interface AuthState {
  user: User | null;
  phone: string | null; // Mantido para compatibilidade
  displayName: string | null;
  role: UserRole | null;
  /** MEI habilitado no vínculo `role_x_user_x_empresa` (paridade web). */
  mei: boolean | null;
  empresaId: string | null;
  sessionRestored: boolean;
  isImpersonating: boolean;
  userId: string | null; // user.id do Supabase Auth
  setUser: (user: User | null) => void;
  setPhone: (phone: string) => void;
  setDisplayName: (displayName: string) => void;
  signUp: (
    email: string,
    password: string,
    phone?: string | null,
    displayName?: string | null,
    inviteToken?: string | null
  ) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initAuth: () => Promise<void>;
  updatePhone: (phone: string) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  impersonate: (targetUserId: string) => Promise<void>;
  stopImpersonating: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  phone: null, // Mantido para compatibilidade
  displayName: null,
  role: null,
  mei: null,
  empresaId: null,
  userId: null,
  sessionRestored: false,
  isImpersonating: false,
  setUser: (user) =>
    set((state) => ({
      user,
      userId: user?.id || null,
      role: state.role,
      mei: state.mei,
      empresaId: state.empresaId,
    })),
  setPhone: (phone) => set({ phone }),
  setDisplayName: (displayName) => set({ displayName }),
  signUp: async (email, password, phone = null, displayName = null, inviteToken = null) => {
    const cleanedPhone = cleanPhone(phone) || null;
    const emailNorm = email.trim();
    const { data, error } = await supabase.auth.signUp({
      email: emailNorm,
      password,
      options: {
        data: {
          phone: cleanedPhone,
          display_name: displayName || null,
          ...signupOriginMetadata(),
        },
      },
    });
    if (error) {
      throw new Error(getSupabaseAuthMessagePt(error));
    }
    if (!data.user) {
      throw new Error('Não foi possível criar a conta. Tente novamente.');
    }

    /** Sem sessão: política Supabase com confirmação de e-mail (ou equivalente). Mantém logout explícito. */
    if (!data.session) {
      await supabase.auth.signOut();
      set({
        user: null,
        phone: null,
        displayName: null,
        userId: null,
        role: null,
        mei: null,
        empresaId: null,
      });
      return { needsEmailConfirmation: true, email: data.user.email ?? emailNorm };
    }

    const sessionUser = data.session.user;
    const userId = sessionUser.id || null;
    let role: UserRole | null = null;
    let empresaId: string | null = null;
    let mei: boolean | null = null;
    if (userId) {
      try {
        const resolved = await resolveRoleAndEmpresa(userId);
        role = resolved.role;
        empresaId = resolved.empresaId;
        mei = resolved.mei ?? null;
      } catch (resolveError: unknown) {
        await supabase.auth.signOut();
        throw resolveError instanceof Error ? resolveError : new Error(getErrorMessage(resolveError));
      }
    }
    if (userId) {
      try {
        await supabase.functions.invoke('ensure-profile');
      } catch (profileError) {
        console.warn('Não foi possível garantir profile padrão:', profileError);
      }
    }

    if (inviteToken) {
      try {
        const { acceptInviteRequest } = await import('../services/invitesService');
        await acceptInviteRequest({ token: inviteToken, mei: false });
        try {
          const resolved = await resolveRoleAndEmpresa(userId ?? sessionUser.id);
          role = resolved.role;
          empresaId = resolved.empresaId;
          mei = resolved.mei ?? null;
        } catch (resolveAfterInviteError) {
          console.warn('Falha ao reconciliar vínculo após aceitar convite:', resolveAfterInviteError);
        }
      } catch (inviteAcceptError) {
        console.warn('Falha ao aceitar convite após signUp:', inviteAcceptError);
      }
    }

    const metaPhone = sessionUser.user_metadata?.phone || cleanedPhone;
    const metaName = sessionUser.user_metadata?.display_name ?? displayName ?? null;

    set({
      user: sessionUser,
      phone: metaPhone,
      displayName: metaName,
      userId,
      role,
      mei,
      empresaId,
    });

    if (userId && cleanedPhone) {
      await syncPhoneToN8nLink(userId, cleanedPhone);
    }

    return { needsEmailConfirmation: false };
  },
  updatePhone: async (phone) => {
    const savedPhone = await updatePhoneApi(phone);
    const currentState = useAuthStore.getState();
    set({
      phone: savedPhone,
      user: currentState.user
        ? {
            ...currentState.user,
            user_metadata: {
              ...currentState.user.user_metadata,
              phone: savedPhone,
            },
          }
        : null,
    });
  },
  updateDisplayName: async (displayName) => {
    const { data, error } = await supabase.auth.updateUser({
      data: { display_name: displayName },
    });
    if (error) throw error;
    // Atualizar estado local com os dados atualizados do Supabase
    if (data.user) {
      const updatedDisplayName = data.user.user_metadata?.display_name || displayName;
      set({ user: data.user, displayName: updatedDisplayName });
    }

    // Tentar atualizar profiles.display_name (não falhar caso RLS bloqueie)
    try {
      await supabase
        .from('profiles')
        .upsert({ id: data.user?.id, display_name: displayName }, { onConflict: 'id' });
    } catch (profileError) {
      console.warn('Não foi possível atualizar profiles.display_name:', profileError);
    }
  },
  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(getSupabaseAuthMessagePt(error));
    }
    const userId = data.user?.id || null;
    let role: UserRole | null = null;
    let empresaId: string | null = null;
    let mei: boolean | null = null;
    if (userId) {
      try {
        const resolved = await resolveRoleAndEmpresa(userId);
        role = resolved.role;
        empresaId = resolved.empresaId;
        mei = resolved.mei ?? null;
      } catch (resolveError: unknown) {
        await supabase.auth.signOut();
        throw resolveError instanceof Error ? resolveError : new Error(getErrorMessage(resolveError));
      }
    }
    const phone = data.user?.user_metadata?.phone || null;
    const displayName = data.user?.user_metadata?.display_name || null;
    set({ user: data.user, phone, displayName, userId, role, mei, empresaId });
  },
  signOut: async () => {
    await clearBackedUpAdminSession();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { error } = await supabase.auth.signOut();
        if (error && !isBenignSignOutError(getErrorMessage(error))) {
          throw error;
        }
      }
    } catch (error: unknown) {
      if (!isBenignSignOutError(getErrorMessage(error))) {
        throw error;
      }
    }
    await clearSupabaseAuthStorage();
    resetSessionActivationSkip();
    set(CLEARED_AUTH_STATE);
  },
  impersonate: async (targetUserId) => {
    const { data: currentSession } = await supabase.auth.getSession();
    if (!currentSession?.session) {
      throw new Error('Sessão não encontrada. Faça login novamente.');
    }

    await backupAdminSession({
      access_token: currentSession.session.access_token,
      refresh_token: currentSession.session.refresh_token,
    });

    try {
      const { token_hash } = await impersonateUser(targetUserId);
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash,
        type: 'magiclink',
      });
      if (error) throw new Error(getSupabaseAuthMessagePt(error));
      if (!data.session) {
        throw new Error('Falha ao obter sessão do usuário alvo');
      }
      await applySessionToStore(data.session, set, true);
    } catch (error) {
      await clearBackedUpAdminSession();
      throw error instanceof Error ? error : new Error(getErrorMessage(error));
    }
  },
  stopImpersonating: async () => {
    const backup = await readBackedUpAdminSession();
    if (!backup) {
      await get().signOut();
      return;
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: backup.access_token,
      refresh_token: backup.refresh_token,
    });
    if (error) throw new Error(getSupabaseAuthMessagePt(error));
    if (!data.session) {
      await clearBackedUpAdminSession();
      throw new Error('Não foi possível restaurar a sessão do administrador');
    }

    await clearBackedUpAdminSession();
    await applySessionToStore(data.session, set, false);
  },
  initAuth: async () => {
    // Evitar múltiplas inicializações
    const currentState = useAuthStore.getState();
    if (currentState.sessionRestored) {
      return;
    }
    
    const { data: { session } } = await getStoredSessionOrClear(set);
    const isImpersonating = await hasBackedUpAdminSession();
    if (session?.user) {
      try {
        await applySessionToStore(session, set, isImpersonating);
      } catch (resolveError: unknown) {
        set({ sessionRestored: true });
        throw resolveError;
      }
      set({ sessionRestored: true });
    } else {
      set({ ...CLEARED_AUTH_STATE, sessionRestored: true });
    }
  },
  updatePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(getSupabaseAuthMessagePt(error));
  },
  resetPassword: async (email) => {
    await requestPasswordReset(email);
  },
}));

/** Watchdog global: vale em qualquer rota (não só `/`). */
setTimeout(() => {
  if (!useAuthStore.getState().sessionRestored) {
    console.warn('[Auth] Timeout global ao restaurar sessão — liberando interface.');
    useAuthStore.setState({ sessionRestored: true });
  }
}, AUTH_BOOT_TIMEOUT_MS);

async function bootstrapAuthFromStorage(): Promise<void> {
  const { data: { session } } = await getStoredSessionOrClear(useAuthStore.setState);
  const isImpersonating = await hasBackedUpAdminSession();

  if (!session) {
    useAuthStore.setState({ ...CLEARED_AUTH_STATE, sessionRestored: true });
    return;
  }

  try {
    await withTimeout(
      applySessionToStore(session, useAuthStore.setState, isImpersonating),
      AUTH_BOOT_TIMEOUT_MS,
      'AUTH_BOOT_TIMEOUT',
    );
    useAuthStore.setState({ sessionRestored: true });
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    if (isAuthBlockOrExpiryMessage(msg)) {
      await clearLocalAuthSession(useAuthStore.setState);
      useAuthStore.setState({ sessionRestored: true });
      return;
    }
    if (msg === 'AUTH_BOOT_TIMEOUT') {
      console.warn('[Auth] Boot lento — exibindo app com sessão mínima.');
      applyMinimalSessionState(session, useAuthStore.setState, isImpersonating);
      void applySessionToStore(session, useAuthStore.setState, isImpersonating).catch(() => {});
      return;
    }
    applyMinimalSessionState(session, useAuthStore.setState, isImpersonating);
  }
}

void bootstrapAuthFromStorage().catch(async (error) => {
  if (isInvalidRefreshTokenMessage(getErrorMessage(error))) {
    await clearLocalAuthSession(useAuthStore.setState);
  }
  console.error('Erro ao inicializar autenticação:', error);
  useAuthStore.setState({ sessionRestored: true });
});

// Listener para eventos de autenticação pós-inicialização.
// TOKEN_REFRESHED: Supabase renovou o JWT automaticamente — atualiza o user no store.
// SIGNED_OUT: sessão expirou sem renovação possível (ex: refresh token inválido) — limpa o store.
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'TOKEN_REFRESHED' && session) {
    useAuthStore.setState({ user: session.user, userId: session.user.id });
  } else if (event === 'SIGNED_OUT') {
    useAuthStore.setState({
      user: null,
      phone: null,
      displayName: null,
      userId: null,
      role: null,
      mei: null,
      empresaId: null,
      isImpersonating: false,
    });
  }
});



