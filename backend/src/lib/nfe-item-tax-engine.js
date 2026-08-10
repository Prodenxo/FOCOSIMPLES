/**
 * Motor de regras tributárias NF-e — reexporta matriz ST (espelho de lib/nfeItemTaxEngine.ts).
 * @see lib/stRulesEngine.ts
 * @see lib/nfeItemTaxEngine.ts
 */

export {
  CSOSN_TRIBUTADO_SN,
  CSOSN_ST,
  CFOP_VENDA_ESTADUAL_RESELLER,
  CFOP_VENDA_INTERESTADUAL_RESELLER,
  CFOP_VENDA_ESTADUAL_MANUFACTURER,
  CFOP_VENDA_INTERESTADUAL_MANUFACTURER,
  CFOP_VENDA_ESTADUAL_ST_RESELLER,
  CFOP_VENDA_ESTADUAL_ST_MANUFACTURER,
  CFOP_VENDA_INTERESTADUAL_ST,
  CFOP_VENDA_INTERESTADUAL_ST_ALT,
  CFOP_VENDA_INTERESTADUAL_CONSUMIDOR_RESELLER,
  CFOP_VENDA_INTERESTADUAL_CONSUMIDOR_MANUFACTURER,
  CFOP_VENDA_INTERESTADUAL_ST_CONSUMIDOR_CONVENIO,
  ST_MATRIX_DEFAULTS,
  normalizeUf,
  normalizeNcm,
  detectNfeVendaLocalizacao,
  normalizeStMatrixRule,
  isNcmInStMatrix,
  resolveDestinatarioNonTaxpayer,
  resolveItemTaxFromStMatrix,
  sanitizeStMatrixApiResult,
} from './st-rules-engine.js';

/** @deprecated use normalizeStMatrixRule */
export { normalizeStMatrixRule as normalizeTaxStateRule } from './st-rules-engine.js';

const onlyDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);

export const CFOP_VENDA_ESTADUAL = '5102';
export const CFOP_VENDA_INTERESTADUAL = '6102';
export const CFOP_VENDA_ESTADUAL_ST = '5405';

export const productHasCest = (product) => onlyDigits(product?.cest, 7).length === 7;

/** @deprecated Não usar na determinação tributária — ST vem só da matriz. */
export const productHasStTaxation = (product) => {
  if (product?.hasSt === true) return true;
  const csosn = onlyDigits(product?.icmsCsosn ?? product?.csosn, 3);
  if (csosn === '500') return true;
  return productHasCest(product);
};

/** ST somente quando o NCM consta na matriz ST. */
export const resolveItemHasSt = (_product, stRule) => Boolean(stRule);

export const resolveEstadualHasSt = (product, stRule) => resolveItemHasSt(product, stRule);

import {
  resolveItemTaxFromStMatrix,
  sanitizeStMatrixApiResult,
  normalizeStMatrixRule,
} from './st-rules-engine.js';

/**
 * @param {object} product
 * @param {string|null|undefined} originUf
 * @param {string|null|undefined} destinationUf
 * @param {import('./st-rules-engine.js').StMatrixRule|object|null|undefined} stateRule
 */
export const calculateItemTax = (
  product,
  originUf,
  destinationUf,
  stateRule = null,
  businessType,
  destinatarioContext = null,
) => {
  const stRule = stateRule?.ncm
    ? stateRule
    : normalizeStMatrixRule(stateRule, product?.ncm);
  return resolveItemTaxFromStMatrix(
    product,
    originUf,
    destinationUf,
    stRule,
    businessType,
    destinatarioContext,
  );
};

/** @deprecated use sanitizeStMatrixApiResult */
export const sanitizeItemTaxApiResult = (tax, product = null) =>
  sanitizeStMatrixApiResult(tax, product);
