import { Platform } from 'react-native';
import { useEffect } from 'react';
import { LEGAL_PRIVACY_PATH, LEGAL_PRIVACY_URL, openLegalUrl } from '@/lib/legalUrls';

/**
 * Produção (nginx): /privacidade serve public/privacidade.html antes do SPA.
 * Expo dev: redireciona com reload completo para o HTML estático (evita Unmatched Route).
 */
export default function PrivacidadeRoute() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.replace(LEGAL_PRIVACY_PATH);
      return;
    }
    void openLegalUrl(LEGAL_PRIVACY_URL);
  }, []);

  return null;
}
