/**
 * Identidade estável da emissão para ledger virtual shadow.
 * Separada de executionAttemptId (retry técnico de comparison).
 */

/**
 * @param {object} params
 * @returns {string | null}
 */
export const resolveShadowEmissionIdentity = ({
  shadowEmissionIdentity = null,
  meiNotaRecordId = null,
  idIntegracao = null,
  correlationId = null,
}) => {
  if (shadowEmissionIdentity) return String(shadowEmissionIdentity).trim() || null;
  // meiNotaRecordId é estável por persistência; idIntegracao pode mudar em retry de duplicidade NF-e.
  if (meiNotaRecordId) return String(meiNotaRecordId).trim() || null;
  if (idIntegracao) return String(idIntegracao).trim() || null;
  if (correlationId) return String(correlationId).trim() || null;
  return null;
};

/**
 * @param {object} params
 */
export const buildShadowLedgerIdempotencyKey = ({
  empresaId,
  shadowEmissionIdentity,
  stockLotId,
  itemIndex = 0,
  fifoOrder = 0,
}) => `${empresaId}:${shadowEmissionIdentity}:${stockLotId}:${itemIndex}:${fifoOrder}`;
