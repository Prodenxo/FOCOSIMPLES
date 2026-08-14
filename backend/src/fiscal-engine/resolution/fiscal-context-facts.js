/**
 * Extrai fatos normalizados de FiscalContext para resolução por regras.
 * Phase 8E.2 — paridade com matching facts do contador.
 */
import { CURRENT_OPERATION_ST } from '../types/st-allocation.js';

/**
 * @param {object} context FiscalContext (Fase 4)
 * @param {object} [treatmentPartial]
 * @param {object} [options]
 * @param {Record<string, unknown>} [options.matchingFacts]
 */
export const extractFactsFromContext = (context, treatmentPartial = {}, options = {}) => {
  const cpfCnpj = context.destinatario?.cpfCnpj ?? null;
  const recipientPersonType = context.destinatario?.personType
    ?? (cpfCnpj && String(cpfCnpj).replace(/\D/g, '').length === 11 ? 'PF' : cpfCnpj ? 'PJ' : 'UNKNOWN');

  const base = {
    empresaId: context.empresaId ?? null,
    crt: context.emitente?.crt ?? null,
    location: context.operacao?.localizacao ?? null,
    itemSource: context.item?.itemSource ?? null,
    priorStStatus: context.estoque?.priorStStatus
      ?? context.allocation?.priorStStatus
      ?? null,
    currentOperationSt: treatmentPartial.currentOperationSt
      ?? CURRENT_OPERATION_ST.UNKNOWN,
    stScenarioKey: treatmentPartial.stScenarioKey ?? null,
    operationType: context.operacao?.operationType ?? context.operacao?.tipo ?? null,
    recipientTaxpayerStatus: context.destinatario?.icmsTaxpayerStatus ?? null,
    consumerFinal: context.destinatario?.consumidorFinal ?? null,
    recipientFinalConsumer: context.destinatario?.consumidorFinal === true
      ? 'YES'
      : context.destinatario?.consumidorFinal === false
        ? 'NO'
        : 'UNKNOWN',
    issuerStLiability: context.fiscalExtensions?.issuerStLiability ?? 'UNKNOWN',
    stApplicabilityStatus: context.fiscalExtensions?.stApplicabilityStatus ?? 'UNKNOWN',
    interstatePriorRetainedEligible: Boolean(context.fiscalExtensions?.interstatePriorRetainedEligible),
    creditAllowed: context.fiscalExtensions?.creditAllowed === true,
    issuerUf: context.emitente?.uf ?? null,
    destinationUf: context.operacao?.destinationUf ?? context.destinatario?.uf ?? null,
    referenceDate: context.operacao?.referenceDate ?? context.dataOperacao ?? null,
    origemMercadoria: context.allocation?.origem
      ?? context.estoque?.origemMercadoria
      ?? 'UNKNOWN',
    origemSource: context.allocation?.origemSource ?? null,
    ncm: context.produto?.ncm ?? null,
    cest: context.produto?.cest ?? null,
    supplierCest: context.produto?.supplierCest ?? null,
    catalogCest: context.produto?.cest ?? null,
    productId: context.produto?.produtoCatalogoId ?? context.produto?.id ?? null,
    customerId: context.destinatario?.customerId ?? context.destinatario?.id ?? null,
    establishmentId: context.emitente?.establishmentId ?? context.fiscalExtensions?.establishmentId ?? null,
    fiscalProductGroupId: context.fiscalExtensions?.fiscalProductGroupId ?? null,
    recipientPersonType,
  };

  const enriched = options.matchingFacts ?? {};
  return {
    ...base,
    ...(enriched.fiscalProductGroupId !== undefined
      ? { fiscalProductGroupId: enriched.fiscalProductGroupId }
      : {}),
  };
};
