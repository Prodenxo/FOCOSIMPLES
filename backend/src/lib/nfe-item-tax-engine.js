/**
 * Motor de regras tributárias NF-e (espelho de lib/nfeItemTaxEngine.ts).
 * @see lib/nfeItemTaxEngine.ts
 */

import { normalizeBusinessType, DEFAULT_BUSINESS_TYPE } from './empresa-business-type.js';

export const CSOSN_TRIBUTADO_SN = '102';
export const CSOSN_ST = '500';

export const CFOP_VENDA_ESTADUAL_RESELLER = '5102';
export const CFOP_VENDA_INTERESTADUAL_RESELLER = '6102';
export const CFOP_VENDA_ESTADUAL_MANUFACTURER = '5101';
export const CFOP_VENDA_INTERESTADUAL_MANUFACTURER = '6101';
export const CFOP_VENDA_ESTADUAL_ST_RESELLER = '5405';
export const CFOP_VENDA_ESTADUAL_ST_MANUFACTURER = '5401';
export const CFOP_VENDA_INTERESTADUAL_ST = '6105';
export const CFOP_VENDA_INTERESTADUAL_ST_ALT = '6403';

export const CFOP_VENDA_ESTADUAL = CFOP_VENDA_ESTADUAL_RESELLER;
export const CFOP_VENDA_INTERESTADUAL = CFOP_VENDA_INTERESTADUAL_RESELLER;
export const CFOP_VENDA_ESTADUAL_ST = CFOP_VENDA_ESTADUAL_ST_RESELLER;

const onlyDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);

export const normalizeUf = (value) => String(value ?? '').trim().toUpperCase().slice(0, 2);

export const normalizeNcm = (value) => onlyDigits(value, 8);

export const detectNfeVendaLocalizacao = (emitenteUf, destinatarioUf) => {
  const orig = normalizeUf(emitenteUf);
  const dest = normalizeUf(destinatarioUf);
  if (!orig || !dest) return 'unknown';
  return orig === dest ? 'estadual' : 'interestadual';
};

export const productHasCest = (product) => onlyDigits(product?.cest, 7).length === 7;

export const resolveEstadualHasSt = (_product, stateRule) =>
  Boolean(stateRule?.hasSt);

const resolveInterestadualStCfop = (rule) => {
  const cfop = onlyDigits(rule?.cfopSt ?? rule?.cfop_st, 4);
  if (cfop === CFOP_VENDA_INTERESTADUAL_ST_ALT) return CFOP_VENDA_INTERESTADUAL_ST_ALT;
  if (cfop === CFOP_VENDA_INTERESTADUAL_ST) return CFOP_VENDA_INTERESTADUAL_ST;
  return CFOP_VENDA_INTERESTADUAL_ST;
};

const resolveCfopWithoutSt = (scope, businessType) => {
  const type = normalizeBusinessType(businessType);
  if (scope === 'estadual') {
    return type === 'MANUFACTURER'
      ? CFOP_VENDA_ESTADUAL_MANUFACTURER
      : CFOP_VENDA_ESTADUAL_RESELLER;
  }
  return type === 'MANUFACTURER'
    ? CFOP_VENDA_INTERESTADUAL_MANUFACTURER
    : CFOP_VENDA_INTERESTADUAL_RESELLER;
};

const resolveCfopEstadualSt = (businessType) =>
  normalizeBusinessType(businessType) === 'MANUFACTURER'
    ? CFOP_VENDA_ESTADUAL_ST_MANUFACTURER
    : CFOP_VENDA_ESTADUAL_ST_RESELLER;

/**
 * @param {object} product
 * @param {string|null|undefined} originUf
 * @param {string|null|undefined} destinationUf
 * @param {{ hasSt?: boolean, cfopSt?: string|null, cfop_st?: string|null }|null|undefined} stateRule
 * @param {string|null|undefined} [businessType]
 */
export const calculateItemTax = (
  product,
  originUf,
  destinationUf,
  stateRule = null,
  businessType = DEFAULT_BUSINESS_TYPE,
) => {
  const empresaType = normalizeBusinessType(businessType);
  const scope = detectNfeVendaLocalizacao(originUf, destinationUf);
  if (scope === 'unknown') {
    return {
      cfop: null,
      csosn: null,
      hasSt: false,
      scope,
      reason: 'unknown_uf',
    };
  }

  if (scope === 'estadual') {
    const hasSt = resolveEstadualHasSt(product, stateRule);
    if (hasSt) {
      return {
        cfop: resolveCfopEstadualSt(empresaType),
        csosn: CSOSN_ST,
        hasSt: true,
        scope,
        reason: 'estadual_st',
      };
    }
    return {
      cfop: resolveCfopWithoutSt(scope, empresaType),
      csosn: CSOSN_TRIBUTADO_SN,
      hasSt: false,
      scope,
      reason: 'estadual_normal',
    };
  }

  const hasSt = Boolean(stateRule?.hasSt);
  if (hasSt) {
    return {
      cfop: resolveInterestadualStCfop(stateRule),
      csosn: CSOSN_ST,
      hasSt: true,
      scope,
      reason: 'interestadual_st',
    };
  }

  return {
    cfop: resolveCfopWithoutSt(scope, empresaType),
    csosn: CSOSN_TRIBUTADO_SN,
    hasSt: false,
    scope,
    reason: 'interestadual_normal',
  };
};
