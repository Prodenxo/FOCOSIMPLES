/**
 * PlugNotas/ISSNET: caracteres tipográficos no XML da DPS podem invalidar a assinatura (E0714).
 * Substitui travessões e similares por hífen ASCII, sem remover acentos.
 */

const TYPOGRAPHIC_DASHES = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;

/**
 * @param {unknown} value
 * @returns {string|null|undefined}
 */
export const sanitizeNfseXmlSafeText = (value) => {
  if (value === undefined || value === null) return value;
  const text = String(value);
  if (!text) return text;
  return text.replace(TYPOGRAPHIC_DASHES, '-');
};

/**
 * Aplica {@link sanitizeNfseXmlSafeText} em campos de texto que entram no XML da DPS.
 * @param {Record<string, unknown>|null|undefined} payload
 * @returns {Record<string, unknown>|null|undefined}
 */
export const sanitizeNfseXmlSafeTextInEmitPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;

  let changed = false;
  const next = { ...payload };

  for (const key of ['descricao', 'informacoesComplementares']) {
    if (typeof next[key] !== 'string') continue;
    const sanitized = sanitizeNfseXmlSafeText(next[key]);
    if (sanitized !== next[key]) {
      next[key] = sanitized;
      changed = true;
    }
  }

  const list = Array.isArray(next.servico)
    ? next.servico
    : next.servico && typeof next.servico === 'object'
      ? [next.servico]
      : [];

  if (list.length) {
    const servicoNext = list.map((item) => {
      if (!item || typeof item !== 'object') return item;
      if (typeof item.discriminacao !== 'string') return item;
      const discriminacao = sanitizeNfseXmlSafeText(item.discriminacao);
      if (discriminacao === item.discriminacao) return item;
      changed = true;
      return { ...item, discriminacao };
    });
    if (changed) {
      next.servico = Array.isArray(next.servico) ? servicoNext : servicoNext[0];
    }
  }

  return changed ? next : payload;
};
