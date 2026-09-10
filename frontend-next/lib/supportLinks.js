/** Contatos de suporte — mesmos valores do SettingsScreen Expo. */
export const SUPPORT_WHATSAPP_URL = 'https://wa.me/5521974526796';
export const SUPPORT_GROUP_URL = 'https://chat.whatsapp.com/G0F3SaEFfvNI066k5MYKDT';

export function openExternalUrl(url) {
  if (typeof window === 'undefined') return;
  window.open(url, '_blank', 'noopener,noreferrer');
}
