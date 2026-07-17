import { Platform } from 'react-native';
import { REGISTER_INVITE_PREFIX } from './registerInviteDeepLink';
import { getPublicEnv } from './runtimeEnv';

/**
 * Monta URL de cadastro com token de convite (espelha Site `/register?convite=`).
 * Web: origem atual. Native: `EXPO_PUBLIC_INVITE_APP_BASE_URL` ou deep link do app.
 */
export function buildInviteRegisterUrl(rawToken: string): string {
  const token = rawToken.trim();
  if (!token) return '';
  const query = `convite=${encodeURIComponent(token)}`;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const origin = window.location.origin.replace(/\/$/, '');
    return `${origin}/register?${query}`;
  }

  const webBase = getPublicEnv('EXPO_PUBLIC_INVITE_APP_BASE_URL').replace(/\/$/, '');
  if (webBase) {
    return `${webBase}/register?${query}`;
  }

  return `${REGISTER_INVITE_PREFIX}?${query}`;
}
