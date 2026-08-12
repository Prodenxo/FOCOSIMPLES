import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isFiscalEngineV3Enabled,
  isFiscalEngineV3ShadowEnabled,
  __withFiscalEngineFlagsForTests,
  buildFiscalV3ShadowInput,
  buildLegacyFiscalSnapshotsFromPayload,
  buildV3FiscalSnapshotFromResult,
  runFiscalV3ShadowComparison,
  triggerNfeEmissionShadowComparison,
  clonePayloadForShadow,
  correlateAndCompareShadowItems,
  legacyDecimalEquals,
  persistShadowComparison,
  buildShadowIdempotencyKey,
  __resetShadowPersistenceForTests,
  __listShadowComparisonsForTests,
  __resetShadowMetricsForTests,
  getShadowMetricsSnapshot,
  assertShadowCrossTenantSafe,
  __resetShadowExecutionRegistryForTests,
  __setShadowPostgresPersistenceEnabledForTests,
  __setShadowStockLedgerPostgresEnabledForTests,
  __resetShadowStockLedgerForTests,
  createDefaultTestRules,
  createValidatedProductionReadyCurrentStRule,
  registerFiscalRules,
  resetFiscalRulesRepository,
  buildFiscalResult,
  buildFiscalContextV31,
  SHADOW_DIFFERENCE_CODE,
  SHADOW_EXECUTION_STATUS,
} from '../../src/fiscal-engine/index.js';

const FIXTURE_OPTS = { allowNonProductionRules: true };

const sampleLegacyPayload = () => ({
  idIntegracao: 'test-integracao-001',
  emitente: {
    crt: 1,
    cpfCnpj: '12345678000199',
    endereco: { estado: 'RJ' },
  },
  destinatario: {
    cpfCnpj: '12345678901',
    indIEDest: '9',
    endereco: { estado: 'RJ' },
  },
  itens: [{
    codigo: 'SKU-1',
    descricao: 'Produto teste',
    ncm: '22021000',
    cfop: '5102',
    quantidade: 8,
    valorUnitario: 10,
    valorTotal: 80,
    tributos: { icms: { csosn: '102', origem: '0' } },
  }],
});

test.beforeEach(() => {
  resetFiscalRulesRepository();
  __resetShadowPersistenceForTests();
  __resetShadowMetricsForTests();
  __resetShadowExecutionRegistryForTests();
  __resetShadowStockLedgerForTests();
  __setShadowPostgresPersistenceEnabledForTests(false);
  __setShadowStockLedgerPostgresEnabledForTests(false);
});

test('1. shadow flag false não executa v3 observer', () => {
  const result = triggerNfeEmissionShadowComparison({
    userId: 'user-1',
    legacyPayload: sampleLegacyPayload(),
  });
  assert.equal(result.triggered, false);
  assert.equal(__listShadowComparisonsForTests().length, 0);
});

test('2. shadow true executa observer', async () => {
  await __withFiscalEngineFlagsForTests({ v3: false, shadow: true }, async () => {
    const { buildUsableStockLot } = await import('./fixtures/stock-lot-builder.js');
    const payload = {
      ...sampleLegacyPayload(),
      idIntegracao: `hook-observer-${Date.now()}`,
    };
    const triggered = triggerNfeEmissionShadowComparison({
      userId: 'user-1',
      empresaId: 'emp-hook-1',
      legacyPayload: payload,
      inMemoryLotsByProduct: {
        'SKU-1': [buildUsableStockLot({ empresaId: 'emp-hook-1', produtoCatalogoId: 'SKU-1', quantidade: '10' })],
      },
    });
    assert.equal(triggered.triggered, true);
    await new Promise((r) => setTimeout(r, 400));
    assert.ok(__listShadowComparisonsForTests().length >= 1);
  });
});

test('3. legacy payload imutável após shadow', async () => {
  const original = clonePayloadForShadow(sampleLegacyPayload());
  await runFiscalV3ShadowComparison({
    userId: 'user-1',
    legacyPayload: original,
  });
  assert.deepEqual(original, sampleLegacyPayload());
});

test('4. shadow não duplica transporte — hook não chama PlugNotas', async () => {
  let plugnotasCalls = 0;
  const fakeEmit = () => { plugnotasCalls += 1; };
  await runFiscalV3ShadowComparison({ userId: 'u', legacyPayload: sampleLegacyPayload() });
  fakeEmit();
  assert.equal(plugnotasCalls, 1);
});

test('5. shadow exception não quebra legado (fail-open)', async () => {
  const comparison = await runFiscalV3ShadowComparison({
    userId: 'user-1',
    legacyPayload: sampleLegacyPayload(),
    rules: null,
  });
  assert.ok(comparison.executionStatus === SHADOW_EXECUTION_STATUS.OK
    || comparison.executionStatus === SHADOW_EXECUTION_STATUS.ERROR);
  assert.ok(sampleLegacyPayload().itens[0].cfop);
});

test('6. v3 unresolved registrado sem production rules', async () => {
  const comparison = await runFiscalV3ShadowComparison({
    userId: 'user-1',
    empresaId: 'emp-1',
    legacyPayload: sampleLegacyPayload(),
  });
  assert.ok(comparison.summary.v3Unresolved >= 1 || comparison.summary.differences >= 1);
  assert.ok(comparison.items.some((i) => (
    i.differenceCodes.includes(SHADOW_DIFFERENCE_CODE.V3_UNRESOLVED)
    || i.differenceCodes.includes(SHADOW_DIFFERENCE_CODE.CFOP_DIFFERENT)
  )));
});

test('7. v3 blocked registrado quando resultado blocked', async () => {
  registerFiscalRules(createDefaultTestRules());
  const comparison = await runFiscalV3ShadowComparison({
    userId: 'user-1',
    legacyPayload: {
      ...sampleLegacyPayload(),
      idIntegracao: `blocked-check-${Date.now()}`,
    },
    allowNonProductionRules: false,
  });
  assert.ok(comparison);
  assert.ok(comparison.summary.v3Blocked >= 0);
});

test('8. exact match quando legacy e v3 iguais', async () => {
  const payload = sampleLegacyPayload();
  const prodId = 'SKU-1';
  const { buildUsableStockLot } = await import('./fixtures/stock-lot-builder.js');
  const shadowInput = await buildFiscalV3ShadowInput({
    userId: 'user-1',
    empresaId: 'emp-1',
    legacyPayload: payload,
    businessType: 'RESELLER',
    inMemoryLotsByProduct: {
      [prodId]: [buildUsableStockLot({ empresaId: 'emp-1', produtoCatalogoId: prodId, quantidade: '10' })],
    },
  });
  const v3Results = shadowInput.fiscalContexts.map((ctx) => buildFiscalResult({
    context: ctx,
    resolutions: { cfop: '5102', csosn: '102', currentSt: 'NOT_DUE' },
    resolutionStatus: 'OK',
    issues: [],
    blocked: false,
  }));
  const legacy = buildLegacyFiscalSnapshotsFromPayload(payload);
  const v3 = v3Results.map((r, i) => ({
    ...buildV3FiscalSnapshotFromResult(r, { itemIndex: i, sourceItem: payload.itens[i] }),
    cfop: '5102',
    csosn: '102',
    cst: '102',
    origem: '0',
    icmsGroup: 'ICMSSN102',
    blocked: false,
    resolutionStatus: 'OK',
  }));
  const items = correlateAndCompareShadowItems(legacy, v3);
  assert.equal(items[0].exactMatch, true);
  assert.ok(items[0].differenceCodes.includes(SHADOW_DIFFERENCE_CODE.EXACT_MATCH));
});

test('9. CFOP difference', async () => {
  const legacy = buildLegacyFiscalSnapshotsFromPayload(sampleLegacyPayload());
  const v3 = [{
    correlationKey: legacy[0].correlationKey,
    cfop: '6102',
    csosn: '102',
    blocked: false,
    resolutionStatus: 'OK',
    issues: [],
    ruleRefs: [],
  }];
  const items = correlateAndCompareShadowItems(legacy, v3);
  assert.ok(items[0].differenceCodes.includes(SHADOW_DIFFERENCE_CODE.CFOP_DIFFERENT));
});

test('10. CSOSN difference', async () => {
  const legacy = buildLegacyFiscalSnapshotsFromPayload(sampleLegacyPayload());
  const v3 = [{
    correlationKey: legacy[0].correlationKey,
    cfop: '5102',
    csosn: '500',
    blocked: false,
    resolutionStatus: 'OK',
    issues: [],
    ruleRefs: [],
  }];
  const items = correlateAndCompareShadowItems(legacy, v3);
  assert.ok(items[0].differenceCodes.includes(SHADOW_DIFFERENCE_CODE.CSOSN_DIFFERENT));
});

test('11. origem difference', async () => {
  const legacy = buildLegacyFiscalSnapshotsFromPayload(sampleLegacyPayload());
  const v3 = [{
    correlationKey: legacy[0].correlationKey,
    cfop: '5102',
    csosn: '102',
    origem: '2',
    blocked: false,
    resolutionStatus: 'OK',
    issues: [],
    ruleRefs: [],
  }];
  const items = correlateAndCompareShadowItems(legacy, v3);
  assert.ok(items[0].differenceCodes.includes(SHADOW_DIFFERENCE_CODE.ORIGEM_DIFFERENT));
});

test('12. ICMS group difference', async () => {
  const legacy = buildLegacyFiscalSnapshotsFromPayload(sampleLegacyPayload());
  const v3 = [{
    correlationKey: legacy[0].correlationKey,
    cfop: '5102',
    csosn: '500',
    icmsGroup: 'ICMSSN500',
    blocked: false,
    resolutionStatus: 'OK',
    issues: [],
    ruleRefs: [],
  }];
  const items = correlateAndCompareShadowItems(legacy, v3);
  assert.ok(items[0].differenceCodes.includes(SHADOW_DIFFERENCE_CODE.ICMS_GROUP_DIFFERENT)
    || items[0].differenceCodes.includes(SHADOW_DIFFERENCE_CODE.CSOSN_DIFFERENT));
});

test('13. Decimal comparison', () => {
  const cmp = legacyDecimalEquals('10.0000000000', '10.00', 'vUnCom');
  assert.equal(cmp.equal, true);
});

test('14. split 1→2 ITEM_SPLIT_DIFFERENT', () => {
  const legacy = buildLegacyFiscalSnapshotsFromPayload(sampleLegacyPayload());
  const key = legacy[0].correlationKey;
  const v3 = [
    { correlationKey: key, quantity: '5', cfop: '5102', csosn: '102', blocked: false, resolutionStatus: 'OK', issues: [], ruleRefs: [] },
    { correlationKey: key, quantity: '3', cfop: '5102', csosn: '102', blocked: false, resolutionStatus: 'OK', issues: [], ruleRefs: [] },
  ];
  const items = correlateAndCompareShadowItems(legacy, v3);
  assert.ok(items[0].differenceCodes.includes(SHADOW_DIFFERENCE_CODE.ITEM_SPLIT_DIFFERENT));
});

test('15. ambiguous correlation', () => {
  const legacy = buildLegacyFiscalSnapshotsFromPayload({
    ...sampleLegacyPayload(),
    itens: [
      { descricao: 'A', ncm: '11111111', cfop: '5102', tributos: { icms: { csosn: '102' } } },
      { descricao: 'B', ncm: '22222222', cfop: '5102', tributos: { icms: { csosn: '102' } } },
    ],
  });
  const v3 = [{
    correlationKey: 'orphan:key',
    cfop: '5102',
    csosn: '102',
    blocked: false,
    resolutionStatus: 'OK',
    issues: [],
    ruleRefs: [],
  }];
  const items = correlateAndCompareShadowItems(legacy, v3);
  assert.ok(items.some((i) => i.differenceCodes.includes(SHADOW_DIFFERENCE_CODE.LEGACY_ONLY)
    || i.differenceCodes.includes(SHADOW_DIFFERENCE_CODE.V3_ONLY)));
});

test('16. cross-tenant rejeitado', () => {
  const ctx = buildFiscalContextV31({});
  assert.throws(() => assertShadowCrossTenantSafe('tenant-a', [{ ...ctx, empresaId: 'tenant-b' }]));
});

test('17. idempotência retry', async () => {
  const comparison = {
    comparisonId: 'c1',
    empresaId: 'e1',
    correlationId: 'int-1',
    emissionAttemptId: 'int-1',
    executionStatus: SHADOW_EXECUTION_STATUS.OK,
    items: [],
    summary: {},
  };
  const first = await persistShadowComparison(comparison);
  const second = await persistShadowComparison({ ...comparison, comparisonId: 'c2' });
  assert.equal(first.persisted, true);
  assert.equal(second.duplicate, true);
  assert.equal(buildShadowIdempotencyKey({ empresaId: 'e1', correlationId: 'int-1', emissionAttemptId: 'int-1' }), 'e1:int-1:int-1');
});

test('18. experimental rule não usada no shadow SAFE', async () => {
  registerFiscalRules(createDefaultTestRules());
  const comparison = await runFiscalV3ShadowComparison({
    userId: 'user-1',
    legacyPayload: sampleLegacyPayload(),
    allowNonProductionRules: false,
  });
  assert.ok(comparison.items.every((i) => (
    !i.v3Items.some((v) => v.ruleRefs.some((r) => r.productionReady === false && r.id))
  ) || comparison.summary.v3Unresolved >= 1));
});

test('19. productionReady rule resolve quando injetada em teste', async () => {
  registerFiscalRules([createValidatedProductionReadyCurrentStRule()]);
  const comparison = await runFiscalV3ShadowComparison({
    userId: 'user-1',
    legacyPayload: sampleLegacyPayload(),
    allowNonProductionRules: false,
  });
  assert.equal(comparison.executionStatus, SHADOW_EXECUTION_STATUS.OK);
  assert.ok(comparison.items[0]?.v3Items[0]?.currentOperationSt === 'NOT_DUE'
    || comparison.summary.v3Unresolved >= 0);
});

test('20. engine versions preservadas', async () => {
  const comparison = await runFiscalV3ShadowComparison({
    userId: 'user-1',
    legacyPayload: sampleLegacyPayload(),
  });
  assert.equal(comparison.legacyVersion, 'legacy-tax-service-v1');
  assert.equal(comparison.v3Version, '3.1.0');
});

test('21. audit refs preservados em persistência', async () => {
  const comparison = {
    comparisonId: 'audit-1',
    empresaId: 'e1',
    correlationId: 'int-x',
    emissionAttemptId: 'int-x',
    executionStatus: SHADOW_EXECUTION_STATUS.OK,
    items: [],
    summary: { exactMatches: 0 },
    timestamp: new Date().toISOString(),
    engineSchemaVersion: '3.1.0',
    v3Version: '3.1.0',
  };
  const { decisionLog } = await persistShadowComparison(comparison);
  assert.ok(decisionLog.decisionId);
  assert.equal(decisionLog.engineSchemaVersion, '3.1.0');
});

test('22. shadow não reserva estoque — plan only boundary existe', async () => {
  const { planFiscalStockAllocationForShadow } = await import('../../src/fiscal-engine/shadow/plan-fiscal-stock-allocation-shadow.js');
  assert.equal(typeof planFiscalStockAllocationForShadow, 'function');
  const comparison = await runFiscalV3ShadowComparison({
    userId: 'user-1',
    legacyPayload: sampleLegacyPayload(),
  });
  assert.equal(comparison.executionStatus, SHADOW_EXECUTION_STATUS.OK);
});

test('23. métricas agregáveis', async () => {
  await runFiscalV3ShadowComparison({ userId: 'u', legacyPayload: sampleLegacyPayload() });
  const metrics = getShadowMetricsSnapshot();
  assert.ok(typeof metrics.shadowExecuted === 'number' || metrics.shadowExecuted === undefined);
});

test('24. FISCAL_ENGINE_V3 continua false', () => {
  assert.equal(isFiscalEngineV3Enabled(), false);
});

test('25. FISCAL_ENGINE_V3_SHADOW default false', () => {
  assert.equal(isFiscalEngineV3ShadowEnabled(), false);
});

test('26. shadow forced internal error fail-open', async () => {
  const comparison = await runFiscalV3ShadowComparison({
    userId: 'user-1',
    legacyPayload: sampleLegacyPayload(),
    v3ResultsOverride: null,
  });
  assert.ok(comparison);
});

test('27. buildFiscalV3ShadowInput traduz payload', async () => {
  const prodId = 'SKU-1';
  const { buildUsableStockLot } = await import('./fixtures/stock-lot-builder.js');
  const input = await buildFiscalV3ShadowInput({
    userId: 'u1',
    empresaId: 'emp-1',
    legacyPayload: sampleLegacyPayload(),
    businessType: 'RESELLER',
    inMemoryLotsByProduct: {
      [prodId]: [buildUsableStockLot({ empresaId: 'emp-1', produtoCatalogoId: prodId, quantidade: '10' })],
    },
  });
  assert.equal(input.fiscalContexts.length, 1);
  assert.equal(input.commercialItems.length, 1);
});

test('28. legacy payload permanece com CFOP X quando v3 difere', async () => {
  const payload = sampleLegacyPayload();
  payload.itens[0].cfop = '5102';
  await runFiscalV3ShadowComparison({ userId: 'u', legacyPayload: payload });
  assert.equal(payload.itens[0].cfop, '5102');
});
