/**
 * Phase 8F.5 — estoque fiscal inicial MANUAL_FISCAL_CONFIRMATION.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { env } from '../../src/config/env.js';
import {
  FISCAL_LOT_SOURCE,
  ORIGEM_FISCAL_SOURCE,
  PRIOR_ST_STATUS,
  createManualFiscalOpeningLot,
  validateManualOpeningLotInput,
  resolveManualOpeningLotStatus,
  isManualOpeningLotRow,
  allocateFiscalStockForSaleItem,
  importPurchaseNfeXml,
  buildFiscalContextFromAllocation,
  planFifoAllocation,
  isFiscalEngineV3Enabled,
  __setManualOpeningLotRepoForTests,
  __resetManualOpeningLotRepoForTests,
  __setFiscalDecisionLogRepoForTests,
  __resetFiscalDecisionLogRepoForTests,
  __setStockAllocationRepoForTests,
  __resetStockAllocationRepoForTests,
  __resetPurchaseRepoForTests,
  __resetRolloutPolicyMemoryForTests,
} from '../../src/fiscal-engine/index.js';
import {
  validateManualOpeningLotInput as validatePolicyInput,
} from '../../src/fiscal-engine/acquisition/manual-opening-lot.policy.js';
import {
  insertManualOpeningLotMemory,
  findManualOpeningLotByConfirmationRequestIdMemory,
  __resetManualOpeningLotMemoryRepo,
  __getManualOpeningLotsMap,
} from '../../src/fiscal-engine/acquisition/manual-opening-lot-memory.repository.js';
import {
  __setAssertUserOwnsEmpresaForTests,
  __resetCatalogDbForTests,
  __setCatalogDbForTests,
} from '../../src/fiscal-engine/acquisition/purchase-catalog.service.js';
import {
  ensureFiscalPurchaseSchema,
  FISCAL_MANUAL_OPENING_STOCK_PHASE8F5_SQL,
  __resetFiscalPurchaseSchemaCacheForTests,
} from '../../src/fiscal-engine/acquisition/fiscal-purchase.schema.js';
import {
  memoryRepository as purchaseMemoryRepo,
  __setPurchaseRepoForTests,
} from '../../src/fiscal-engine/acquisition/purchase-import.service.js';
import * as memoryAllocationRepo from '../../src/fiscal-engine/allocation/stock-allocation-memory.repository.js';
import { buildAllocationRowFromLot } from '../../src/fiscal-engine/allocation/stock-allocation-builder.js';
import { buildUsableStockLot, buildManualOpeningStockLot } from './fixtures/stock-lot-builder.js';
import { buildMinimalPurchaseNfeXml } from './fixtures/purchase-xml-builder.js';
import { getPgPool } from '../../src/config/pg.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const hasDb = Boolean(String(env.DATABASE_URL || env.SUPABASE_DB_URL || '').trim());

const TENANT = randomUUID();
const ACTOR = randomUUID();
const PRODUCT = randomUUID();
const CNPJ_0145 = '35774511000145';
const CNPJ_0167 = '43627677000167';

const validManualInput = (overrides = {}) => ({
  tenantId: TENANT,
  establishmentId: CNPJ_0145,
  produtoCatalogoId: PRODUCT,
  quantidade: '12.5',
  origemMercadoria: '2',
  priorStStatus: PRIOR_ST_STATUS.UNKNOWN,
  actorUserId: ACTOR,
  ...overrides,
});

const wireManualOpeningTestDeps = () => {
  __resetManualOpeningLotMemoryRepo();
  __setManualOpeningLotRepoForTests({
    findByConfirmation: findManualOpeningLotByConfirmationRequestIdMemory,
    insert: insertManualOpeningLotMemory,
  });
  __setAssertUserOwnsEmpresaForTests(async () => {});
  __setCatalogDbForTests(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: PRODUCT,
                user_id: ACTOR,
                metadata_json: { unidade: 'UN' },
                document_type: 'NFE',
              },
              error: null,
            }),
          }),
        }),
      }),
    }),
  }));
};

test.afterEach(() => {
  __resetManualOpeningLotRepoForTests();
  __resetManualOpeningLotMemoryRepo();
  __resetFiscalDecisionLogRepoForTests();
  __resetCatalogDbForTests();
  __resetStockAllocationRepoForTests();
  __resetPurchaseRepoForTests();
  __resetRolloutPolicyMemoryForTests();
});

test('8F5-MAN-01 — MANUAL_FISCAL_CONFIRMATION reconhecido', () => {
  assert.equal(FISCAL_LOT_SOURCE.MANUAL_FISCAL_CONFIRMATION, 'MANUAL_FISCAL_CONFIRMATION');
  assert.equal(ORIGEM_FISCAL_SOURCE.MANUAL_FISCAL_CONFIRMATION, 'MANUAL_FISCAL_CONFIRMATION');
  assert.equal(isManualOpeningLotRow({ lot_source: FISCAL_LOT_SOURCE.MANUAL_FISCAL_CONFIRMATION }), true);
});

test('8F5-MAN-02 — purchase_item_id nullable somente para manual', () => {
  const manual = buildManualOpeningStockLot({
    empresaId: TENANT,
    establishmentId: CNPJ_0145,
    produtoCatalogoId: PRODUCT,
  });
  assert.equal(manual.purchase_item_id, null);
  assert.equal(manual.lot_source, FISCAL_LOT_SOURCE.MANUAL_FISCAL_CONFIRMATION);
});

test('8F5-MAN-03 — PURCHASE_XML exige purchase_item_id (migration)', () => {
  assert.match(FISCAL_MANUAL_OPENING_STOCK_PHASE8F5_SQL, /lot_source = 'PURCHASE_XML' and purchase_item_id is not null/i);
});

test('8F5-MAN-04 — manual proíbe purchase_item_id (migration coherence)', () => {
  assert.match(
    FISCAL_MANUAL_OPENING_STOCK_PHASE8F5_SQL,
    /lot_source = 'MANUAL_FISCAL_CONFIRMATION' and purchase_item_id is null/i,
  );
});

test('8F5-MAN-05 — qty > 0 obrigatória', () => {
  const result = validateManualOpeningLotInput(validManualInput({ quantidade: '0' }));
  assert.equal(result.ok, false);
});

test('8F5-MAN-06 — origem obrigatória', () => {
  const result = validateManualOpeningLotInput(validManualInput({ origemMercadoria: '' }));
  assert.equal(result.ok, false);
});

test('8F5-MAN-07 — origem não recebe default 0', () => {
  const missing = validateManualOpeningLotInput(validManualInput({ origemMercadoria: undefined }));
  assert.equal(missing.ok, false);
  const implicitZero = validatePolicyInput(validManualInput({ origemMercadoria: null }));
  assert.equal(implicitZero.ok, false);
});

test('8F5-MAN-08 — priorStStatus obrigatório', () => {
  const result = validateManualOpeningLotInput(validManualInput({ priorStStatus: '' }));
  assert.equal(result.ok, false);
});

test('8F5-MAN-09 — priorStStatus não recebe default NO_ST_EVIDENCE', () => {
  const result = validateManualOpeningLotInput(validManualInput({ priorStStatus: undefined }));
  assert.equal(result.ok, false);
  assert.notEqual(resolveManualOpeningLotStatus(validManualInput({ priorStStatus: undefined, baseUnit: 'UN' })), 'USABLE');
});

test('8F5-MAN-10 — UNKNOWN é aceito explicitamente', () => {
  const result = validateManualOpeningLotInput(validManualInput({ priorStStatus: 'UNKNOWN' }));
  assert.equal(result.ok, true);
});

test('8F5-MAN-11 — created_by vem do actor autenticado', async () => {
  wireManualOpeningTestDeps();
  const auditLogs = [];
  __setFiscalDecisionLogRepoForTests(async (params) => {
    auditLogs.push(params);
    return { id: randomUUID() };
  });

  const result = await createManualFiscalOpeningLot(validManualInput());
  assert.equal(result.lot.created_by_user_id, ACTOR);
});

test('8F5-MAN-12 — actor payload não pode sobrescrever auth actor', () => {
  const result = validateManualOpeningLotInput(validManualInput({
    payloadActorUserId: randomUUID(),
  }));
  assert.equal(result.ok, false);
});

test('8F5-MAN-13 — manual lot criado USABLE', async () => {
  wireManualOpeningTestDeps();
  __setFiscalDecisionLogRepoForTests(async () => ({ id: randomUUID() }));
  const result = await createManualFiscalOpeningLot(validManualInput());
  assert.equal(result.lot.status, 'USABLE');
});

test('8F5-MAN-14 — não cria purchase invoice', async () => {
  wireManualOpeningTestDeps();
  __setFiscalDecisionLogRepoForTests(async () => ({ id: randomUUID() }));
  __setPurchaseRepoForTests(purchaseMemoryRepo);
  await createManualFiscalOpeningLot(validManualInput());
  const found = await purchaseMemoryRepo.findInvoiceByChave(TENANT, 'any');
  assert.equal(found, null);
});

test('8F5-MAN-15 — não cria purchase item', async () => {
  wireManualOpeningTestDeps();
  __setFiscalDecisionLogRepoForTests(async () => ({ id: randomUUID() }));
  await createManualFiscalOpeningLot(validManualInput());
  const lots = [...__getManualOpeningLotsMap().values()];
  assert.ok(lots.every((lot) => lot.purchase_item_id == null));
});

test('8F5-MAN-16 — origem provenance permanece MANUAL_FISCAL_CONFIRMATION', async () => {
  wireManualOpeningTestDeps();
  __setFiscalDecisionLogRepoForTests(async () => ({ id: randomUUID() }));
  const { lot } = await createManualFiscalOpeningLot(validManualInput({ origemMercadoria: '3' }));

  const allocationRow = buildAllocationRowFromLot({
    lot,
    purchaseInvoiceId: null,
    quantity: '1.0000000000',
    availableBefore: lot.quantidade_disponivel,
    allocationRequestUuid: randomUUID(),
    commercialSaleItem: {
      commercialSaleId: randomUUID(),
      commercialSaleItemId: randomUUID(),
      allocationRequestId: randomUUID(),
      establishmentId: CNPJ_0145,
    },
    fifoOrder: 1,
  });

  const ctx = buildFiscalContextFromAllocation({
    empresaId: TENANT,
    fiscalItemAllocation: allocationRow,
    issuer: { crt: 1, uf: 'RJ', document: CNPJ_0145 },
    recipient: { uf: 'RJ', cpfCnpj: '12345678901' },
    produto: { ncm: '04064000', descricao: 'Queijo' },
    item: { itemSource: 'THIRD_PARTY' },
    operation: { tipo: 'VENDA' },
    referenceDate: '2026-08-17',
  });

  assert.equal(ctx.allocation.origemSource, ORIGEM_FISCAL_SOURCE.MANUAL_FISCAL_CONFIRMATION);
});

test('8F5-MAN-17 — audit log criado', async () => {
  wireManualOpeningTestDeps();
  const auditLogs = [];
  __setFiscalDecisionLogRepoForTests(async (params) => {
    auditLogs.push(params);
    return { id: randomUUID() };
  });
  const result = await createManualFiscalOpeningLot(validManualInput());
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].userId, ACTOR);
  assert.equal(auditLogs[0].contextSnapshot.event, 'MANUAL_FISCAL_OPENING_LOT');
  assert.ok(result.auditLogId);
});

test('8F5-MAN-18 — establishment obrigatório', () => {
  const result = validateManualOpeningLotInput(validManualInput({ establishmentId: '' }));
  assert.equal(result.ok, false);
});

test('8F5-MAN-19 — lote 0145 invisível para 0167', async () => {
  const lotsMap = new Map();
  const lotA = buildManualOpeningStockLot({
    empresaId: TENANT,
    establishmentId: CNPJ_0145,
    produtoCatalogoId: PRODUCT,
    quantidade: '10.0000000000',
    dataEntrada: '2026-01-01',
  });
  const lotB = buildManualOpeningStockLot({
    empresaId: TENANT,
    establishmentId: CNPJ_0167,
    produtoCatalogoId: PRODUCT,
    quantidade: '20.0000000000',
    dataEntrada: '2026-01-02',
  });
  lotsMap.set(lotA.id, lotA);
  lotsMap.set(lotB.id, lotB);
  memoryAllocationRepo.__bindStockAllocationLotsMap(lotsMap);
  __setStockAllocationRepoForTests(memoryAllocationRepo);

  const result = await allocateFiscalStockForSaleItem({
    empresaId: TENANT,
    establishmentId: CNPJ_0145,
    produtoCatalogoId: PRODUCT,
    quantidade: '5',
    allocationRequestId: randomUUID(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.allocations.length, 1);
  assert.equal(result.allocations[0].stock_lot_id, lotA.id);
});

test('8F5-MAN-20 — FIFO seleciona manual lot', () => {
  const manual = buildManualOpeningStockLot({
    empresaId: TENANT,
    establishmentId: CNPJ_0145,
    produtoCatalogoId: PRODUCT,
    dataEntrada: '2026-01-01',
  });
  const plan = planFifoAllocation([manual], '3', {
    empresaId: TENANT,
    establishmentId: CNPJ_0145,
    produtoCatalogoId: PRODUCT,
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.allocations[0].lot.id, manual.id);
});

test('8F5-MAN-21 — FIFO combina manual + purchase corretamente', () => {
  const manual = buildManualOpeningStockLot({
    empresaId: TENANT,
    establishmentId: CNPJ_0145,
    produtoCatalogoId: PRODUCT,
    quantidade: '10.0000000000',
    dataEntrada: '2026-01-01',
  });
  const purchase = buildUsableStockLot({
    empresaId: TENANT,
    establishmentId: CNPJ_0145,
    produtoCatalogoId: PRODUCT,
    quantidade: '20.0000000000',
    dataEntrada: '2026-01-15',
  });
  purchase.lot_source = FISCAL_LOT_SOURCE.PURCHASE_XML;

  const plan = planFifoAllocation([purchase, manual], '15', {
    empresaId: TENANT,
    establishmentId: CNPJ_0145,
    produtoCatalogoId: PRODUCT,
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.allocations.length, 2);
  assert.equal(plan.allocations[0].lot.id, manual.id);
  assert.equal(plan.allocations[1].lot.id, purchase.id);
});

test('8F5-MAN-22 — allocation suporta purchase_item_id null', () => {
  const manual = buildManualOpeningStockLot({
    empresaId: TENANT,
    establishmentId: CNPJ_0145,
    produtoCatalogoId: PRODUCT,
  });
  const row = buildAllocationRowFromLot({
    lot: manual,
    purchaseInvoiceId: null,
    quantity: '2.0000000000',
    availableBefore: manual.quantidade_disponivel,
    allocationRequestUuid: randomUUID(),
    commercialSaleItem: { establishmentId: CNPJ_0145 },
    fifoOrder: 1,
  });
  assert.equal(row.purchase_item_id, null);
});

test('8F5-MAN-23 — allocation suporta purchase_invoice_id null', () => {
  const manual = buildManualOpeningStockLot({
    empresaId: TENANT,
    establishmentId: CNPJ_0145,
    produtoCatalogoId: PRODUCT,
  });
  const row = buildAllocationRowFromLot({
    lot: manual,
    purchaseInvoiceId: null,
    quantity: '2.0000000000',
    availableBefore: manual.quantidade_disponivel,
    allocationRequestUuid: randomUUID(),
    commercialSaleItem: { establishmentId: CNPJ_0145 },
    fifoOrder: 1,
  });
  assert.equal(row.purchase_invoice_id, null);
});

test('8F5-MAN-24 — purchase XML regression intacta', async () => {
  __setPurchaseRepoForTests(purchaseMemoryRepo);
  const xml = Buffer.from(buildMinimalPurchaseNfeXml({ destCnpj: CNPJ_0145 }), 'utf8');
  const result = await importPurchaseNfeXml({
    empresaId: TENANT,
    establishmentId: CNPJ_0145,
    xmlBuffer: xml,
    catalogProducts: [{ id: PRODUCT, nome: 'Prod', ncm: '22021000', unidade: 'UN' }],
    confirmedCatalogId: PRODUCT,
  });
  assert.equal(result.blocked, false);
  assert.ok(result.lots?.length >= 1);
  assert.ok(result.lots[0].purchase_item_id);
  assert.equal(result.lots[0].lot_source, FISCAL_LOT_SOURCE.PURCHASE_XML);
});

test('8F5-MAN-25 — zero emissão PlugNotas', () => {
  assert.equal(isFiscalEngineV3Enabled(), false);
});

test('8F5-MAN-26 — zero rollout', async () => {
  const { getInMemoryRolloutPolicy } = await import('../../src/fiscal-engine/rollout/rollout-policy-memory.repository.js');
  const policy = getInMemoryRolloutPolicy(TENANT, CNPJ_0145);
  assert.equal(policy?.enabled, false);
  assert.equal(policy?.mode, 'LEGACY');
});

test('8F5-MAN-27 — zero AccountantApprovedRule', async () => {
  const { listAccountantApprovedRulesForTenant } = await import('../../src/fiscal-engine/fiscal-configuration/fiscal-configuration-memory.repository.js');
  const rules = listAccountantApprovedRulesForTenant(TENANT);
  assert.equal(rules.length, 0);
});

test('8F5-MAN-28 — legacy V3 OFF intacto', () => {
  assert.equal(isFiscalEngineV3Enabled(), false);
});

test('8F5-MAN-MIG — migration preserva histórico e partial unique', () => {
  const sql = readFileSync(
    join(__dirname, '../../supabase/migrations/20260817120000_fiscal_manual_opening_stock_phase8f5.sql'),
    'utf8',
  );
  assert.match(sql, /set lot_source = 'PURCHASE_XML'/i);
  assert.match(sql, /alter column purchase_item_id drop not null/i);
  assert.match(sql, /where purchase_item_id is not null/i);
  assert.match(sql, /manual_confirmation_json jsonb/i);
  assert.match(sql, /created_by_user_id uuid/i);
});

test('8F5-MAN-IDEM — confirmationRequestId idempotente', async () => {
  wireManualOpeningTestDeps();
  __setFiscalDecisionLogRepoForTests(async () => ({ id: randomUUID() }));
  const confirmationRequestId = randomUUID();
  const first = await createManualFiscalOpeningLot(validManualInput({ confirmationRequestId }));
  const second = await createManualFiscalOpeningLot(validManualInput({ confirmationRequestId }));
  assert.equal(second.idempotentReplay, true);
  assert.equal(second.lot.id, first.lot.id);
});

test('8F5-MAN-PG — schema 8F5 aplica colunas (integração)', { skip: !hasDb }, async () => {
  __resetFiscalPurchaseSchemaCacheForTests();
  await ensureFiscalPurchaseSchema({ force: true });
  const pool = getPgPool();
  const cols = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'fiscal_stock_lots'
       AND column_name IN ('lot_source', 'origem_mercadoria_source', 'manual_confirmation_json', 'created_by_user_id')`,
  );
  const names = cols.rows.map((r) => r.column_name).sort();
  assert.deepEqual(names, [
    'created_by_user_id',
    'lot_source',
    'manual_confirmation_json',
    'origem_mercadoria_source',
  ].sort());
});
