/**
 * Valida que destinatário do XML pertence à empresa autenticada.
 */
import { onlyDigits } from './purchase-xml-validator.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';

/**
 * @param {object} params
 * @param {string} params.destinatarioDoc — CNPJ/CPF do dest no XML
 * @param {string} params.empresaFiscalDoc — CNPJ da empresa autenticada
 */
export const validatePurchaseRecipient = ({ destinatarioDoc, empresaFiscalDoc }) => {
  const dest = onlyDigits(destinatarioDoc, 14);
  const empresa = onlyDigits(empresaFiscalDoc, 14);

  if (!empresa || empresa.length !== 14) {
    return {
      ok: false,
      issue: createFiscalIssue(
        'PURCHASE_RECIPIENT_MISMATCH',
        'Documento fiscal da empresa autenticada indisponível para validação do destinatário',
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
  if (destComparable !== empresa && dest !== empresa) {
    return {
      ok: false,
      issue: createFiscalIssue(
        'PURCHASE_RECIPIENT_MISMATCH',
        'Destinatário do XML não corresponde ao CNPJ da empresa autenticada',
        {
          meta: { destinatarioDoc: dest, empresaFiscalDoc: empresa },
        },
      ),
    };
  }

  return { ok: true };
};
