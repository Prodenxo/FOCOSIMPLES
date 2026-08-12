import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  buildFiscalContextFromAllocation,
  buildFiscalContextsFromAllocations,
  prepareTaxTreatmentInput,
} from '../../src/fiscal-engine/context/build-allocation-fiscal-context.js';
import { ENGINE_SCHEMA_VERSION } from '../../src/fiscal-engine/constants.js';
import { CURRENT_OPERATION_ST } from '../../src/fiscal-engine/types/st-allocation.js';
import { CRT_MEI_PROFILE } from '../../src/fiscal-engine/types/crt.js';
import { toDecimal } from '../../src/fiscal-engine/money/decimal.js';
import { isFiscalEngineV3Enabled } from '../../src/fiscal-engine/feature-flag.js';

const EMP = 'empresa-fc4-a';
const PROD = 'produto-fc4-001';

const allocationRow = (overrides = {}) => ({
  id: randomUUID(),
  empresa_id: EMP,
  stock_lot_id: randomUUID(),
  produto_catalogo_id: PROD,
  quantidade: '5.0000000000',
  origem_mercadoria: '0',
  prior_st_status: 'RETAINED',
  prior_st_evidence_json: { classifier: 'test' },
  supplier_cest: null,
  stock_unit_resolution_json: { baseUnit: 'UN', status: 'CONFIRMED' },
  base_unit: 'UN',
  purchase_invoice_id: randomUUID(),
  purchase_item_id: randomUUID(),
  allocation_audit_json: { fifoOrder: 1 },
  st_allocation_json: { allocatedValues: { vBCSTRet: '50.00' } },
  commercial_sale_id: randomUUID(),
  commercial_sale_item_id: randomUUID(),
  allocation_request_uuid: randomUUID(),
  ...overrides,
});

const baseInput = (overrides = {}) => ({
  empresaId: EMP,
  fiscalItemAllocation: allocationRow(),
  issuer: { crt: 1, uf: 'RJ', document: '12345678000199' },
  recipient: { uf: 'SP', cpfCnpj: '12345678901', icmsTaxpayerStatus: 'NON_TAXPAYER' },
  produto: { ncm: '40111000', descricao: 'Pneu' },
  item: { itemSource: 'THIRD_PARTY' },
  operation: { tipo: 'VENDA' },
  referenceDate: '2026-06-15',
  nfeTechnicalProfileOverrides: { layoutVersion: '4.00' },
  ...overrides,
});

test('FISCAL_ENGINE_V3 permanece false — Fase 4 não altera emissão', () => {
  assert.equal(isFiscalEngineV3Enabled(), false);
});

test('1. allocation RETAINED → context preserva RETAINED', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    fiscalItemAllocation: allocationRow({ prior_st_status: 'RETAINED' }),
  }));
  assert.equal(ctx.allocation.priorStStatus, 'RETAINED');
  assert.equal(ctx.estoque.priorStStatus, 'RETAINED');
});

test('2. allocation NO_ST_EVIDENCE', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    fiscalItemAllocation: allocationRow({ prior_st_status: 'NO_ST_EVIDENCE' }),
  }));
  assert.equal(ctx.allocation.priorStStatus, 'NO_ST_EVIDENCE');
});

test('3. allocation UNKNOWN priorSt', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    fiscalItemAllocation: allocationRow({ prior_st_status: 'UNKNOWN' }),
  }));
  assert.equal(ctx.allocation.priorStStatus, 'UNKNOWN');
});

test('4. origem 0 confirmada', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    fiscalItemAllocation: allocationRow({ origem_mercadoria: '0' }),
  }));
  assert.equal(ctx.allocation.origem, '0');
  assert.equal(ctx.allocation.origemSource, 'UNKNOWN');
  assert.equal(ctx.allocation.origemProvenance, 'unattributed_known_value');
});

test('5. origem diferente de 0', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    fiscalItemAllocation: allocationRow({ origem_mercadoria: '2' }),
  }));
  assert.equal(ctx.allocation.origem, '2');
});

test('6. origem UNKNOWN permanece UNKNOWN', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    fiscalItemAllocation: allocationRow({ origem_mercadoria: 'UNKNOWN' }),
    produto: { ncm: '40111000', defaultOrigemMercadoria: '0' },
  }));
  assert.equal(ctx.allocation.origem, 'UNKNOWN');
  assert.equal(ctx.allocation.origemSource, 'UNKNOWN');
  assert.equal(ctx.produto.defaultOrigemMercadoria, '0');
  assert.ok(ctx.issues.some((i) => i.code === 'ORIGIN_UNKNOWN'));
});

test('7. THIRD_PARTY itemSource', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({ item: { itemSource: 'THIRD_PARTY' } }));
  assert.equal(ctx.item.itemSource, 'THIRD_PARTY');
});

test('8. OWN_PRODUCTION itemSource', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({ item: { itemSource: 'OWN_PRODUCTION' } }));
  assert.equal(ctx.item.itemSource, 'OWN_PRODUCTION');
});

test('9. itemSource UNKNOWN gera issue', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({ item: {} }));
  assert.equal(ctx.item.itemSource, 'UNKNOWN');
  assert.ok(ctx.issues.some((i) => i.code === 'ITEM_SOURCE_UNKNOWN'));
});

test('10. operação interna', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    issuer: { crt: 1, uf: 'RJ' },
    recipient: { uf: 'RJ', icmsTaxpayerStatus: 'NON_TAXPAYER', cpfCnpj: '12345678901' },
  }));
  assert.equal(ctx.operacao.localizacao, 'INTERNA');
});

test('11. operação interestadual', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    issuer: { crt: 1, uf: 'RJ' },
    recipient: { uf: 'SP', icmsTaxpayerStatus: 'NON_TAXPAYER', cpfCnpj: '12345678901' },
  }));
  assert.equal(ctx.operacao.localizacao, 'INTERESTADUAL');
});

test('12. issuer UF ausente', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    issuer: { crt: 1 },
    recipient: { uf: 'SP', icmsTaxpayerStatus: 'NON_TAXPAYER' },
  }));
  assert.equal(ctx.operacao.localizacao, 'UNKNOWN');
  assert.ok(ctx.issues.some((i) => i.meta?.field === 'issuer.uf'));
});

test('13. recipient UF ausente', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    issuer: { crt: 1, uf: 'RJ' },
    recipient: { icmsTaxpayerStatus: 'NON_TAXPAYER' },
  }));
  assert.ok(ctx.issues.some((i) => i.meta?.field === 'recipient.uf'));
});

test('14. PF + NON_TAXPAYER', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    recipient: { uf: 'RJ', cpfCnpj: '12345678901', icmsTaxpayerStatus: 'NON_TAXPAYER' },
  }));
  assert.equal(ctx.destinatario.personType, 'PF');
  assert.equal(ctx.destinatario.icmsTaxpayerStatus, 'NON_TAXPAYER');
});

test('15. PF + TAXPAYER', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    recipient: { uf: 'RJ', cpfCnpj: '12345678901', icmsTaxpayerStatus: 'TAXPAYER', inscricaoEstadual: '123' },
  }));
  assert.equal(ctx.destinatario.personType, 'PF');
  assert.equal(ctx.destinatario.icmsTaxpayerStatus, 'TAXPAYER');
});

test('16. PJ + NON_TAXPAYER', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    recipient: { uf: 'RJ', cpfCnpj: '12345678000199', icmsTaxpayerStatus: 'NON_TAXPAYER' },
  }));
  assert.equal(ctx.destinatario.personType, 'PJ');
  assert.equal(ctx.destinatario.icmsTaxpayerStatus, 'NON_TAXPAYER');
});

test('17. PJ + TAXPAYER', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    recipient: { uf: 'RJ', cpfCnpj: '12345678000199', icmsTaxpayerStatus: 'TAXPAYER', inscricaoEstadual: '12345678' },
  }));
  assert.equal(ctx.destinatario.personType, 'PJ');
  assert.equal(ctx.destinatario.icmsTaxpayerStatus, 'TAXPAYER');
});

test('18. taxpayerStatus UNKNOWN', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    recipient: { uf: 'RJ', cpfCnpj: '12345678901' },
  }));
  assert.equal(ctx.destinatario.icmsTaxpayerStatus, 'UNKNOWN');
  assert.ok(ctx.issues.some((i) => i.code === 'ICMS_TAXPAYER_STATUS_UNKNOWN'));
});

test('19. CRT1', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({ issuer: { crt: 1, uf: 'RJ' } }));
  assert.equal(ctx.emitente.crt, 1);
  assert.equal(ctx.emitente.crtProfile.rulesetId, 'crt-1-simples');
});

test('20. CRT4 não tratado como CRT1', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({ issuer: { crt: 4, uf: 'RJ' } }));
  assert.equal(ctx.emitente.crt, 4);
  assert.equal(ctx.emitente.crtProfile.rulesetId, CRT_MEI_PROFILE.rulesetId);
  assert.notEqual(ctx.emitente.crtProfile.rulesetId, 'crt-1-simples');
});

test('21. supplierCest preservado', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    fiscalItemAllocation: allocationRow({ supplier_cest: '1234567' }),
  }));
  assert.equal(ctx.produto.supplierCest, '1234567');
  assert.equal(ctx.auditRefs.facts.supplierCest.value, '1234567');
});

test('22. CEST não gera ST automaticamente', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    fiscalItemAllocation: allocationRow({
      supplier_cest: '1234567',
      prior_st_status: 'NO_ST_EVIDENCE',
    }),
    produto: { ncm: '40111000', cest: '1234567' },
  }));
  assert.equal(ctx.allocation.priorStStatus, 'NO_ST_EVIDENCE');
  assert.notEqual(ctx.allocation.priorStStatus, 'RETAINED');
});

test('23. currentOperationSt não recebe fallback', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput());
  assert.equal(ctx.pendingTaxResolution.currentOperationSt, CURRENT_OPERATION_ST.UNKNOWN);
  assert.notEqual(ctx.pendingTaxResolution.currentOperationSt, CURRENT_OPERATION_ST.NOT_DUE);
  assert.equal(ctx.preResolutionContext.currentOperationSt, null);
  const taxInput = prepareTaxTreatmentInput(ctx);
  assert.equal(taxInput.currentOperationSt, CURRENT_OPERATION_ST.UNKNOWN);
  assert.equal(taxInput.resolved, false);
});

test('24. CFOP ausente', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput());
  assert.equal(ctx.pendingTaxResolution.cfop, null);
  assert.equal(ctx.preResolutionContext.cfop, null);
  assert.ok(!ctx.issues.some((i) => String(i.message).includes('CFOP')));
});

test('25. CSOSN ausente', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput());
  assert.equal(ctx.pendingTaxResolution.csosn, null);
  assert.equal(ctx.preResolutionContext.csosn, null);
});

test('26. Decimal preservado na quantity', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    fiscalItemAllocation: allocationRow({ quantidade: '5.0000000000' }),
  }));
  assert.equal(ctx.allocation.quantity, '5.0000000000');
  assert.equal(ctx.item.quantidade, '5.0000000000');
  assert.equal(ctx.item.quantidadeDecimal.toString(), '5');
});

test('27. cross-tenant rejeitado', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    empresaId: EMP,
    fiscalItemAllocation: allocationRow({ empresa_id: 'outra-empresa' }),
  }));
  assert.equal(ctx.resolutionStatus, 'ERROR');
  assert.ok(ctx.issues.some((i) => i.code === 'CROSS_TENANT_ACCESS'));
});

test('28. technical profile preservado', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    nfeTechnicalProfileOverrides: { layoutVersion: '4.00', modelo: 55 },
  }));
  assert.equal(ctx.engineSchemaVersion, ENGINE_SCHEMA_VERSION);
  assert.equal(ctx.technicalProfile.layoutVersion, '4.00');
  assert.equal(ctx.technicalProfile.modelo, 55);
});

test('29. referenceDate preservada', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({ referenceDate: '2026-03-20' }));
  assert.equal(ctx.operacao.referenceDate, '2026-03-20');
  assert.equal(ctx.dataOperacao, '2026-03-20');
});

test('30. audit/source refs preservados', () => {
  const row = allocationRow({ origem_mercadoria: '0', prior_st_status: 'RETAINED' });
  const ctx = buildFiscalContextFromAllocation(baseInput({ fiscalItemAllocation: row }));
  assert.equal(ctx.auditRefs.allocationId, row.id);
  assert.equal(ctx.auditRefs.facts.origem.source, 'UNKNOWN');
  assert.equal(ctx.auditRefs.facts.priorStStatus.source, 'ACQUISITION_CLASSIFIER');
  assert.equal(ctx.auditRefs.facts.crt.source, 'ISSUER_FISCAL_REGISTRATION');
});

test('31. mesma linha comercial com duas allocations gera dois FiscalContexts distintos', () => {
  const saleItemId = randomUUID();
  const saleId = randomUUID();
  const a1 = allocationRow({
    id: 'alloc-a',
    commercial_sale_item_id: saleItemId,
    commercial_sale_id: saleId,
    quantidade: '5.0000000000',
    origem_mercadoria: '0',
    prior_st_status: 'RETAINED',
  });
  const a2 = allocationRow({
    id: 'alloc-b',
    commercial_sale_item_id: saleItemId,
    commercial_sale_id: saleId,
    quantidade: '3.0000000000',
    origem_mercadoria: '2',
    prior_st_status: 'NO_ST_EVIDENCE',
  });

  const contexts = buildFiscalContextsFromAllocations({
    ...baseInput(),
    commercialSaleId: saleId,
    commercialSaleItemId: saleItemId,
    fiscalItemAllocations: [a1, a2],
  });

  assert.equal(contexts.length, 2);
  assert.notEqual(contexts[0].allocationId, contexts[1].allocationId);
});

test('32. split 5+3 — contextos não mergeiam allocations da Fase 3', () => {
  const a1 = allocationRow({
    quantidade: '5.0000000000',
    origem_mercadoria: '0',
    prior_st_status: 'RETAINED',
  });
  const a2 = allocationRow({
    quantidade: '3.0000000000',
    origem_mercadoria: '2',
    prior_st_status: 'NO_ST_EVIDENCE',
  });

  const [ctxA, ctxB] = buildFiscalContextsFromAllocations({
    ...baseInput(),
    fiscalItemAllocations: [a1, a2],
  });

  assert.equal(toDecimal(ctxA.allocation.quantity).toString(), '5');
  assert.equal(ctxA.allocation.origem, '0');
  assert.equal(ctxA.allocation.priorStStatus, 'RETAINED');

  assert.equal(toDecimal(ctxB.allocation.quantity).toString(), '3');
  assert.equal(ctxB.allocation.origem, '2');
  assert.equal(ctxB.allocation.priorStStatus, 'NO_ST_EVIDENCE');

  assert.equal(ctxA.pendingTaxResolution.cfop, null);
  assert.equal(ctxB.pendingTaxResolution.csosn, null);
});

test('origem A — LOT_CONFIRMED explícito', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    fiscalItemAllocation: allocationRow({
      origem_mercadoria: '0',
      origem_mercadoria_source: 'LOT_CONFIRMED',
    }),
  }));
  assert.equal(ctx.allocation.origemSource, 'LOT_CONFIRMED');
});

test('origem B — PURCHASE_XML_CONFIRMED explícito/evidenciado', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    fiscalItemAllocation: allocationRow({
      origem_mercadoria: '2',
      prior_st_evidence_json: { origemFromPurchaseXml: true },
    }),
  }));
  assert.equal(ctx.allocation.origem, '2');
  assert.equal(ctx.allocation.origemSource, 'PURCHASE_XML_CONFIRMED');
});

test('origem C — MANUAL_FISCAL_CONFIRMATION explícito', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    fiscalItemAllocation: allocationRow({
      origem_mercadoria: '1',
      origem_mercadoria_source: 'MANUAL_FISCAL_CONFIRMATION',
    }),
  }));
  assert.equal(ctx.allocation.origemSource, 'MANUAL_FISCAL_CONFIRMATION');
});

test('origem D — purchase refs sem evidência XML => origem preservada, source UNKNOWN', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    fiscalItemAllocation: allocationRow({
      origem_mercadoria: '0',
      purchase_invoice_id: randomUUID(),
      purchase_item_id: randomUUID(),
      prior_st_evidence_json: { classifier: 'test' },
    }),
  }));
  assert.equal(ctx.allocation.origem, '0');
  assert.equal(ctx.allocation.origemSource, 'UNKNOWN');
  assert.equal(ctx.allocation.origemProvenance, 'unattributed_known_value');
  assert.notEqual(ctx.allocation.origemSource, 'PURCHASE_XML_CONFIRMED');
});

test('origem E — evidências concorrentes respeitam precedência LOT > XML > MANUAL', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    fiscalItemAllocation: allocationRow({
      origem_mercadoria: '0',
      origem_mercadoria_source: 'MANUAL_FISCAL_CONFIRMATION',
      allocation_audit_json: { lotOrigemConfirmed: true, origemFromPurchaseXml: true },
      prior_st_evidence_json: { manualOrigemConfirmed: true },
    }),
  }));
  assert.equal(ctx.allocation.origemSource, 'LOT_CONFIRMED');
});

test('origem F — valor UNKNOWN => source UNKNOWN', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    fiscalItemAllocation: allocationRow({ origem_mercadoria: 'UNKNOWN' }),
  }));
  assert.equal(ctx.allocation.origem, 'UNKNOWN');
  assert.equal(ctx.allocation.origemSource, 'UNKNOWN');
  assert.equal(ctx.allocation.origemProvenance, 'value_unknown');
});

test('origem de XML não é falsamente rotulada como LOT_CONFIRMED', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    fiscalItemAllocation: allocationRow({
      origem_mercadoria: '2',
      prior_st_evidence_json: { origemFromPurchaseXml: true },
    }),
  }));
  assert.equal(ctx.allocation.origem, '2');
  assert.equal(ctx.allocation.origemSource, 'PURCHASE_XML_CONFIRMED');
  assert.notEqual(ctx.allocation.origemSource, 'LOT_CONFIRMED');
});

test('origem manual preserva MANUAL_FISCAL_CONFIRMATION', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    fiscalItemAllocation: allocationRow({
      origem_mercadoria: '1',
      prior_st_evidence_json: { manualOrigemConfirmed: true },
    }),
  }));
  assert.equal(ctx.allocation.origem, '1');
  assert.equal(ctx.allocation.origemSource, 'MANUAL_FISCAL_CONFIRMATION');
});

test('origem LOT_CONFIRMED somente com evidência explícita de lote', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    fiscalItemAllocation: allocationRow({
      origem_mercadoria: '0',
      allocation_audit_json: { lotOrigemConfirmed: true },
    }),
  }));
  assert.equal(ctx.allocation.origemSource, 'LOT_CONFIRMED');
});

test('origem conhecida sem proveniência comprovável → source UNKNOWN', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    fiscalItemAllocation: allocationRow({
      origem_mercadoria: '3',
      purchase_invoice_id: null,
      purchase_item_id: null,
    }),
  }));
  assert.equal(ctx.allocation.origem, '3');
  assert.equal(ctx.allocation.origemSource, 'UNKNOWN');
  assert.equal(ctx.allocation.origemProvenance, 'unattributed_known_value');
});

test('origem source arbitrária não é aceita como proveniência confiável', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    fiscalItemAllocation: allocationRow({
      origem_mercadoria: '0',
      origem_mercadoria_source: 'INVENTED_SOURCE',
    }),
  }));
  assert.equal(ctx.allocation.origem, '0');
  assert.equal(ctx.allocation.origemSource, 'UNKNOWN');
});

test('destinationUf A — ausente + recipient.uf presente usa fallback', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    issuer: { crt: 1, uf: 'RJ' },
    recipient: { uf: 'SP', icmsTaxpayerStatus: 'NON_TAXPAYER', cpfCnpj: '12345678901' },
    operation: { tipo: 'VENDA' },
  }));
  assert.equal(ctx.operacao.destinationUf, 'SP');
  assert.equal(ctx.operacao.destinationUfSource, 'RECIPIENT_FALLBACK');
  assert.equal(ctx.operacao.localizacao, 'INTERESTADUAL');
});

test('destinationUf B — explícita igual a recipient.uf', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    issuer: { crt: 1, uf: 'RJ' },
    recipient: { uf: 'SP', icmsTaxpayerStatus: 'NON_TAXPAYER', cpfCnpj: '12345678901' },
    operation: { tipo: 'VENDA', destinationUf: 'SP' },
  }));
  assert.equal(ctx.operacao.destinationUf, 'SP');
  assert.equal(ctx.operacao.destinationUfSource, 'OPERATION_INPUT');
  assert.equal(ctx.operacao.localizacao, 'INTERESTADUAL');
});

test('destinationUf C — explícita diferente de recipient.uf gera RULE_CONFLICT', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    issuer: { crt: 1, uf: 'RJ' },
    recipient: { uf: 'RJ', icmsTaxpayerStatus: 'NON_TAXPAYER', cpfCnpj: '12345678901' },
    operation: { tipo: 'VENDA', destinationUf: 'SP' },
  }));
  assert.equal(ctx.operacao.destinationUf, null);
  assert.equal(ctx.operacao.localizacao, 'UNKNOWN');
  assert.ok(ctx.issues.some((i) => i.code === 'RULE_CONFLICT'));
  assert.equal(ctx.resolutionStatus, 'ERROR');
});

test('destinationUf D — issuer RJ + destination SP => INTERESTADUAL', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    issuer: { crt: 1, uf: 'RJ' },
    recipient: { uf: 'SP', icmsTaxpayerStatus: 'NON_TAXPAYER', cpfCnpj: '12345678901' },
    operation: { tipo: 'VENDA', destinationUf: 'SP' },
  }));
  assert.equal(ctx.operacao.localizacao, 'INTERESTADUAL');
  assert.equal(ctx.auditRefs.facts.location.canonicalDestinationUf, 'SP');
});

test('destinationUf E — issuer RJ + destination RJ => INTERNA', () => {
  const ctx = buildFiscalContextFromAllocation(baseInput({
    issuer: { crt: 1, uf: 'RJ' },
    recipient: { uf: 'RJ', icmsTaxpayerStatus: 'NON_TAXPAYER', cpfCnpj: '12345678901' },
    operation: { tipo: 'VENDA', destinationUf: 'RJ' },
  }));
  assert.equal(ctx.operacao.localizacao, 'INTERNA');
  assert.equal(ctx.auditRefs.facts.location.destinationUfSource, 'OPERATION_INPUT');
});
