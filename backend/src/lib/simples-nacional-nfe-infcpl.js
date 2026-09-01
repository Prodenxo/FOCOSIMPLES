/**
 * Textos legais do Simples Nacional em informações adicionais da NF-e (infCpl).
 * LC 123/2006 — ME/EPP optante.
 * PlugNotas: quebra de linha em informacoesComplementares é `|`, não \n.
 */

export const SIMPLES_NACIONAL_NFE_INF_CPL_LINES = [
  'DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL',
  'NÃO GERA DIREITO A CRÉDITO FISCAL DE IPI',
];

const PLUGNOTAS_INF_CPL_LINE_SEP = '|';

const sanitizeInfCplForPlugnotas = (value) =>
  String(value || '')
    .replace(/\r\n|\n|\r/g, PLUGNOTAS_INF_CPL_LINE_SEP)
    .replace(/\|{2,}/g, PLUGNOTAS_INF_CPL_LINE_SEP)
    .replace(/^\|+|\|+$/g, '')
    .trim();

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

  const existing = sanitizeInfCplForPlugnotas(
    payload.informacoesComplementares || payload.observacoes || '',
  );
  const missing = missingSimplesNacionalInfCplLines(existing);
  const extra = missing.join(PLUGNOTAS_INF_CPL_LINE_SEP);
  const merged = sanitizeInfCplForPlugnotas(
    extra && existing ? `${extra}${PLUGNOTAS_INF_CPL_LINE_SEP}${existing}` : (extra || existing),
  );
  if (!merged) return payload;
  if (!missing.length && merged === String(payload.informacoesComplementares || '').trim()) {
    return payload;
  }
  const next = { ...payload, informacoesComplementares: merged };
  if (payload.observacoes !== undefined && payload.observacoes !== null) {
    next.observacoes = merged;
  }
  return next;
};
