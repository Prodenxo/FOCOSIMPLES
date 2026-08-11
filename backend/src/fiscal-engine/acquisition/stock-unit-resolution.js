/**
 * Resolução de unidade física de estoque — uTrib/qTrib não viram base automática.
 */
import { toDecimal } from '../money/decimal.js';
import { buildUnitConversionEvidence } from './unit-conversion.js';

export const STOCK_UNIT_SOURCE = Object.freeze({
  CATALOG_CONFIRMED: 'CATALOG_CONFIRMED',
  MANUAL_CONFIRMED: 'MANUAL_CONFIRMED',
  DIRECT_DOCUMENT: 'DIRECT_DOCUMENT',
  UNKNOWN: 'UNKNOWN',
});

export const STOCK_UNIT_RESOLUTION_STATUS = Object.freeze({
  CONFIRMED: 'CONFIRMED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  UNKNOWN: 'UNKNOWN',
});

/**
 * @typedef {object} StockUnitResolution
 * @property {string} baseUnit
 * @property {string} baseQty
 * @property {keyof typeof STOCK_UNIT_SOURCE} source
 * @property {keyof typeof STOCK_UNIT_RESOLUTION_STATUS} status
 * @property {ReturnType<typeof buildUnitConversionEvidence>} unitConversionEvidence
 */

/**
 * @param {object} item — campos comerciais uCom/qCom/uTrib/qTrib
 * @param {object} [options]
 * @param {'MANUAL_CONFIRMED'|'CATALOG_CONFIRMED'|null} [options.confirmedSource]
 * @param {{ baseUnit?: string, factor?: string }|null} [options.catalogUnitConversion]
 */
export const resolveStockUnit = (item, options = {}) => {
  const evidence = buildUnitConversionEvidence(item);
  const { confirmedSource = null, catalogUnitConversion = null } = options;

  if (confirmedSource === 'MANUAL_CONFIRMED' || confirmedSource === 'CATALOG_CONFIRMED') {
    if (!evidence.sameUnit) {
      if (catalogUnitConversion?.baseUnit && catalogUnitConversion?.factor) {
        return {
          baseUnit: catalogUnitConversion.baseUnit,
          baseQty: evidence.qCom,
          source: confirmedSource,
          status: STOCK_UNIT_RESOLUTION_STATUS.CONFIRMED,
          unitConversionEvidence: evidence,
        };
      }
      return {
        baseUnit: evidence.uCom,
        baseQty: evidence.qCom,
        source: STOCK_UNIT_SOURCE.UNKNOWN,
        status: STOCK_UNIT_RESOLUTION_STATUS.NEEDS_REVIEW,
        unitConversionEvidence: evidence,
      };
    }
    return {
      baseUnit: evidence.uCom,
      baseQty: evidence.qCom,
      source: confirmedSource,
      status: STOCK_UNIT_RESOLUTION_STATUS.CONFIRMED,
      unitConversionEvidence: evidence,
    };
  }

  if (evidence.sameUnit && evidence.sameQuantity) {
    return {
      baseUnit: evidence.uCom,
      baseQty: evidence.qCom,
      source: STOCK_UNIT_SOURCE.DIRECT_DOCUMENT,
      status: STOCK_UNIT_RESOLUTION_STATUS.CONFIRMED,
      unitConversionEvidence: evidence,
    };
  }

  if (!evidence.sameUnit) {
    return {
      baseUnit: evidence.uCom,
      baseQty: evidence.qCom,
      source: STOCK_UNIT_SOURCE.UNKNOWN,
      status: STOCK_UNIT_RESOLUTION_STATUS.NEEDS_REVIEW,
      unitConversionEvidence: evidence,
    };
  }

  if (evidence.sameUnit && !evidence.sameQuantity) {
    return {
      baseUnit: evidence.uCom,
      baseQty: evidence.qCom,
      source: STOCK_UNIT_SOURCE.UNKNOWN,
      status: STOCK_UNIT_RESOLUTION_STATUS.NEEDS_REVIEW,
      unitConversionEvidence: evidence,
    };
  }

  return {
    baseUnit: evidence.uCom || 'UN',
    baseQty: evidence.qCom || '0',
    source: STOCK_UNIT_SOURCE.UNKNOWN,
    status: STOCK_UNIT_RESOLUTION_STATUS.UNKNOWN,
    unitConversionEvidence: evidence,
  };
};

/**
 * @param {StockUnitResolution} resolution
 */
export const stockUnitNeedsReview = (resolution) => (
  resolution?.status === STOCK_UNIT_RESOLUTION_STATUS.NEEDS_REVIEW
  || resolution?.status === STOCK_UNIT_RESOLUTION_STATUS.UNKNOWN
);

/**
 * @param {string} qty
 */
export const isPositiveDecimalQty = (qty) => toDecimal(qty).gt(0);
