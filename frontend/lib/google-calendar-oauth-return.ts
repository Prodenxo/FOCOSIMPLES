import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY = 'mf_google_calendar_oauth_v1';

export type GoogleCalendarOAuthReturnStatus = 'connected' | 'error';

export const GOOGLE_CALENDAR_OAUTH_MESSAGE_TYPE = 'mf-google-calendar-oauth';

/** Popup OAuth: avisa a janela que abriu e tenta fechar (evita configuracoes duplicada). */
export function tryNotifyOpenerAndClosePopup(
  status: GoogleCalendarOAuthReturnStatus,
): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const opener = window.opener as Window | null;
  if (!opener || opener.closed) return false;

  try {
    opener.postMessage(
      { type: GOOGLE_CALENDAR_OAUTH_MESSAGE_TYPE, status },
      window.location.origin,
    );
    window.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Web: guarda resultado do OAuth antes do router mandar para /login.
 * Chamar de forma síncrona no boot (app/_layout).
 */
export function captureGoogleCalendarReturnFromUrlSync(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const status = params.get('googleCalendar');
  if (status !== 'connected' && status !== 'error') return;

  if (tryNotifyOpenerAndClosePopup(status)) {
    return;
  }

  try {
    sessionStorage.setItem(STORAGE_KEY, status);
  } catch {
    /* ignore */
  }
  void AsyncStorage.setItem(STORAGE_KEY, status);

  params.delete('googleCalendar');
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
  window.history.replaceState({}, document.title, nextUrl);
}

/** Native / URL completa com query googleCalendar= */
export async function captureGoogleCalendarOAuthReturn(url?: string): Promise<void> {
  captureGoogleCalendarReturnFromUrlSync();

  if (!url) return;
  try {
    const parsed = new URL(url);
    const status = parsed.searchParams.get('googleCalendar');
    if (status === 'connected' || status === 'error') {
      await AsyncStorage.setItem(STORAGE_KEY, status);
    }
  } catch {
    if (url.includes('googleCalendar=connected')) {
      await AsyncStorage.setItem(STORAGE_KEY, 'connected');
    } else if (url.includes('googleCalendar=error')) {
      await AsyncStorage.setItem(STORAGE_KEY, 'error');
    }
  }
}

export async function consumeGoogleCalendarOAuthReturn(): Promise<GoogleCalendarOAuthReturnStatus | null> {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    const fromSession = sessionStorage.getItem(STORAGE_KEY);
    if (fromSession === 'connected' || fromSession === 'error') {
      sessionStorage.removeItem(STORAGE_KEY);
      void AsyncStorage.removeItem(STORAGE_KEY);
      return fromSession;
    }
  }

  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  await AsyncStorage.removeItem(STORAGE_KEY);
  if (raw === 'connected' || raw === 'error') return raw;
  return null;
}

/** returnTo enviado à edge function (somente web). */
export function buildGoogleOAuthReturnTo(): string | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

  const { origin, pathname } = window.location;
  const basePath = pathname.includes('configuracoes')
    ? pathname.split('?')[0]
    : '/configuracoes';
  return `${origin}${basePath}`;
}
