/**
 * Motor de regras tributárias NF-e (espelho de lib/nfeItemTaxEngine.ts).
 * @see lib/nfeItemTaxEngine.ts
 */

export const CSOSN_TRIBUTADO_SN = '102';
export const CSOSN_ST = '500';

export const CFOP_VENDA_ESTADUAL = '5102';
export const CFOP_VENDA_ESTADUAL_ST = '5405';
export const CFOP_VENDA_INTERESTADUAL = '6102';
export const CFOP_VENDA_INTERESTADUAL_ST = '6105';
export const CFOP_VENDA_INTERESTADUAL_ST_ALT = '6403';

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

export const resolveEstadualHasSt = (product, stateRule) =>
  productHasCest(product) || Boolean(stateRule?.hasSt);

const resolveInterestadualStCfop = (rule) => {
  const cfop = onlyDigits(rule?.cfopSt ?? rule?.cfop_st, 4);
  if (cfop === CFOP_VENDA_INTERESTADUAL_ST_ALT) return CFOP_VENDA_INTERESTADUAL_ST_ALT;
  if (cfop === CFOP_VENDA_INTERESTADUAL_ST) return CFOP_VENDA_INTERESTADUAL_ST;
  return CFOP_VENDA_INTERESTADUAL_ST;
};

/**
 * @param {object} product
 * @param {string} [product.ncm]
 * @param {string} [product.cest]
 * @param {string|null|undefined} originUf
 * @param {string|null|undefined} destinationUf
 * @param {{ hasSt?: boolean, cfopSt?: string|null, cfop_st?: string|null }|null|undefined} stateRule
 */
export const calculateItemTax = (product, originUf, destinationUf, stateRule = null) => {
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
        cfop: CFOP_VENDA_ESTADUAL_ST,
        csosn: CSOSN_ST,
        hasSt: true,
        scope,
        reason: 'estadual_st',
      };
    }
    return {
      cfop: CFOP_VENDA_ESTADUAL,
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
    cfop: CFOP_VENDA_INTERESTADUAL,
    csosn: CSOSN_TRIBUTADO_SN,
    hasSt: false,
    scope,
    reason: 'interestadual_normal',
  };
};
