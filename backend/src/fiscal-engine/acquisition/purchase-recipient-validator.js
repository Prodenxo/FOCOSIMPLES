/**
 * Valida que destinatário do XML pertence à entidade fiscal (establishment) alvo.
 */
import { onlyDigits } from './purchase-xml-validator.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { normalizeEstablishmentIdFromEmitenteCpfCnpj } from '../establishment/fiscal-establishment-id.js';

/**
 * @param {object} params
 * @param {string} params.destinatarioDoc — CNPJ/CPF do dest no XML
 * @param {string} params.targetEstablishmentId — CNPJ normalizado da entidade fiscal
 */
export const validatePurchaseRecipientForEstablishment = ({
  destinatarioDoc,
  targetEstablishmentId,
}) => {
  const dest = onlyDigits(destinatarioDoc, 14);
  const establishment = normalizeEstablishmentIdFromEmitenteCpfCnpj(targetEstablishmentId);

  if (!establishment) {
    return {
      ok: false,
      issue: createFiscalIssue(
        'PURCHASE_RECIPIENT_MISMATCH',
        'establishmentId alvo inválido para validação do destinatário da compra',
      ),
    };
  }

  if (!dest || (dest.length !== 11 && dest.length !== 14)) {
    return {
      ok: false,
      issue: createFiscalIssue(
        'PURCHASE_RECIPIENT_MISMATCH',
        'Destinatário do XML ausente ou inválido',
        { meta: { destinatarioDoc: dest || null } },
      ),
    };
  }

  const destComparable = dest.length === 11 ? dest.padStart(14, '0') : dest;
  if (destComparable !== establishment && dest !== establishment) {
    return {
      ok: false,
      issue: createFiscalIssue(
        'PURCHASE_RECIPIENT_MISMATCH',
        'Destinatário do XML não corresponde ao establishmentId fiscal alvo',
        {
          meta: { destinatarioDoc: dest, targetEstablishmentId: establishment },
        },
      ),
    };
  }

  return { ok: true };
};

/**
 * @deprecated Prefer validatePurchaseRecipientForEstablishment — empresas.cnpj não é autoridade fiscal multi-CNPJ.
 * @param {object} params
 * @param {string} params.destinatarioDoc
 * @param {string} params.empresaFiscalDoc
 */
export const validatePurchaseRecipient = ({ destinatarioDoc, empresaFiscalDoc }) => (
  validatePurchaseRecipientForEstablishment({
    destinatarioDoc,
    targetEstablishmentId: empresaFiscalDoc,
  })
);
