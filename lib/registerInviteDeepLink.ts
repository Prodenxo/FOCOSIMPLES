import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { getConviteTokenFromSearch } from '../utils/registerInviteQuery';

export const REGISTER_INVITE_PREFIX = 'financas-pessoais://register';

/**
 * Extrai o token de convite (?convite=...) de qualquer URL — deep link nativo ou query string web.
 * Retorna string vazia se não houver token.
 */
export function parseInviteTokenFromUrl(url: string): string {
  if (!url) return '';
  try {
    const queryIndex = url.indexOf('?');
    if (queryIndex < 0) return '';
    const search = url.slice(queryIndex);
    return getConviteTokenFromSearch(search);
  } catch {
    return '';
  }
}

/**
 * Hook que resolve o token de convite a partir do contexto da plataforma:
 *  - web: lê window.location.search
 *  - native: lê Linking.getInitialURL e escuta novos deep links
 *
 * Retorna o token mais recente conhecido (string vazia se não houver).
 */
export function useInviteTokenFromDeepLink(): string {
  const [token, setToken] = useState<string>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return getConviteTokenFromSearch(window.location.search);
    }
    return '';
  });

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let cancelled = false;
    const apply = (url: string | null) => {
      if (cancelled || !url) return;
      const parsed = parseInviteTokenFromUrl(url);
      if (parsed) setToken(parsed);
    };

    void Linking.getInitialURL().then(apply);
    const sub = Linking.addEventListener('url', (e) => apply(e.url));
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return token;
}
