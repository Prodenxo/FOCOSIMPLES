/**
 * Política shadow — quando observar vs quando confirmar consumo virtual.
 * Espelha normalizeStatus de mei-notas.service.js (estados reais PlugNotas/SEFAZ).
 */

const stripDiacritics = (value) => String(value || '')
  .normalize('NFD')
  .replace(/\p{M}/gu, '');

/**
 * Normaliza status bruto do provider para os valores canônicos persistidos em mei_notas.
 * @param {unknown} value
 * @returns {string}
 */
export const normalizeShadowEmissionStatus = (value) => {
  const ascii = stripDiacritics(String(value || '')).toUpperCase();
  if (!ascii) return 'processando';
  if (ascii.includes('CANCELAMENTO_PENDENTE') || (ascii.includes('CANCELAMENTO') && ascii.includes('PENDENTE'))) {
    return 'cancelamento_pendente';
  }
  if (ascii.includes('CONCLUIDO') || ascii.includes('CONCLUIDA') || ascii.includes('AUTORIZ')) return 'concluido';
  if (ascii.includes('PROCESS')) return 'processando';
  if (ascii.includes('REJEIT')) return 'rejeitado';
  if (ascii.includes('CANCEL')) return 'cancelado';
  if (ascii.includes('INTERROMP')) return 'interrompido';
  return String(value || '').toLowerCase();
};

/** Estados terminais observados após poll NF-e/NFS-e (mei-notas isNfseEmitStatusTerminal). */
export const SHADOW_TERMINAL_EMISSION_STATUSES = Object.freeze([
  'concluido',
  'rejeitado',
  'cancelado',
  'interrompido',
]);

/**
 * Shadow observacional pode executar (comparison) sem confirmar ledger.
 * @param {unknown} status
 */
export const isEmissionEligibleForShadowObservation = (status) => {
  const normalized = normalizeShadowEmissionStatus(status);
  return normalized === 'concluido' || normalized === 'processando';
};

/**
 * Consumo virtual CONFIRMED só quando a emissão está fiscalmente autorizada/concluída.
 * Nunca usar status !== 'rejeitado'.
 * @param {unknown} status
 */
export const isEmissionConfirmedForShadow = (status) => (
  normalizeShadowEmissionStatus(status) === 'concluido'
);

/**
 * @param {unknown} status
 */
export const isEmissionRejectedForShadow = (status) => (
  normalizeShadowEmissionStatus(status) === 'rejeitado'
);
