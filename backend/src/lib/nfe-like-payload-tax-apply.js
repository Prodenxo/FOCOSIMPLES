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
import { tryResolveAccountantTaxForNfeItem, mergeAccountantTaxWithMatrixTax } from './nfe-like-payload-accountant-tax.js';
import { loadAccountantApprovedRulesForTenant } from '../fiscal-engine/fiscal-configuration/fiscal-configuration-loader.js';

const toObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
};

const extractEntityUf = (entity) => {
  const endereco = toObject(entity?.endereco);
  return normalizeUf(endereco.estado ?? endereco.uf ?? entity?.uf);
};

/**
 * @param {{
 *   itens: object[],
 *   taxes: object[],
 *   tenantId?: string | null,
 *   emitente?: object,
 *   destinatario?: object,
 *   originUf: string,
 *   destinationUf: string,
 *   businessType?: string,
 *   approvedRulesCache?: object[] | null,
 *   resolveCatalogProductId?: (codigo: string, ncm: string) => Promise<string | null>,
 * }} input
 * @returns {Promise<object[]>}
 */
export const applyAccountantTaxOverridesToCalculatedTaxes = async (input) => {
  const itens = Array.isArray(input.itens) ? input.itens : [];
  const taxes = Array.isArray(input.taxes) ? input.taxes : [];
  const tenantId = String(input.tenantId ?? '').trim() || null;
  const resolveCatalogProductId = input.resolveCatalogProductId ?? null;
  const emitente = toObject(input.emitente);
  const destinatario = toObject(input.destinatario);

  if (!tenantId || typeof resolveCatalogProductId !== 'function') {
    return taxes;
  }

  let approvedRulesCache = input.approvedRulesCache ?? null;
  if (!approvedRulesCache) {
    approvedRulesCache = await loadAccountantApprovedRulesForTenant(tenantId);
  }

  return Promise.all(itens.map(async (item, index) => {
    const tax = taxes[index];
    if (!tax) return tax;

    const codigo = String(item?.codigo || item?.sku || '').trim();
    const ncm = String(item?.ncm || '').replace(/\D/g, '').slice(0, 8);
    if (!codigo) return tax;

    const catalogProductId = await resolveCatalogProductId(codigo, ncm);
    if (!catalogProductId) return tax;

    const accountantTax = await tryResolveAccountantTaxForNfeItem({
      tenantId,
      emitente,
      destinatario,
      item,
      originUf: input.originUf,
      destinationUf: input.destinationUf,
      businessType: input.businessType,
      catalogProductId,
      approvedRulesCache,
      legacyCfopCsosnOnly: true,
    });

    if (!accountantTax) return tax;

    const merged = mergeAccountantTaxWithMatrixTax(accountantTax, tax);
    return {
      ...tax,
      cfop: merged.cfop,
      csosn: merged.csosn,
      has_st: merged.has_st,
      cest: merged.cest,
      reason: 'accountant_approved_rule',
    };
  }));
};

/**
 * @param {object} payload
 * @param {{ businessType?: string, originUf?: string, destinationUf?: string, tenantId?: string, userId?: string, approvedRulesCache?: object[], resolveCatalogProductId?: (codigo: string, ncm: string) => Promise<string | null> }} [options]
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

  const tenantId = String(options.tenantId ?? '').trim() || null;
  const effectiveTaxes = await applyAccountantTaxOverridesToCalculatedTaxes({
    itens,
    taxes,
    tenantId,
    emitente,
    destinatario,
    originUf,
    destinationUf,
    businessType: options.businessType,
    approvedRulesCache: options.approvedRulesCache ?? null,
    resolveCatalogProductId: options.resolveCatalogProductId ?? null,
  });

  const nextItens = await Promise.all(itens.map(async (item, index) => {
    const effectiveTax = effectiveTaxes[index];
    if (!effectiveTax) return item;
    const tributos = toObject(item.tributos);
    const icms = toObject(tributos.icms);
    const isSt = effectiveTax.has_st === true && String(effectiveTax.csosn) === CSOSN_ST;
    const csosn = isSt ? CSOSN_ST : String(effectiveTax.csosn ?? CSOSN_TRIBUTADO_SN);

    const base = {
      ...item,
      cfop: effectiveTax.cfop ?? item.cfop,
      tributos: {
        ...tributos,
        icms: {
          ...icms,
          csosn,
          cst: csosn,
        },
      },
    };

    if (isSt && (effectiveTax.cest || item.cest)) {
      return { ...base, cest: effectiveTax.cest ?? item.cest };
    }

    const { cest: _omit, ...withoutCest } = base;
    return withoutCest;
  }));

  return sanitizeNfeLikePayloadForEmit({
    ...payload,
    itens: nextItens,
  });
};
