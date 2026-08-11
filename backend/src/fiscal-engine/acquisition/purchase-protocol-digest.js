/**
 * Valida coerência entre protNFe.infProt.digVal e DigestValue da NF-e assinada.
 */
import { extractNfeDigestValue } from './purchase-xml-signature.js';

const normalizeBase64 = (value) => String(value || '').replace(/\s+/g, '');

/**
 * @param {object} params
 * @param {string} params.xmlText
 * @param {string} params.infNfeId
 * @param {string|null|undefined} params.protocolDigVal
 */
export const validateProtocolDigestCoherence = ({
  xmlText,
  infNfeId,
  protocolDigVal,
}) => {
  const digVal = normalizeBase64(protocolDigVal);
  if (!digVal) {
    return { ok: true, skipped: true, reason: 'digVal ausente no protocolo' };
  }

  const nfeDigest = normalizeBase64(extractNfeDigestValue(xmlText, infNfeId));
  if (!nfeDigest) {
    return { ok: true, skipped: true, reason: 'DigestValue da assinatura indisponível para comparação' };
  }

  if (digVal !== nfeDigest) {
    return {
      ok: false,
      reason: 'protNFe.infProt.digVal diverge do DigestValue da NF-e assinada',
      protocolDigVal: digVal,
      nfeDigestValue: nfeDigest,
    };
  }

  return { ok: true, skipped: false };
};
