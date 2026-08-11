/**
 * Evidência de conversão comercial ↔ tributável (qCom/uCom vs qTrib/uTrib).
 */
import { toDecimal } from '../money/decimal.js';

const isPositiveDecimalQty = (qty) => toDecimal(qty).gt(0);

/**
 * @typedef {object} UnitConversionEvidence
 * @property {string} uCom
 * @property {string} qCom
 * @property {string} uTrib
 * @property {string} qTrib
 * @property {boolean} sameUnit
 * @property {boolean} sameQuantity
 * @property {string|null} conversionRatio
 * @property {'DIRECT' | 'CONVERSION_REQUIRED' | 'UNKNOWN'} stockBasis
 * @property {string[]} warnings
 */

/**
 * @param {object} item
 */
export const buildUnitConversionEvidence = (item) => {
  const uCom = String(item?.uCom ?? '').trim() || 'UN';
  const uTrib = String(item?.uTrib ?? '').trim() || uCom;
  const qCom = String(item?.qCom ?? '0');
  const qTrib = String(item?.qTrib ?? qCom);

  const sameUnit = uCom.toUpperCase() === uTrib.toUpperCase();
  const sameQuantity = qCom === qTrib;
  const warnings = [];

  let stockBasis = 'DIRECT';
  let conversionRatio = null;

  if (sameUnit && sameQuantity) {
    stockBasis = 'DIRECT';
  } else if (sameUnit && !sameQuantity) {
    stockBasis = 'UNKNOWN';
    warnings.push('qCom difere de qTrib com mesma unidade — revisão necessária');
  } else {
    stockBasis = 'CONVERSION_REQUIRED';
    warnings.push(`Conversão ${uCom}→${uTrib} exigida — confirmação de cadastro/regra necessária`);
    if (isPositiveDecimalQty(qCom) && isPositiveDecimalQty(qTrib)) {
      conversionRatio = `${qTrib}/${qCom}`;
    } else {
      stockBasis = 'UNKNOWN';
      warnings.push('Não foi possível determinar ratio qTrib/qCom');
    }
  }

  return {
    uCom,
    qCom,
    uTrib,
    qTrib,
    sameUnit,
    sameQuantity,
    conversionRatio,
    stockBasis,
    warnings,
  };
};

/**
 * Unidade base para estoque.
 * @param {UnitConversionEvidence} evidence
 */
export const resolveStockBaseUnit = (evidence) => {
  if (evidence.stockBasis === 'DIRECT') return evidence.uCom;
  if (evidence.stockBasis === 'CONVERSION_REQUIRED') return evidence.uTrib;
  return evidence.uTrib || evidence.uCom || 'UN';
};

/**
 * Quantidade inicial do lote em unidade base (string decimal).
 * @param {UnitConversionEvidence} evidence
 */
export const resolveStockBaseQuantity = (evidence) => {
  if (evidence.stockBasis === 'DIRECT') return evidence.qCom;
  if (evidence.stockBasis === 'CONVERSION_REQUIRED') return evidence.qTrib;
  return evidence.qCom;
};

/**
 * @param {UnitConversionEvidence} evidence
 */
export const unitConversionNeedsReview = (evidence) => (
  evidence.stockBasis === 'UNKNOWN'
  || (evidence.stockBasis === 'CONVERSION_REQUIRED' && !evidence.conversionRatio)
);
