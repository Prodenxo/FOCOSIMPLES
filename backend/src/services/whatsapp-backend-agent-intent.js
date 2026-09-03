/**
 * Atalhos óbvios: o modelo às vezes responde "não consigo" sem chamar a ação.
 * @param {string} text
 * @returns {{ action: string, payload: Record<string, unknown> } | null}
 */
export const matchQuickWhatsappIntent = (text) => {
  const t = String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!t) return null;
  if (/\b(das|guia|nota|nfse|nfe|emitir|emissao)\b/.test(t)) return null;
  if (/\b(saldo|quanto (eu )?tenho|quanto tem)\b/.test(t)) {
    return { action: 'get_saldo', payload: {} };
  }
  return null;
};
