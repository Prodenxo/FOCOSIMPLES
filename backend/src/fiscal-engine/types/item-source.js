/**
 * Origem comercial/fiscal do item na operação.
 */

/** @typedef {'OWN_PRODUCTION' | 'THIRD_PARTY' | 'UNKNOWN'} ItemSource */

export const ITEM_SOURCE = Object.freeze({
  OWN_PRODUCTION: 'OWN_PRODUCTION',
  THIRD_PARTY: 'THIRD_PARTY',
  UNKNOWN: 'UNKNOWN',
});

/**
 * Hint de UI/cadastro — nunca promovido a fato fiscal sem confirmação.
 * @param {unknown} hint
 * @returns {ItemSource | null}
 */
export const parseItemSourceHint = (hint) => {
  const v = String(hint ?? '').trim().toUpperCase();
  if (v === 'OWN_PRODUCTION' || v === 'MANUFACTURER') return ITEM_SOURCE.OWN_PRODUCTION;
  if (v === 'THIRD_PARTY' || v === 'RESELLER') return ITEM_SOURCE.THIRD_PARTY;
  return null;
};

/**
 * @param {unknown} value
 * @returns {ItemSource}
 */
export const normalizeItemSource = (value) => {
  const v = String(value ?? '').trim().toUpperCase();
  if (v === ITEM_SOURCE.OWN_PRODUCTION) return ITEM_SOURCE.OWN_PRODUCTION;
  if (v === ITEM_SOURCE.THIRD_PARTY) return ITEM_SOURCE.THIRD_PARTY;
  return ITEM_SOURCE.UNKNOWN;
};

/**
 * @typedef {'PF' | 'PJ' | 'UNKNOWN'} PersonType
 * @typedef {'TAXPAYER' | 'EXEMPT' | 'NON_TAXPAYER' | 'UNKNOWN'} IcmsTaxpayerStatus
 */

export const PERSON_TYPE = Object.freeze({
  PF: 'PF',
  PJ: 'PJ',
  UNKNOWN: 'UNKNOWN',
});

export const ICMS_TAXPAYER_STATUS = Object.freeze({
  TAXPAYER: 'TAXPAYER',
  EXEMPT: 'EXEMPT',
  NON_TAXPAYER: 'NON_TAXPAYER',
  UNKNOWN: 'UNKNOWN',
});

/**
 * Deriva indIEDest a partir do status ICMS — não de PF/PJ isolado.
 * @param {IcmsTaxpayerStatus} icmsTaxpayerStatus
 * @param {string | null | undefined} inscricaoEstadual
 * @returns {'1' | '2' | '9' | null}
 */
export const deriveIndIeDest = (icmsTaxpayerStatus, inscricaoEstadual) => {
  const ie = String(inscricaoEstadual ?? '').replace(/\D/g, '');
  if (icmsTaxpayerStatus === ICMS_TAXPAYER_STATUS.TAXPAYER) {
    return ie ? '1' : '9';
  }
  if (icmsTaxpayerStatus === ICMS_TAXPAYER_STATUS.EXEMPT) return '2';
  if (icmsTaxpayerStatus === ICMS_TAXPAYER_STATUS.NON_TAXPAYER) return '9';
  return null;
};
