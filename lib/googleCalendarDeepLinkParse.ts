/** Alinhado ao redirect da Edge Function `google-calendar` e ao AndroidManifest. */
export const GOOGLE_CALENDAR_CALLBACK_PREFIX = 'financas-pessoais://google-callback';

export type ParsedGoogleCalendarUrl =
  | { kind: 'ignored' }
  | { kind: 'oauth_callback'; code?: string; state?: string; success?: boolean };

/**
 * Interpreta URLs de retorno OAuth / deep link do Google Calendar.
 * Módulo sem dependências de native (aptidão a testes Jest).
 */
export function parseGoogleCalendarCallbackUrl(url: string): ParsedGoogleCalendarUrl {
  if (!url || !url.startsWith(GOOGLE_CALENDAR_CALLBACK_PREFIX)) {
    return { kind: 'ignored' };
  }
  try {
    const noScheme = url.slice(GOOGLE_CALENDAR_CALLBACK_PREFIX.length);
    const query = noScheme.startsWith('?') ? noScheme.slice(1) : noScheme;
    const search = query ? `?${query}` : '';
    const urlObj = new URL(`http://local.invalid/${search}`);
    const code = urlObj.searchParams.get('code') || undefined;
    const state = urlObj.searchParams.get('state') || undefined;
    const successRaw = urlObj.searchParams.get('success');
    const success = successRaw === 'true' ? true : successRaw === 'false' ? false : undefined;
    return { kind: 'oauth_callback', code, state, success };
  } catch {
    return { kind: 'oauth_callback' };
  }
}
