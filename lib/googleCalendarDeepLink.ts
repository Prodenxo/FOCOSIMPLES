import { useEffect } from 'react';
import { Linking, Alert } from 'react-native';
import { handleGoogleCallback, checkGoogleAuth } from './google-calendar';
import {
  parseGoogleCalendarCallbackUrl,
  GOOGLE_CALENDAR_CALLBACK_PREFIX,
  type ParsedGoogleCalendarUrl,
} from './googleCalendarDeepLinkParse';

export { parseGoogleCalendarCallbackUrl, GOOGLE_CALENDAR_CALLBACK_PREFIX, type ParsedGoogleCalendarUrl };

/** Aguarda backend/token após troca do code (evita condição de corrida com check-auth). */
const POST_CALLBACK_MS = 2000;
const POST_ERROR_RETRY_MS = 3000;

async function processOAuthCallbackParsed(
  parsed: Extract<ParsedGoogleCalendarUrl, { kind: 'oauth_callback' }>,
  onAuthenticated?: () => void
): Promise<void> {
  const showSuccess = () => {
    Alert.alert('Sucesso', 'Integração com Google Calendar autorizada com sucesso!');
    onAuthenticated?.();
  };

  if (parsed.code) {
    try {
      await handleGoogleCallback(parsed.code, parsed.state);
      await new Promise((r) => setTimeout(r, POST_CALLBACK_MS));
      const isAuthenticated = await checkGoogleAuth();
      if (isAuthenticated) {
        showSuccess();
        return;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('401') || message.includes('Missing authorization')) {
        await new Promise((r) => setTimeout(r, POST_ERROR_RETRY_MS));
        const isAuthenticated = await checkGoogleAuth();
        if (isAuthenticated) {
          showSuccess();
        }
      }
    }
    return;
  }

  if (parsed.success === true) {
    await new Promise((r) => setTimeout(r, POST_CALLBACK_MS));
    const isAuthenticated = await checkGoogleAuth();
    if (isAuthenticated) {
      showSuccess();
    }
  }
}

/** Processa uma URL (cold start ou foreground). */
export async function handleGoogleCalendarDeepLinkUrl(
  url: string,
  onAuthenticated?: () => void
): Promise<void> {
  const parsed = parseGoogleCalendarCallbackUrl(url);
  if (parsed.kind !== 'oauth_callback') return;
  await processOAuthCallbackParsed(parsed, onAuthenticated);
}

/** Registra listener + URL inicial; retorna cleanup. */
export function subscribeGoogleCalendarDeepLinks(onAuthenticated?: () => void): () => void {
  const run = (url: string | null) => {
    if (url) void handleGoogleCalendarDeepLinkUrl(url, onAuthenticated);
  };

  void Linking.getInitialURL().then(run);
  const sub = Linking.addEventListener('url', (e) => run(e.url));
  return () => sub.remove();
}

/** Hook para uso no root `App.tsx`. */
export function useGoogleCalendarDeepLink() {
  useEffect(() => subscribeGoogleCalendarDeepLinks(), []);
}
