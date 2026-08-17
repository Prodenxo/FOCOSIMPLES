/**
 * Adapter shadow — CommercialItem → FIFO read-only → Allocation[] → FiscalContext[].
 */
import { buildFiscalContextFromAllocation } from '../context/build-allocation-fiscal-context.js';
import { ICMS_TAXPAYER_STATUS, parseItemSourceHint } from '../types/item-source.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { SHADOW_DIFFERENCE_CODE } from './shadow-constants.js';
import {
  planFiscalStockAllocationForShadow,
  buildPlannedAllocationRowsForShadow,
  snapshotLotBalances,
} from './plan-fiscal-stock-allocation-shadow.js';
import { fetchLotsForShadow } from './shadow-lot-fetcher.js';
import { deriveIcmsTaxpayerStatusFromLegacyDestinatario } from './build-fiscal-v3-shadow-input.helpers.js';
import {
  getShadowVirtualPlanningDeductionByLotIds,
  applyShadowVirtualAvailabilityToLots,
} from './shadow-stock-ledger.service.js';
import { resolveEstablishmentIdFromPayload } from '../establishment/fiscal-establishment-id.js';

export { deriveIcmsTaxpayerStatusFromLegacyDestinatario } from './build-fiscal-v3-shadow-input.helpers.js';

const onlyDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);

/**
 * @typedef {object} ShadowCommercialItemPlan
 * @property {number} itemIndex
 * @property {object} commercialItem
 * @property {object[]} plannedAllocations
 * @property {object[]} fiscalContexts
 * @property {import('../types/fiscal-issue.js').FiscalIssue[]} planningIssues
 * @property {object[]} lotBalanceBefore
 * @property {object[]} lotBalanceAfter
 */

/**
 * @param {object} params
 */
export const buildFiscalV3ShadowInput = async ({
  empresaId = null,
  userId = null,
  correlationId = null,
  emissionAttemptId = null,
  documentType = 'NFE',
  businessType = null,
  legacyPayloadSnapshot: legacyPayloadSnapshotParam = null,
  legacyPayload = null,
  metadata = {},
  lotFetcher = null,
  inMemoryLotsByProduct = null,
}) => {
  const legacyPayloadSnapshot = legacyPayloadSnapshotParam ?? legacyPayload;
  const payload = legacyPayloadSnapshot && typeof legacyPayloadSnapshot === 'object'
    ? legacyPayloadSnapshot
    : {};
  const emitente = payload.emitente && typeof payload.emitente === 'object' ? payload.emitente : {};
  const destinatario = payload.destinatario && typeof payload.destinatario === 'object'
    ? payload.destinatario
    : {};
  const itens = Array.isArray(payload.itens) ? payload.itens : [];
  const icmsTaxpayerStatus = deriveIcmsTaxpayerStatusFromLegacyDestinatario(destinatario);
  const referenceDate = String(metadata?.referenceDate ?? new Date().toISOString()).slice(0, 10);
  const tenantId = empresaId ?? userId ?? null;
  const establishmentId = metadata?.establishmentId
    ?? resolveEstablishmentIdFromPayload(payload)
    ?? null;

  const buildEmitenteForContext = () => ({
    cpfCnpj: emitente.cpfCnpj ?? emitente.cnpj ?? null,
    crt: emitente.crt ?? emitente.CRT ?? metadata?.crt ?? 1,
    uf: emitente.endereco?.estado ?? emitente.endereco?.uf ?? emitente.uf,
    cnae: emitente.cnae ?? null,
    inscricaoEstadual: emitente.inscricaoEstadual ?? null,
    businessTypeHint: businessType,
    establishmentId,
  });

  /** @type {ShadowCommercialItemPlan[]} */
  const itemPlans = [];
  /** @type {object[]} */
  const fiscalContexts = [];
  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */
  const planningIssues = [];

  for (let index = 0; index < itens.length; index += 1) {
    const item = itens[index];
    const produtoCatalogoId = item?.produtoCatalogoId
      ?? item?.metadata?.catalogoProdutoId
      ?? item?.codigo
      ?? null;

    const commercialItem = {
      itemIndex: index,
      commercialSaleItemId: item?.commercialSaleItemId ?? item?.metadata?.commercialSaleItemId ?? null,
      commercialSaleId: item?.commercialSaleId ?? metadata?.commercialSaleId ?? null,
      produtoCatalogoId,
      codigo: item?.codigo ?? null,
      descricao: item?.descricao ?? null,
      ncm: item?.ncm ?? null,
      cest: item?.cest ?? null,
      quantidade: item?.quantidade ?? null,
      valorUnitario: item?.valorUnitario ?? null,
      valorTotal: item?.valorTotal ?? null,
      itemSourceHint: businessType ?? metadata?.businessType ?? null,
    };

    if (!tenantId || !produtoCatalogoId || !commercialItem.quantidade) {
      planningIssues.push(createFiscalIssue(
        'SHADOW_ALLOCATION_UNAVAILABLE',
        'Shadow não conseguiu localizar evidência fiscal do lote — produto/quantidade/empresa ausentes.',
        {
          severity: 'REVIEW',
          blocksEmission: false,
          meta: { itemIndex: index, produtoCatalogoId, reason: 'MISSING_COMMERCIAL_IDENTITY' },
        },
      ));
      itemPlans.push({
        itemIndex: index,
        commercialItem,
        plannedAllocations: [],
        fiscalContexts: [],
        planningIssues: planningIssues.slice(-1),
        lotBalanceBefore: [],
        lotBalanceAfter: [],
      });
      continue;
    }

    const productLotsRaw = await fetchLotsForShadow(tenantId, produtoCatalogoId, {
      lotFetcher,
      inMemoryLots: inMemoryLotsByProduct?.[produtoCatalogoId],
      preferPostgres: !inMemoryLotsByProduct,
      establishmentId,
      allowLegacyUntaggedLots: true,
    });

    const lotBalanceBefore = snapshotLotBalances(productLotsRaw);

    if (!Array.isArray(productLotsRaw) || productLotsRaw.length === 0) {
      planningIssues.push(createFiscalIssue(
        'SHADOW_ALLOCATION_UNAVAILABLE',
        'Shadow não encontrou lotes fiscais utilizáveis para planejamento FIFO.',
        {
          severity: 'REVIEW',
          blocksEmission: false,
          meta: { itemIndex: index, produtoCatalogoId },
        },
      ));
      itemPlans.push({
        itemIndex: index,
        commercialItem,
        plannedAllocations: [],
        fiscalContexts: [],
        planningIssues: planningIssues.slice(-1),
        lotBalanceBefore,
        lotBalanceAfter: lotBalanceBefore,
      });
      continue;
    }

    const lotIds = productLotsRaw.map((lot) => lot.id);
    const planningDeduction = await getShadowVirtualPlanningDeductionByLotIds(tenantId, lotIds);
    const productLots = applyShadowVirtualAvailabilityToLots(
      productLotsRaw.map((lot) => ({ ...lot })),
      planningDeduction,
    );

    const plan = planFiscalStockAllocationForShadow(
      productLots,
      String(commercialItem.quantidade),
      {
        empresaId: tenantId,
        produtoCatalogoId,
        establishmentId,
        allowLegacyUntaggedLots: true,
      },
    );

    const lotBalanceAfter = snapshotLotBalances(productLotsRaw);

    if (!plan.ok) {
      planningIssues.push(createFiscalIssue(
        'SHADOW_ALLOCATION_UNAVAILABLE',
        'Estoque fiscal insuficiente para planejamento shadow FIFO.',
        {
          severity: 'REVIEW',
          blocksEmission: false,
          meta: {
            itemIndex: index,
            produtoCatalogoId,
            remaining: plan.remaining,
            totalUsable: plan.totalUsable,
          },
        },
      ));
      const allocationRequestId = `shadow-${correlationId || 'emit'}-${index}`;
      const partialRows = buildPlannedAllocationRowsForShadow({
        plan,
        commercialSaleItem: {
          commercialSaleId: commercialItem.commercialSaleId,
          commercialSaleItemId: commercialItem.commercialSaleItemId,
          allocationRequestId,
        },
        allocationRequestId,
      });

      const itemSourceHintPartial = parseItemSourceHint(
        businessType ?? item?.itemSource ?? item?.metadata?.businessType,
      );
      const partialContexts = partialRows.map((allocationRow) => buildFiscalContextFromAllocation({
        empresaId: tenantId,
        commercialSaleId: commercialItem.commercialSaleId,
        commercialSaleItemId: commercialItem.commercialSaleItemId,
        fiscalItemAllocation: allocationRow,
        referenceDate,
        emitente: buildEmitenteForContext(),
        destinatario: {
          cpfCnpj: destinatario.cpfCnpj,
          uf: destinatario.endereco?.estado ?? destinatario.endereco?.uf ?? destinatario.uf,
          icmsTaxpayerStatus,
          inscricaoEstadual: destinatario.inscricaoEstadual ?? null,
          indIEDest: destinatario.indIEDest ?? destinatario.indicadorInscricaoEstadual ?? null,
        },
        produto: {
          ncm: item?.ncm,
          descricao: item?.descricao,
          cest: item?.cest ?? null,
        },
        item: {
          itemSource: item?.itemSource ?? itemSourceHintPartial ?? undefined,
          valorUnitario: item?.valorUnitario ?? 0,
          valorTotal: item?.valorTotal ?? null,
        },
        operation: {
          tipo: 'VENDA',
          destinationUf: destinatario.endereco?.estado ?? destinatario.endereco?.uf ?? destinatario.uf,
        },
      }));

      fiscalContexts.push(...partialContexts);
      itemPlans.push({
        itemIndex: index,
        commercialItem,
        plannedAllocations: partialRows,
        fiscalContexts: partialContexts,
        planningIssues: planningIssues.slice(-1),
        lotBalanceBefore,
        lotBalanceAfter,
        shadowVirtualConsumed: Object.fromEntries(planningDeduction),
        partialPlan: true,
        unallocatedQuantity: plan.remaining,
      });
      continue;
    }

    const allocationRequestId = `shadow-${correlationId || 'emit'}-${index}`;
    const plannedRows = buildPlannedAllocationRowsForShadow({
      plan,
      commercialSaleItem: {
        commercialSaleId: commercialItem.commercialSaleId,
        commercialSaleItemId: commercialItem.commercialSaleItemId,
        allocationRequestId,
      },
      allocationRequestId,
    });

    const itemSourceHint = parseItemSourceHint(
      businessType ?? item?.itemSource ?? item?.metadata?.businessType,
    );

    const contextsForItem = plannedRows.map((allocationRow) => buildFiscalContextFromAllocation({
      empresaId: tenantId,
      commercialSaleId: commercialItem.commercialSaleId,
      commercialSaleItemId: commercialItem.commercialSaleItemId,
      fiscalItemAllocation: allocationRow,
      referenceDate,
      emitente: buildEmitenteForContext(),
      destinatario: {
        cpfCnpj: destinatario.cpfCnpj,
        uf: destinatario.endereco?.estado ?? destinatario.endereco?.uf ?? destinatario.uf,
        icmsTaxpayerStatus,
        inscricaoEstadual: destinatario.inscricaoEstadual ?? null,
        indIEDest: destinatario.indIEDest ?? destinatario.indicadorInscricaoEstadual ?? null,
      },
      produto: {
        ncm: item?.ncm,
        descricao: item?.descricao,
        cest: item?.cest ?? null,
      },
      item: {
        itemSource: item?.itemSource ?? itemSourceHint ?? undefined,
        valorUnitario: item?.valorUnitario ?? 0,
        valorTotal: item?.valorTotal ?? null,
      },
      operation: {
        tipo: 'VENDA',
        destinationUf: destinatario.endereco?.estado ?? destinatario.endereco?.uf ?? destinatario.uf,
      },
    }));

    fiscalContexts.push(...contextsForItem);
    itemPlans.push({
      itemIndex: index,
      commercialItem,
      plannedAllocations: plannedRows,
      fiscalContexts: contextsForItem,
      planningIssues: [],
      lotBalanceBefore,
      lotBalanceAfter,
      shadowVirtualConsumed: Object.fromEntries(planningDeduction),
    });
  }

  return {
    empresaId: tenantId,
    establishmentId,
    userId: userId ?? null,
    correlationId: correlationId ?? payload.idIntegracao ?? null,
    emissionAttemptId: emissionAttemptId ?? payload.idIntegracao ?? null,
    documentType,
    businessType,
    legacyPayloadSnapshot: payload,
    commercialItems: itemPlans.map((p) => p.commercialItem),
    itemPlans,
    fiscalContexts,
    planningIssues,
  };
};

/**
 * @param {import('./build-fiscal-v3-shadow-input.js').ShadowCommercialItemPlan[]} itemPlans
 */
export const extractShadowAllocationUnavailableCodes = (itemPlans) => {
  const codes = [];
  for (const plan of itemPlans ?? []) {
    if (!plan.plannedAllocations?.length) {
      codes.push(SHADOW_DIFFERENCE_CODE.SHADOW_ALLOCATION_UNAVAILABLE);
    }
  }
  return codes;
};
