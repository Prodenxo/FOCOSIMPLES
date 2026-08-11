/**
 * Origem da mercadoria — sem default silencioso para '0' (nacional).
 */

/** @typedef {'0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'UNKNOWN'} OrigemMercadoriaCode */

/**
 * Precedência de fontes fiscais (maior prevalece).
 * product.defaultOrigemMercadoria NÃO entra nesta lista — é apenas sugestão UI.
 */
export const ORIGEM_FISCAL_SOURCE = Object.freeze({
  LOT_CONFIRMED: 'LOT_CONFIRMED',
  PURCHASE_XML_CONFIRMED: 'PURCHASE_XML_CONFIRMED',
  MANUAL_FISCAL_CONFIRMATION: 'MANUAL_FISCAL_CONFIRMATION',
  UNKNOWN: 'UNKNOWN',
});

/** @type {readonly (keyof typeof ORIGEM_FISCAL_SOURCE)[]} */
export const ORIGEM_FISCAL_SOURCE_PRECEDENCE = Object.freeze([
  'LOT_CONFIRMED',
  'PURCHASE_XML_CONFIRMED',
  'MANUAL_FISCAL_CONFIRMATION',
  'UNKNOWN',
]);

/**
 * @param {unknown} value
 * @returns {OrigemMercadoriaCode}
 */
export const normalizeOrigemMercadoriaCode = (value) => {
  const digit = String(value ?? '').trim().slice(0, 1);
  if (/^[0-8]$/.test(digit)) return /** @type {OrigemMercadoriaCode} */ (digit);
  return 'UNKNOWN';
};

/**
 * @typedef {object} OrigemCandidate
 * @property {OrigemMercadoriaCode} code
 * @property {keyof typeof ORIGEM_FISCAL_SOURCE} source
 */

/**
 * Resolve origem fiscal pela precedência de candidatos.
 * @param {OrigemCandidate[]} candidates
 */
export const resolveOrigemByPrecedence = (candidates) => {
  const list = Array.isArray(candidates) ? candidates : [];
  for (const level of ORIGEM_FISCAL_SOURCE_PRECEDENCE) {
    const match = list.find((c) => c?.source === level && c?.code && c.code !== 'UNKNOWN');
    if (match) {
      return {
        origemMercadoria: match.code,
        source: match.source,
        isUnknown: false,
      };
    }
  }
  return {
    origemMercadoria: /** @type {OrigemMercadoriaCode} */ ('UNKNOWN'),
    source: ORIGEM_FISCAL_SOURCE.UNKNOWN,
    isUnknown: true,
  };
};
