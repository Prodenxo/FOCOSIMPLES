/**
 * Matriz de ST (Substituição Tributária) — motor genérico por NCM.
 * Fonte: tabela `tax_rules_state` (+ defaults quando colunas ausentes).
 *
 * @typedef {object} StMatrixRule
 * @property {string} ncm
 * @property {string|null} [cest_default]
 * @property {string} csosn
 * @property {string} cfop_interno
 * @property {string} cfop_interestadual_pf
 * @property {string|null} [cfop_st] — CFOP interestadual contribuinte (6105/6403)
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
export const CFOP_VENDA_INTERESTADUAL_CONSUMIDOR_RESELLER = '6108';
export const CFOP_VENDA_INTERESTADUAL_CONSUMIDOR_MANUFACTURER = '6107';
export const CFOP_VENDA_INTERESTADUAL_ST_CONSUMIDOR_CONVENIO = '6404';

/** Defaults da matriz ST quando o NCM consta na tabela. */
export const ST_MATRIX_DEFAULTS = {
  csosn: CSOSN_ST,
  cfop_interno: CFOP_VENDA_ESTADUAL_ST_RESELLER,
  cfop_interestadual_pf: CFOP_VENDA_INTERESTADUAL_CONSUMIDOR_RESELLER,
};

const onlyDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);

export const normalizeUf = (value) => String(value ?? '').trim().toUpperCase().slice(0, 2);

export const normalizeNcm = (value) => onlyDigits(value, 8);

export const detectNfeVendaLocalizacao = (emitenteUf, destinatarioUf) => {
  const orig = normalizeUf(emitenteUf);
  const dest = normalizeUf(destinatarioUf);
  if (!orig || !dest) return 'unknown';
  return orig === dest ? 'estadual' : 'interestadual';
};

/**
 * Converte linha de `tax_rules_state` em regra da matriz ST.
 * @param {object|null|undefined} dbRow
 * @param {string} [ncmFallback]
 * @returns {StMatrixRule|null}
 */
export const normalizeStMatrixRule = (dbRow, ncmFallback = '') => {
  if (!dbRow) return null;
  const hasSt = dbRow.hasSt === true || dbRow.has_st === true;
  if (!hasSt) return null;

  const ncm = normalizeNcm(dbRow.ncm ?? ncmFallback);
  if (ncm.length !== 8) return null;

  const cestRaw = dbRow.cest_default ?? dbRow.cestDefault ?? null;
  const cestDigits = onlyDigits(cestRaw, 7);

  return {
    ncm,
    cest_default: cestDigits.length === 7 ? cestDigits : null,
    csosn: ST_MATRIX_DEFAULTS.csosn,
    cfop_interno: onlyDigits(dbRow.cfop_interno ?? dbRow.cfopInterno, 4)
      || ST_MATRIX_DEFAULTS.cfop_interno,
    cfop_interestadual_pf: onlyDigits(dbRow.cfop_interestadual_pf ?? dbRow.cfopInterestadualPf, 4)
      || ST_MATRIX_DEFAULTS.cfop_interestadual_pf,
    cfop_st: onlyDigits(dbRow.cfopSt ?? dbRow.cfop_st, 4) || null,
  };
};

/** @param {StMatrixRule|null|undefined} stRule */
export const isNcmInStMatrix = (stRule) => Boolean(stRule);

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

const resolveInterestadualStCfop = (stRule) => {
  const cfop = onlyDigits(stRule?.cfop_st, 4);
  if (cfop === CFOP_VENDA_INTERESTADUAL_ST_ALT) return CFOP_VENDA_INTERESTADUAL_ST_ALT;
  if (cfop === CFOP_VENDA_INTERESTADUAL_ST) return CFOP_VENDA_INTERESTADUAL_ST;
  return CFOP_VENDA_INTERESTADUAL_ST;
};

const hasInterestadualStConvenio = (stRule) => {
  const cfop = onlyDigits(stRule?.cfop_st, 4);
  return cfop === CFOP_VENDA_INTERESTADUAL_ST_ALT
    || cfop === CFOP_VENDA_INTERESTADUAL_ST_CONSUMIDOR_CONVENIO;
};

const resolveInterestadualNonTaxpayerCfop = (hasSt, stRule, businessType) => {
  if (hasSt) {
    if (hasInterestadualStConvenio(stRule)) {
      return CFOP_VENDA_INTERESTADUAL_ST_CONSUMIDOR_CONVENIO;
    }
    return stRule?.cfop_interestadual_pf || ST_MATRIX_DEFAULTS.cfop_interestadual_pf;
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

const resolveCfopEstadualSt = (stRule, businessType) => {
  if (normalizeBusinessType(businessType) === 'MANUFACTURER') {
    return CFOP_VENDA_ESTADUAL_ST_MANUFACTURER;
  }
  return stRule?.cfop_interno || ST_MATRIX_DEFAULTS.cfop_interno;
};

/**
 * Resolve CSOSN/CFOP/CEST para um item consultando a matriz ST.
 * @param {object} product
 * @param {string|null|undefined} originUf
 * @param {string|null|undefined} destinationUf
 * @param {StMatrixRule|null|undefined} stRule
 * @param {string|null|undefined} [businessType]
 * @param {object|null|undefined} [destinatarioContext]
 */
export const resolveItemTaxFromStMatrix = (
  product,
  originUf,
  destinationUf,
  stRule = null,
  businessType = DEFAULT_BUSINESS_TYPE,
  destinatarioContext = null,
) => {
  const scope = detectNfeVendaLocalizacao(originUf, destinationUf);
  if (scope === 'unknown') {
    return {
      cfop: null,
      csosn: null,
      hasSt: false,
      scope,
      reason: 'unknown_uf',
      stRule: null,
    };
  }

  const hasSt = isNcmInStMatrix(stRule);

  if (scope === 'estadual') {
    if (hasSt) {
      return {
        cfop: resolveCfopEstadualSt(stRule, businessType),
        csosn: CSOSN_ST,
        hasSt: true,
        scope,
        reason: 'estadual_st',
        stRule,
      };
    }
    return {
      cfop: resolveCfopWithoutSt(scope, businessType),
      csosn: CSOSN_TRIBUTADO_SN,
      hasSt: false,
      scope,
      reason: 'estadual_normal',
      stRule: null,
    };
  }

  const nonTaxpayer = resolveDestinatarioNonTaxpayer(destinatarioContext ?? {});

  if (hasSt) {
    const cfop = nonTaxpayer
      ? resolveInterestadualNonTaxpayerCfop(true, stRule, businessType)
      : resolveInterestadualStCfop(stRule);
    return {
      cfop,
      csosn: CSOSN_ST,
      hasSt: true,
      scope,
      reason: nonTaxpayer ? 'interestadual_st_consumidor' : 'interestadual_st',
      stRule,
    };
  }

  if (nonTaxpayer) {
    return {
      cfop: resolveInterestadualNonTaxpayerCfop(false, stRule, businessType),
      csosn: CSOSN_TRIBUTADO_SN,
      hasSt: false,
      scope,
      reason: 'interestadual_normal_consumidor',
      stRule: null,
    };
  }

  return {
    cfop: resolveCfopWithoutSt(scope, businessType),
    csosn: CSOSN_TRIBUTADO_SN,
    hasSt: false,
    scope,
    reason: 'interestadual_normal',
    stRule: null,
  };
};

/**
 * Sanitiza retorno de `/tax/calculate-items`.
 * CEST só quando ST confirmado (has_st + CSOSN 500).
 * @param {ReturnType<typeof resolveItemTaxFromStMatrix>} tax
 * @param {{ cest?: string|null, descricao?: string|null }|null|undefined} [product]
 */
export const sanitizeStMatrixApiResult = (tax, product = null) => {
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

  const fromProduct = onlyDigits(product?.cest, 7);
  const fromMatrix = onlyDigits(tax?.stRule?.cest_default, 7);
  const cestResolved = fromProduct.length === 7
    ? fromProduct
    : (fromMatrix.length === 7 ? fromMatrix : null);

  return {
    cfop: tax?.cfop ?? null,
    csosn: CSOSN_ST,
    has_st: true,
    cest: cestResolved,
    scope: tax?.scope ?? 'unknown',
    reason: tax?.reason ?? 'estadual_st',
  };
};
