/**
 * Fixture de FiscalContext para testes das Fases 5+6.
 */
import { randomUUID } from 'node:crypto';
import { buildFiscalContextFromAllocation } from '../../../src/fiscal-engine/context/build-allocation-fiscal-context.js';

const EMP = 'empresa-phase56';

export const allocationFixture = (overrides = {}) => ({
  id: randomUUID(),
  empresa_id: EMP,
  stock_lot_id: randomUUID(),
  produto_catalogo_id: 'prod-001',
  quantidade: '1.0000000000',
  origem_mercadoria: '0',
  origem_mercadoria_source: 'LOT_CONFIRMED',
  prior_st_status: 'NO_ST_EVIDENCE',
  prior_st_evidence_json: {},
  supplier_cest: null,
  stock_unit_resolution_json: { baseUnit: 'UN', status: 'CONFIRMED' },
  base_unit: 'UN',
  purchase_invoice_id: randomUUID(),
  purchase_item_id: randomUUID(),
  allocation_audit_json: { lotOrigemConfirmed: true },
  st_allocation_json: {},
  commercial_sale_id: randomUUID(),
  commercial_sale_item_id: randomUUID(),
  allocation_request_uuid: randomUUID(),
  ...overrides,
});

/**
 * @param {object} [overrides]
 */
export const buildTestFiscalContext = (overrides = {}) => {
  const allocation = allocationFixture(overrides.allocation ?? {});
  return buildFiscalContextFromAllocation({
    empresaId: overrides.empresaId ?? EMP,
    fiscalItemAllocation: allocation,
    issuer: { crt: 1, uf: 'RJ', document: '12345678000199', ...(overrides.issuer ?? {}) },
    recipient: {
      uf: 'RJ',
      cpfCnpj: '12345678901',
      icmsTaxpayerStatus: 'NON_TAXPAYER',
      ...(overrides.recipient ?? {}),
    },
    produto: { ncm: '22021000', descricao: 'Produto teste', ...(overrides.produto ?? {}) },
    item: { itemSource: 'THIRD_PARTY', quantidade: 1, valorUnitario: 100, ...(overrides.item ?? {}) },
    operation: { tipo: 'VENDA', ...(overrides.operation ?? {}) },
    referenceDate: overrides.referenceDate ?? '2026-06-15',
    ...overrides.input,
  });
};

export { EMP as TEST_EMPRESA_ID };
