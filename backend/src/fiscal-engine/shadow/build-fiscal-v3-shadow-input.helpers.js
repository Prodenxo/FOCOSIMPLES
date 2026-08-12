/**
 * Helpers do shadow input adapter.
 */
import { ICMS_TAXPAYER_STATUS } from '../types/item-source.js';

const onlyDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);

/**
 * @param {object} destinatario
 */
export const deriveIcmsTaxpayerStatusFromLegacyDestinatario = (destinatario) => {
  const explicit = String(destinatario?.icmsTaxpayerStatus ?? '').trim().toUpperCase();
  if (Object.values(ICMS_TAXPAYER_STATUS).includes(explicit)) return explicit;

  const ind = String(destinatario?.indIEDest ?? destinatario?.indicadorInscricaoEstadual ?? '').trim();
  if (ind === '1') return ICMS_TAXPAYER_STATUS.TAXPAYER;
  if (ind === '2') return ICMS_TAXPAYER_STATUS.EXEMPT;
  if (ind === '9') return ICMS_TAXPAYER_STATUS.NON_TAXPAYER;

  const doc = onlyDigits(destinatario?.cpfCnpj, 14);
  if (doc.length === 11) return ICMS_TAXPAYER_STATUS.NON_TAXPAYER;

  return ICMS_TAXPAYER_STATUS.UNKNOWN;
};
