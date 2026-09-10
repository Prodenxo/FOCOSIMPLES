export const LEGAL_PRIVACY_PATH = '/privacidade.html';
export const LEGAL_TERMS_PATH = '/termos.html';

export function openLegalDocument(path) {
  if (typeof window === 'undefined') return;
  window.open(path, '_blank', 'noopener,noreferrer');
}
