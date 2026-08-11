/**
 * Sanitiza itens NF-e/NFC-e antes da validação/emissão.
 * ST só quando `tributos.icms.csosn === '500'` (definido pelo motor tributário).
 * Qualquer outro caso → CSOSN 102.
 *
 * CEST: removido apenas no fluxo legado (FISCAL_ENGINE_V3=false).
 * Com FISCAL_ENGINE_V3=true, CEST permanece — independente de ST da operação (v3.1).
 */

import { CSOSN_ST, CSOSN_TRIBUTADO_SN } from './nfe-item-tax-engine.js';
import { isFiscalEngineV3Enabled } from '../fiscal-engine/feature-flag.js';

const onlyDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);

const toObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
};

/** ST explícito: somente csosn === '500' no payload (ignora cst legado). */
export const payloadItemCsosnIsSt = (item) => {
  const icms = toObject(toObject(item?.tributos).icms);
  return onlyDigits(icms.csosn, 3) === CSOSN_ST;
};

/**
 * @param {object} item
 * @returns {object}
 */
export const sanitizeNfeLikePayloadItemForEmit = (item) => {
  if (!item || typeof item !== 'object') return item;

  const tributos = toObject(item.tributos);
  const icms = toObject(tributos.icms);
  const isSt = payloadItemCsosnIsSt(item);

  if (isSt) {
    return {
      ...item,
      tributos: {
        ...tributos,
        icms: {
          ...icms,
          csosn: CSOSN_ST,
          cst: CSOSN_ST,
        },
      },
    };
  }

  const base = {
    ...item,
    tributos: {
      ...tributos,
      icms: {
        ...icms,
        csosn: CSOSN_TRIBUTADO_SN,
        cst: CSOSN_TRIBUTADO_SN,
      },
    },
  };

  if (isFiscalEngineV3Enabled()) {
    return base;
  }

  const { cest: _omit, ...rest } = base;
  return rest;
};

/**
 * @param {object} payload
 * @returns {object}
 */
export const sanitizeNfeLikePayloadForEmit = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  const itens = Array.isArray(payload.itens) ? payload.itens : [];
  if (itens.length === 0) return payload;
  return {
    ...payload,
    itens: itens.map(sanitizeNfeLikePayloadItemForEmit),
  };
};
