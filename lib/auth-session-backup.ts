import AsyncStorage from '@react-native-async-storage/async-storage';

export const ORIGINAL_SESSION_KEY = 'financas-pessoais-original-session';

export interface BackedUpSession {
  access_token: string;
  refresh_token: string;
}

export async function hasBackedUpAdminSession(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(ORIGINAL_SESSION_KEY);
  return Boolean(raw);
}

export async function backupAdminSession(session: BackedUpSession): Promise<void> {
  await AsyncStorage.setItem(ORIGINAL_SESSION_KEY, JSON.stringify(session));
}

export async function readBackedUpAdminSession(): Promise<BackedUpSession | null> {
  const raw = await AsyncStorage.getItem(ORIGINAL_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BackedUpSession;
    if (!parsed?.access_token || !parsed?.refresh_token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearBackedUpAdminSession(): Promise<void> {
  await AsyncStorage.removeItem(ORIGINAL_SESSION_KEY);
}
