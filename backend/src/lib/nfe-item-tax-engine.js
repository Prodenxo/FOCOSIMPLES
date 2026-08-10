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
/** Venda interestadual para não contribuinte / consumidor final (CPF). */
export const CFOP_VENDA_INTERESTADUAL_CONSUMIDOR_RESELLER = '6108';
export const CFOP_VENDA_INTERESTADUAL_CONSUMIDOR_MANUFACTURER = '6107';
/** ST interestadual para não contribuinte com convênio/protocolo. */
export const CFOP_VENDA_INTERESTADUAL_ST_CONSUMIDOR_CONVENIO = '6404';

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

/**
 * @deprecated Não usar na determinação tributária — ST vem só de tax_rules_state.
 * Mantido para compatibilidade de testes legados.
 */
export const productHasStTaxation = (product) => {
  if (product?.hasSt === true) return true;
  const csosn = onlyDigits(product?.icmsCsosn ?? product?.csosn, 3);
  if (csosn === CSOSN_ST) return true;
  return productHasCest(product);
};

/** ST somente quando o NCM consta na tabela explícita (tax_rules_state) da UF emitente. */
export const resolveItemHasSt = (_product, stateRule) =>
  Boolean(stateRule?.hasSt === true);

export const resolveEstadualHasSt = (product, stateRule) =>
  resolveItemHasSt(product, stateRule);

/**
 * Pessoa física (CPF), não contribuinte (indIEDest 9/2) ou CNPJ sem IE de contribuinte.
 * @param {object|null|undefined} context
 * @param {boolean|null|undefined} [context.nonTaxpayer]
 * @param {string|null|undefined} [context.destinatarioDoc]
 * @param {string|null|undefined} [context.cpfCnpj]
 * @param {string|null|undefined} [context.indIEDest]
 * @param {string|null|undefined} [context.inscricaoEstadual]
 */
export const resolveDestinatarioNonTaxpayer = (context) => {
  const ctx = context && typeof context === 'object' ? context : {};
  if (ctx.nonTaxpayer === true) return true;
  if (ctx.nonTaxpayer === false) return false;

  const doc = onlyDigits(ctx.destinatarioDoc ?? ctx.cpfCnpj, 14);
  const ind = String(ctx.indIEDest ?? '').trim();
  const ie = onlyDigits(ctx.inscricaoEstadual, 14);

  if (doc.length === 11) return true;
  if (ind === '9' || ind === '2') return true;
  if (doc.length === 14 && ind !== '1') return true;
  if (doc.length === 14 && ind === '1' && !ie) return true;
  return false;
};

const resolveInterestadualStCfop = (rule) => {
  const cfop = onlyDigits(rule?.cfopSt ?? rule?.cfop_st, 4);
  if (cfop === CFOP_VENDA_INTERESTADUAL_ST_ALT) return CFOP_VENDA_INTERESTADUAL_ST_ALT;
  if (cfop === CFOP_VENDA_INTERESTADUAL_ST) return CFOP_VENDA_INTERESTADUAL_ST;
  return CFOP_VENDA_INTERESTADUAL_ST;
};

const hasInterestadualStConvenio = (rule) => {
  const cfop = onlyDigits(rule?.cfopSt ?? rule?.cfop_st, 4);
  return cfop === CFOP_VENDA_INTERESTADUAL_ST_ALT
    || cfop === CFOP_VENDA_INTERESTADUAL_ST_CONSUMIDOR_CONVENIO;
};

const resolveInterestadualNonTaxpayerCfop = (hasSt, rule, businessType) => {
  if (hasSt) {
    if (hasInterestadualStConvenio(rule)) {
      return CFOP_VENDA_INTERESTADUAL_ST_CONSUMIDOR_CONVENIO;
    }
    return CFOP_VENDA_INTERESTADUAL_CONSUMIDOR_RESELLER;
  }
  return normalizeBusinessType(businessType) === 'MANUFACTURER'
    ? CFOP_VENDA_INTERESTADUAL_CONSUMIDOR_MANUFACTURER
    : CFOP_VENDA_INTERESTADUAL_CONSUMIDOR_RESELLER;
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
 * @param {object|null|undefined} [destinatarioContext]
 */
export const calculateItemTax = (
  product,
  originUf,
  destinationUf,
  stateRule = null,
  businessType = DEFAULT_BUSINESS_TYPE,
  destinatarioContext = null,
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
    const hasSt = resolveItemHasSt(product, stateRule);
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

  const hasSt = resolveItemHasSt(product, stateRule);
  const nonTaxpayer = resolveDestinatarioNonTaxpayer(destinatarioContext ?? {});

  if (hasSt) {
    const cfop = nonTaxpayer
      ? resolveInterestadualNonTaxpayerCfop(true, stateRule, empresaType)
      : resolveInterestadualStCfop(stateRule);
    return {
      cfop,
      csosn: CSOSN_ST,
      hasSt: true,
      scope,
      reason: nonTaxpayer ? 'interestadual_st_consumidor' : 'interestadual_st',
    };
  }

  if (nonTaxpayer) {
    return {
      cfop: resolveInterestadualNonTaxpayerCfop(false, stateRule, empresaType),
      csosn: CSOSN_TRIBUTADO_SN,
      hasSt: false,
      scope,
      reason: 'interestadual_normal_consumidor',
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

/**
 * Sanitiza retorno de `/tax/calculate-items`: produtos sem ST nunca levam CSOSN 500 nem CEST.
 * @param {ReturnType<typeof calculateItemTax>} tax
 * @param {{ cest?: string|null }|null|undefined} [product]
 */
export const sanitizeItemTaxApiResult = (tax, product = null) => {
  const csosn = onlyDigits(tax?.csosn, 3);
  const isSt = tax?.hasSt === true && csosn === CSOSN_ST;

  if (!isSt) {
    return {
      cfop: tax?.cfop ?? null,
      csosn: CSOSN_TRIBUTADO_SN,
      has_st: false,
      cest: null,
      scope: tax?.scope ?? 'unknown',
      reason: tax?.reason ?? 'estadual_normal',
    };
  }

  const cestDigits = onlyDigits(product?.cest, 7);
  return {
    cfop: tax?.cfop ?? null,
    csosn: CSOSN_ST,
    has_st: true,
    cest: cestDigits.length === 7 ? cestDigits : null,
    scope: tax?.scope ?? 'unknown',
    reason: tax?.reason ?? 'estadual_st',
  };
};
