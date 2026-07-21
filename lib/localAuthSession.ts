import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@supabase/supabase-js';
import type { UserRole } from './auth-roles';

export const LOCAL_AUTH_STORAGE_KEY = 'focosimples-local-auth';

export interface LocalAuthSnapshot {
  accessToken: string;
  user: User;
  role: UserRole | null;
  empresaId: string | null;
  mei: boolean | null;
  phone: string | null;
  displayName: string | null;
}

export async function readLocalAuthSnapshot(): Promise<LocalAuthSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalAuthSnapshot;
    if (!parsed?.accessToken || !parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeLocalAuthSnapshot(
  snapshot: LocalAuthSnapshot,
): Promise<void> {
  await AsyncStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(snapshot));
}

export async function clearLocalAuthSnapshot(): Promise<void> {
  await AsyncStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
}

export async function getLocalAccessToken(): Promise<string | null> {
  const snap = await readLocalAuthSnapshot();
  return snap?.accessToken || null;
}

/** Monta um User compatível com o store (shape Supabase). */
export function buildLocalUser(params: {
  id: string;
  email: string | null;
  phone?: string | null;
  displayName?: string | null;
}): User {
  return {
    id: params.id,
    email: params.email || undefined,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {
      phone: params.phone || null,
      display_name: params.displayName || null,
    },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as User;
}
