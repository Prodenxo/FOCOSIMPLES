/**
 * Serviço de alocação fiscal — CommercialSaleItem → FIFO → reserva (Fase 3).
 */
import { randomUUID } from 'node:crypto';
import { ENGINE_SCHEMA_VERSION } from '../constants.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { deriveResolutionStatusFromIssues } from '../types/resolution-status.js';
import { createFiscalDecisionLogEntry } from '../audit/fiscal-decision-log.js';
import { toDecimal, formatDecimal, sumDecimals } from '../money/decimal.js';
import { planFifoAllocation } from './stock-allocation-eligibility.js';
import {
  buildAllocationRowFromLot,
  buildPreResolutionAllocationContext,
} from './stock-allocation-builder.js';
import { ALLOCATION_REQUEST_STATUS } from './allocation-constants.js';
import {
  describeAllocationRequestMismatch,
  buildAllocationRequestFingerprint,
  resolveBoundaryAllocationQuantity,
} from './allocation-idempotency.js';
import { buildPriorLotStateMap, mergeLotStStateAfterRow } from './st-allocation-lot-state.js';
import * as pgAllocationRepo from './stock-allocation.repository.js';
import * as memoryAllocationRepo from './stock-allocation-memory.repository.js';

const QTY_SCALE = 10;

/** @type {typeof pgAllocationRepo} */
let allocationRepo = pgAllocationRepo;

/** @internal testes */
export const __setStockAllocationRepoForTests = (repo) => {
  allocationRepo = repo || pgAllocationRepo;
};

/** @internal testes */
export const __resetStockAllocationRepoForTests = () => {
  allocationRepo = pgAllocationRepo;
};

const validateCommercialSaleItem = (item) => {
  const issues = [];
  if (!item?.empresaId) {
    issues.push(createFiscalIssue('REQUIRED_FIELD_MISSING', 'empresaId obrigatório'));
  }
  if (!item?.produtoCatalogoId) {
    issues.push(createFiscalIssue('REQUIRED_FIELD_MISSING', 'produtoCatalogoId obrigatório'));
  }
  if (!item?.allocationRequestId) {
    issues.push(createFiscalIssue('REQUIRED_FIELD_MISSING', 'allocationRequestId obrigatório para idempotência'));
  }
  const qty = toDecimal(item?.quantidade ?? '0');
  if (!qty.gt(0)) {
    issues.push(createFiscalIssue('REQUIRED_FIELD_MISSING', 'quantidade deve ser positiva'));
  } else {
    const resolved = resolveBoundaryAllocationQuantity(item.quantidade);
    if (!resolved.ok && resolved.reason === 'precision') {
      issues.push(createFiscalIssue(
        'ALLOCATION_QUANTITY_PRECISION_INVALID',
        'Quantidade excede a precisão fiscal permitida (qCom, 4 casas decimais)',
      ));
    }
  }
  return issues;
};

const buildFailureResult = (commercialSaleItem, plan, criteria, allocationRequestId) => {
  const issues = [
    createFiscalIssue(
      'INSUFFICIENT_USABLE_FISCAL_STOCK',
      `Estoque fiscal utilizável insuficiente — solicitado ${formatDecimal(toDecimal(commercialSaleItem.quantidade), QTY_SCALE)}, disponível ${plan.totalUsable}`,
      {
        meta: {
          requestedQty: formatDecimal(toDecimal(commercialSaleItem.quantidade), QTY_SCALE),
          totalUsable: plan.totalUsable,
          remaining: plan.remaining,
          rejectedLots: plan.rejectedLots,
        },
      },
    ),
  ];
  return {
    ok: false,
    resolutionStatus: deriveResolutionStatusFromIssues(issues),
    issues,
    allocations: [],
    preResolutionContexts: [],
    audit: createFiscalDecisionLogEntry({
      decisionId: allocationRequestId,
      contextSnapshot: { commercialSaleItem, criteria },
      automaticResult: { plan },
      issues,
    }),
    idempotentReplay: false,
  };
};

const buildSuccessResult = (persisted, plan, commercialSaleItem, criteria, allocationRequestId, replay, requestedQty) => {
  const sumAllocated = sumDecimals(persisted.allocations.map((a) => a.quantidade));
  if (!toDecimal(sumAllocated).eq(toDecimal(requestedQty))) {
    throw new Error('Invariante de quantidade alocada violada');
  }

  const audit = createFiscalDecisionLogEntry({
    decisionId: allocationRequestId,
    contextSnapshot: { commercialSaleItem, criteria },
    automaticResult: {
      allocations: persisted.allocations,
      rejectedLots: plan?.rejectedLots ?? persisted.request?.allocation_audit_json?.rejectedLots,
    },
    issues: [],
  });

  return {
    ok: true,
    resolutionStatus: persisted.request.resolution_status || 'OK',
    issues: persisted.request.issues_json || [],
    allocations: persisted.allocations,
    preResolutionContexts: persisted.allocations.map(buildPreResolutionAllocationContext),
    audit,
    idempotentReplay: replay,
    request: persisted.request,
  };
};

/**
 * @param {object} commercialSaleItem
 */
export const allocateFiscalStockForSaleItem = async (commercialSaleItem) => {
  const validationIssues = validateCommercialSaleItem(commercialSaleItem);
  if (validationIssues.length) {
    return {
      ok: false,
      resolutionStatus: deriveResolutionStatusFromIssues(validationIssues),
      issues: validationIssues,
      allocations: [],
      preResolutionContexts: [],
      audit: null,
      idempotentReplay: false,
    };
  }

  const {
    empresaId,
    produtoCatalogoId,
    quantidade,
    allocationRequestId,
    commercialSaleId = null,
    commercialSaleItemId = null,
  } = commercialSaleItem;

  const criteria = { empresaId, produtoCatalogoId };
  const boundaryQty = resolveBoundaryAllocationQuantity(quantidade);
  if (!boundaryQty.ok) {
    const issues = boundaryQty.reason === 'precision'
      ? [createFiscalIssue(
        'ALLOCATION_QUANTITY_PRECISION_INVALID',
        'Quantidade excede a precisão fiscal permitida (qCom, 4 casas decimais)',
      )]
      : [createFiscalIssue('REQUIRED_FIELD_MISSING', 'quantidade deve ser positiva')];
    return {
      ok: false,
      resolutionStatus: deriveResolutionStatusFromIssues(issues),
      issues,
      allocations: [],
      preResolutionContexts: [],
      audit: null,
      idempotentReplay: false,
    };
  }
  const requestedQty = boundaryQty.quantity;

  const planExecutor = async (lockedLots, context = {}) => {
    const plan = planFifoAllocation(lockedLots, requestedQty, criteria);
    if (!plan.ok) {
      return buildFailureResult(commercialSaleItem, plan, criteria, allocationRequestId);
    }

    const allocationRequestUuid = randomUUID();
    const priorByLot = buildPriorLotStateMap(context.activeAllocationsByLotId);
    const allocationRows = [];

    for (const [index, entry] of plan.allocations.entries()) {
      const lotId = entry.lot.id;
      const priorState = priorByLot.get(lotId) ?? {
        priorActiveAllocatedQty: '0',
        priorActiveAllocatedValues: {},
      };
      const row = buildAllocationRowFromLot({
        lot: entry.lot,
        purchaseInvoiceId: entry.lot.purchase_invoice_id,
        quantity: entry.quantity,
        availableBefore: entry.availableBefore,
        allocationRequestUuid,
        commercialSaleItem,
        fifoOrder: index + 1,
        priorActiveLotState: priorState,
      });
      allocationRows.push(row);
      priorByLot.set(lotId, mergeLotStStateAfterRow(priorState, row));
    }

    const lotUpdates = plan.allocations.map((entry) => ({
      lotId: entry.lot.id,
      empresaId,
      quantity: entry.quantity,
      expectedVersion: entry.lot.version ?? 0,
    }));

    return {
      ok: true,
      plan,
      requestRow: {
        id: allocationRequestUuid,
        empresa_id: empresaId,
        allocation_request_id: allocationRequestId,
        commercial_sale_id: commercialSaleId,
        commercial_sale_item_id: commercialSaleItemId,
        produto_catalogo_id: produtoCatalogoId,
        quantidade_solicitada: requestedQty,
        status: ALLOCATION_REQUEST_STATUS.COMPLETED,
        resolution_status: 'OK',
        issues_json: [],
        allocation_audit_json: {
          fifoField: 'data_entrada',
          tieBreak: 'id',
          rejectedLots: plan.rejectedLots,
          chosenLots: plan.allocations.map((a) => ({
            lotId: a.lot.id,
            quantity: a.quantity,
            dataEntrada: a.lot.data_entrada,
          })),
        },
        engine_schema_version: ENGINE_SCHEMA_VERSION,
      },
      allocationRows,
      lotUpdates,
    };
  };

  try {
    const result = await allocationRepo.runStockAllocationAtomic({
      empresaId,
      produtoCatalogoId,
      allocationRequestId,
      quantidadeSolicitada: requestedQty,
      commercialSaleId,
      commercialSaleItemId,
      planExecutor,
    });

    if (result.idempotencyConflict) {
      const existing = await allocationRepo.findAllocationRequestByKey(empresaId, allocationRequestId);
      const mismatch = existing?.request
        ? describeAllocationRequestMismatch(existing.request, buildAllocationRequestFingerprint({
          produtoCatalogoId: String(produtoCatalogoId),
          quantidade: requestedQty,
          commercialSaleId,
          commercialSaleItemId,
        }))
        : 'parâmetros canônicos divergentes';
      const issues = [createFiscalIssue(
        'ALLOCATION_IDEMPOTENCY_CONFLICT',
        `Replay rejeitado — mesma allocationRequestId com payload diferente (${mismatch})`,
      )];
      return {
        ok: false,
        resolutionStatus: deriveResolutionStatusFromIssues(issues),
        issues,
        allocations: existing?.allocations ?? [],
        preResolutionContexts: [],
        audit: null,
        idempotentReplay: false,
      };
    }

    if (result.ok === false) {
      return result;
    }

    if (result.replay) {
      return buildSuccessResult(result, null, commercialSaleItem, criteria, allocationRequestId, true, requestedQty);
    }

    return buildSuccessResult(result, null, commercialSaleItem, criteria, allocationRequestId, false, requestedQty);
  } catch (err) {
    if (String(err?.message).includes('STOCK_ALLOCATION_CONFLICT')) {
      const issues = [createFiscalIssue('STOCK_ALLOCATION_CONFLICT', 'Conflito de concorrência na alocação de estoque')];
      return {
        ok: false,
        resolutionStatus: deriveResolutionStatusFromIssues(issues),
        issues,
        allocations: [],
        preResolutionContexts: [],
        audit: null,
        idempotentReplay: false,
      };
    }
    throw err;
  }
};

export const releaseFiscalStockAllocation = async (empresaId, allocationRequestId) => (
  allocationRepo.releaseAllocationRequest(empresaId, allocationRequestId)
);

export const consumeFiscalStockAllocation = async (empresaId, allocationRequestId) => (
  allocationRepo.consumeAllocationRequest(empresaId, allocationRequestId)
);

export { memoryAllocationRepo };
