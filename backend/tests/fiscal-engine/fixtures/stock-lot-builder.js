import { randomUUID } from 'node:crypto';
import { STOCK_UNIT_RESOLUTION_STATUS, STOCK_UNIT_SOURCE } from '../../../src/fiscal-engine/acquisition/stock-unit-resolution.js';

/**
 * Monta lote fiscal USABLE para testes da Fase 3.
 */
export const buildUsableStockLot = ({
  id = randomUUID(),
  empresaId,
  establishmentId = null,
  establishment_id = null,
  produtoCatalogoId,
  purchaseItemId = randomUUID(),
  purchaseInvoiceId = randomUUID(),
  quantidade = '10.0000000000',
  dataEntrada = '2026-01-10',
  origem = '0',
  priorStStatus = 'NO_ST_EVIDENCE',
  priorStEvidence = {},
  supplierCest = null,
  stRetainedValues = {},
  baseUnit = 'UN',
  status = 'USABLE',
  version = 0,
  unitConfirmed = true,
} = {}) => ({
  id,
  empresa_id: empresaId,
  establishment_id: establishment_id ?? establishmentId ?? null,
  produto_catalogo_id: produtoCatalogoId,
  purchase_item_id: purchaseItemId,
  _purchase_invoice_id: purchaseInvoiceId,
  purchase_invoice_id: purchaseInvoiceId,
  origem_mercadoria: origem,
  base_unit: baseUnit,
  quantidade_inicial: quantidade,
  quantidade_disponivel: quantidade,
  prior_st_status: priorStStatus,
  prior_st_evidence_json: priorStEvidence,
  supplier_cest: supplierCest,
  st_retained_values_json: stRetainedValues,
  stock_unit_resolution_json: {
    baseUnit,
    baseQty: quantidade,
    source: STOCK_UNIT_SOURCE.CATALOG_CONFIRMED,
    status: unitConfirmed ? STOCK_UNIT_RESOLUTION_STATUS.CONFIRMED : STOCK_UNIT_RESOLUTION_STATUS.NEEDS_REVIEW,
    unitConversionEvidence: { sameUnit: true, sameQuantity: true, uCom: baseUnit, qCom: quantidade },
  },
  data_entrada: dataEntrada,
  status,
  version,
});
