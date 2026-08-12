/**
 * Ledger virtual shadow — sequência de emissões, idempotência, concorrência.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { env } from '../../src/config/env.js';
import {
  buildFiscalV3ShadowInput,
  buildLegacyFiscalSnapshotsFromPayload,
  runFiscalV3ShadowComparison,
  triggerNfeEmissionShadowComparisonAfterSuccess,
  clonePayloadForShadow,
  __resetShadowPersistenceForTests,
  __resetShadowMetricsForTests,
  __resetShadowExecutionRegistryForTests,
  __setShadowPostgresPersistenceEnabledForTests,
  __setShadowStockLedgerPostgresEnabledForTests,
  __resetShadowStockLedgerForTests,
  getShadowVirtualConsumedByLotIds,
  getShadowVirtualPendingCommitmentsByLotIds,
  getShadowVirtualPlanningDeductionByLotIds,
  computeShadowVirtualRemainingByLot,
  hasConfirmedShadowEmission,
  hasPendingShadowEmission,
  confirmShadowStockLedgerFromComparison,
  reconcileShadowLedgerOnMeiNotaStatusChange,
  promotePendingShadowLedgerToConfirmed,
  voidPendingShadowLedgerCommitments,
  mergeShadowQuantityMaps,
  SHADOW_LEDGER_STATUS,
  SHADOW_LEDGER_CANCELLATION_NOTE,
  SHADOW_LEDGER_LIFECYCLE_NOTE,
  SHADOW_LEDGER_ISSUE_CODE,
  isEmissionConfirmedForShadow,
  isEmissionEligibleForShadowObservation,
  aggregatePlannedQuantitiesByLot,
  assertPlannedMatchesConfirmedLedger,
  __listInMemoryShadowLedgerByEmissionForTests,
  toDecimal,
  formatDecimal,
} from '../../src/fiscal-engine/index.js';
import { buildUsableStockLot } from './fixtures/stock-lot-builder.js';
import { PRIOR_ST_STATUS } from '../../src/fiscal-engine/types/st-allocation.js';
import {
  __ensureShadowStockLedgerSchemaForTests,
  __deleteShadowStockLedgerByEmpresaForTests,
  fetchShadowStockAllocationsByEmission,
} from '../../src/fiscal-engine/shadow/shadow-stock-ledger.repository.js';

const hasDb = Boolean(String(env.DATABASE_URL || env.SUPABASE_DB_URL || '').trim());
const EMPRESA = '22222222-2222-4222-8222-222222222222';
const PROD = 'SEQ-PROD-1';

const buildLotsAB = () => {
  const lotA = buildUsableStockLot({
    id: randomUUID(),
    empresaId: EMPRESA,
    produtoCatalogoId: PROD,
    quantidade: '10.0000000000',
    origem: '0',
    priorStStatus: PRIOR_ST_STATUS.RETAINED,
    dataEntrada: '2026-01-01',
  });
  const lotB = buildUsableStockLot({
    id: randomUUID(),
    empresaId: EMPRESA,
    produtoCatalogoId: PROD,
    quantidade: '10.0000000000',
    origem: '2',
    priorStStatus: PRIOR_ST_STATUS.NO_ST_EVIDENCE,
    dataEntrada: '2026-01-02',
  });
  return { lotA, lotB, lots: [lotA, lotB] };
};

const salePayload = (idIntegracao, qty) => ({
  idIntegracao,
  emitente: { crt: 1, endereco: { estado: 'RJ' } },
  destinatario: { cpfCnpj: '12345678901', indIEDest: '9', endereco: { estado: 'RJ' } },
  itens: [{
    codigo: PROD,
    produtoCatalogoId: PROD,
    ncm: '22021000',
    cfop: '5102',
    quantidade: qty,
    valorUnitario: 10,
    valorTotal: qty * 10,
    tributos: { icms: { csosn: '102', origem: '0', vBC: '100.00', vICMS: '0.00' } },
  }],
});

const runProcessingShadow = async ({
  meiNotaRecordId,
  qty,
  lots,
  idIntegracao = `proc-${randomUUID()}`,
}) => runFiscalV3ShadowComparison({
  empresaId: EMPRESA,
  legacyPayload: salePayload(idIntegracao, qty),
  shadowEmissionIdentity: meiNotaRecordId,
  meiNotaRecordId,
  idIntegracao,
  emissionStatus: 'processando',
  inMemoryLotsByProduct: { [PROD]: lots.map((l) => ({ ...l })) },
  confirmShadowLedger: true,
});

const qtyDec = (value) => toDecimal(value ?? '0');
const qtyLte = (left, right) => qtyDec(left).lte(qtyDec(right));
const qtyGte = (left, right) => qtyDec(left).gte(qtyDec(right));
const qtyEq = (left, right) => qtyDec(left).eq(qtyDec(right));

const runConfirmedShadow = async ({
  idIntegracao,
  qty,
  lots,
  meiNotaRecordId = randomUUID(),
  emissionStatus = 'concluido',
}) => {
  const payload = salePayload(idIntegracao, qty);
  return runFiscalV3ShadowComparison({
    empresaId: EMPRESA,
    legacyPayload: payload,
    shadowEmissionIdentity: meiNotaRecordId,
    meiNotaRecordId,
    idIntegracao,
    emissionStatus,
    inMemoryLotsByProduct: { [PROD]: lots.map((l) => ({ ...l })) },
    confirmShadowLedger: true,
  });
};

const buildLotAOnly = () => {
  const lotA = buildUsableStockLot({
    id: randomUUID(),
    empresaId: EMPRESA,
    produtoCatalogoId: PROD,
    quantidade: '10.0000000000',
    origem: '0',
    priorStStatus: PRIOR_ST_STATUS.RETAINED,
    dataEntrada: '2026-01-01',
  });
  return { lotA, lots: [lotA] };
};

const ledgerConfirmedByLot = (comparison) => {
  const meiId = comparison.audit?.itemPlans?.[0]?.commercialItem?.commercialSaleItemId;
  void meiId;
  const identity = comparison.audit?.shadowEmissionIdentity;
  void identity;
  return aggregatePlannedQuantitiesByLot(comparison.audit?.itemPlans ?? []);
};

test.before(async () => {
  if (!hasDb) return;
  await __ensureShadowStockLedgerSchemaForTests();
});

test.beforeEach(() => {
  __resetShadowPersistenceForTests();
  __resetShadowMetricsForTests();
  __resetShadowExecutionRegistryForTests();
  __resetShadowStockLedgerForTests();
  __setShadowPostgresPersistenceEnabledForTests(false);
  __setShadowStockLedgerPostgresEnabledForTests(false);
});

test.afterEach(async () => {
  if (!hasDb) return;
  await __deleteShadowStockLedgerByEmpresaForTests(EMPRESA);
});

test('L1. snapshot capturado === payload fiscal enviado ao adapter', () => {
  const finalPayload = salePayload('snap-final-1', 6);
  finalPayload.itens[0].cfop = '5102';
  finalPayload.itens[0].tributos.icms.csosn = '500';

  const snapshot = clonePayloadForShadow(finalPayload);
  finalPayload.itens[0].cfop = '9999';

  const legacySnap = buildLegacyFiscalSnapshotsFromPayload(snapshot)[0];
  assert.equal(legacySnap.cfop, '5102');
  assert.equal(legacySnap.csosn, '500');
  assert.equal(legacySnap.origem, '0');
});

test('L2. hook pós-sucesso agenda shadow — não antes da emissão', async () => {
  const { __withFiscalEngineFlagsForTests } = await import('../../src/fiscal-engine/index.js');
  const { lotA, lotB, lots } = buildLotsAB();
  const idIntegracao = `emit-ok-${randomUUID()}`;
  const finalPayload = salePayload(idIntegracao, 6);

  await __withFiscalEngineFlagsForTests({ v3: false, shadow: true }, async () => {
    const result = triggerNfeEmissionShadowComparisonAfterSuccess({
      userId: EMPRESA,
      empresaId: EMPRESA,
      legacyPayload: finalPayload,
      shadowEmissionIdentity: randomUUID(),
      idIntegracao,
      meiNotaRecordId: randomUUID(),
      emissionStatus: 'concluido',
      inMemoryLotsByProduct: { [PROD]: lots },
    });

    assert.equal(result.triggered, true);
    assert.equal(result.reason, 'scheduled_after_success');
    await new Promise((r) => setTimeout(r, 500));

    const consumed = await getShadowVirtualConsumedByLotIds(EMPRESA, [lotA.id, lotB.id]);
    assert.ok(String(consumed.get(lotA.id)).startsWith('6'));
  });
});

test('L3. emissão rejeitada não confirma ledger virtual', async () => {
  const { lotA, lots } = buildLotsAB();
  const meiNotaRecordId = randomUUID();
  const idIntegracao = `emit-fail-${randomUUID()}`;

  const comparison = await runFiscalV3ShadowComparison({
    empresaId: EMPRESA,
    legacyPayload: salePayload(idIntegracao, 6),
    shadowEmissionIdentity: meiNotaRecordId,
    meiNotaRecordId,
    idIntegracao,
    emissionStatus: 'rejeitado',
    inMemoryLotsByProduct: { [PROD]: lots },
    confirmShadowLedger: true,
  });

  assert.ok(comparison);
  assert.equal(comparison.audit.shadowLedgerStatus, SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION);
  assert.equal(await hasConfirmedShadowEmission(EMPRESA, meiNotaRecordId), false);
  const consumed = await getShadowVirtualConsumedByLotIds(EMPRESA, [lotA.id]);
  assert.equal(consumed.get(lotA.id) ?? '0', '0.0000000000');
});

test('L4. primeira emissão confirmada consome virtualmente lote A', async () => {
  const { lotA, lots } = buildLotsAB();
  const idIntegracao = `sale1-${randomUUID()}`;

  await runConfirmedShadow({ idIntegracao, qty: 6, lots });

  const consumed = await getShadowVirtualConsumedByLotIds(EMPRESA, [lotA.id]);
  assert.ok(String(consumed.get(lotA.id)).startsWith('6'));
});

test('L5. segunda emissão respeita consumo virtual anterior', async () => {
  const { lotA, lotB, lots } = buildLotsAB();

  await runConfirmedShadow({ idIntegracao: `sale1-${randomUUID()}`, qty: 6, lots });

  const comparison2 = await runConfirmedShadow({
    idIntegracao: `sale2-${randomUUID()}`,
    qty: 6,
    lots,
  });

  assert.equal(comparison2.v3Snapshots.length, 2);
  const qtys = comparison2.v3Snapshots.map((s) => String(s.quantity));
  assert.ok(qtys.some((q) => q.startsWith('4')));
  assert.ok(qtys.some((q) => q.startsWith('2')));
});

test('L6. sequência A10/B10: sale6 + sale6 => A6 depois A4+B2', async () => {
  const { lotA, lotB, lots } = buildLotsAB();

  await runConfirmedShadow({ idIntegracao: `seq1-${randomUUID()}`, qty: 6, lots });
  const cmp2 = await runConfirmedShadow({ idIntegracao: `seq2-${randomUUID()}`, qty: 6, lots });

  const consumedA = await getShadowVirtualConsumedByLotIds(EMPRESA, [lotA.id]);
  const consumedB = await getShadowVirtualConsumedByLotIds(EMPRESA, [lotB.id]);
  assert.ok(String(consumedA.get(lotA.id)).startsWith('10'));
  assert.ok(String(consumedB.get(lotB.id)).startsWith('2'));

  const remaining = computeShadowVirtualRemainingByLot(lots, consumedA);
  assert.equal(remaining.get(lotA.id), '0.0000000000');

  const remainingB = computeShadowVirtualRemainingByLot([lotB], consumedB);
  assert.equal(remainingB.get(lotB.id), '8.0000000000');

  assert.equal(cmp2.v3Snapshots.length, 2);
});

test('L7. fiscal_stock_lots físicos permanecem intactos (objetos originais)', async () => {
  const { lotA, lotB, lots } = buildLotsAB();
  const beforeA = lotA.quantidade_disponivel;
  const beforeB = lotB.quantidade_disponivel;

  await runConfirmedShadow({ idIntegracao: `phys-${randomUUID()}`, qty: 6, lots });
  await runConfirmedShadow({ idIntegracao: `phys2-${randomUUID()}`, qty: 6, lots });

  assert.equal(lotA.quantidade_disponivel, beforeA);
  assert.equal(lotB.quantidade_disponivel, beforeB);
});

test('L8. retry mesma emissão não duplica consumo virtual', async () => {
  const { lotA, lots } = buildLotsAB();
  const meiNotaRecordId = randomUUID();
  const idIntegracao = `retry-${randomUUID()}`;

  await runConfirmedShadow({ idIntegracao, qty: 6, lots, meiNotaRecordId });
  await runConfirmedShadow({ idIntegracao: `retry2-${randomUUID()}`, qty: 6, lots, meiNotaRecordId });

  const consumed = await getShadowVirtualConsumedByLotIds(EMPRESA, [lotA.id]);
  assert.ok(String(consumed.get(lotA.id)).startsWith('6'));
});

test('L9. restart preserva shadow ledger via Postgres', { skip: !hasDb }, async () => {
  __setShadowStockLedgerPostgresEnabledForTests(true);
  const { lotA, lots } = buildLotsAB();
  const meiNotaRecordId = randomUUID();
  const idIntegracao = `pg-restart-${randomUUID()}`;

  await runConfirmedShadow({ idIntegracao, qty: 6, lots, meiNotaRecordId });
  __resetShadowStockLedgerForTests();

  const consumed = await getShadowVirtualConsumedByLotIds(EMPRESA, [lotA.id]);
  assert.ok(String(consumed.get(lotA.id)).startsWith('6'));
});

test('L10. cross-tenant ledger independente', async () => {
  const tenantB = '33333333-3333-4333-8333-333333333333';
  const { lotA, lots } = buildLotsAB();
  const lotsB = lots.map((l) => ({ ...l, empresa_id: tenantB, id: randomUUID() }));
  const lotBId = lotsB[0].id;
  const meiA = randomUUID();
  const meiB = randomUUID();

  await runConfirmedShadow({ idIntegracao: `tenant-a-${randomUUID()}`, qty: 6, lots, meiNotaRecordId: meiA });
  await runFiscalV3ShadowComparison({
    empresaId: tenantB,
    legacyPayload: salePayload(`tenant-b-${randomUUID()}`, 6),
    shadowEmissionIdentity: meiB,
    meiNotaRecordId: meiB,
    emissionStatus: 'concluido',
    inMemoryLotsByProduct: { [PROD]: lotsB },
    confirmShadowLedger: true,
  });

  const consumedA = await getShadowVirtualConsumedByLotIds(EMPRESA, [lotA.id]);
  const consumedB = await getShadowVirtualConsumedByLotIds(tenantB, [lotBId]);
  assert.ok(String(consumedA.get(lotA.id)).startsWith('6'));
  assert.ok(String(consumedB.get(lotBId)).startsWith('6'));
});

test('L11. concorrência — total ≤ físico e plano === ledger por emissão', async () => {
  const { lotA, lots } = buildLotsAB();

  const results = await Promise.all([
    runConfirmedShadow({ idIntegracao: `conc1-${randomUUID()}`, qty: 6, lots }),
    runConfirmedShadow({ idIntegracao: `conc2-${randomUUID()}`, qty: 6, lots }),
    runConfirmedShadow({ idIntegracao: `conc3-${randomUUID()}`, qty: 6, lots }),
  ]);

  const consumed = await getShadowVirtualConsumedByLotIds(EMPRESA, [lotA.id]);
  const consumedDec = consumed.get(lotA.id) ?? '0';
  assert.ok(qtyLte(consumedDec, '10'));
  assert.ok(results.every((r) => r !== null));

  for (const comparison of results) {
    if (comparison.audit.shadowLedgerStatus === SHADOW_LEDGER_STATUS.CONFIRMED) {
      const planned = aggregatePlannedQuantitiesByLot(comparison.audit.itemPlans ?? []);
      const confirmedRows = __listInMemoryShadowLedgerByEmissionForTests(
        EMPRESA,
        comparison.audit.shadowEmissionIdentity,
      );
      if (confirmedRows.length > 0) {
        const invariant = assertPlannedMatchesConfirmedLedger(comparison.audit.itemPlans, confirmedRows);
        assert.equal(invariant.ok, true, `plano diverge do ledger: ${JSON.stringify(invariant)}`);
      }
      for (const [lotId, qty] of planned.entries()) {
        void lotId;
        void qty;
      }
    }
  }
});

test('L12. lifecycle suporta VOIDED — cancelamento automático pendente', () => {
  assert.equal(SHADOW_LEDGER_STATUS.VOIDED, 'VOIDED');
  assert.ok(SHADOW_LEDGER_CANCELLATION_NOTE.includes('Fase 7A'));
});

test('L12b. confirmShadowStockLedgerFromComparison aceita status VOIDED futuro', async () => {
  assert.ok(Object.values(SHADOW_LEDGER_STATUS).includes('VOIDED'));
  const rows = await confirmShadowStockLedgerFromComparison({
    empresaId: EMPRESA,
    shadowEmissionIdentity: `void-prep-${randomUUID()}`,
    comparisonId: randomUUID(),
    itemPlans: [],
  });
  assert.equal(rows.persisted, false);
});

test('L13. status processando executa comparison mas não confirma ledger', async () => {
  const { lotA, lots } = buildLotsAB();
  const meiNotaRecordId = randomUUID();

  const comparison = await runFiscalV3ShadowComparison({
    empresaId: EMPRESA,
    legacyPayload: salePayload(`proc-${randomUUID()}`, 6),
    shadowEmissionIdentity: meiNotaRecordId,
    meiNotaRecordId,
    emissionStatus: 'processando',
    inMemoryLotsByProduct: { [PROD]: lots },
    confirmShadowLedger: true,
  });

  assert.ok(comparison);
  assert.equal(comparison.executionStatus, 'OK');
  assert.equal(comparison.audit.shadowLedgerStatus, SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION);
  assert.equal(await hasConfirmedShadowEmission(EMPRESA, meiNotaRecordId), false);
  const consumed = await getShadowVirtualConsumedByLotIds(EMPRESA, [lotA.id]);
  assert.equal(consumed.get(lotA.id) ?? '0', '0.0000000000');
});

test('L14. rejeição posterior — processando observado, rejeitado não consome', async () => {
  const { lotA, lots } = buildLotsAB();
  const meiNotaRecordId = randomUUID();

  await runFiscalV3ShadowComparison({
    empresaId: EMPRESA,
    legacyPayload: salePayload(`post-rej-${randomUUID()}`, 6),
    shadowEmissionIdentity: meiNotaRecordId,
    meiNotaRecordId,
    emissionStatus: 'processando',
    inMemoryLotsByProduct: { [PROD]: lots },
    confirmShadowLedger: true,
  });

  await runFiscalV3ShadowComparison({
    empresaId: EMPRESA,
    legacyPayload: salePayload(`post-rej2-${randomUUID()}`, 6),
    shadowEmissionIdentity: meiNotaRecordId,
    meiNotaRecordId,
    emissionStatus: 'rejeitado',
    inMemoryLotsByProduct: { [PROD]: lots },
    confirmShadowLedger: true,
  });

  const consumed = await getShadowVirtualConsumedByLotIds(EMPRESA, [lotA.id]);
  assert.equal(consumed.get(lotA.id) ?? '0', '0.0000000000');
});

test('L15. status concluido confirma ledger (estado real autorizado)', async () => {
  assert.equal(isEmissionConfirmedForShadow('concluido'), true);
  assert.equal(isEmissionConfirmedForShadow('AUTORIZADA'), true);

  const { lotA, lots } = buildLotsAB();
  const meiNotaRecordId = randomUUID();
  const comparison = await runConfirmedShadow({
    idIntegracao: `auth-${randomUUID()}`,
    qty: 6,
    lots,
    meiNotaRecordId,
    emissionStatus: 'concluido',
  });

  assert.equal(comparison.audit.shadowLedgerStatus, SHADOW_LEDGER_STATUS.CONFIRMED);
  assert.equal(await hasConfirmedShadowEmission(EMPRESA, meiNotaRecordId), true);
  const consumed = await getShadowVirtualConsumedByLotIds(EMPRESA, [lotA.id]);
  assert.ok(String(consumed.get(lotA.id)).startsWith('6'));
});

test('L16. política shadow — processando elegível, rejeitado não', () => {
  assert.equal(isEmissionEligibleForShadowObservation('processando'), true);
  assert.equal(isEmissionEligibleForShadowObservation('concluido'), true);
  assert.equal(isEmissionEligibleForShadowObservation('rejeitado'), false);
  assert.equal(isEmissionEligibleForShadowObservation('cancelado'), false);
});

test('L17. planning === ledger confirmado por lote', async () => {
  const { lots } = buildLotsAB();
  const meiNotaRecordId = randomUUID();
  const comparison = await runConfirmedShadow({
    idIntegracao: `plan-eq-${randomUUID()}`,
    qty: 6,
    lots,
    meiNotaRecordId,
  });

  const planned = aggregatePlannedQuantitiesByLot(comparison.audit.itemPlans ?? []);
  const confirmedRows = __listInMemoryShadowLedgerByEmissionForTests(EMPRESA, meiNotaRecordId);
  const invariant = assertPlannedMatchesConfirmedLedger(comparison.audit.itemPlans, confirmedRows);
  assert.equal(invariant.ok, true);
  assert.ok(planned.size > 0);
  assert.ok(confirmedRows.length > 0);
});

test('L18. A10 sem lote B: sale6 + sale6 => A6 depois A4 + unresolved2', async () => {
  const { lotA, lots } = buildLotAOnly();

  await runConfirmedShadow({ idIntegracao: `only-a1-${randomUUID()}`, qty: 6, lots });
  const cmp2 = await runConfirmedShadow({ idIntegracao: `only-a2-${randomUUID()}`, qty: 6, lots });

  const consumed = await getShadowVirtualConsumedByLotIds(EMPRESA, [lotA.id]);
  assert.ok(String(consumed.get(lotA.id)).startsWith('10'));

  assert.equal(cmp2.v3Snapshots.length, 1);
  assert.ok(String(cmp2.v3Snapshots[0].quantity).startsWith('4'));
  assert.ok(cmp2.items.some((i) => i.differenceCodes.includes('SHADOW_ALLOCATION_UNAVAILABLE')));
});

test('L19. concorrência não confirma quantidade maior que planejada', async () => {
  const { lotA, lots } = buildLotAOnly();

  const results = await Promise.all([
    runConfirmedShadow({ idIntegracao: `clip1-${randomUUID()}`, qty: 6, lots }),
    runConfirmedShadow({ idIntegracao: `clip2-${randomUUID()}`, qty: 6, lots }),
  ]);

  for (const cmp of results) {
    if (cmp.audit.shadowLedgerStatus !== SHADOW_LEDGER_STATUS.CONFIRMED) continue;
    const planned = ledgerConfirmedByLot(cmp);
    for (const [lotId, qty] of planned.entries()) {
      const rows = __listInMemoryShadowLedgerByEmissionForTests(
        EMPRESA,
        cmp.audit.shadowEmissionIdentity,
      );
      const rowQty = rows
        .filter((r) => r.stockLotId === lotId)
        .reduce((acc, r) => acc.plus(toDecimal(r.quantity ?? '0')), toDecimal(0));
      assert.ok(qtyEq(formatDecimal(rowQty, 10), qty));
    }
  }

  const consumed = await getShadowVirtualConsumedByLotIds(EMPRESA, [lotA.id]);
  assert.ok(qtyLte(consumed.get(lotA.id) ?? '0', '10'));
});

test('L20. assertPlannedMatchesConfirmedLedger detecta divergência (sem clip silencioso)', () => {
  const itemPlans = [{
    itemIndex: 0,
    plannedAllocations: [{ stock_lot_id: 'lot-1', quantidade: '6.0000000000', allocation_audit_json: { fifoOrder: 0 } }],
  }];
  const confirmedRows = [{ stockLotId: 'lot-1', quantity: '4.0000000000' }];
  const result = assertPlannedMatchesConfirmedLedger(itemPlans, confirmedRows);
  assert.equal(result.ok, false);
  assert.equal(result.code, SHADOW_LEDGER_ISSUE_CODE.PLAN_STALE);
});

test('L21. Postgres lock cobre plan+confirm concorrente', { skip: !hasDb }, async () => {
  __setShadowStockLedgerPostgresEnabledForTests(true);
  const { lotA, lots } = buildLotAOnly();

  await Promise.all([
    runConfirmedShadow({ idIntegracao: `pgc1-${randomUUID()}`, qty: 6, lots }),
    runConfirmedShadow({ idIntegracao: `pgc2-${randomUUID()}`, qty: 6, lots }),
  ]);

  const consumed = await getShadowVirtualConsumedByLotIds(EMPRESA, [lotA.id]);
  assert.ok(qtyLte(consumed.get(lotA.id) ?? '0', '10'));
  assert.ok(qtyGte(consumed.get(lotA.id) ?? '0', '6'));
});

test('L22. meiNotaRecordId estável — idIntegracao diferente no retry não duplica', async () => {
  const { lotA, lots } = buildLotsAB();
  const meiNotaRecordId = randomUUID();

  await runConfirmedShadow({
    idIntegracao: `integ-1-${randomUUID()}`,
    qty: 6,
    lots,
    meiNotaRecordId,
  });
  await runConfirmedShadow({
    idIntegracao: `integ-2-${randomUUID()}`,
    qty: 6,
    lots,
    meiNotaRecordId,
  });

  const consumed = await getShadowVirtualConsumedByLotIds(EMPRESA, [lotA.id]);
  assert.ok(String(consumed.get(lotA.id)).startsWith('6'));
  assert.equal(await hasConfirmedShadowEmission(EMPRESA, meiNotaRecordId), true);
});

test('L23. mergeShadowQuantityMaps usa Decimal — 0.1+0.2 sem Number', () => {
  const a = new Map([['lot-x', '0.1000000000']]);
  const b = new Map([['lot-x', '0.2000000000']]);
  const merged = mergeShadowQuantityMaps(a, b);
  assert.ok(qtyEq(merged.get('lot-x'), '0.3000000000'));
  assert.notEqual(Number('0.1') + Number('0.2'), 0.3);
});

test('L24. processando persiste pending commitment sem confirmed consumption', async () => {
  const { lotA, lots } = buildLotAOnly();
  const meiNotaRecordId = randomUUID();

  const comparison = await runProcessingShadow({ meiNotaRecordId, qty: 6, lots });

  assert.equal(comparison.audit.shadowLedgerStatus, SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION);
  assert.equal(await hasPendingShadowEmission(EMPRESA, meiNotaRecordId), true);
  assert.equal(await hasConfirmedShadowEmission(EMPRESA, meiNotaRecordId), false);

  const consumed = await getShadowVirtualConsumedByLotIds(EMPRESA, [lotA.id]);
  assert.ok(qtyEq(consumed.get(lotA.id) ?? '0', '0'));

  const pending = await getShadowVirtualPendingCommitmentsByLotIds(EMPRESA, [lotA.id]);
  assert.ok(qtyEq(pending.get(lotA.id), '6.0000000000'));
});

test('L25. pending reduz disponibilidade para novo planning (A10 → A4)', async () => {
  const { lotA, lots } = buildLotAOnly();
  const mei1 = randomUUID();

  await runProcessingShadow({ meiNotaRecordId: mei1, qty: 6, lots });

  const deduction = await getShadowVirtualPlanningDeductionByLotIds(EMPRESA, [lotA.id]);
  assert.ok(qtyEq(deduction.get(lotA.id), '6.0000000000'));

  const cmp2 = await runProcessingShadow({ meiNotaRecordId: randomUUID(), qty: 6, lots });
  assert.equal(cmp2.v3Snapshots.length, 1);
  assert.ok(String(cmp2.v3Snapshots[0].quantity).startsWith('4'));
});

test('L26. duas processando qty6 não oversubscribe A10', async () => {
  const { lotA, lots } = buildLotAOnly();

  await runProcessingShadow({ meiNotaRecordId: randomUUID(), qty: 6, lots });
  const cmp2 = await runProcessingShadow({ meiNotaRecordId: randomUUID(), qty: 6, lots });

  const pending = await getShadowVirtualPendingCommitmentsByLotIds(EMPRESA, [lotA.id]);
  assert.ok(qtyEq(pending.get(lotA.id), '10.0000000000'));
  assert.ok(String(cmp2.v3Snapshots[0]?.quantity ?? '0').startsWith('4'));
});

test('L27. pending → concluido confirma mesmo plano (reconcile)', async () => {
  const { lotA, lots } = buildLotAOnly();
  const meiNotaRecordId = randomUUID();

  await runProcessingShadow({ meiNotaRecordId, qty: 6, lots });
  const pendingRows = __listInMemoryShadowLedgerByEmissionForTests(
    EMPRESA,
    meiNotaRecordId,
    SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION,
  );
  assert.equal(pendingRows.length, 1);

  const result = await reconcileShadowLedgerOnMeiNotaStatusChange({
    empresaId: EMPRESA,
    meiNotaRecordId,
    previousStatus: 'processando',
    newStatus: 'concluido',
  });

  assert.equal(result.promoted, true);
  assert.equal(await hasConfirmedShadowEmission(EMPRESA, meiNotaRecordId), true);
  assert.equal(await hasPendingShadowEmission(EMPRESA, meiNotaRecordId), false);

  const confirmedRows = __listInMemoryShadowLedgerByEmissionForTests(EMPRESA, meiNotaRecordId);
  assert.equal(confirmedRows.length, 1);
  assert.ok(qtyEq(confirmedRows[0].quantity, pendingRows[0].quantity));

  const consumed = await getShadowVirtualConsumedByLotIds(EMPRESA, [lotA.id]);
  assert.ok(qtyEq(consumed.get(lotA.id), '6.0000000000'));
});

test('L28. confirmação repetida é idempotente', async () => {
  const { lotA, lots } = buildLotAOnly();
  const meiNotaRecordId = randomUUID();

  await runProcessingShadow({ meiNotaRecordId, qty: 6, lots });
  await reconcileShadowLedgerOnMeiNotaStatusChange({
    empresaId: EMPRESA,
    meiNotaRecordId,
    previousStatus: 'processando',
    newStatus: 'concluido',
  });
  const second = await reconcileShadowLedgerOnMeiNotaStatusChange({
    empresaId: EMPRESA,
    meiNotaRecordId,
    previousStatus: 'processando',
    newStatus: 'concluido',
  });

  assert.equal(second.duplicate, true);
  const consumed = await getShadowVirtualConsumedByLotIds(EMPRESA, [lotA.id]);
  assert.ok(qtyEq(consumed.get(lotA.id), '6.0000000000'));
});

test('L29. pending → rejeitado libera commitment (VOIDED)', async () => {
  const { lotA, lots } = buildLotAOnly();
  const meiNotaRecordId = randomUUID();

  await runProcessingShadow({ meiNotaRecordId, qty: 6, lots });
  await reconcileShadowLedgerOnMeiNotaStatusChange({
    empresaId: EMPRESA,
    meiNotaRecordId,
    previousStatus: 'processando',
    newStatus: 'rejeitado',
  });

  assert.equal(await hasPendingShadowEmission(EMPRESA, meiNotaRecordId), false);
  assert.equal(await hasConfirmedShadowEmission(EMPRESA, meiNotaRecordId), false);

  const pending = await getShadowVirtualPendingCommitmentsByLotIds(EMPRESA, [lotA.id]);
  assert.ok(qtyEq(pending.get(lotA.id) ?? '0', '0'));

  const deduction = await getShadowVirtualPlanningDeductionByLotIds(EMPRESA, [lotA.id]);
  assert.ok(qtyEq(deduction.get(lotA.id) ?? '0', '0'));
});

test('L30. sequência A10: NF1 processando + NF2 processando + NF1 concluido', async () => {
  const { lotA, lots } = buildLotAOnly();
  const mei1 = randomUUID();
  const mei2 = randomUUID();

  await runProcessingShadow({ meiNotaRecordId: mei1, qty: 6, lots });
  const cmp2 = await runProcessingShadow({ meiNotaRecordId: mei2, qty: 6, lots });

  assert.ok(String(cmp2.v3Snapshots[0]?.quantity ?? '').startsWith('4'));

  await reconcileShadowLedgerOnMeiNotaStatusChange({
    empresaId: EMPRESA,
    meiNotaRecordId: mei1,
    previousStatus: 'processando',
    newStatus: 'concluido',
  });

  const consumed = await getShadowVirtualConsumedByLotIds(EMPRESA, [lotA.id]);
  const pending = await getShadowVirtualPendingCommitmentsByLotIds(EMPRESA, [lotA.id]);
  assert.ok(qtyEq(consumed.get(lotA.id), '6.0000000000'));
  assert.ok(qtyEq(pending.get(lotA.id), '4.0000000000'));
});

test('L31. lifecycle documentado — PENDING vs PLANNED vs CONFIRMED', () => {
  assert.ok(SHADOW_LEDGER_LIFECYCLE_NOTE.includes('PENDING'));
  assert.equal(SHADOW_LEDGER_STATUS.PLANNED, 'PLANNED');
  assert.equal(SHADOW_LEDGER_STATUS.PENDING_CONFIRMATION, 'PENDING_CONFIRMATION');
});

test('L32. advisory lock usa mesmo client connect/release', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(
    new URL('../../src/fiscal-engine/shadow/shadow-stock-ledger.repository.js', import.meta.url),
    'utf8',
  );
  assert.ok(source.includes('const client = await pool.connect()'));
  assert.ok(source.includes('await client.query(\'SELECT pg_advisory_lock'));
  assert.ok(source.includes('await client.query(\'SELECT pg_advisory_unlock'));
  assert.ok(source.includes('client.release()'));
});

test('L33. decimal partial allocation 0.3+0.3 preservado no planning', async () => {
  const lotA = buildUsableStockLot({
    id: randomUUID(),
    empresaId: EMPRESA,
    produtoCatalogoId: PROD,
    quantidade: '0.6000000000',
    origem: '0',
    priorStStatus: PRIOR_ST_STATUS.RETAINED,
    dataEntrada: '2026-01-01',
  });

  const input = await buildFiscalV3ShadowInput({
    empresaId: EMPRESA,
    legacyPayload: salePayload(`dec-${randomUUID()}`, 0.6),
    inMemoryLotsByProduct: { [PROD]: [lotA] },
  });

  const planned = aggregatePlannedQuantitiesByLot(input.itemPlans ?? []);
  const total = [...planned.values()].reduce(
    (acc, qty) => acc.plus(toDecimal(qty)),
    toDecimal(0),
  );
  assert.ok(qtyEq(formatDecimal(total, 10), '0.6000000000'));
});

test('L34. promotePending usa meiNotaRecordId como identidade', async () => {
  const { lotA, lots } = buildLotAOnly();
  const meiNotaRecordId = randomUUID();

  await runProcessingShadow({ meiNotaRecordId, qty: 6, lots });
  const promoted = await promotePendingShadowLedgerToConfirmed({
    empresaId: EMPRESA,
    meiNotaRecordId,
    shadowEmissionIdentity: meiNotaRecordId,
  });

  assert.equal(promoted.promoted, true);
  assert.ok(qtyEq(
    (await getShadowVirtualConsumedByLotIds(EMPRESA, [lotA.id])).get(lotA.id),
    '6.0000000000',
  ));
});
