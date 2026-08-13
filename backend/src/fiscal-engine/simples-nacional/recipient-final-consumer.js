/**
 * Consumidor final — dimensão explícita YES/NO/UNKNOWN (Fase 8B).
 */

/** @typedef {'YES' | 'NO' | 'UNKNOWN'} RecipientFinalConsumerStatus */

/**
 * @param {boolean | null | undefined} consumidorFinal
 * @returns {RecipientFinalConsumerStatus}
 */
export const normalizeRecipientFinalConsumer = (consumidorFinal) => {
  if (consumidorFinal === true) return 'YES';
  if (consumidorFinal === false) return 'NO';
  return 'UNKNOWN';
};

/**
 * @param {RecipientFinalConsumerStatus} status
 * @returns {boolean | null}
 */
export const recipientFinalConsumerToBoolean = (status) => {
  if (status === 'YES') return true;
  if (status === 'NO') return false;
  return null;
};
