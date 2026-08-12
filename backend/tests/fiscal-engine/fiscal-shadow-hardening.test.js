/**
 * Hardening Fase 7A — shadow real read-only pipeline.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  buildFiscalV3ShadowInput,
  buildLegacyFiscalSnapshotsFromPayload,
  runFiscalV3ShadowComparison,
  runFiscalV3ShadowComparisonWithTimeout,
  triggerNfeEmissionShadowComparison,
  resolveLegacyCorrelation,
  correlateAndCompareShadowItems,
  persistShadowComparison,
  __resetShadowPersistenceForTests,
  __resetShadowMetricsForTests,
  __resetShadowExecutionRegistryForTests,
  __setShadowPostgresPersistenceEnabledForTests,
  __setShadowStockLedgerPostgresEnabledForTests,
  __resetShadowStockLedgerForTests,
  __withFiscalEngineFlagsForTests,
  getShadowMetricsSnapshot,
  getShadowTerminalState,
  buildShadowIdempotencyKey,
  SHADOW_DIFFERENCE_CODE,
  SHADOW_EXECUTION_STATUS,
  CORRELATION_CONFIDENCE,
} from '../../src/fiscal-engine/index.js';
import { __forceShadowCloneErrorForTests } from '../../src/fiscal-engine/shadow/clone-payload-for-shadow.js';
import { buildUsableStockLot } from './fixtures/stock-lot-builder.js';
import {
  lotBalancesUnchanged,
  buildPlannedAllocationRowsForShadow,
} from '../../src/fiscal-engine/shadow/plan-fiscal-stock-allocation-shadow.js';
import { SHADOW_ALLOCATION_PLANNED_STATUS } from '../../src/fiscal-engine/shadow/shadow-constants.js';
import { PRIOR_ST_STATUS } from '../../src/fiscal-engine/types/st-allocation.js';

const EMPRESA = '11111111-1111-4111-8111-111111111111';
const PROD_ID = 'PROD-SPLIT-001';

const splitPayload = () => ({
  idIntegracao: `shadow-split-${randomUUID()}`,
  emitente: { crt: 1, endereco: { estado: 'RJ' } },
  destinatario: { cpfCnpj: '12345678901', indIEDest: '9', endereco: { estado: 'RJ' } },
  itens: [{
    codigo: PROD_ID,
    produtoCatalogoId: PROD_ID,
    descricao: 'Item split shadow',
    ncm: '22021000',
    cfop: '5102',
    quantidade: 8,
    valorUnitario: 10,
    valorTotal: 80,
    tributos: { icms: { csosn: '102', origem: '0' } },
  }],
});

const splitLots = () => {
  const lotA = buildUsableStockLot({
    id: randomUUID(),
    empresaId: EMPRESA,
    produtoCatalogoId: PROD_ID,
    quantidade: '5.0000000000',
    origem: '0',
    priorStStatus: PRIOR_ST_STATUS.RETAINED,
    dataEntrada: '2026-01-01',
  });
  const lotB = buildUsableStockLot({
    id: randomUUID(),
    empresaId: EMPRESA,
    produtoCatalogoId: PROD_ID,
    quantidade: '3.0000000000',
    origem: '2',
    priorStStatus: PRIOR_ST_STATUS.NO_ST_EVIDENCE,
    dataEntrada: '2026-01-02',
  });
  return [lotA, lotB];
};

test.beforeEach(() => {
  __resetShadowPersistenceForTests();
  __resetShadowMetricsForTests();
  __resetShadowExecutionRegistryForTests();
  __resetShadowStockLedgerForTests();
  __setShadowPostgresPersistenceEnabledForTests(false);
  __setShadowStockLedgerPostgresEnabledForTests(false);
});

test('H1. shadow usa planning FIFO real via planFiscalStockAllocationForShadow', async () => {
  const lots = splitLots();
  const input = await buildFiscalV3ShadowInput({
    empresaId: EMPRESA,
    legacyPayload: splitPayload(),
    inMemoryLotsByProduct: { [PROD_ID]: lots },
  });
  const plan = input.itemPlans[0];
  assert.equal(plan.plannedAllocations.length, 2);
  assert.equal(plan.plannedAllocations[0].allocation_audit_json?.fifoOrder, 0);
  assert.equal(plan.plannedAllocations[1].allocation_audit_json?.fifoOrder, 1);
  assert.equal(input.fiscalContexts.length, 2);
});

test('H2. priorSt vem do lote real — RETAINED e NO_ST_EVIDENCE', async () => {
  const lots = splitLots();
  const input = await buildFiscalV3ShadowInput({
    empresaId: EMPRESA,
    legacyPayload: splitPayload(),
    inMemoryLotsByProduct: { [PROD_ID]: lots },
  });
  const priorStatuses = input.fiscalContexts.map((ctx) => ctx.estoque?.priorStStatus ?? ctx.allocation?.priorStStatus);
  assert.deepEqual(priorStatuses, [PRIOR_ST_STATUS.RETAINED, PRIOR_ST_STATUS.NO_ST_EVIDENCE]);
});

test('H3. sem lote fiscal não usa NO_ST_EVIDENCE artificial', async () => {
  const comparison = await runFiscalV3ShadowComparison({
    empresaId: EMPRESA,
    legacyPayload: splitPayload(),
    inMemoryLotsByProduct: {},
  });
  assert.ok(comparison.executionIssues.some((i) => i.code === 'SHADOW_ALLOCATION_UNAVAILABLE'));
  assert.ok(comparison.items.some((i) => (
    i.differenceCodes.includes(SHADOW_DIFFERENCE_CODE.SHADOW_ALLOCATION_UNAVAILABLE)
    || i.differenceCodes.includes(SHADOW_DIFFERENCE_CODE.V3_UNRESOLVED)
  )));
  const v3Prior = comparison.v3Snapshots.flatMap((s) => s.priorStStatus).filter(Boolean);
  assert.equal(v3Prior.length, 0);
});

test('H4. split real 5+3 gera ITEM_SPLIT_DIFFERENT contra linha única legado', async () => {
  const lots = splitLots();
  const payload = splitPayload();
  const comparison = await runFiscalV3ShadowComparison({
    empresaId: EMPRESA,
    legacyPayload: payload,
    inMemoryLotsByProduct: { [PROD_ID]: lots },
  });
  assert.equal(comparison.v3Snapshots.length, 2);
  assert.ok(String(comparison.v3Snapshots[0].quantity).startsWith('5'));
  assert.ok(String(comparison.v3Snapshots[1].quantity).startsWith('3'));
  assert.ok(comparison.items.some((i) => (
    i.differenceCodes.includes(SHADOW_DIFFERENCE_CODE.ITEM_SPLIT_DIFFERENT)
  )));
});

test('H5. saldo dos lotes não muda após shadow planning', async () => {
  const lots = splitLots();
  const before = lots.map((l) => ({ lotId: l.id, quantidade_disponivel: l.quantidade_disponivel }));
  await buildFiscalV3ShadowInput({
    empresaId: EMPRESA,
    legacyPayload: splitPayload(),
    inMemoryLotsByProduct: { [PROD_ID]: lots },
  });
  const after = lots.map((l) => ({ lotId: l.id, quantidade_disponivel: l.quantidade_disponivel }));
  assert.equal(lotBalancesUnchanged(before, after), true);
});

test('H6. zero reservation persistida — status PLANNED only', async () => {
  const lots = splitLots();
  const input = await buildFiscalV3ShadowInput({
    empresaId: EMPRESA,
    legacyPayload: splitPayload(),
    inMemoryLotsByProduct: { [PROD_ID]: lots },
  });
  for (const row of input.itemPlans[0].plannedAllocations) {
    assert.equal(row.status, SHADOW_ALLOCATION_PLANNED_STATUS);
    assert.equal(row.allocation_audit_json?.plannedOnly, true);
    assert.equal(row.allocation_audit_json?.shadowMode, true);
  }
});

test('H7. legacyPayloadSnapshot criado síncronamente no hook', async () => {
  await __withFiscalEngineFlagsForTests({ v3: false, shadow: true }, async () => {
    const payload = splitPayload();
    const result = triggerNfeEmissionShadowComparison({
      userId: EMPRESA,
      empresaId: EMPRESA,
      legacyPayload: payload,
      inMemoryLotsByProduct: { [PROD_ID]: splitLots() },
    });
    assert.equal(result.triggered, true);
    assert.ok(result.legacyPayloadSnapshot);
    assert.equal(result.legacyPayloadSnapshot.itens[0].cfop, '5102');
    assert.ok(Array.isArray(result.legacySnapshotsSync));
  });
});

test('H8. mutação posterior do payload original não afeta snapshot', async () => {
  await __withFiscalEngineFlagsForTests({ v3: false, shadow: true }, async () => {
    const payload = splitPayload();
    const result = triggerNfeEmissionShadowComparison({
      userId: EMPRESA,
      empresaId: EMPRESA,
      legacyPayload: payload,
      inMemoryLotsByProduct: { [PROD_ID]: splitLots() },
    });
    payload.itens[0].cfop = '9999';
    payload.itens[0].tributos.icms.csosn = '500';
    assert.equal(result.legacyPayloadSnapshot.itens[0].cfop, '5102');
    assert.equal(result.legacyPayloadSnapshot.itens[0].tributos.icms.csosn, '102');
  });
});

test('H9. erro síncrono no hook não quebra legado — SHADOW_EXECUTION_ERROR', async () => {
  __resetShadowMetricsForTests();
  __forceShadowCloneErrorForTests(true);
  try {
    await __withFiscalEngineFlagsForTests({ v3: false, shadow: true }, async () => {
      const payload = splitPayload();
      const legacyCfop = payload.itens[0].cfop;
      const result = triggerNfeEmissionShadowComparison({
        userId: EMPRESA,
        legacyPayload: payload,
      });
      assert.equal(result.triggered, false);
      assert.equal(result.reason, 'sync_error');
      assert.equal(payload.itens[0].cfop, legacyCfop);
      const metrics = getShadowMetricsSnapshot();
      assert.ok(metrics.shadowFailed >= 1);
    });
  } finally {
    __forceShadowCloneErrorForTests(false);
  }
});

test('H10. erro assíncrono não quebra legado', async () => {
  const payload = splitPayload();
  const comparison = await runFiscalV3ShadowComparison({
    empresaId: EMPRESA,
    legacyPayload: payload,
    lotFetcher: async () => { throw new Error('lot fetch boom'); },
  });
  assert.equal(comparison.executionStatus, SHADOW_EXECUTION_STATUS.ERROR);
  assert.ok(comparison.executionIssues.some((i) => i.code === 'SHADOW_EXECUTION_ERROR'));
  assert.equal(payload.itens[0].cfop, '5102');
});

test('H15. DB shadow indisponível não quebra emissão legado', async () => {
  __setShadowPostgresPersistenceEnabledForTests(true);
  const payload = splitPayload();
  const comparison = await runFiscalV3ShadowComparison({
    empresaId: 'not-a-valid-uuid',
    legacyPayload: payload,
    inMemoryLotsByProduct: { [PROD_ID]: splitLots() },
  });
  assert.ok(comparison);
  assert.equal(payload.itens[0].cfop, '5102');
});

test('H16. timeout não gera segundo estado terminal contraditório', async () => {
  const payload = splitPayload();

  const slowFetcher = () => new Promise((resolve) => {
    setTimeout(() => resolve(splitLots()), 200);
  });

  const comparison = await runFiscalV3ShadowComparisonWithTimeout({
    empresaId: EMPRESA,
    legacyPayload: payload,
    legacySnapshotsSync: buildLegacyFiscalSnapshotsFromPayload(payload),
    lotFetcher: slowFetcher,
    timeoutMs: 20,
  });

  assert.equal(comparison.executionStatus, SHADOW_EXECUTION_STATUS.TIMEOUT);
  const executionKey = comparison.audit?.executionKey ?? buildShadowIdempotencyKey({
    empresaId: EMPRESA,
    correlationId: payload.idIntegracao,
    emissionAttemptId: comparison.comparisonId,
  });
  const terminal = getShadowTerminalState(executionKey);
  assert.equal(terminal?.status, SHADOW_EXECUTION_STATUS.TIMEOUT);

  await new Promise((r) => setTimeout(r, 250));
  assert.equal(getShadowTerminalState(executionKey)?.status, SHADOW_EXECUTION_STATUS.TIMEOUT);
});

test('H17. correlação idx: marcada WEAK e auditável', () => {
  const item = { descricao: '', ncm: '' };
  const correlation = resolveLegacyCorrelation(item, 2);
  assert.equal(correlation.key, 'idx:2');
  assert.equal(correlation.confidence, CORRELATION_CONFIDENCE.WEAK);

  const legacy = [{ correlationKey: 'idx:2', correlationConfidence: CORRELATION_CONFIDENCE.WEAK, cfop: '5102', csosn: '102', blocked: false, resolutionStatus: 'OK', issues: [], ruleRefs: [] }];
  const v3 = [{ correlationKey: 'idx:2', correlationConfidence: CORRELATION_CONFIDENCE.WEAK, cfop: '6102', csosn: '102', blocked: false, resolutionStatus: 'OK', issues: [], ruleRefs: [] }];
  const items = correlateAndCompareShadowItems(legacy, v3);
  assert.equal(items[0].correlationConfidence, CORRELATION_CONFIDENCE.WEAK);
  assert.ok(items[0].differenceCodes.includes(SHADOW_DIFFERENCE_CODE.CFOP_DIFFERENT));
});
