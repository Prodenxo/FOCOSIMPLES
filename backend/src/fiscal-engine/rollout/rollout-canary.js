/**
 * Seleção canary determinística — mesma emissão → mesma decisão em retry.
 * Usa hash inteiro (distribuição), não valores fiscais.
 */

/**
 * @param {string} empresaId
 * @param {string} emissionStableId
 * @returns {number} bucket 0..99
 */
export const computeDeterministicCanaryBucket = (empresaId, emissionStableId) => {
  const seed = `${String(empresaId ?? '')}:${String(emissionStableId ?? '')}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 100;
};

/**
 * @param {string} empresaId
 * @param {string} emissionStableId
 * @param {number} canaryPercentage 0..100
 */
export const isCanarySelected = (empresaId, emissionStableId, canaryPercentage) => {
  const pct = Math.max(0, Math.min(100, Number(canaryPercentage) || 0));
  if (pct <= 0) return false;
  if (pct >= 100) return true;
  const bucket = computeDeterministicCanaryBucket(empresaId, emissionStableId);
  return bucket < pct;
};

/**
 * Identidade estável preferida para canary/attempt (meiNotaRecordId quando existir).
 * @param {object} params
 */
export const resolveEmissionStableId = (params) => {
  if (params.meiNotaRecordId) return String(params.meiNotaRecordId);
  if (params.emissionAttemptId) return String(params.emissionAttemptId);
  if (params.idIntegracao) return String(params.idIntegracao);
  if (params.correlationId) return String(params.correlationId);
  return 'unknown-emission';
};
