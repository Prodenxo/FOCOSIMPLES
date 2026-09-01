/**
 * Textos legais do Simples Nacional em informações adicionais da NF-e (infCpl).
 * LC 123/2006 — ME/EPP optante.
 */

export const SIMPLES_NACIONAL_NFE_INF_CPL_LINES = [
  'DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL',
  'NÃO GERA DIREITO A CRÉDITO FISCAL DE IPI',
];

const normalizeInfCpl = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase();

const missingSimplesNacionalInfCplLines = (existing) => {
  const hay = normalizeInfCpl(existing);
  return SIMPLES_NACIONAL_NFE_INF_CPL_LINES.filter((line) => !hay.includes(normalizeInfCpl(line)));
};

/**
 * Garante as duas frases do Simples no campo que a PlugNotas manda para infCpl.
 * Não duplica se o texto já estiver na nota. IBPT e outras observações permanecem.
 * @param {Record<string, unknown>} payload
 */
export const applySimplesNacionalInformacoesComplementares = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;

  const existing = String(
    payload.informacoesComplementares || payload.observacoes || '',
  ).trim();
  const missing = missingSimplesNacionalInfCplLines(existing);
  if (!missing.length) return payload;

  const extra = missing.join('\n');
  const merged = existing ? `${extra}\n${existing}` : extra;
  const next = { ...payload, informacoesComplementares: merged };
  if (payload.observacoes !== undefined && payload.observacoes !== null) {
    next.observacoes = merged;
  }
  return next;
};
