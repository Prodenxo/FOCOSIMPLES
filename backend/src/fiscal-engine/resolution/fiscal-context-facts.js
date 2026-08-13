/**
 * Extrai fatos normalizados de FiscalContext para resolução por regras.
 */
import { CURRENT_OPERATION_ST } from '../types/st-allocation.js';

/**
 * @param {object} context FiscalContext (Fase 4)
 * @param {object} [treatmentPartial]
 */
export const extractFactsFromContext = (context, treatmentPartial = {}) => ({
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
  destinationUf: context.operacao?.destinationUf ?? null,
  referenceDate: context.operacao?.referenceDate ?? context.dataOperacao ?? null,
  origemMercadoria: context.allocation?.origem
    ?? context.estoque?.origemMercadoria
    ?? 'UNKNOWN',
  origemSource: context.allocation?.origemSource ?? null,
  ncm: context.produto?.ncm ?? null,
  supplierCest: context.produto?.supplierCest ?? null,
  catalogCest: context.produto?.cest ?? null,
});
