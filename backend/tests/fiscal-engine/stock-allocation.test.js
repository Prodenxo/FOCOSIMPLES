import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  allocateFiscalStockForSaleItem,
  releaseFiscalStockAllocation,
  consumeFiscalStockAllocation,
  __setStockAllocationRepoForTests,
  __resetStockAllocationRepoForTests,
  memoryAllocationRepo,
} from '../../src/fiscal-engine/allocation/stock-allocation.service.js';
import {
  __bindStockAllocationLotsMap,
  __resetStockAllocationMemoryRepo,
  findAllocationRequestByKey,
} from '../../src/fiscal-engine/allocation/stock-allocation-memory.repository.js';
import {
  __resetFiscalPurchaseMemoryRepo,
  __getLotsByIdMapForTests,
} from '../../src/fiscal-engine/acquisition/fiscal-purchase-memory.repository.js';
import {
  planFifoAllocation,
  evaluateLotEligibility,
  sortLotsFifo,
} from '../../src/fiscal-engine/allocation/stock-allocation-eligibility.js';
import { buildUsableStockLot } from './fixtures/stock-lot-builder.js';
import { toDecimal, formatDecimal, sumDecimals } from '../../src/fiscal-engine/money/decimal.js';
import { isFiscalEngineV3Enabled } from '../../src/fiscal-engine/feature-flag.js';
import { ALLOCATION_STATUS } from '../../src/fiscal-engine/allocation/allocation-constants.js';
import { ST_ALLOCATION_METHOD } from '../../src/fiscal-engine/types/st-allocation.js';
import {
  buildAllocationRequestFingerprint,
  resolveBoundaryAllocationQuantity,
} from '../../src/fiscal-engine/allocation/allocation-idempotency.js';
import { sumActiveStField } from '../../src/fiscal-engine/allocation/st-allocation-lot-state.js';

const EMP = 'empresa-alloc-a';
const PROD = 'produto-catalogo-001';

const seedLots = (lots) => {
  const map = __getLotsByIdMapForTests();
  for (const lot of lots) {
    map.set(lot.id, lot);
  }
};

const saleItem = (overrides = {}) => ({
  empresaId: EMP,
  produtoCatalogoId: PROD,
  quantidade: '8.0000000000',
  allocationRequestId: `req-${randomUUID()}`,
  commercialSaleId: randomUUID(),
  commercialSaleItemId: randomUUID(),
  ...overrides,
});

test.beforeEach(() => {
  __resetFiscalPurchaseMemoryRepo();
  __resetStockAllocationMemoryRepo();
  __setStockAllocationRepoForTests(memoryAllocationRepo);
  __bindStockAllocationLotsMap(__getLotsByIdMapForTests());
});

test('FISCAL_ENGINE_V3 permanece false por padrão', () => {
  assert.equal(isFiscalEngineV3Enabled(), false);
});

test('FIFO — um único lote suficiente', async () => {
  const lot = buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '10.0000000000' });
  seedLots([lot]);
  const result = await allocateFiscalStockForSaleItem(saleItem({ quantidade: '5.0000000000' }));
  assert.equal(result.ok, true);
  assert.equal(result.allocations.length, 1);
  assert.equal(result.allocations[0].stock_lot_id, lot.id);
});

test('FIFO — primeiro lote exatamente igual à quantidade', async () => {
  const lot = buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '8.0000000000', dataEntrada: '2026-01-01' });
  seedLots([lot]);
  const result = await allocateFiscalStockForSaleItem(saleItem({ quantidade: '8.0000000000' }));
  assert.equal(result.ok, true);
  assert.equal(result.allocations.length, 1);
  assert.equal(toDecimal(__getLotsByIdMapForTests().get(lot.id).quantidade_disponivel).isZero(), true);
});

test('FIFO — múltiplos lotes 5+3=8', async () => {
  const lotA = buildUsableStockLot({
    id: 'lot-a-fifo',
    empresaId: EMP,
    produtoCatalogoId: PROD,
    quantidade: '5.0000000000',
    dataEntrada: '2026-01-01',
    origem: '0',
    priorStStatus: 'RETAINED',
    stRetainedValues: { vBCSTRet: '100.00', vICMSSTRet: '18.00' },
  });
  const lotB = buildUsableStockLot({
    id: 'lot-b-fifo',
    empresaId: EMP,
    produtoCatalogoId: PROD,
    quantidade: '10.0000000000',
    dataEntrada: '2026-01-02',
    origem: '2',
    priorStStatus: 'NO_ST_EVIDENCE',
  });
  seedLots([lotB, lotA]);

  const result = await allocateFiscalStockForSaleItem(saleItem({ quantidade: '8.0000000000' }));
  assert.equal(result.ok, true);
  assert.equal(result.allocations.length, 2);
  assert.equal(result.allocations[0].stock_lot_id, lotA.id);
  assert.equal(result.allocations[0].quantidade, '5.0000000000');
  assert.equal(result.allocations[1].stock_lot_id, lotB.id);
  assert.equal(result.allocations[1].quantidade, '3.0000000000');
  assert.notEqual(result.allocations[0].prior_st_status, result.allocations[1].prior_st_status);
});

test('FIFO — ordem por data_entrada e desempate id', () => {
  const lots = sortLotsFifo([
    buildUsableStockLot({ id: 'b', dataEntrada: '2026-01-02' }),
    buildUsableStockLot({ id: 'a', dataEntrada: '2026-01-01' }),
    buildUsableStockLot({ id: 'c', dataEntrada: '2026-01-01' }),
  ]);
  assert.deepEqual(lots.map((l) => l.id), ['a', 'c', 'b']);
});

test('lote BLOCKED ignorado', async () => {
  seedLots([
    buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '3.0000000000', status: 'BLOCKED' }),
    buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '5.0000000000' }),
  ]);
  const result = await allocateFiscalStockForSaleItem(saleItem({ quantidade: '5.0000000000' }));
  assert.equal(result.ok, true);
  assert.equal(result.allocations.length, 1);
});

test('lote NEEDS_REVIEW ignorado — saldo utilizável menor', async () => {
  seedLots([
    buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '3.0000000000', status: 'NEEDS_REVIEW' }),
    buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '5.0000000000' }),
  ]);
  const result = await allocateFiscalStockForSaleItem(saleItem({ quantidade: '8.0000000000' }));
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === 'INSUFFICIENT_USABLE_FISCAL_STOCK'));
});

test('lote sem unidade confirmada ignorado', () => {
  const lot = buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, unitConfirmed: false });
  const evalResult = evaluateLotEligibility(lot, { empresaId: EMP, produtoCatalogoId: PROD });
  assert.equal(evalResult.eligible, false);
});

test('estoque insuficiente — rollback sem allocation parcial', async () => {
  seedLots([
    buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '3.0000000000' }),
    buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '2.0000000000', dataEntrada: '2026-01-02' }),
  ]);
  const req = saleItem({ quantidade: '6.0000000000' });
  const result = await allocateFiscalStockForSaleItem(req);
  assert.equal(result.ok, false);
  const lots = [...__getLotsByIdMapForTests().values()];
  assert.equal(toDecimal(lots[0].quantidade_disponivel).toString(), '3');
  assert.equal(toDecimal(lots[1].quantidade_disponivel).toString(), '2');
});

test('Decimal — soma exata das allocations', async () => {
  seedLots([
    buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '2.5000000000' }),
    buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '3.7500000000', dataEntrada: '2026-01-02' }),
  ]);
  const qty = '4.2500000000';
  const result = await allocateFiscalStockForSaleItem(saleItem({ quantidade: qty }));
  assert.equal(result.ok, true);
  const sum = result.allocations.reduce((acc, a) => acc.plus(toDecimal(a.quantidade)), toDecimal(0));
  assert.equal(formatDecimal(sum, 10), qty);
});

test('ST retained parcial — rateio proporcional', async () => {
  const lot = buildUsableStockLot({
    empresaId: EMP,
    produtoCatalogoId: PROD,
    quantidade: '10.0000000000',
    priorStStatus: 'RETAINED',
    stRetainedValues: { vBCSTRet: '100.00', vICMSSTRet: '18.00', allocationMethod: ST_ALLOCATION_METHOD.PROPORTIONAL_QTY },
  });
  seedLots([lot]);
  const r1 = await allocateFiscalStockForSaleItem(saleItem({ quantidade: '4.0000000000', allocationRequestId: 'st-partial-1' }));
  assert.equal(r1.ok, true);
  assert.ok(r1.allocations[0].st_allocation_json.allocatedValues.vBCSTRet);

  const r2 = await allocateFiscalStockForSaleItem(saleItem({ quantidade: '3.0000000000', allocationRequestId: 'st-partial-2' }));
  assert.equal(r2.ok, true);
  assert.equal(toDecimal(__getLotsByIdMapForTests().get(lot.id).quantidade_disponivel).toString(), '3');
});

test('ST retained sequencial 4+3+3 — total ativo exatamente 100', async () => {
  const lot = buildUsableStockLot({
    empresaId: EMP,
    produtoCatalogoId: PROD,
    quantidade: '10.0000000000',
    priorStStatus: 'RETAINED',
    stRetainedValues: {
      vBCSTRet: '100.00',
      vICMSSTRet: '18.00',
      allocationMethod: ST_ALLOCATION_METHOD.PROPORTIONAL_QTY,
    },
  });
  seedLots([lot]);

  const rA = await allocateFiscalStockForSaleItem(saleItem({ quantidade: '4.0000000000', allocationRequestId: 'st-seq-a' }));
  const rB = await allocateFiscalStockForSaleItem(saleItem({ quantidade: '3.0000000000', allocationRequestId: 'st-seq-b' }));
  const rC = await allocateFiscalStockForSaleItem(saleItem({ quantidade: '3.0000000000', allocationRequestId: 'st-seq-c' }));

  assert.equal(rA.allocations[0].st_allocation_json.allocatedValues.vBCSTRet, '40.00');
  assert.equal(rB.allocations[0].st_allocation_json.allocatedValues.vBCSTRet, '30.00');
  assert.equal(rC.allocations[0].st_allocation_json.allocatedValues.vBCSTRet, '30.00');

  const stSum = sumDecimals([rA, rB, rC].map((r) => r.allocations[0].st_allocation_json.allocatedValues.vBCSTRet));
  assert.equal(formatDecimal(stSum, 2), '100.00');
});

test('ST retained sequencial — arredondamento DecimalFieldPolicy', async () => {
  const lot = buildUsableStockLot({
    empresaId: EMP,
    produtoCatalogoId: PROD,
    quantidade: '7.0000000000',
    priorStStatus: 'RETAINED',
    stRetainedValues: {
      vBCSTRet: '100.00',
      allocationMethod: ST_ALLOCATION_METHOD.PROPORTIONAL_QTY,
    },
  });
  seedLots([lot]);

  const qtys = ['2.0000000000', '2.0000000000', '3.0000000000'];
  const expected = ['28.57', '28.57', '42.86'];
  const parts = [];
  for (let i = 0; i < qtys.length; i += 1) {
    const r = await allocateFiscalStockForSaleItem(saleItem({
      quantidade: qtys[i],
      allocationRequestId: `st-round-${i}`,
    }));
    parts.push(r.allocations[0].st_allocation_json.allocatedValues.vBCSTRet);
  }

  assert.deepEqual(parts, expected);
  assert.equal(formatDecimal(sumDecimals(parts), 2), '100.00');
});

test('ST retained sem estratégia — ST_ALLOCATION_STRATEGY_MISSING, sem rateio inventado', async () => {
  const lot = buildUsableStockLot({
    empresaId: EMP,
    produtoCatalogoId: PROD,
    quantidade: '10.0000000000',
    priorStStatus: 'RETAINED',
    stRetainedValues: { vBCSTRet: '100.00', vICMSSTRet: '18.00' },
  });
  seedLots([lot]);
  const result = await allocateFiscalStockForSaleItem(saleItem({ quantidade: '4.0000000000' }));
  assert.equal(result.ok, true);
  const st = result.allocations[0].st_allocation_json;
  assert.ok(st.issues.some((i) => i.code === 'ST_ALLOCATION_STRATEGY_MISSING'));
  assert.equal(st.allocatedValues?.vBCSTRet, undefined);
  assert.equal(result.allocations[0].allocation_method, null);
});

test('idempotência — retry não consome duas vezes', async () => {
  seedLots([buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '10.0000000000' })]);
  const item = saleItem({ quantidade: '4.0000000000', allocationRequestId: 'idem-abc' });
  const r1 = await allocateFiscalStockForSaleItem(item);
  const r2 = await allocateFiscalStockForSaleItem(item);
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(r2.idempotentReplay, true);
  assert.equal(r1.allocations[0].id, r2.allocations[0].id);
  assert.equal(toDecimal([...__getLotsByIdMapForTests().values()][0].quantidade_disponivel).toString(), '6');
});

test('idempotência — fingerprint canônico normaliza 5 / 5.0 / 5.000', () => {
  const fp1 = buildAllocationRequestFingerprint({ produtoCatalogoId: PROD, quantidade: '5' });
  const fp2 = buildAllocationRequestFingerprint({ produtoCatalogoId: PROD, quantidade: '5.0' });
  const fp3 = buildAllocationRequestFingerprint({ produtoCatalogoId: PROD, quantidade: '5.000' });
  assert.equal(fp1.quantidadeSolicitada, '5.0000');
  assert.deepEqual(fp1, fp2);
  assert.deepEqual(fp2, fp3);
});

test('idempotência — quantidade acima de qCom é rejeitada no boundary', async () => {
  seedLots([buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '10.0000000000' })]);
  const result = await allocateFiscalStockForSaleItem(saleItem({
    quantidade: '1.00001',
    allocationRequestId: 'prec-invalid',
  }));
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === 'ALLOCATION_QUANTITY_PRECISION_INVALID'));
  assert.equal(toDecimal([...__getLotsByIdMapForTests().values()][0].quantidade_disponivel).toString(), '10');
});

test('idempotência — 1.00001 e 1.00002 não colidem (primeiro rejeitado, segundo distinto)', () => {
  const r1 = resolveBoundaryAllocationQuantity('1.00001');
  const r2 = resolveBoundaryAllocationQuantity('1.00002');
  assert.equal(r1.ok, false);
  assert.equal(r2.ok, false);
  const fp1 = buildAllocationRequestFingerprint({ produtoCatalogoId: PROD, quantidade: '1.0001' });
  const fp2 = buildAllocationRequestFingerprint({ produtoCatalogoId: PROD, quantidade: '1.0002' });
  assert.notEqual(fp1.quantidadeSolicitada, fp2.quantidadeSolicitada);
});

test('idempotência — 1.0001 vs 1.0002 mesma chave => CONFLICT após reserva válida', async () => {
  seedLots([buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '10.0000000000' })]);
  const key = 'prec-distinct-key';
  const base = saleItem({ quantidade: '1.0001', allocationRequestId: key });
  const r1 = await allocateFiscalStockForSaleItem(base);
  const r2 = await allocateFiscalStockForSaleItem({ ...base, quantidade: '1.0002' });
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, false);
  assert.ok(r2.issues.some((i) => i.code === 'ALLOCATION_IDEMPOTENCY_CONFLICT'));
  assert.equal(r1.allocations[0].quantidade, '1.0001000000');
});

test('idempotência — quantidades equivalentes replay sem nova reserva', async () => {
  seedLots([buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '10.0000000000' })]);
  const key = 'idem-equiv-qty';
  const base = saleItem({ quantidade: '5', allocationRequestId: key });
  const r1 = await allocateFiscalStockForSaleItem(base);
  const r2 = await allocateFiscalStockForSaleItem({ ...base, quantidade: '5.0' });
  const r3 = await allocateFiscalStockForSaleItem({ ...base, quantidade: '5.000' });
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(r3.ok, true);
  assert.equal(r2.idempotentReplay, true);
  assert.equal(r3.idempotentReplay, true);
  assert.equal(r1.allocations[0].id, r3.allocations[0].id);
  assert.equal(toDecimal([...__getLotsByIdMapForTests().values()][0].quantidade_disponivel).toString(), '5');
});

test('idempotência — concorrência mesma allocationRequestId, uma reserva efetiva', async () => {
  seedLots([buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '10.0000000000' })]);
  const key = 'idem-concurrent';
  const item = saleItem({ quantidade: '4.0000000000', allocationRequestId: key });
  const [r1, r2] = await Promise.all([
    allocateFiscalStockForSaleItem(item),
    allocateFiscalStockForSaleItem(item),
  ]);
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  const replays = [r1, r2].filter((r) => r.idempotentReplay).length;
  assert.equal(replays, 1);
  assert.equal(r1.allocations[0].id, r2.allocations[0].id);
  assert.equal(toDecimal([...__getLotsByIdMapForTests().values()][0].quantidade_disponivel).toString(), '6');
  const loaded = await findAllocationRequestByKey(EMP, key);
  assert.equal(loaded.allocations.length, 1);
});

test('idempotência — mesma chave com quantidade diferente => CONFLICT', async () => {
  seedLots([buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '10.0000000000' })]);
  const key = 'idem-conflict-qty';
  const r1 = await allocateFiscalStockForSaleItem(saleItem({ quantidade: '5.0000000000', allocationRequestId: key }));
  const r2 = await allocateFiscalStockForSaleItem(saleItem({ quantidade: '8.0000000000', allocationRequestId: key }));
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, false);
  assert.ok(r2.issues.some((i) => i.code === 'ALLOCATION_IDEMPOTENCY_CONFLICT'));
  assert.equal(r2.allocations[0].quantidade, '5.0000000000');
  assert.equal(toDecimal([...__getLotsByIdMapForTests().values()][0].quantidade_disponivel).toString(), '5');
});

test('idempotência — mesma chave com produto diferente => CONFLICT', async () => {
  const prodY = 'produto-catalogo-y';
  seedLots([
    buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '10.0000000000' }),
    buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: prodY, quantidade: '10.0000000000', id: 'lot-prod-y' }),
  ]);
  const key = 'idem-conflict-prod';
  const r1 = await allocateFiscalStockForSaleItem(saleItem({ quantidade: '5.0000000000', allocationRequestId: key, produtoCatalogoId: PROD }));
  const r2 = await allocateFiscalStockForSaleItem(saleItem({ quantidade: '5.0000000000', allocationRequestId: key, produtoCatalogoId: prodY }));
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, false);
  assert.ok(r2.issues.some((i) => i.code === 'ALLOCATION_IDEMPOTENCY_CONFLICT'));
  assert.equal(r2.allocations[0].produto_catalogo_id, PROD);
});

test('idempotência — mesma chave com commercialSaleId diferente => CONFLICT', async () => {
  seedLots([buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '10.0000000000' })]);
  const key = 'idem-conflict-sale';
  const r1 = await allocateFiscalStockForSaleItem(saleItem({
    quantidade: '5.0000000000',
    allocationRequestId: key,
    commercialSaleId: 'venda-100',
    commercialSaleItemId: 'item-a',
  }));
  const r2 = await allocateFiscalStockForSaleItem(saleItem({
    quantidade: '5.0000000000',
    allocationRequestId: key,
    commercialSaleId: 'venda-200',
    commercialSaleItemId: 'item-b',
  }));
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, false);
  assert.ok(r2.issues.some((i) => i.code === 'ALLOCATION_IDEMPOTENCY_CONFLICT'));
});

test('ST fechamento acumulado — 6×1 UN / ST 100 fecha exatamente 100.00', async () => {
  const lot = buildUsableStockLot({
    empresaId: EMP,
    produtoCatalogoId: PROD,
    quantidade: '6.0000000000',
    priorStStatus: 'RETAINED',
    stRetainedValues: {
      vBCSTRet: '100.00',
      allocationMethod: ST_ALLOCATION_METHOD.PROPORTIONAL_QTY,
    },
  });
  seedLots([lot]);

  /** @type {object[]} */
  const activeAllocs = [];
  const parts = [];
  for (let i = 0; i < 6; i += 1) {
    const r = await allocateFiscalStockForSaleItem(saleItem({
      quantidade: '1.0000000000',
      allocationRequestId: `st-close-6-${i}`,
    }));
    assert.equal(r.ok, true);
    activeAllocs.push(r.allocations[0]);
    parts.push(r.allocations[0].st_allocation_json.allocatedValues.vBCSTRet);
    const running = sumActiveStField(activeAllocs, 'vBCSTRet');
    assert.equal(running.lte(toDecimal('100.00')), true, `acumulado ${running} excedeu 100.00 na iteração ${i}`);
  }

  assert.equal(formatDecimal(sumDecimals(parts), 2), '100.00');
  assert.equal(formatDecimal(sumActiveStField(activeAllocs, 'vBCSTRet'), 2), '100.00');
  assert.notEqual(formatDecimal(sumDecimals(parts), 2), '100.02');
});

test('ST fechamento acumulado — 7×1 UN / ST 1.00 com resíduo determinístico', async () => {
  const lot = buildUsableStockLot({
    empresaId: EMP,
    produtoCatalogoId: PROD,
    quantidade: '7.0000000000',
    priorStStatus: 'RETAINED',
    stRetainedValues: {
      vBCSTRet: '1.00',
      allocationMethod: ST_ALLOCATION_METHOD.PROPORTIONAL_QTY,
    },
  });
  seedLots([lot]);

  /** @type {object[]} */
  const activeAllocs = [];
  for (let i = 0; i < 7; i += 1) {
    const r = await allocateFiscalStockForSaleItem(saleItem({
      quantidade: '1.0000000000',
      allocationRequestId: `st-close-7-${i}`,
    }));
    activeAllocs.push(r.allocations[0]);
    const running = sumActiveStField(activeAllocs, 'vBCSTRet');
    assert.equal(running.lte(toDecimal('1.00')), true);
  }
  assert.equal(formatDecimal(sumActiveStField(activeAllocs, 'vBCSTRet'), 2), '1.00');
});

test('double release — segunda liberação não credita saldo novamente', async () => {
  const lot = buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '10.0000000000' });
  seedLots([lot]);
  await allocateFiscalStockForSaleItem(saleItem({ quantidade: '4.0000000000', allocationRequestId: 'dbl-rel' }));
  assert.equal(toDecimal(__getLotsByIdMapForTests().get(lot.id).quantidade_disponivel).toString(), '6');

  const rel1 = await releaseFiscalStockAllocation(EMP, 'dbl-rel');
  assert.equal(rel1.ok, true);
  assert.equal(rel1.released, 1);
  assert.equal(toDecimal(__getLotsByIdMapForTests().get(lot.id).quantidade_disponivel).toString(), '10');

  const rel2 = await releaseFiscalStockAllocation(EMP, 'dbl-rel');
  assert.equal(rel2.ok, true);
  assert.equal(rel2.released, 0);
  assert.equal(toDecimal(__getLotsByIdMapForTests().get(lot.id).quantidade_disponivel).toString(), '10');
});

test('double consume — segunda consumação não altera status nem saldo', async () => {
  const lot = buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '10.0000000000' });
  seedLots([lot]);
  await allocateFiscalStockForSaleItem(saleItem({ quantidade: '4.0000000000', allocationRequestId: 'dbl-cons' }));

  const c1 = await consumeFiscalStockAllocation(EMP, 'dbl-cons');
  assert.equal(c1.ok, true);
  assert.equal(c1.allocations[0].status, ALLOCATION_STATUS.CONSUMED);
  assert.equal(toDecimal(__getLotsByIdMapForTests().get(lot.id).quantidade_disponivel).toString(), '6');

  const c2 = await consumeFiscalStockAllocation(EMP, 'dbl-cons');
  assert.equal(c2.ok, false);
  const loaded = await findAllocationRequestByKey(EMP, 'dbl-cons');
  assert.equal(loaded.allocations[0].status, ALLOCATION_STATUS.CONSUMED);
  assert.equal(toDecimal(__getLotsByIdMapForTests().get(lot.id).quantidade_disponivel).toString(), '6');
});

test('lifecycle — RELEASED não pode ser consumida', async () => {
  seedLots([buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '10.0000000000' })]);
  await allocateFiscalStockForSaleItem(saleItem({ quantidade: '4.0000000000', allocationRequestId: 'rel-cons' }));
  await releaseFiscalStockAllocation(EMP, 'rel-cons');

  const consumed = await consumeFiscalStockAllocation(EMP, 'rel-cons');
  assert.equal(consumed.ok, false);
  const loaded = await findAllocationRequestByKey(EMP, 'rel-cons');
  assert.equal(loaded.allocations[0].status, ALLOCATION_STATUS.RELEASED);
});

test('lifecycle — CONSUMED não pode ser liberada', async () => {
  seedLots([buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '10.0000000000' })]);
  await allocateFiscalStockForSaleItem(saleItem({ quantidade: '4.0000000000', allocationRequestId: 'cons-rel' }));
  await consumeFiscalStockAllocation(EMP, 'cons-rel');

  const released = await releaseFiscalStockAllocation(EMP, 'cons-rel');
  assert.equal(released.ok, false);
  const loaded = await findAllocationRequestByKey(EMP, 'cons-rel');
  assert.equal(loaded.allocations[0].status, ALLOCATION_STATUS.CONSUMED);
  assert.equal(toDecimal(__getLotsByIdMapForTests().values().next().value.quantidade_disponivel).toString(), '6');
});

test('release restaura saldo reservado', async () => {
  const lot = buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '10.0000000000' });
  seedLots([lot]);
  const item = saleItem({ quantidade: '4.0000000000', allocationRequestId: 'rel-001' });
  await allocateFiscalStockForSaleItem(item);
  assert.equal(toDecimal(__getLotsByIdMapForTests().get(lot.id).quantidade_disponivel).toString(), '6');
  const released = await releaseFiscalStockAllocation(EMP, 'rel-001');
  assert.equal(released.ok, true);
  assert.equal(toDecimal(__getLotsByIdMapForTests().get(lot.id).quantidade_disponivel).toString(), '10');
});

test('release + nova reserva — saldo, ST ativo e histórico RELEASED', async () => {
  const lot = buildUsableStockLot({
    empresaId: EMP,
    produtoCatalogoId: PROD,
    quantidade: '10.0000000000',
    priorStStatus: 'RETAINED',
    stRetainedValues: {
      vBCSTRet: '100.00',
      allocationMethod: ST_ALLOCATION_METHOD.PROPORTIONAL_QTY,
    },
  });
  seedLots([lot]);

  await allocateFiscalStockForSaleItem(saleItem({ quantidade: '4.0000000000', allocationRequestId: 'reres-1' }));
  assert.equal(toDecimal(__getLotsByIdMapForTests().get(lot.id).quantidade_disponivel).toString(), '6');

  await releaseFiscalStockAllocation(EMP, 'reres-1');
  assert.equal(toDecimal(__getLotsByIdMapForTests().get(lot.id).quantidade_disponivel).toString(), '10');

  const r2 = await allocateFiscalStockForSaleItem(saleItem({ quantidade: '4.0000000000', allocationRequestId: 'reres-2' }));
  assert.equal(r2.ok, true);
  assert.equal(toDecimal(__getLotsByIdMapForTests().get(lot.id).quantidade_disponivel).toString(), '6');
  assert.equal(r2.allocations[0].st_allocation_json.allocatedValues.vBCSTRet, '40.00');

  const req1 = await findAllocationRequestByKey(EMP, 'reres-1');
  const req2 = await findAllocationRequestByKey(EMP, 'reres-2');
  assert.equal(req1.allocations.filter((a) => a.status === ALLOCATION_STATUS.RESERVED).length, 0);
  assert.equal(req1.allocations[0].status, ALLOCATION_STATUS.RELEASED);
  assert.equal(req2.allocations.filter((a) => a.status === ALLOCATION_STATUS.RESERVED).length, 1);

  const activeSt = sumDecimals(
    req2.allocations
      .filter((a) => a.status === ALLOCATION_STATUS.RESERVED || a.status === ALLOCATION_STATUS.CONSUMED)
      .map((a) => a.st_allocation_json?.allocatedValues?.vBCSTRet ?? '0'),
  );
  assert.equal(formatDecimal(activeSt, 2), '40.00');
});

test('consume marca allocation CONSUMED sem alterar saldo novamente', async () => {
  seedLots([buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD, quantidade: '10.0000000000' })]);
  const item = saleItem({ quantidade: '4.0000000000', allocationRequestId: 'cons-001' });
  await allocateFiscalStockForSaleItem(item);
  const consumed = await consumeFiscalStockAllocation(EMP, 'cons-001');
  assert.equal(consumed.ok, true);
  assert.equal(consumed.allocations[0].status, ALLOCATION_STATUS.CONSUMED);
  assert.equal(toDecimal(__getLotsByIdMapForTests().values().next().value.quantidade_disponivel).toString(), '6');
});

test('preResolutionContext não contém cfop/csosn resolvidos', async () => {
  seedLots([buildUsableStockLot({ empresaId: EMP, produtoCatalogoId: PROD })]);
  const result = await allocateFiscalStockForSaleItem(saleItem({ quantidade: '1.0000000000' }));
  assert.equal(result.preResolutionContexts[0].cfop, null);
  assert.equal(result.preResolutionContexts[0].csosn, null);
  assert.equal(result.preResolutionContexts[0].resolved, false);
});

test('planFifoAllocation — lotes equivalentes permanecem separados na persistência', async () => {
  const lot1 = buildUsableStockLot({ id: 'same-facts-1', empresaId: EMP, produtoCatalogoId: PROD, quantidade: '4.0000000000', dataEntrada: '2026-01-01' });
  const lot2 = buildUsableStockLot({ id: 'same-facts-2', empresaId: EMP, produtoCatalogoId: PROD, quantidade: '4.0000000000', dataEntrada: '2026-01-02' });
  seedLots([lot1, lot2]);
  const result = await allocateFiscalStockForSaleItem(saleItem({ quantidade: '6.0000000000' }));
  assert.equal(result.allocations.length, 2);
  assert.notEqual(result.allocations[0].stock_lot_id, result.allocations[1].stock_lot_id);
});
