import { getMeiApiBaseUrl, getPublicEnv } from './runtimeEnv';
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

/** App pode abrir: Supabase clássico OU Auth local + API. */
export function isAppConfigured(): boolean {
  if (isSupabaseConfigured()) return true;
  return isLocalApiAuthMode() && Boolean(getMeiApiBaseUrl());
}
