'use client';

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import { unwrapAuthSession } from '@/lib/authApi';
import { acceptInviteRequest } from '@/lib/invitesService';
import { updateDisplayName as apiUpdateDisplayName, updatePhone as apiUpdatePhone } from '@/lib/profileApi';
import {
  buildLocalUser,
  clearLocalAuthSnapshot,
  readLocalAuthSnapshot,
  writeLocalAuthSnapshot,
} from '@/lib/authSession';

const AuthContext = createContext(null);

function buildSnapshotFromSignInResult(result, emailInput) {
  const accessToken = result.session?.access_token;
  const id = result.userId || result.user?.id;
  if (!accessToken || !id) {
    throw new Error('Sessão inválida retornada pela API');
  }
  return {
    accessToken,
    user: buildLocalUser({
      id,
      email: result.user?.email || emailInput,
      phone: result.phone,
      displayName: result.displayName || result.user?.user_metadata?.display_name,
    }),
    role: result.role ?? null,
    empresaId: result.empresaId ?? null,
    mei: result.mei ?? null,
    phone: result.phone ?? null,
    displayName: result.displayName ?? null,
  };
}

export function AuthProvider({ children }) {
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [userId, setUserId] = useState(null);
  const [displayName, setDisplayName] = useState(null);
  const [email, setEmail] = useState(null);
  const [phone, setPhone] = useState(null);
  const [role, setRole] = useState(null);
  const [mei, setMei] = useState(null);

  const hydrateFromSnapshot = useCallback((snap) => {
    setUserId(snap.user?.id || null);
    setDisplayName(snap.displayName || snap.user?.user_metadata?.display_name || null);
    setEmail(snap.user?.email || null);
    setPhone(snap.phone || snap.user?.user_metadata?.phone || null);
    setRole(snap.role ?? null);
    setMei(snap.mei ?? null);
  }, []);

  const persistSnapshot = useCallback(
    (snapshot) => {
      writeLocalAuthSnapshot(snapshot);
      hydrateFromSnapshot(snapshot);
    },
    [hydrateFromSnapshot],
  );

  const refreshSession = useCallback(async () => {
    const snap = readLocalAuthSnapshot();
    if (!snap?.accessToken) {
      setUserId(null);
      return false;
    }
    try {
      const payload = await apiClient.get('/auth/session');
      const session = unwrapAuthSession(payload);
      if (!session) throw new Error('Sessão inválida');

      const next = {
        ...snap,
        role: session.role ?? snap.role,
        empresaId: session.empresaId ?? snap.empresaId,
        mei: session.mei ?? snap.mei,
        phone: session.user?.phone ?? snap.phone,
        displayName: session.user?.displayName || snap.displayName,
        user: {
          ...snap.user,
          id: session.user.id,
          email: session.user.email || snap.user?.email,
          user_metadata: {
            ...snap.user?.user_metadata,
            display_name: session.user?.displayName || snap.user?.user_metadata?.display_name,
            phone: session.user?.phone ?? snap.user?.user_metadata?.phone,
          },
        },
      };
      persistSnapshot(next);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      const isAuthError =
        message.includes('autenticado')
        || message.includes('Sessão')
        || message.includes('401')
        || message.includes('Unauthorized');
      if (isAuthError) {
        clearLocalAuthSnapshot();
        setUserId(null);
        setDisplayName(null);
        setEmail(null);
        setPhone(null);
        setRole(null);
        setMei(null);
      }
      return false;
    }
  }, [persistSnapshot]);

  const refreshSessionRef = useRef(refreshSession);
  refreshSessionRef.current = refreshSession;

  useLayoutEffect(() => {
    const snap = readLocalAuthSnapshot();
    if (snap) hydrateFromSnapshot(snap);
    else setUserId(null);

    setHydrated(true);
    setBooting(false);
    refreshSessionRef.current().catch(() => {});
  }, [hydrateFromSnapshot]);

  const signIn = useCallback(async (emailInput, password) => {
    const result = await apiClient.postPublic('/auth/signin', {
      email: emailInput.trim().toLowerCase(),
      password,
    });
    persistSnapshot(buildSnapshotFromSignInResult(result, emailInput));
    router.replace('/');
  }, [persistSnapshot, router]);

  const signUp = useCallback(async ({ email: emailInput, password, phone: phoneInput, displayName: name, inviteToken }) => {
    const result = await apiClient.postPublic('/auth/signup', {
      email: emailInput.trim().toLowerCase(),
      password,
      phone: phoneInput || null,
      displayName: name || null,
      inviteToken: inviteToken || null,
    });

    if (result.session?.access_token) {
      persistSnapshot(buildSnapshotFromSignInResult(result, emailInput));
      if (inviteToken?.trim()) {
        try {
          await acceptInviteRequest({ token: inviteToken.trim() });
        } catch {
          /* cadastro ok */
        }
      }
      router.replace('/');
      return { needsEmailConfirmation: false };
    }

    return { needsEmailConfirmation: true, email: emailInput };
  }, [persistSnapshot, router]);

  const signOut = useCallback(async () => {
    try {
      await apiClient.post('/auth/signout');
    } catch {
      /* ignora falha de rede no logout */
    }
    clearLocalAuthSnapshot();
    setUserId(null);
    setDisplayName(null);
    setEmail(null);
    setPhone(null);
    setRole(null);
    setMei(null);
    router.replace('/login');
  }, [router]);

  const updateDisplayName = useCallback(async (name) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) throw new Error('Nome inválido');
    await apiUpdateDisplayName(trimmed);
    const snap = readLocalAuthSnapshot();
    if (snap) {
      persistSnapshot({
        ...snap,
        displayName: trimmed,
        user: {
          ...snap.user,
          user_metadata: { ...snap.user?.user_metadata, display_name: trimmed },
        },
      });
    } else {
      setDisplayName(trimmed);
    }
  }, [persistSnapshot]);

  const updatePhone = useCallback(async (phoneDigits) => {
    const cleaned = await apiUpdatePhone(phoneDigits);
    const snap = readLocalAuthSnapshot();
    if (snap) {
      persistSnapshot({
        ...snap,
        phone: cleaned,
        user: {
          ...snap.user,
          user_metadata: { ...snap.user?.user_metadata, phone: cleaned },
        },
      });
    } else {
      setPhone(cleaned);
    }
    return cleaned;
  }, [persistSnapshot]);

  const value = useMemo(
    () => ({
      booting: booting || !hydrated,
      userId,
      displayName,
      email,
      phone,
      role,
      mei,
      signIn,
      signUp,
      signOut,
      refreshSession,
      updateDisplayName,
      updatePhone,
      isAuthenticated: Boolean(userId),
    }),
    [
      booting,
      hydrated,
      userId,
      displayName,
      email,
      phone,
      role,
      mei,
      signIn,
      signUp,
      signOut,
      refreshSession,
      updateDisplayName,
      updatePhone,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
