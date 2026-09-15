/**
 * Normalizações finais em `servico[]` antes do POST PlugNotas.
 */

/**
 * PlugNotas pode marcar `tributosFederaisRetidos: true` no XML quando o flag veio ambíguo.
 * Força `false` quando não há retenções federais informadas no item.
 *
 * @param {Record<string, unknown>|null|undefined} payload
 * @returns {Record<string, unknown>|null|undefined}
 */
export const normalizeServicoTributosFederaisRetidosForEmit = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  const servicos = Array.isArray(payload.servico)
    ? payload.servico
    : payload.servico && typeof payload.servico === 'object'
      ? [payload.servico]
      : [];
  if (!servicos.length) return payload;

  const FEDERAL_KEYS = ['pis', 'cofins', 'inss', 'ir', 'csll', 'cpp', 'retencoes'];

  let changed = false;
  const servicoNext = servicos.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const hasFederalDetail = FEDERAL_KEYS.some((key) => {
      const val = item[key];
      if (val === undefined || val === null) return false;
      if (typeof val === 'object') return Object.keys(val).length > 0;
      return String(val).trim() !== '';
    });
    const shouldRetain = item.tributosFederaisRetidos === true && hasFederalDetail;
    if (item.tributosFederaisRetidos === shouldRetain) return item;
    changed = true;
    return { ...item, tributosFederaisRetidos: shouldRetain };
  });

  if (!changed) return payload;
  return {
    ...payload,
    servico: Array.isArray(payload.servico) ? servicoNext : servicoNext[0],
  };
};
