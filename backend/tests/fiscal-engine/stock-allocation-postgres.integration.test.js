/**
 * Integração Postgres — alocação fiscal Fase 3.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { env } from '../../src/config/env.js';
import { ensureFiscalPurchaseSchema, __resetFiscalPurchaseSchemaCacheForTests } from '../../src/fiscal-engine/acquisition/fiscal-purchase.schema.js';
import {
  savePurchaseImport,
  __deletePurchaseImportForTests,
} from '../../src/fiscal-engine/acquisition/fiscal-purchase.repository.js';
import {
  allocateFiscalStockForSaleItem,
  releaseFiscalStockAllocation,
  consumeFiscalStockAllocation,
  __resetStockAllocationRepoForTests,
} from '../../src/fiscal-engine/allocation/stock-allocation.service.js';
import {
  findAllocationRequestByKey,
  __deleteAllocationRequestForTests,
} from '../../src/fiscal-engine/allocation/stock-allocation.repository.js';
import { getPgPool } from '../../src/config/pg.js';
import { toDecimal, formatDecimal } from '../../src/fiscal-engine/money/decimal.js';
import { STOCK_UNIT_RESOLUTION_STATUS, STOCK_UNIT_SOURCE } from '../../src/fiscal-engine/acquisition/stock-unit-resolution.js';
import { ST_ALLOCATION_METHOD } from '../../src/fiscal-engine/types/st-allocation.js';
import { ENGINE_SCHEMA_VERSION } from '../../src/fiscal-engine/constants.js';
import { ALLOCATION_STATUS } from '../../src/fiscal-engine/allocation/allocation-constants.js';

const hasDb = Boolean(String(env.DATABASE_URL || env.SUPABASE_DB_URL || '').trim());

const parseJsonField = (value) => {
  if (value == null) return value;
  if (typeof value === 'object') return value;
  return JSON.parse(value);
};

const seedUsableLot = async (empresaId, produtoId, qty, dataEntrada = '2026-01-15', lotOverrides = {}) => {
  const chave = `33${String(Date.now()).slice(-40).padStart(40, '0')}`.slice(0, 44);
  const invoiceId = randomUUID();
  const itemId = randomUUID();
  await savePurchaseImport({
    invoice: {
      id: invoiceId,
      empresa_id: empresaId,
      chave_nfe: chave,
      inf_nfe_id: `NFe${chave}`,
      modelo: 55,
      xml_sha256: 'a'.repeat(64),
      parser_version: '1.0.0',
      document_status: 'AUTHORIZED',
      authorization_status: 'AUTHORIZED',
      event_status: 'NOT_CHECKED',
      signature_status: 'VALID',
    },
    items: [{
      id: itemId,
      numero_item: 1,
      origem: lotOverrides.origem ?? '0',
      prior_st_status: lotOverrides.priorStStatus ?? 'NO_ST_EVIDENCE',
      catalog_match_status: 'MANUALLY_CONFIRMED',
      produto_catalogo_id: produtoId,
      q_com: qty,
    }],
    lots: [{
      empresa_id: empresaId,
      produto_catalogo_id: produtoId,
      purchase_item_id: itemId,
      origem_mercadoria: lotOverrides.origem ?? '0',
      base_unit: 'UN',
      quantidade_inicial: qty,
      quantidade_disponivel: qty,
      prior_st_status: lotOverrides.priorStStatus ?? 'NO_ST_EVIDENCE',
      prior_st_evidence_json: lotOverrides.priorStEvidence ?? {},
      supplier_cest: lotOverrides.supplierCest ?? null,
      st_retained_values_json: lotOverrides.stRetainedValues ?? {},
      stock_unit_resolution_json: {
        baseUnit: 'UN',
        baseQty: qty,
        source: STOCK_UNIT_SOURCE.CATALOG_CONFIRMED,
        status: STOCK_UNIT_RESOLUTION_STATUS.CONFIRMED,
      },
      data_entrada: dataEntrada,
      status: 'USABLE',
      version: 0,
    }],
  });
  return { chave, invoiceId, itemId };
};

test.before(async () => {
  if (!hasDb) return;
  __resetFiscalPurchaseSchemaCacheForTests();
  await ensureFiscalPurchaseSchema({ force: true });
});

test.afterEach(() => {
  __resetStockAllocationRepoForTests();
});

test('postgres — persistência allocation + idempotência', { skip: !hasDb }, async () => {
  const empresaId = randomUUID();
  const produtoId = randomUUID();
  const { chave } = await seedUsableLot(empresaId, produtoId, '10.0000000000');

  const item = {
    empresaId,
    produtoCatalogoId: produtoId,
    quantidade: '4.0000000000',
    allocationRequestId: `pg-idem-${randomUUID()}`,
  };

  const r1 = await allocateFiscalStockForSaleItem(item);
  const r2 = await allocateFiscalStockForSaleItem(item);
  assert.equal(r1.ok, true);
  assert.equal(r2.idempotentReplay, true);

  const loaded = await findAllocationRequestByKey(empresaId, item.allocationRequestId);
  assert.equal(loaded.allocations.length, 1);

  await __deleteAllocationRequestForTests(empresaId, item.allocationRequestId);
  await __deletePurchaseImportForTests(empresaId, chave);
});

test('postgres — idempotência concorrente mesma allocationRequestId, uma reserva', { skip: !hasDb }, async () => {
  const empresaId = randomUUID();
  const produtoId = randomUUID();
  const { chave } = await seedUsableLot(empresaId, produtoId, '10.0000000000');
  const reqId = `pg-idem-concurrent-${randomUUID()}`;
  const item = {
    empresaId,
    produtoCatalogoId: produtoId,
    quantidade: '4.0000000000',
    allocationRequestId: reqId,
  };

  const [r1, r2] = await Promise.all([
    allocateFiscalStockForSaleItem(item),
    allocateFiscalStockForSaleItem(item),
  ]);

  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal([r1, r2].filter((r) => r.idempotentReplay).length, 1);
  assert.equal(r1.allocations[0].id, r2.allocations[0].id);

  const pool = getPgPool();
  const lot = await pool.query(
    `SELECT quantidade_disponivel FROM fiscal_stock_lots WHERE empresa_id = $1 AND produto_catalogo_id = $2`,
    [empresaId, produtoId],
  );
  assert.equal(toDecimal(lot.rows[0].quantidade_disponivel).toString(), '6');

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM fiscal_stock_allocations WHERE empresa_id = $1`,
    [empresaId],
  );
  assert.equal(countRes.rows[0].total, 1);

  await __deleteAllocationRequestForTests(empresaId, reqId);
  await __deletePurchaseImportForTests(empresaId, chave);
});

test('postgres — estoque insuficiente não persiste allocation', { skip: !hasDb }, async () => {
  const empresaId = randomUUID();
  const produtoId = randomUUID();
  const { chave } = await seedUsableLot(empresaId, produtoId, '3.0000000000');
  const reqId = `pg-fail-${randomUUID()}`;

  const result = await allocateFiscalStockForSaleItem({
    empresaId,
    produtoCatalogoId: produtoId,
    quantidade: '6.0000000000',
    allocationRequestId: reqId,
  });
  assert.equal(result.ok, false);
  const loaded = await findAllocationRequestByKey(empresaId, reqId);
  assert.equal(loaded, null);

  await __deletePurchaseImportForTests(empresaId, chave);
});

test('postgres — concorrência: apenas uma alocação de 7 sobre saldo 10', { skip: !hasDb }, async () => {
  const empresaId = randomUUID();
  const produtoId = randomUUID();
  const { chave } = await seedUsableLot(empresaId, produtoId, '10.0000000000');

  const base = {
    empresaId,
    produtoCatalogoId: produtoId,
    quantidade: '7.0000000000',
  };

  const [r1, r2] = await Promise.all([
    allocateFiscalStockForSaleItem({ ...base, allocationRequestId: `pg-c1-${randomUUID()}` }),
    allocateFiscalStockForSaleItem({ ...base, allocationRequestId: `pg-c2-${randomUUID()}` }),
  ]);

  const successes = [r1, r2].filter((r) => r.ok);
  const failures = [r1, r2].filter((r) => !r.ok);
  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);

  const pool = getPgPool();
  const sumRes = await pool.query(
    `SELECT COALESCE(SUM(a.quantidade), 0) AS total
     FROM fiscal_stock_allocations a
     INNER JOIN fiscal_stock_lots l ON l.id = a.stock_lot_id
     WHERE l.empresa_id = $1 AND l.produto_catalogo_id = $2 AND a.status = 'RESERVED'`,
    [empresaId, produtoId],
  );
  assert.equal(toDecimal(sumRes.rows[0].total).lte(toDecimal('10')), true);

  await pool.query(
    `DELETE FROM fiscal_stock_allocations WHERE empresa_id = $1`,
    [empresaId],
  );
  await pool.query(
    `DELETE FROM fiscal_stock_allocation_requests WHERE empresa_id = $1`,
    [empresaId],
  );
  await __deletePurchaseImportForTests(empresaId, chave);
});

test('postgres — release restaura saldo', { skip: !hasDb }, async () => {
  const empresaId = randomUUID();
  const produtoId = randomUUID();
  const { chave } = await seedUsableLot(empresaId, produtoId, '10.0000000000');
  const reqId = `pg-rel-${randomUUID()}`;

  await allocateFiscalStockForSaleItem({
    empresaId,
    produtoCatalogoId: produtoId,
    quantidade: '4.0000000000',
    allocationRequestId: reqId,
  });

  await releaseFiscalStockAllocation(empresaId, reqId);

  const pool = getPgPool();
  const lot = await pool.query(
    `SELECT quantidade_disponivel FROM fiscal_stock_lots WHERE empresa_id = $1 AND produto_catalogo_id = $2`,
    [empresaId, produtoId],
  );
  assert.equal(toDecimal(lot.rows[0].quantidade_disponivel).toString(), '10');

  await __deleteAllocationRequestForTests(empresaId, reqId);
  await __deletePurchaseImportForTests(empresaId, chave);
});

test('postgres — idempotência mesma chave payload diferente => CONFLICT', { skip: !hasDb }, async () => {
  const empresaId = randomUUID();
  const produtoId = randomUUID();
  const { chave } = await seedUsableLot(empresaId, produtoId, '10.0000000000');
  const reqId = `pg-idem-conflict-${randomUUID()}`;

  const r1 = await allocateFiscalStockForSaleItem({
    empresaId,
    produtoCatalogoId: produtoId,
    quantidade: '5.0000000000',
    allocationRequestId: reqId,
  });
  const r2 = await allocateFiscalStockForSaleItem({
    empresaId,
    produtoCatalogoId: produtoId,
    quantidade: '8.0000000000',
    allocationRequestId: reqId,
  });

  assert.equal(r1.ok, true);
  assert.equal(r2.ok, false);
  assert.ok(r2.issues.some((i) => i.code === 'ALLOCATION_IDEMPOTENCY_CONFLICT'));

  const pool = getPgPool();
  const lot = await pool.query(
    `SELECT quantidade_disponivel FROM fiscal_stock_lots WHERE empresa_id = $1 AND produto_catalogo_id = $2`,
    [empresaId, produtoId],
  );
  assert.equal(toDecimal(lot.rows[0].quantidade_disponivel).toString(), '5');

  await __deleteAllocationRequestForTests(empresaId, reqId);
  await __deletePurchaseImportForTests(empresaId, chave);
});

test('postgres — cross-tenant consume rejeitado', { skip: !hasDb }, async () => {
  const empresaA = randomUUID();
  const empresaB = randomUUID();
  const produtoId = randomUUID();
  const { chave } = await seedUsableLot(empresaA, produtoId, '10.0000000000');
  const reqId = `pg-consume-cross-${randomUUID()}`;

  await allocateFiscalStockForSaleItem({
    empresaId: empresaA,
    produtoCatalogoId: produtoId,
    quantidade: '4.0000000000',
    allocationRequestId: reqId,
  });

  const consumed = await consumeFiscalStockAllocation(empresaB, reqId);
  assert.equal(consumed.ok, false);
  assert.equal(consumed.allocations.length, 0);

  const loaded = await findAllocationRequestByKey(empresaA, reqId);
  assert.equal(loaded.allocations[0].status, ALLOCATION_STATUS.RESERVED);

  const pool = getPgPool();
  const lot = await pool.query(
    `SELECT quantidade_disponivel FROM fiscal_stock_lots WHERE empresa_id = $1 AND produto_catalogo_id = $2`,
    [empresaA, produtoId],
  );
  assert.equal(toDecimal(lot.rows[0].quantidade_disponivel).toString(), '6');

  await __deleteAllocationRequestForTests(empresaA, reqId);
  await __deletePurchaseImportForTests(empresaA, chave);
});

test('postgres — release concorrente restaura saldo apenas uma vez', { skip: !hasDb }, async () => {
  const empresaId = randomUUID();
  const produtoId = randomUUID();
  const { chave } = await seedUsableLot(empresaId, produtoId, '10.0000000000');
  const reqId = `pg-rel-concurrent-${randomUUID()}`;

  await allocateFiscalStockForSaleItem({
    empresaId,
    produtoCatalogoId: produtoId,
    quantidade: '4.0000000000',
    allocationRequestId: reqId,
  });

  const pool = getPgPool();
  const before = await pool.query(
    `SELECT quantidade_disponivel FROM fiscal_stock_lots WHERE empresa_id = $1 AND produto_catalogo_id = $2`,
    [empresaId, produtoId],
  );
  assert.equal(toDecimal(before.rows[0].quantidade_disponivel).toString(), '6');

  const [rel1, rel2] = await Promise.all([
    releaseFiscalStockAllocation(empresaId, reqId),
    releaseFiscalStockAllocation(empresaId, reqId),
  ]);

  assert.equal(rel1.ok, true);
  assert.equal(rel2.ok, true);
  assert.equal(rel1.released + rel2.released, 1);

  const after = await pool.query(
    `SELECT quantidade_disponivel FROM fiscal_stock_lots WHERE empresa_id = $1 AND produto_catalogo_id = $2`,
    [empresaId, produtoId],
  );
  assert.equal(toDecimal(after.rows[0].quantidade_disponivel).toString(), '10');

  await __deleteAllocationRequestForTests(empresaId, reqId);
  await __deletePurchaseImportForTests(empresaId, chave);
});

test('postgres — ST concorrente 6×1 UN / ST 100 fecha exatamente 100.00', { skip: !hasDb }, async () => {
  const empresaId = randomUUID();
  const produtoId = randomUUID();
  const { chave } = await seedUsableLot(empresaId, produtoId, '6.0000000000', '2026-01-15', {
    priorStStatus: 'RETAINED',
    stRetainedValues: {
      vBCSTRet: '100.00',
      allocationMethod: ST_ALLOCATION_METHOD.PROPORTIONAL_QTY,
    },
  });

  const requests = Array.from({ length: 6 }, (_, i) => allocateFiscalStockForSaleItem({
    empresaId,
    produtoCatalogoId: produtoId,
    quantidade: '1.0000',
    allocationRequestId: `pg-st-conc-${i}-${randomUUID()}`,
  }));

  const results = await Promise.all(requests);
  assert.equal(results.filter((r) => r.ok).length, 6);

  const pool = getPgPool();
  const lot = await pool.query(
    `SELECT quantidade_disponivel FROM fiscal_stock_lots WHERE empresa_id = $1 AND produto_catalogo_id = $2`,
    [empresaId, produtoId],
  );
  assert.equal(toDecimal(lot.rows[0].quantidade_disponivel).isZero(), true);

  const stSum = await pool.query(
    `SELECT COALESCE(SUM((st_allocation_json->'allocatedValues'->>'vBCSTRet')::numeric), 0) AS total
     FROM fiscal_stock_allocations
     WHERE empresa_id = $1 AND status IN ('RESERVED', 'CONSUMED')`,
    [empresaId],
  );
  assert.equal(formatDecimal(toDecimal(stSum.rows[0].total), 2), '100.00');
  assert.notEqual(formatDecimal(toDecimal(stSum.rows[0].total), 2), '100.02');

  const qtySum = await pool.query(
    `SELECT COALESCE(SUM(quantidade), 0) AS total
     FROM fiscal_stock_allocations
     WHERE empresa_id = $1 AND status IN ('RESERVED', 'CONSUMED')`,
    [empresaId],
  );
  assert.equal(toDecimal(qtySum.rows[0].total).toString(), '6');

  await pool.query(`DELETE FROM fiscal_stock_allocations WHERE empresa_id = $1`, [empresaId]);
  await pool.query(`DELETE FROM fiscal_stock_allocation_requests WHERE empresa_id = $1`, [empresaId]);
  await __deletePurchaseImportForTests(empresaId, chave);
});

test('postgres — audit persistido reconstruível após reload', { skip: !hasDb }, async () => {
  const empresaId = randomUUID();
  const produtoId = randomUUID();
  const reqId = `pg-audit-${randomUUID()}`;
  const { chave, invoiceId, itemId } = await seedUsableLot(empresaId, produtoId, '10.0000000000', '2026-01-15', {
    origem: '2',
    priorStStatus: 'RETAINED',
    priorStEvidence: { source: 'xml', tag: 'ICMSST' },
    supplierCest: '0100100',
    stRetainedValues: {
      vBCSTRet: '100.00',
      allocationMethod: ST_ALLOCATION_METHOD.PROPORTIONAL_QTY,
    },
  });

  await allocateFiscalStockForSaleItem({
    empresaId,
    produtoCatalogoId: produtoId,
    quantidade: '4.0000000000',
    allocationRequestId: reqId,
  });

  const loaded = await findAllocationRequestByKey(empresaId, reqId);
  const alloc = loaded.allocations[0];
  const audit = parseJsonField(alloc.allocation_audit_json);
  const stAlloc = parseJsonField(alloc.st_allocation_json);

  assert.equal(loaded.request.allocation_request_id, reqId);
  assert.equal(alloc.stock_lot_id, loaded.allocations[0].stock_lot_id);
  assert.equal(alloc.purchase_invoice_id, invoiceId);
  assert.equal(alloc.purchase_item_id, itemId);
  assert.equal(alloc.produto_catalogo_id, produtoId);
  assert.equal(alloc.quantidade, '4.0000000000');
  assert.equal(audit.allocationRequestId, reqId);
  assert.equal(audit.fifoOrder, 1);
  assert.equal(audit.availableBefore, '10.0000000000');
  assert.equal(audit.availableAfter, '6.0000000000');
  assert.equal(alloc.origem_mercadoria, '2');
  assert.equal(alloc.prior_st_status, 'RETAINED');
  assert.equal(alloc.supplier_cest, '0100100');
  assert.deepEqual(parseJsonField(alloc.prior_st_evidence_json), { source: 'xml', tag: 'ICMSST' });
  assert.equal(stAlloc.allocatedValues.vBCSTRet, '40.00');
  assert.equal(alloc.engine_schema_version, ENGINE_SCHEMA_VERSION);

  await __deleteAllocationRequestForTests(empresaId, reqId);
  await __deletePurchaseImportForTests(empresaId, chave);
});
