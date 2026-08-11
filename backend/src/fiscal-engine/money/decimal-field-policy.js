/**
 * Política de arredondamento/escala por campo — conforme NT/MOC/regra tributária.
 */
import { Decimal, toDecimal } from './decimal.js';

/**
 * @typedef {object} DecimalFieldPolicy
 * @property {string} field
 * @property {number} maxScale
 * @property {number} [minScale]
 * @property {number} roundingMode
 * @property {string} [calculationRule]
 * @property {string} technicalSource
 * @property {string} effectiveFrom
 * @property {string} [effectiveTo]
 */

export const ROUNDING_MODES = Object.freeze({
  HALF_UP: Decimal.ROUND_HALF_UP,
  HALF_DOWN: Decimal.ROUND_HALF_DOWN,
  HALF_EVEN: Decimal.ROUND_HALF_EVEN,
  UP: Decimal.ROUND_UP,
  DOWN: Decimal.ROUND_DOWN,
});

/** @type {DecimalFieldPolicy[]} */
export const DEFAULT_DECIMAL_FIELD_POLICIES = Object.freeze([
  {
    field: 'vBC',
    maxScale: 2,
    roundingMode: ROUNDING_MODES.HALF_UP,
    technicalSource: 'MOC NF-e 7.0',
    effectiveFrom: '2020-01-01',
  },
  {
    field: 'vICMS',
    maxScale: 2,
    roundingMode: ROUNDING_MODES.HALF_UP,
    technicalSource: 'MOC NF-e 7.0',
    effectiveFrom: '2020-01-01',
  },
  {
    field: 'vBCST',
    maxScale: 2,
    roundingMode: ROUNDING_MODES.HALF_UP,
    technicalSource: 'MOC NF-e 7.0',
    effectiveFrom: '2020-01-01',
  },
  {
    field: 'vICMSST',
    maxScale: 2,
    roundingMode: ROUNDING_MODES.HALF_UP,
    technicalSource: 'MOC NF-e 7.0',
    effectiveFrom: '2020-01-01',
  },
  {
    field: 'vBCSTRet',
    maxScale: 2,
    roundingMode: ROUNDING_MODES.HALF_UP,
    technicalSource: 'MOC NF-e 7.0 / ICMSSN500',
    effectiveFrom: '2020-01-01',
  },
  {
    field: 'vICMSSTRet',
    maxScale: 2,
    roundingMode: ROUNDING_MODES.HALF_UP,
    technicalSource: 'MOC NF-e 7.0 / ICMSSN500',
    effectiveFrom: '2020-01-01',
  },
  {
    field: 'pICMS',
    maxScale: 4,
    minScale: 2,
    roundingMode: ROUNDING_MODES.HALF_UP,
    technicalSource: 'MOC NF-e 7.0',
    effectiveFrom: '2020-01-01',
  },
  {
    field: 'pST',
    maxScale: 4,
    roundingMode: ROUNDING_MODES.HALF_UP,
    technicalSource: 'MOC NF-e 7.0',
    effectiveFrom: '2020-01-01',
  },
  {
    field: 'pMVAST',
    maxScale: 4,
    roundingMode: ROUNDING_MODES.HALF_UP,
    technicalSource: 'MOC NF-e 7.0',
    effectiveFrom: '2020-01-01',
  },
  {
    field: 'qCom',
    maxScale: 4,
    roundingMode: ROUNDING_MODES.HALF_UP,
    technicalSource: 'MOC NF-e 7.0 — qCom',
    effectiveFrom: '2020-01-01',
  },
  {
    field: 'vUnCom',
    maxScale: 10,
    roundingMode: ROUNDING_MODES.HALF_UP,
    calculationRule: 'emit-scale-2-to-4',
    technicalSource: 'MOC NF-e 7.0 — vUnCom',
    effectiveFrom: '2020-01-01',
  },
  {
    field: 'vProd',
    maxScale: 2,
    roundingMode: ROUNDING_MODES.HALF_UP,
    technicalSource: 'MOC NF-e 7.0',
    effectiveFrom: '2020-01-01',
  },
]);

/**
 * @param {string} field
 * @param {string} [effectiveDate]
 * @param {DecimalFieldPolicy[]} [registry]
 * @returns {DecimalFieldPolicy | null}
 */
export const getDecimalFieldPolicy = (field, effectiveDate, registry = DEFAULT_DECIMAL_FIELD_POLICIES) => {
  const date = effectiveDate || new Date().toISOString().slice(0, 10);
  const matches = (registry || []).filter((p) => {
    if (p.field !== field) return false;
    if (p.effectiveFrom && date < p.effectiveFrom) return false;
    if (p.effectiveTo && date > p.effectiveTo) return false;
    return true;
  });
  return matches.length ? matches[matches.length - 1] : null;
};

/**
 * @param {import('./decimal.js').FiscalDecimal | unknown} value
 * @param {string} field
 * @param {string} [effectiveDate]
 * @returns {string}
 */
export const formatFieldByPolicy = (value, field, effectiveDate) => {
  const policy = getDecimalFieldPolicy(field, effectiveDate);
  if (!policy) throw new Error(`DecimalFieldPolicy ausente para campo: ${field}`);
  return toDecimal(value).toDecimalPlaces(policy.maxScale, policy.roundingMode).toFixed(policy.maxScale);
};
