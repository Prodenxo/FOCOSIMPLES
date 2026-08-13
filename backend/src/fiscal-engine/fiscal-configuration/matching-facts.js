/**
 * Extrai fatos de matching para AccountantApprovedFiscalRule a partir do FiscalContext.
 * FiscalContext = fatos da operação; não contém resultado aprovado.
 */
import { CURRENT_OPERATION_ST } from '../types/st-allocation.js';
import { OPERATION_SCOPE } from './constants.js';

/**
 * @param {object} context
 * @param {object} [treatmentPartial]
 */
export const extractMatchingFactsFromContext = (context, treatmentPartial = {}) => {
  const location = context.operacao?.localizacao ?? null;
  const operationScope = location === 'INTERESTADUAL'
    ? OPERATION_SCOPE.INTERSTATE
    : location === 'INTERNA'
      ? OPERATION_SCOPE.INTERNAL
      : null;

  const cpfCnpj = context.destinatario?.cpfCnpj ?? null;
  const personType = context.destinatario?.personType
    ?? (cpfCnpj && String(cpfCnpj).replace(/\D/g, '').length === 11 ? 'PF' : cpfCnpj ? 'PJ' : 'UNKNOWN');

  const recipientFinalConsumer = context.operacao?.consumidorFinal !== undefined
    ? (context.operacao.consumidorFinal === true ? 'YES' : 'NO')
    : context.destinatario?.consumidorFinal === true
      ? 'YES'
      : context.destinatario?.consumidorFinal === false
        ? 'NO'
        : 'UNKNOWN';

  return {
    tenantId: context.empresaId ?? null,
    empresaId: context.empresaId ?? null,
    establishmentId: context.emitente?.establishmentId ?? context.fiscalExtensions?.establishmentId ?? null,
    companyId: context.emitente?.companyId ?? context.empresaId ?? null,
    productId: context.produto?.produtoCatalogoId ?? context.produto?.id ?? null,
    customerId: context.destinatario?.customerId ?? context.destinatario?.id ?? null,
    crt: context.emitente?.crt ?? null,
    operationType: context.operacao?.operationType ?? context.operacao?.tipo ?? null,
    operationPurpose: context.operacao?.operationPurpose ?? null,
    itemSource: context.item?.itemSource ?? null,
    location,
    operationScope,
    issuerUf: context.emitente?.uf ?? null,
    destinationUf: context.operacao?.destinationUf ?? context.destinatario?.uf ?? null,
    recipientPersonType: personType,
    recipientTaxpayerStatus: context.destinatario?.icmsTaxpayerStatus ?? 'UNKNOWN',
    recipientFinalConsumer,
    priorStStatus: context.estoque?.priorStStatus
      ?? context.allocation?.priorStStatus
      ?? null,
    currentOperationSt: treatmentPartial.currentOperationSt
      ?? CURRENT_OPERATION_ST.UNKNOWN,
    stScenarioKey: treatmentPartial.stScenarioKey ?? null,
    issuerStLiability: context.fiscalExtensions?.issuerStLiability ?? 'UNKNOWN',
    stApplicabilityStatus: context.fiscalExtensions?.stApplicabilityStatus ?? 'UNKNOWN',
    ncm: context.produto?.ncm || null,
    cest: context.produto?.cest ?? context.produto?.supplierCest ?? null,
    origem: context.allocation?.origem ?? context.estoque?.origemMercadoria ?? 'UNKNOWN',
    origemSource: context.allocation?.origemSource ?? null,
    referenceDate: context.operacao?.referenceDate ?? context.dataOperacao ?? null,
  };
};

/** Campos cujo valor UNKNOWN impede match otimista. */
export const REQUIRED_FACT_FIELDS = Object.freeze([
  'recipientTaxpayerStatus',
  'ncm',
]);
