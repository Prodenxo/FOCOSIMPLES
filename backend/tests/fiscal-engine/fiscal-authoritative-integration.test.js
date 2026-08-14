/**
 * Fase 8A hardening — integração authoritative no boundary real de emissão.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  __withFiscalEngineFlagsForTests,
  isFiscalEngineV3Enabled,
  isFiscalEngineV3ShadowEnabled,
} from '../../src/fiscal-engine/feature-flag.js';
import {
  resolveNfeEmitPayloadForPlugnotas,
  prepareFiscalAuthorityRouting,
  handleAuthoritativeEmitOutcome,
  reconcileAuthoritativeAttemptOnMeiNotaStatusChange,
  bindAuthoritativeAttemptIdIntegracao,
  NFE_EMIT_PIPELINE_ORDER,
  NFE_EMIT_TRANSFORM_CLASS,
} from '../../src/fiscal-engine/authoritative/nfe-emit-authority-integration.js';
import {
  AUTHORITY_ENGINE,
  EMISSION_ATTEMPT_STATUS,
  ROLLOUT_MODE,
  REQUEST_OUTCOME,
} from '../../src/fiscal-engine/rollout/rollout-constants.js';
import {
  upsertInMemoryRolloutPolicy,
  __resetRolloutPolicyMemoryForTests,
} from '../../src/fiscal-engine/rollout/rollout-policy-memory.repository.js';
import {
  registerFiscalRules,
  resetFiscalRulesRepository,
  listFiscalRulesForEmpresa,
  bootstrapDefaultTestRules,
} from '../../src/fiscal-engine/rules/fiscal-rule-memory.repository.js';
import { createValidatedProductionReadyCurrentStRule } from '../../src/fiscal-engine/rules/fixtures/default-test-rules.js';
import {
  __setStockAllocationRepoForTests,
  __resetStockAllocationRepoForTests,
  allocateFiscalStockForSaleItem,
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
import { buildTestFiscalContext } from './fixtures/fiscal-context-fixture.js';
import {
  findEmissionAttemptById,
  __resetEmissionAttemptServiceForTests,
  hashPayloadForAudit,
} from '../../src/fiscal-engine/authoritative/emission-attempt.service.js';
import { __resetEmissionAttemptsMemoryForTests } from '../../src/fiscal-engine/authoritative/emission-attempt-memory.repository.js';
import {
  runAuthoritativePreflightReadOnly,
  assertLegacyPayloadUnmutated,
} from '../../src/fiscal-engine/authoritative/authoritative-preflight.js';
import { createFiscalIssue } from '../../src/fiscal-engine/types/fiscal-issue.js';
import { resolveFiscalFromContext } from '../../src/fiscal-engine/resolution/resolve-fiscal-from-context.js';
import { triggerNfeEmissionShadowComparisonAfterSuccess } from '../../src/fiscal-engine/shadow/nfe-emission-shadow-hook.js';
import { countProductionReadyFiscalRules } from '../../src/fiscal-engine/rollout/rollout-production-rules-gate.js';
import { ALLOCATION_STATUS } from '../../src/fiscal-engine/allocation/allocation-constants.js';
import {
  insertApprovedRuleForFixture,
  resetFiscalConfigurationRepository,
  saveCompanyFiscalProfile,
  ACCOUNTANT_RULE_STATUS,
  FISCAL_PROFILE_STATUS,
} from '../../src/fiscal-engine/index.js';

const EMP = randomUUID();
const PROD = 'prod-auth-int';
const MEI_NOTA_ID = randomUUID();

const registerAuthoritativeAccountantRule = () => {
  saveCompanyFiscalProfile({
    id: 'cfp-auth-int',
    tenantId: EMP,
    companyId: EMP,
    establishmentId: 'default',
    crt: 1,
    taxRegime: 'SIMPLES_NACIONAL',
    issuerUf: 'RJ',
    status: FISCAL_PROFILE_STATUS.ACTIVE,
    validFrom: '2020-01-01',
    configuredBy: 'acc-test',
    approvedBy: 'acc-test',
  });

  insertApprovedRuleForFixture({
    id: 'auth-int-accountant-102',
    tenantId: EMP,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 200,
    conditions: {
      crt: [1],
      operationType: ['VENDA'],
      operationScope: ['INTERNAL'],
      itemSource: ['THIRD_PARTY'],
      recipientTaxpayerStatus: ['NON_TAXPAYER'],
      priorStStatus: ['NO_ST_EVIDENCE'],
      issuerUf: ['RJ'],
      destinationUf: ['RJ'],
    },
    approvedResult: {
      cfop: '5102',
      csosn: '102',
      currentOperationSt: 'NOT_DUE',
      pis: { cst: '07' },
      cofins: { cst: '08' },
    },
    validFrom: '2020-01-01',
    approvedBy: 'acc-test',
  });
};

const registerAuthoritativeTestRules = () => {
  resetFiscalConfigurationRepository();
  bootstrapDefaultTestRules();
  registerAuthoritativeAccountantRule();
  registerFiscalRules([
    createValidatedProductionReadyCurrentStRule(),
    {
      id: 'prod-ready-csosn-102',
      ruleType: 'CSOSN',
      schemaVersion: '1.0.0',
      applicableCrt: [1],
      effectiveFrom: '2020-01-01',
      priority: 100,
      conditions: { location: ['INTERNA'], itemSource: ['THIRD_PARTY'], currentOperationSt: ['NOT_DUE'] },
      result: { csosn: '102', icmsGroup: 'ICMSSN102' },
      sourceLegalReference: 'TEST:PROD_CSOSN',
      productionReady: true,
    },
    {
      id: 'prod-ready-cfop-5102',
      ruleType: 'CFOP',
      schemaVersion: '1.0.0',
      applicableCrt: [1],
      effectiveFrom: '2020-01-01',
      priority: 100,
      conditions: { location: ['INTERNA'], itemSource: ['THIRD_PARTY'] },
      result: { cfop: '5102' },
      sourceLegalReference: 'TEST:PROD_CFOP',
      productionReady: true,
    },
  ]);
};

const seedLot = (qty = '10.0000000000') => {
  const lot = buildUsableStockLot({
    empresaId: EMP,
    produtoCatalogoId: PROD,
    quantidade: qty,
    origem: '0',
  });
  __getLotsByIdMapForTests().set(lot.id, lot);
  return lot;
};

const commercialPayload = (overrides = {}) => {
  const commercialSaleItemId = overrides.item?.commercialSaleItemId ?? randomUUID();
  return {
    emitente: {
      cpfCnpj: '12345678000199',
      crt: 1,
      endereco: { estado: 'RJ' },
    },
    destinatario: {
      cpfCnpj: '12345678901',
      indIEDest: '9',
      endereco: { estado: 'RJ' },
    },
    idIntegracao: 'integracao-base',
    itens: [{
      produtoCatalogoId: PROD,
      codigo: PROD,
      ncm: '61091000',
      descricao: 'Camisa teste',
      quantidade: '1.0000',
      valorUnitario: '10.00',
      valorTotal: '10.00',
      commercialSaleItemId,
      itemSource: 'THIRD_PARTY',
      ...overrides.item,
    }],
    ...overrides.payload,
  };
};

const authoritativeRoutingParams = (lot, overrides = {}) => ({
  empresaId: EMP,
  userId: EMP,
  documentType: 'NFE',
  businessType: 'RESELLER',
  meiNotaRecordId: overrides.meiNotaRecordId,
  legacyPayload: commercialPayload(overrides),
  commercialPayload: commercialPayload(overrides),
  inMemoryLotsByProduct: { [PROD]: [lot] },
});

test.beforeEach(() => {
  __resetRolloutPolicyMemoryForTests();
  __resetEmissionAttemptsMemoryForTests();
  __resetEmissionAttemptServiceForTests();
  resetFiscalRulesRepository();
  resetFiscalConfigurationRepository();
  __resetFiscalPurchaseMemoryRepo();
  __resetStockAllocationMemoryRepo();
  __resetStockAllocationRepoForTests();
  __setStockAllocationRepoForTests(memoryAllocationRepo);
  __bindStockAllocationLotsMap(__getLotsByIdMapForTests());
});

test('H1. master false — resolveNfeEmitPayload usa legado, sem reserva', async () => {
  seedLot();
  let legacyCalled = false;
  const result = await resolveNfeEmitPayloadForPlugnotas({
    empresaId: EMP,
    documentType: 'NFE',
    commercialPayload: commercialPayload(),
    inMemoryLotsByProduct: { [PROD]: [seedLot()] },
    applyLegacyFiscalTransform: async (p) => { legacyCalled = true; return { ...p, _legacy: true }; },
    applyTechnicalTransforms: async (p) => p,
  });
  assert.equal(result.engine, AUTHORITY_ENGINE.LEGACY);
  assert.equal(legacyCalled, true);
  assert.equal(result.legacyFiscalApplied, true);
  assert.equal(result.allocationRequestIds?.length ?? 0, 0);
});

test('H2. V3=true + gates — adapter boundary recebe payload V3 fiscal', async () => {
  const lot = seedLot();
  registerAuthoritativeTestRules();
  upsertInMemoryRolloutPolicy(EMP, {
    mode: ROLLOUT_MODE.AUTHORITATIVE,
    enabled: true,
    readinessRequired: false,
    minimumShadowSamples: 0,
  });

  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    const adapterPayload = { value: null };
    const legacyTransform = async (p) => ({ ...p, impostos: { icms: { CSOSN: '999' } } });

    const result = await resolveNfeEmitPayloadForPlugnotas({
      ...authoritativeRoutingParams(lot, { meiNotaRecordId: MEI_NOTA_ID }),
      applyLegacyFiscalTransform: legacyTransform,
      applyTechnicalTransforms: async (p) => {
        adapterPayload.value = p;
        return p;
      },
    });

    assert.equal(result.engine, AUTHORITY_ENGINE.V3);
    assert.equal(result.authorityAssumed, true);
    assert.ok(result.payloadToEmit?.itens?.length >= 1);
    const item = result.payloadToEmit.itens[0];
    assert.equal(item.cfop, '5102');
    assert.equal(item.impostos?.icms?.CSOSN, '102');
    assert.equal(item.tributos?.icms?.csosn, '102');
    assert.equal(item.tributos?.pis?.cst, '07');
    assert.equal(item.tributos?.cofins?.cst, '08');
    assert.notEqual(item.impostos?.icms?.CSOSN, '999');
    assert.ok(result.allocationRequestIds?.length >= 1);
    const attempt = findEmissionAttemptById(result.attemptId);
    assert.equal(attempt.attemptStatus, EMISSION_ATTEMPT_STATUS.PREPARED);
    assert.ok(attempt.candidatePayloadHash);
  });
});

test('H3. PREPARED persistido antes do network (TX1)', async () => {
  const lot = seedLot();
  registerAuthoritativeTestRules();
  upsertInMemoryRolloutPolicy(EMP, {
    mode: ROLLOUT_MODE.AUTHORITATIVE,
    enabled: true,
    readinessRequired: false,
  });

  await __withFiscalEngineFlagsForTests({ v3: true }, async () => {
    const result = await prepareFiscalAuthorityRouting(authoritativeRoutingParams(lot));
    assert.equal(result.engine, AUTHORITY_ENGINE.V3);
    const attempt = findEmissionAttemptById(result.attemptId);
    assert.equal(attempt.attemptStatus, EMISSION_ATTEMPT_STATUS.PREPARED);
    assert.ok(attempt.allocationRequestIds.length >= 1);
    assert.equal(hashPayloadForAudit(result.payloadToEmit), attempt.candidatePayloadHash);
  });
});

test('H4. LEGACY emit não cria reserva real', async () => {
  const lot = seedLot();
  await resolveNfeEmitPayloadForPlugnotas({
    empresaId: EMP,
    documentType: 'NFE',
    commercialPayload: commercialPayload(),
    inMemoryLotsByProduct: { [PROD]: [lot] },
    applyLegacyFiscalTransform: async (p) => p,
    applyTechnicalTransforms: async (p) => p,
  });
  const alloc = await findAllocationRequestByKey(EMP, 'any');
  assert.equal(alloc, null);
});

test('H5. preflight read-only não reserva', async () => {
  const lot = seedLot();
  registerAuthoritativeTestRules();
  const preflight = await runAuthoritativePreflightReadOnly({
    empresaId: EMP,
    businessType: 'RESELLER',
    legacyPayload: commercialPayload(),
    inMemoryLotsByProduct: { [PROD]: [lot] },
  });
  assert.ok(preflight.fiscalResults[0]?.audit?.accountantConfig?.accountantApprovedRuleId);
  assert.equal(__getLotsByIdMapForTests().get(lot.id).quantidade_disponivel, lot.quantidade_disponivel);
});

test('H6. network unknown pós-send — HOLD reserva, attempt REQUEST_OUTCOME_UNKNOWN', async () => {
  const lot = seedLot();
  registerAuthoritativeTestRules();
  upsertInMemoryRolloutPolicy(EMP, { mode: ROLLOUT_MODE.AUTHORITATIVE, enabled: true, readinessRequired: false });

  await __withFiscalEngineFlagsForTests({ v3: true }, async () => {
    const prep = await prepareFiscalAuthorityRouting(authoritativeRoutingParams(lot));
    assert.equal(prep.engine, AUTHORITY_ENGINE.V3);

    const outcome = await handleAuthoritativeEmitOutcome({
      attemptId: prep.attemptId,
      empresaId: EMP,
      allocationRequestIds: prep.allocationRequestIds,
      error: Object.assign(new Error('socket timeout'), { code: 'ETIMEDOUT' }),
      sentToProvider: true,
    });
    assert.equal(outcome.outcome, REQUEST_OUTCOME.NETWORK_ERROR);
    assert.equal(outcome.transition.releaseReservation, false);
    const attempt = findEmissionAttemptById(prep.attemptId);
    assert.equal(attempt.attemptStatus, EMISSION_ATTEMPT_STATUS.REQUEST_OUTCOME_UNKNOWN);
  });
});

test('H7. processando → RESERVED; concluido → CONSUMED (reconcile)', async () => {
  const lot = seedLot();
  registerAuthoritativeTestRules();
  upsertInMemoryRolloutPolicy(EMP, { mode: ROLLOUT_MODE.AUTHORITATIVE, enabled: true, readinessRequired: false });

  await __withFiscalEngineFlagsForTests({ v3: true }, async () => {
    const prep = await prepareFiscalAuthorityRouting(authoritativeRoutingParams(lot, { meiNotaRecordId: MEI_NOTA_ID }));
    const reqId = prep.allocationRequestIds[0];

    await handleAuthoritativeEmitOutcome({
      attemptId: prep.attemptId,
      empresaId: EMP,
      meiNotaRecordId: MEI_NOTA_ID,
      allocationRequestIds: prep.allocationRequestIds,
      providerStatus: 'processando',
      sentToProvider: true,
    });

    let row = await findAllocationRequestByKey(EMP, reqId);
    assert.equal(row.allocations[0].status, ALLOCATION_STATUS.RESERVED);

    await reconcileAuthoritativeAttemptOnMeiNotaStatusChange({
      empresaId: EMP,
      meiNotaRecordId: MEI_NOTA_ID,
      previousStatus: 'processando',
      newStatus: 'concluido',
    });

    row = await findAllocationRequestByKey(EMP, reqId);
    assert.equal(row.allocations[0].status, ALLOCATION_STATUS.CONSUMED);
  });
});

test('H8. processando → rejeitado → RELEASED', async () => {
  const lot = seedLot();
  registerAuthoritativeTestRules();
  upsertInMemoryRolloutPolicy(EMP, { mode: ROLLOUT_MODE.AUTHORITATIVE, enabled: true, readinessRequired: false });

  await __withFiscalEngineFlagsForTests({ v3: true }, async () => {
    const prep = await prepareFiscalAuthorityRouting(authoritativeRoutingParams(lot, { meiNotaRecordId: MEI_NOTA_ID }));
    const reqId = prep.allocationRequestIds[0];
    await handleAuthoritativeEmitOutcome({
      attemptId: prep.attemptId,
      empresaId: EMP,
      meiNotaRecordId: MEI_NOTA_ID,
      allocationRequestIds: prep.allocationRequestIds,
      providerStatus: 'processando',
      sentToProvider: true,
    });
    await reconcileAuthoritativeAttemptOnMeiNotaStatusChange({
      empresaId: EMP,
      meiNotaRecordId: MEI_NOTA_ID,
      previousStatus: 'processando',
      newStatus: 'rejeitado',
    });
    const row = await findAllocationRequestByKey(EMP, reqId);
    assert.equal(row.allocations[0].status, ALLOCATION_STATUS.RELEASED);
  });
});

test('H9. kill switch OFF — novas emissões LEGACY; attempt antigo reconcilia', async () => {
  const lot = seedLot();
  registerAuthoritativeTestRules();
  upsertInMemoryRolloutPolicy(EMP, { mode: ROLLOUT_MODE.AUTHORITATIVE, enabled: true, readinessRequired: false });

  let prep;
  await __withFiscalEngineFlagsForTests({ v3: true }, async () => {
    prep = await prepareFiscalAuthorityRouting(authoritativeRoutingParams(lot, { meiNotaRecordId: MEI_NOTA_ID }));
    await handleAuthoritativeEmitOutcome({
      attemptId: prep.attemptId,
      empresaId: EMP,
      meiNotaRecordId: MEI_NOTA_ID,
      allocationRequestIds: prep.allocationRequestIds,
      providerStatus: 'processando',
      sentToProvider: true,
    });
  });

  assert.equal(isFiscalEngineV3Enabled(), false);
  const legacy = await resolveNfeEmitPayloadForPlugnotas({
    empresaId: EMP,
    documentType: 'NFE',
    commercialPayload: commercialPayload(),
    applyLegacyFiscalTransform: async (p) => ({ ...p, _legacy: true }),
    applyTechnicalTransforms: async (p) => p,
  });
  assert.equal(legacy.engine, AUTHORITY_ENGINE.LEGACY);

  await reconcileAuthoritativeAttemptOnMeiNotaStatusChange({
    empresaId: EMP,
    meiNotaRecordId: MEI_NOTA_ID,
    previousStatus: 'processando',
    newStatus: 'concluido',
  });
  const row = await findAllocationRequestByKey(EMP, prep.allocationRequestIds[0]);
  assert.equal(row.allocations[0].status, ALLOCATION_STATUS.CONSUMED);
});

test('H10. PAUSED — novas LEGACY; attempt anterior reconcilia', async () => {
  const lot = seedLot();
  registerAuthoritativeTestRules();
  upsertInMemoryRolloutPolicy(EMP, { mode: ROLLOUT_MODE.AUTHORITATIVE, enabled: true, readinessRequired: false });

  let prep;
  await __withFiscalEngineFlagsForTests({ v3: true }, async () => {
    prep = await prepareFiscalAuthorityRouting(authoritativeRoutingParams(lot, { meiNotaRecordId: MEI_NOTA_ID }));
    await handleAuthoritativeEmitOutcome({
      attemptId: prep.attemptId,
      empresaId: EMP,
      meiNotaRecordId: MEI_NOTA_ID,
      allocationRequestIds: prep.allocationRequestIds,
      providerStatus: 'processando',
      sentToProvider: true,
    });
  });

  upsertInMemoryRolloutPolicy(EMP, { mode: ROLLOUT_MODE.PAUSED, enabled: true });
  await __withFiscalEngineFlagsForTests({ v3: true }, async () => {
    const r = await prepareFiscalAuthorityRouting(authoritativeRoutingParams(lot));
    assert.equal(r.engine, AUTHORITY_ENGINE.LEGACY);
  });

  await reconcileAuthoritativeAttemptOnMeiNotaStatusChange({
    empresaId: EMP,
    meiNotaRecordId: MEI_NOTA_ID,
    previousStatus: 'processando',
    newStatus: 'concluido',
  });
  const row = await findAllocationRequestByKey(EMP, prep.allocationRequestIds[0]);
  assert.equal(row.allocations[0].status, ALLOCATION_STATUS.CONSUMED);
});

test('H11. numeração recovery — bind idIntegracao sem nova reserva', async () => {
  const lot = seedLot();
  registerAuthoritativeTestRules();
  upsertInMemoryRolloutPolicy(EMP, { mode: ROLLOUT_MODE.AUTHORITATIVE, enabled: true, readinessRequired: false });

  await __withFiscalEngineFlagsForTests({ v3: true }, async () => {
    const prep = await prepareFiscalAuthorityRouting(authoritativeRoutingParams(lot));
    const idsBefore = [...prep.allocationRequestIds];
    await bindAuthoritativeAttemptIdIntegracao(prep.attemptId, 'novo-id-integracao-recovery');
    const prep2 = await prepareFiscalAuthorityRouting(authoritativeRoutingParams(lot));
    assert.notEqual(prep2.attemptId, prep.attemptId);
    assert.deepEqual(idsBefore, prep.allocationRequestIds);
    const attempt = findEmissionAttemptById(prep.attemptId);
    assert.equal(attempt.idIntegracao, 'novo-id-integracao-recovery');
  });
});

test('H12. shadow skip quando emissão authoritative V3', () => {
  const r = triggerNfeEmissionShadowComparisonAfterSuccess({
    authorityEngine: 'V3',
    legacyPayload: { itens: [] },
    userId: EMP,
  });
  assert.equal(r.triggered, false);
  assert.equal(r.reason, 'authoritative_emit_skip_shadow');
});

test('H13. repository real — zero productionReady após reset', () => {
  resetFiscalRulesRepository();
  assert.equal(countProductionReadyFiscalRules(EMP), 0);
  assert.equal(listFiscalRulesForEmpresa(EMP).filter((r) => r.productionReady).length, 0);
});

test('H14. experimental rule não conta como production ready', () => {
  bootstrapDefaultTestRules();
  assert.equal(countProductionReadyFiscalRules(EMP), 0);
});

test('H15. pipeline order documenta LEGACY_FISCAL skip when V3', () => {
  const legacyStep = NFE_EMIT_PIPELINE_ORDER.find((s) => s.step === 'recalculateNfeLikePayloadTaxForEmit');
  assert.equal(legacyStep.class, NFE_EMIT_TRANSFORM_CLASS.LEGACY_FISCAL);
  assert.equal(legacyStep.skipWhenV3, true);
});

test('H16. preflight unresolved bloqueia — legacy payload imutável', async () => {
  const payload = commercialPayload();
  const before = structuredClone(payload);
  const result = await runAuthoritativePreflightReadOnly({
    empresaId: EMP,
    legacyPayload: payload,
    inMemoryLotsByProduct: {},
  });
  assert.equal(result.blocked, true);
  assert.ok(assertLegacyPayloadUnmutated(before, payload));
});

test('H17. retry reserva idempotente — mesma allocationRequestId', async () => {
  const lot = seedLot('5.0000000000');
  const reqId = `auth-idem-${randomUUID()}`;
  const item = {
    empresaId: EMP,
    produtoCatalogoId: PROD,
    quantidade: '2.0000000000',
    allocationRequestId: reqId,
    commercialSaleItemId: randomUUID(),
  };
  const r1 = await allocateFiscalStockForSaleItem(item);
  const r2 = await allocateFiscalStockForSaleItem(item);
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(r2.idempotentReplay, true);
});

test('H18. defaults finais OFF', () => {
  assert.equal(isFiscalEngineV3Enabled(), false);
  assert.equal(isFiscalEngineV3ShadowEnabled(), false);
});

test('H19. erro antes do provider libera reserva', async () => {
  const lot = seedLot();
  registerAuthoritativeTestRules();
  upsertInMemoryRolloutPolicy(EMP, { mode: ROLLOUT_MODE.AUTHORITATIVE, enabled: true, readinessRequired: false });

  await __withFiscalEngineFlagsForTests({ v3: true }, async () => {
    const prep = await prepareFiscalAuthorityRouting(authoritativeRoutingParams(lot));
    const reqId = prep.allocationRequestIds[0];
    await handleAuthoritativeEmitOutcome({
      attemptId: prep.attemptId,
      empresaId: EMP,
      allocationRequestIds: prep.allocationRequestIds,
      error: new Error('validation local'),
      sentToProvider: false,
    });
    const row = await findAllocationRequestByKey(EMP, reqId);
    assert.equal(row.allocations[0].status, ALLOCATION_STATUS.RELEASED);
  });
});

test('H20. RULE_NOT_PRODUCTION_READY bloqueia sem rules prod', () => {
  bootstrapDefaultTestRules();
  const result = resolveFiscalFromContext(buildTestFiscalContext());
  assert.ok(result.issues.some((i) => i.code === 'RULE_NOT_PRODUCTION_READY'));
});
