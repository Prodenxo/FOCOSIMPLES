/**
 * Expo web em produção (Docker/nginx): variáveis podem vir de
 * - build-time (process.env.EXPO_PUBLIC_* inlined pelo Metro)
 * - runtime (/env-config.js gerado no entrypoint — Easypanel env)
 */
import { Platform } from 'react-native'
import { rewriteLocalhostDevApiUrl } from './expoDevApiUrl'

declare global {
  interface Window {
    __MEU_FINANCEIRO_ENV__?: Record<string, string | undefined>;
  }
}

const ENV_KEYS = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_MEI_API_URL',
  'EXPO_PUBLIC_MEI_API_URL_DEV',
  'EXPO_PUBLIC_INVITE_APP_BASE_URL',
  'EXPO_PUBLIC_APP_PRODUCT',
] as const;

export type ExpoPublicEnvKey = (typeof ENV_KEYS)[number];

/** Literais no topo — Metro/Expo só inlined `process.env.EXPO_PUBLIC_*` assim. */
const INLINED_MEI_API_URL = process.env.EXPO_PUBLIC_MEI_API_URL?.trim() ?? '';
const INLINED_MEI_API_URL_DEV = process.env.EXPO_PUBLIC_MEI_API_URL_DEV?.trim() ?? '';

const DEFAULT_LOCAL_MEI_API_URL = 'http://localhost:3333';

function isLocalDevHost(): boolean {
  if (typeof window === 'undefined' || !window.location?.hostname) return false;
  return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
}

function readExpoPublicFromProcess(key: ExpoPublicEnvKey): string {
  switch (key) {
    case 'EXPO_PUBLIC_SUPABASE_URL':
      return process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
    case 'EXPO_PUBLIC_SUPABASE_ANON_KEY':
      return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
    case 'EXPO_PUBLIC_MEI_API_URL':
      return process.env.EXPO_PUBLIC_MEI_API_URL?.trim() ?? '';
    case 'EXPO_PUBLIC_MEI_API_URL_DEV':
      return process.env.EXPO_PUBLIC_MEI_API_URL_DEV?.trim() ?? '';
    case 'EXPO_PUBLIC_INVITE_APP_BASE_URL':
      return process.env.EXPO_PUBLIC_INVITE_APP_BASE_URL?.trim() ?? '';
    case 'EXPO_PUBLIC_APP_PRODUCT':
      return process.env.EXPO_PUBLIC_APP_PRODUCT?.trim() ?? '';
    default:
      return '';
  }
}

export function getPublicEnv(key: ExpoPublicEnvKey): string {
  if (typeof window !== 'undefined') {
    const fromWindow = window.__MEU_FINANCEIRO_ENV__?.[key];
    if (fromWindow && fromWindow.trim().length > 0) {
      return fromWindow.trim();
    }
  }

  const fromProcess = readExpoPublicFromProcess(key);
  if (fromProcess.length > 0) {
    return fromProcess;
  }

  return '';
}

export function hasPublicEnv(keys: ExpoPublicEnvKey[]): boolean {
  return keys.every((k) => getPublicEnv(k).length > 0);
}

/**
 * URL do backend Site/API.
 * No browser em localhost, usa backend local (3333) — não Easypanel.
 */
export function getMeiApiBaseUrl(): string {
  const production =
    (
      getPublicEnv('EXPO_PUBLIC_MEI_API_URL') ||
      INLINED_MEI_API_URL
    ).replace(/\/$/, '') || '';

  const devFromEnv =
    (
      getPublicEnv('EXPO_PUBLIC_MEI_API_URL_DEV') ||
      INLINED_MEI_API_URL_DEV
    ).replace(/\/$/, '');

  const isExpoDev = typeof __DEV__ !== 'undefined' && __DEV__;

  if (isLocalDevHost()) {
    return devFromEnv || DEFAULT_LOCAL_MEI_API_URL;
  }

  if (isExpoDev && devFromEnv) {
    const resolvedDev = rewriteLocalhostDevApiUrl(devFromEnv)
    if (
      Platform.OS !== 'web' &&
      production &&
      /localhost|127\.0\.0\.1/i.test(resolvedDev)
    ) {
      return production
    }
    return resolvedDev
  }

  return production;
}
