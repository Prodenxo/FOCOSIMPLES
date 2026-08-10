/**
 * Recalcula CSOSN/CFOP/CEST dos itens NF-e via motor tributário (tax_rules_state)
 * antes da emissão — não confia em csosn/cfop enviados pelo cliente.
 */

import { calculateItemsTax } from '../services/tax.service.js';
import {
  CSOSN_ST,
  CSOSN_TRIBUTADO_SN,
  normalizeUf,
} from './nfe-item-tax-engine.js';
import { sanitizeNfeLikePayloadForEmit } from './nfe-like-payload-sanitize.js';

const toObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
};

const extractEntityUf = (entity) => {
  const endereco = toObject(entity?.endereco);
  return normalizeUf(endereco.estado ?? endereco.uf ?? entity?.uf);
};

/**
 * @param {object} payload
 * @param {{ businessType?: string, originUf?: string, destinationUf?: string }} [options]
 */
export const recalculateNfeLikePayloadTaxForEmit = async (payload, options = {}) => {
  if (!payload || typeof payload !== 'object') return payload;

  const itens = Array.isArray(payload.itens) ? payload.itens : [];
  if (itens.length === 0) return sanitizeNfeLikePayloadForEmit(payload);

  const emitente = toObject(payload.emitente);
  const destinatario = toObject(payload.destinatario);
  const originUf = normalizeUf(options.originUf) || extractEntityUf(emitente);
  const destinationUf = normalizeUf(options.destinationUf) || extractEntityUf(destinatario);

  if (!originUf || !destinationUf) {
    return sanitizeNfeLikePayloadForEmit(payload);
  }

  const taxes = await calculateItemsTax({
    originUf,
    destinationUf,
    items: itens.map((item) => ({
      ncm: item?.ncm,
      cest: item?.cest,
    })),
    businessType: options.businessType,
    destinatarioDoc: destinatario.cpfCnpj,
    indIEDest: destinatario.indIEDest ?? destinatario.indicadorInscricaoEstadual,
    inscricaoEstadual: destinatario.inscricaoEstadual,
  });

  const nextItens = itens.map((item, index) => {
    const tax = taxes[index];
    if (!tax) return item;

    const tributos = toObject(item.tributos);
    const icms = toObject(tributos.icms);
    const isSt = tax.has_st === true && String(tax.csosn) === CSOSN_ST;
    const csosn = isSt ? CSOSN_ST : CSOSN_TRIBUTADO_SN;

    const base = {
      ...item,
      cfop: tax.cfop ?? item.cfop,
      tributos: {
        ...tributos,
        icms: {
          ...icms,
          csosn,
          cst: csosn,
        },
      },
    };

    if (isSt && tax.cest) {
      return { ...base, cest: tax.cest };
    }

    const { cest: _omit, ...withoutCest } = base;
    return withoutCest;
  });

  return sanitizeNfeLikePayloadForEmit({
    ...payload,
    itens: nextItens,
  });
};
