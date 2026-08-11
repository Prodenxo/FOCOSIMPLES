/**
 * Decimal canônico — nunca converter para Number em etapas intermediárias.
 */
import Decimal from 'decimal.js';

Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

export { Decimal };

/** @typedef {import('decimal.js').default} FiscalDecimal */

/**
 * @param {unknown} value
 * @returns {FiscalDecimal}
 */
export const toDecimal = (value) => {
  if (value instanceof Decimal) return value;
  if (value === null || value === undefined || value === '') {
    return new Decimal(0);
  }
  return new Decimal(String(value).replace(',', '.'));
};

/**
 * @param {FiscalDecimal | unknown} value
 * @param {number} scale
 * @param {number} [roundingMode]
 * @returns {string}
 */
export const formatDecimal = (value, scale, roundingMode = Decimal.ROUND_HALF_UP) => {
  const d = value instanceof Decimal ? value : toDecimal(value);
  return d.toDecimalPlaces(scale, roundingMode).toFixed(scale);
};

/**
 * @param {FiscalDecimal | unknown} a
 * @param {FiscalDecimal | unknown} b
 */
export const decimalEquals = (a, b) => toDecimal(a).equals(toDecimal(b));

/**
 * @param {FiscalDecimal | unknown} a
 * @param {FiscalDecimal | unknown} b
 */
export const decimalPlus = (a, b) => toDecimal(a).plus(toDecimal(b));

/**
 * @param {FiscalDecimal | unknown} a
 * @param {FiscalDecimal | unknown} b
 */
export const decimalTimes = (a, b) => toDecimal(a).times(toDecimal(b));

/**
 * @param {FiscalDecimal | unknown} a
 * @param {FiscalDecimal | unknown} b
 */
export const decimalDiv = (a, b) => toDecimal(a).div(toDecimal(b));

/**
 * @param {FiscalDecimal | unknown} value
 * @param {number} scale
 * @param {number} [roundingMode]
 */
export const roundDecimal = (value, scale, roundingMode = Decimal.ROUND_HALF_UP) => (
  toDecimal(value).toDecimalPlaces(scale, roundingMode)
);

/**
 * Soma valores Decimal mantendo tipo Decimal.
 * @param {Array<FiscalDecimal | unknown>} values
 */
export const sumDecimals = (values) => (
  (Array.isArray(values) ? values : []).reduce(
    (acc, v) => acc.plus(toDecimal(v)),
    new Decimal(0),
  )
);

/**
 * Rateio proporcional — retorna Decimal, não Number.
 * @param {FiscalDecimal | unknown} totalValue
 * @param {FiscalDecimal | unknown} allocatedQty
 * @param {FiscalDecimal | unknown} totalQty
 * @param {number} scale
 * @param {number} [roundingMode]
 */
export const proportionalAllocate = (
  totalValue,
  allocatedQty,
  totalQty,
  scale,
  roundingMode = Decimal.ROUND_HALF_UP,
) => {
  const total = toDecimal(totalValue);
  const qty = toDecimal(allocatedQty);
  const all = toDecimal(totalQty);
  if (all.isZero()) return new Decimal(0);
  return total.times(qty.div(all)).toDecimalPlaces(scale, roundingMode);
};
