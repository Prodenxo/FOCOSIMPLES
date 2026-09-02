import { getMeiApiBaseUrl, getPublicEnv } from './runtimeEnv';
import { getLocalAccessToken } from './localAuthSession';
import { isSupabaseConfigured } from './supabase';

/**
 * Auth via backend (`AUTH_MODE=local` no API) — sem Supabase Auth.
 * Ativa com EXPO_PUBLIC_AUTH_MODE=local, ou automaticamente se
 * a API está configurada e o Supabase não.
 */
export function isLocalApiAuthMode(): boolean {
  const flag = getPublicEnv('EXPO_PUBLIC_AUTH_MODE').trim().toLowerCase();
  if (flag === 'local') return true;
  if (flag === 'supabase') return false;
  return Boolean(getMeiApiBaseUrl()) && !isSupabaseConfigured();
}

/**
 * Lançamentos/saldo: usar API do backend (Postgres) em vez de supabase.from().
 * Cobre login local mesmo quando EXPO_PUBLIC_SUPABASE_* ainda está no env.
 */
export async function prefersBackendTransactionsApi(): Promise<boolean> {
  if (isLocalApiAuthMode()) return true;
  if (!getMeiApiBaseUrl()) return false;
  const localToken = await getLocalAccessToken();
  return Boolean(localToken);
}

/** App pode abrir: Supabase clássico OU Auth local + API. */
export function isAppConfigured(): boolean {
  if (isSupabaseConfigured()) return true;
  return isLocalApiAuthMode() && Boolean(getMeiApiBaseUrl());
}
