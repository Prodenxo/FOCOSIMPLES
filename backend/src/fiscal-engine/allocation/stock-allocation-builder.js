/**
 * Monta FiscalItemAllocation e rateio ST para persistência (Fase 3).
 */
import { randomUUID } from 'node:crypto';
import { allocateStRetainedValues } from '../acquisition/st-retained-allocator.js';
import { ST_ALLOCATION_METHOD } from '../types/st-allocation.js';
import { ENGINE_SCHEMA_VERSION } from '../constants.js';
import { ALLOCATION_STATUS } from './allocation-constants.js';
import { toDecimal, formatDecimal } from '../money/decimal.js';

const QTY_SCALE = 10;

/**
 * @param {object} lot
 * @returns {import('../types/st-allocation.js').StAllocationMethod|null}
 */
export const resolveStAllocationMethod = (lot) => {
  const fromLot = lot?.st_retained_values_json?.allocationMethod
    || lot?.st_retained_values_json?.method;
  if (fromLot && Object.values(ST_ALLOCATION_METHOD).includes(fromLot)) {
    return fromLot;
  }
  return null;
};

/**
 * @param {object} params
 */
export const buildAllocationRowFromLot = ({
  lot,
  purchaseInvoiceId,
  quantity,
  availableBefore,
  allocationRequestUuid,
  commercialSaleItem,
  fifoOrder,
  priorActiveLotState = { priorActiveAllocatedQty: '0', priorActiveAllocatedValues: {} },
}) => {
  const purchaseTotalQty = lot.quantidade_inicial;
  const allocatedQty = quantity;
  const remainingQty = formatDecimal(
    toDecimal(purchaseTotalQty).minus(toDecimal(allocatedQty)),
    QTY_SCALE,
  );

  const stMethod = resolveStAllocationMethod(lot);
  const stSourceValues = lot.st_retained_values_json ?? {};
  const stAllocation = lot.prior_st_status === 'RETAINED'
    ? allocateStRetainedValues({
      purchaseValues: stSourceValues,
      purchaseTotalQty: String(purchaseTotalQty),
      allocatedQty: String(allocatedQty),
      remainingQty,
      method: stMethod,
      effectiveDate: lot.data_entrada,
      priorActiveAllocatedQty: priorActiveLotState.priorActiveAllocatedQty,
      priorActiveAllocatedValues: priorActiveLotState.priorActiveAllocatedValues,
    })
    : {
      ok: true,
      allocationMethod: null,
      allocatedValues: {},
      audit: { skipped: true, priorStStatus: lot.prior_st_status },
      issues: [],
    };

  return {
    id: randomUUID(),
    empresa_id: lot.empresa_id,
    establishment_id: lot.establishment_id ?? lot.establishmentId ?? commercialSaleItem.establishmentId ?? null,
    stock_lot_id: lot.id,
    allocation_request_uuid: allocationRequestUuid,
    commercial_sale_id: commercialSaleItem.commercialSaleId ?? null,
    commercial_sale_item_id: commercialSaleItem.commercialSaleItemId ?? null,
    purchase_item_id: lot.purchase_item_id,
    purchase_invoice_id: purchaseInvoiceId,
    produto_catalogo_id: lot.produto_catalogo_id,
    quantidade: String(allocatedQty),
    allocation_method: stAllocation.allocationMethod,
    st_allocation_json: {
      method: stAllocation.allocationMethod,
      allocatedValues: stAllocation.allocatedValues ?? {},
      audit: stAllocation.audit ?? {},
      issues: stAllocation.issues ?? [],
    },
    reference_type: 'COMMERCIAL_SALE_ITEM',
    reference_id: commercialSaleItem.commercialSaleItemId ?? null,
    status: ALLOCATION_STATUS.RESERVED,
    origem_mercadoria: lot.origem_mercadoria,
    prior_st_status: lot.prior_st_status,
    prior_st_evidence_json: lot.prior_st_evidence_json ?? {},
    supplier_cest: lot.supplier_cest ?? null,
    stock_unit_resolution_json: lot.stock_unit_resolution_json ?? {},
    base_unit: lot.base_unit,
    allocation_audit_json: {
      allocationRequestId: commercialSaleItem.allocationRequestId,
      fifoOrder,
      availableBefore,
      availableAfter: formatDecimal(
        toDecimal(availableBefore).minus(toDecimal(allocatedQty)),
        QTY_SCALE,
      ),
      purchaseInvoiceId,
      purchaseItemId: lot.purchase_item_id,
      stMethod,
    },
    engine_schema_version: ENGINE_SCHEMA_VERSION,
  };
};

/**
 * Contexto pré-resolução por alocação (sem CFOP/CSOSN).
 * @param {object} allocationRow
 */
export const buildPreResolutionAllocationContext = (allocationRow) => ({
  produtoCatalogoId: allocationRow.produto_catalogo_id,
  quantity: allocationRow.quantidade,
  stockLotId: allocationRow.stock_lot_id,
  itemSource: null,
  origem: allocationRow.origem_mercadoria,
  priorStStatus: allocationRow.prior_st_status,
  priorStEvidence: allocationRow.prior_st_evidence_json,
  supplierCest: allocationRow.supplier_cest,
  unitResolution: allocationRow.stock_unit_resolution_json,
  acquisitionRefs: {
    purchaseInvoiceId: allocationRow.purchase_invoice_id,
    purchaseItemId: allocationRow.purchase_item_id,
  },
  stRetainedAllocation: allocationRow.st_allocation_json,
  auditRefs: {
    allocationId: allocationRow.id,
    allocationRequestUuid: allocationRow.allocation_request_uuid,
    allocationAudit: allocationRow.allocation_audit_json,
  },
  cfop: null,
  csosn: null,
  currentOperationSt: null,
  resolved: false,
});
