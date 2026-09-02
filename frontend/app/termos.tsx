import { Platform } from 'react-native';
import { useEffect } from 'react';
import { LEGAL_TERMS_PATH, LEGAL_TERMS_URL, openLegalUrl } from '@/lib/legalUrls';

export default function TermosRoute() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.replace(LEGAL_TERMS_PATH);
      return;
    }
    void openLegalUrl(LEGAL_TERMS_URL);
  }, []);

  return null;
}
