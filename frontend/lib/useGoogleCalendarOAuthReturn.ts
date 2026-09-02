import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { checkGoogleAuth } from './google-calendar';
import {
  captureGoogleCalendarReturnFromUrlSync,
  consumeGoogleCalendarOAuthReturn,
  GOOGLE_CALENDAR_OAUTH_MESSAGE_TYPE,
  type GoogleCalendarOAuthReturnStatus,
} from './google-calendar-oauth-return';
import { useGoogleCalendarStore } from '../store/googleCalendarStore';
import { useAppToastStore } from '../store/appToastStore';

export async function finalizeGoogleCalendarOAuthReturn(
  status: GoogleCalendarOAuthReturnStatus,
  showToast: (message: string, variant?: 'success' | 'error' | 'info') => void,
): Promise<void> {
  if (status === 'connected') {
    const integrated = await checkGoogleAuth();
    if (integrated) {
      useGoogleCalendarStore.getState().notifyConnectionChanged();
      showToast('Google Agenda vinculada com sucesso!', 'success');
    } else {
      showToast(
        'Autorização recebida. Se a agenda não aparecer conectada, tente atualizar a página.',
        'info',
      );
    }
    return;
  }

  showToast('Não foi possível vincular o Google Agenda. Tente novamente.', 'error');
}

/**
 * Processa ?googleCalendar=connected|error após OAuth (web e cold start).
 * Deve rodar no root layout (app/_layout.tsx).
 */
export function useGoogleCalendarOAuthReturn() {
  const sessionRestored = useAuthStore((s) => s.sessionRestored);
  const user = useAuthStore((s) => s.user);
  const showToast = useAppToastStore((s) => s.show);
  const handled = useRef(false);

  const runFinalize = useCallback(
    async (status: GoogleCalendarOAuthReturnStatus) => {
      if (handled.current) return;
      handled.current = true;
      await finalizeGoogleCalendarOAuthReturn(status, showToast);
    },
    [showToast],
  );

  useEffect(() => {
    captureGoogleCalendarReturnFromUrlSync();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; status?: string } | null;
      if (data?.type !== GOOGLE_CALENDAR_OAUTH_MESSAGE_TYPE) return;
      if (data.status !== 'connected' && data.status !== 'error') return;
      if (!useAuthStore.getState().user) return;
      void runFinalize(data.status);
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [runFinalize]);

  useEffect(() => {
    if (!sessionRestored || !user || handled.current) return;

    void (async () => {
      const status = await consumeGoogleCalendarOAuthReturn();
      if (!status) return;
      await runFinalize(status);
    })();
  }, [sessionRestored, user, runFinalize]);
}
