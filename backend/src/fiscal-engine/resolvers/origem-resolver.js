/**
 * Resolve origem fiscal — product.defaultOrigemMercadoria NÃO entra na precedência.
 */
import {
  ORIGEM_FISCAL_SOURCE,
  normalizeOrigemMercadoriaCode,
  resolveOrigemByPrecedence,
} from '../types/origem-mercadoria.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';

/**
 * @typedef {object} ResolveOrigemInput
 * @property {import('../types/origem-mercadoria.js').OrigemMercadoriaCode} [lotOrigem]
 * @property {import('../types/origem-mercadoria.js').OrigemMercadoriaCode} [purchaseXmlOrigem]
 * @property {import('../types/origem-mercadoria.js').OrigemMercadoriaCode} [manualOrigem]
 * @property {import('../types/origem-mercadoria.js').OrigemMercadoriaCode} [productDefaultOrigem]
 * @property {boolean} [requiredForOperation]
 */

/**
 * @param {ResolveOrigemInput} input
 */
export const resolveOrigemFiscal = (input = {}) => {
  const candidates = [];

  if (input.lotOrigem != null) {
    candidates.push({
      code: normalizeOrigemMercadoriaCode(input.lotOrigem),
      source: ORIGEM_FISCAL_SOURCE.LOT_CONFIRMED,
    });
  }

  if (input.purchaseXmlOrigem != null) {
    candidates.push({
      code: normalizeOrigemMercadoriaCode(input.purchaseXmlOrigem),
      source: ORIGEM_FISCAL_SOURCE.PURCHASE_XML_CONFIRMED,
    });
  }

  if (input.manualOrigem != null) {
    candidates.push({
      code: normalizeOrigemMercadoriaCode(input.manualOrigem),
      source: ORIGEM_FISCAL_SOURCE.MANUAL_FISCAL_CONFIRMATION,
    });
  }

  const resolved = resolveOrigemByPrecedence(candidates);
  const issues = [];

  if (resolved.isUnknown && input.requiredForOperation !== false) {
    issues.push(createFiscalIssue(
      'ORIGIN_UNKNOWN',
      'Origem da mercadoria fiscal não confirmada (lote/XML/manual).',
    ));
  }

  return {
    origemMercadoria: resolved.origemMercadoria,
    source: resolved.source,
    isUnknown: resolved.isUnknown,
    /** Sugestão UI — explicitamente separada, nunca promovida automaticamente */
    productDefaultOrigemSuggestion: input.productDefaultOrigem != null
      ? normalizeOrigemMercadoriaCode(input.productDefaultOrigem)
      : null,
    issues,
  };
};
