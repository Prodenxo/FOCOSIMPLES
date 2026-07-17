import { Platform, Linking } from 'react-native';
import { appPublicUrl } from './appBrand';

/** Páginas legais — mesma origem do app em produção (FOCO MEI). */
export const LEGAL_PRIVACY_URL = appPublicUrl('/privacidade.html');
export const LEGAL_TERMS_URL = appPublicUrl('/termos.html');

/** HTML estático em public/ — funciona no Expo dev e no nginx. */
export const LEGAL_PRIVACY_PATH = '/privacidade.html';
export const LEGAL_TERMS_PATH = '/termos.html';

export async function openLegalUrl(url: string): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    throw new Error('Não foi possível abrir o link.');
  }
  await Linking.openURL(url);
}
