import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  allocateFiscalStockForSaleItem,
  releaseFiscalStockAllocation,
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
import { buildUsableStockLot } from './fixtures/stock-lot-builder.js';

const EMP_A = 'empresa-cross-a';
const EMP_B = 'empresa-cross-b';
const PROD_A = 'produto-a';
const PROD_B = 'produto-b';

test.beforeEach(() => {
  __resetFiscalPurchaseMemoryRepo();
  __resetStockAllocationMemoryRepo();
  __setStockAllocationRepoForTests(memoryAllocationRepo);
  __bindStockAllocationLotsMap(__getLotsByIdMapForTests());

  const map = __getLotsByIdMapForTests();
  map.set('lot-a', buildUsableStockLot({
    id: 'lot-a',
    empresaId: EMP_A,
    produtoCatalogoId: PROD_A,
    quantidade: '10.0000000000',
  }));
  map.set('lot-b', buildUsableStockLot({
    id: 'lot-b',
    empresaId: EMP_B,
    produtoCatalogoId: PROD_B,
    quantidade: '10.0000000000',
  }));
});

test('cross-tenant — B não aloca lote de A', async () => {
  const result = await allocateFiscalStockForSaleItem({
    empresaId: EMP_B,
    produtoCatalogoId: PROD_A,
    quantidade: '5.0000000000',
    allocationRequestId: 'cross-1',
  });
  assert.equal(result.ok, false);
});

test('cross-tenant — B não consulta allocation de A', async () => {
  await allocateFiscalStockForSaleItem({
    empresaId: EMP_A,
    produtoCatalogoId: PROD_A,
    quantidade: '3.0000000000',
    allocationRequestId: 'cross-req-a',
  });
  const cross = await findAllocationRequestByKey(EMP_B, 'cross-req-a');
  assert.equal(cross, null);
});

test('cross-tenant — allocationRequestId de A não interfere em B', async () => {
  const sharedKey = 'shared-idempotency-key';
  const rA = await allocateFiscalStockForSaleItem({
    empresaId: EMP_A,
    produtoCatalogoId: PROD_A,
    quantidade: '2.0000000000',
    allocationRequestId: sharedKey,
  });
  const rB = await allocateFiscalStockForSaleItem({
    empresaId: EMP_B,
    produtoCatalogoId: PROD_B,
    quantidade: '2.0000000000',
    allocationRequestId: sharedKey,
  });
  assert.equal(rA.ok, true);
  assert.equal(rB.ok, true);
  assert.notEqual(rA.allocations[0].stock_lot_id, rB.allocations[0].stock_lot_id);
});

test('cross-tenant — B não libera reserva de A', async () => {
  await allocateFiscalStockForSaleItem({
    empresaId: EMP_A,
    produtoCatalogoId: PROD_A,
    quantidade: '2.0000000000',
    allocationRequestId: 'release-cross',
  });
  const rel = await releaseFiscalStockAllocation(EMP_B, 'release-cross');
  assert.equal(rel.ok, false);
});
