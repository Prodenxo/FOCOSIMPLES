/**
 * Fase 8A — infraestrutura authoritative rollout (tudo OFF por default).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  isFiscalEngineV3Enabled,
  isFiscalEngineV3ShadowEnabled,
  assertShadowDoesNotAuthorizeEmission,
  canFiscalEngineV3AndShadowCoexist,
  __withFiscalEngineFlagsForTests,
} from '../../src/fiscal-engine/feature-flag.js';
import {
  evaluateAuthorityDecision,
} from '../../src/fiscal-engine/rollout/authority-decision.js';
import {
  AUTHORITY_ENGINE,
  AUTHORITY_DECISION_REASON,
  ROLLOUT_MODE,
  REQUEST_OUTCOME,
  EMISSION_ATTEMPT_STATUS,
} from '../../src/fiscal-engine/rollout/rollout-constants.js';
import {
  computeDeterministicCanaryBucket,
  isCanarySelected,
  resolveEmissionStableId,
} from '../../src/fiscal-engine/rollout/rollout-canary.js';
import {
  getRolloutPolicyForEmpresa,
} from '../../src/fiscal-engine/rollout/rollout-policy.service.js';
import {
  upsertInMemoryRolloutPolicy,
  __resetRolloutPolicyMemoryForTests,
} from '../../src/fiscal-engine/rollout/rollout-policy-memory.repository.js';
import {
  evaluateFiscalV3RolloutReadiness,
  assessReadinessGate,
  __seedShadowComparisonsForReadinessTests,
  __resetReadinessDataForTests,
} from '../../src/fiscal-engine/rollout/rollout-readiness.js';
import {
  hasAuthoritativeAccountantConfigReadiness,
} from '../../src/fiscal-engine/rollout/rollout-accountant-config-gate.js';
import {
  resetFiscalConfigurationRepository,
  bootstrapPhase8cFixtures,
  PHASE8C_TENANT_ID,
} from '../../src/fiscal-engine/fiscal-configuration/fixtures/phase8c-test-fixtures.js';
import {
  runAuthoritativePreflightReadOnly,
  assertLegacyPayloadUnmutated,
} from '../../src/fiscal-engine/authoritative/authoritative-preflight.js';
import {
  buildAuthoritativeNfePayloadFromFiscalResults,
  validateAuthoritativeSplitInvariants,
  allocateCommercialValueByQuantityShare,
} from '../../src/fiscal-engine/authoritative/authoritative-payload-builder.js';
import {
  classifyEmitRequestOutcome,
  resolveReservationTransition,
} from '../../src/fiscal-engine/authoritative/reservation-lifecycle.js';
import {
  evaluateAuthoritativeEmissionRouting,
  reconcileAuthoritativeReservationAfterEmit,
} from '../../src/fiscal-engine/authoritative/authoritative-emission-orchestrator.js';
import {
  findEmissionAttempt,
  __resetEmissionAttemptServiceForTests,
} from '../../src/fiscal-engine/authoritative/emission-attempt.service.js';
import { __resetEmissionAttemptsMemoryForTests } from '../../src/fiscal-engine/authoritative/emission-attempt-memory.repository.js';
import { clonePayloadForShadow } from '../../src/fiscal-engine/shadow/clone-payload-for-shadow.js';
import { registerFiscalRules, resetFiscalRulesRepository } from '../../src/fiscal-engine/rules/fiscal-rule-memory.repository.js';
import { createValidatedProductionReadyCurrentStRule } from '../../src/fiscal-engine/rules/fixtures/default-test-rules.js';
import { toDecimal } from '../../src/fiscal-engine/money/decimal.js';
import { SHADOW_EXECUTION_STATUS } from '../../src/fiscal-engine/shadow/shadow-constants.js';

const EMP = randomUUID();
const EMISSION_ID = '550e8400-e29b-41d4-a716-446655440000';

test.beforeEach(() => {
  __resetRolloutPolicyMemoryForTests();
  __resetReadinessDataForTests();
  __resetEmissionAttemptsMemoryForTests();
  __resetEmissionAttemptServiceForTests();
  resetFiscalRulesRepository();
});

test('A1. master switch OFF → LEGACY', async () => {
  upsertInMemoryRolloutPolicy(EMP, {
    mode: ROLLOUT_MODE.AUTHORITATIVE,
    enabled: true,
    canaryPercentage: 100,
  });
  const decision = await evaluateAuthorityDecision({
    empresaId: EMP,
    documentType: 'NFE',
    emissionAttemptId: EMISSION_ID,
  });
  assert.equal(decision.engine, AUTHORITY_ENGINE.LEGACY);
  assert.ok(decision.reasons.includes(AUTHORITY_DECISION_REASON.MASTER_SWITCH_OFF));
});

test('A2. ausência de config tenant → LEGACY', async () => {
  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    const decision = await evaluateAuthorityDecision({
      empresaId: EMP,
      documentType: 'NFE',
      emissionAttemptId: EMISSION_ID,
    });
    assert.equal(decision.engine, AUTHORITY_ENGINE.LEGACY);
    assert.ok(decision.reasons.includes(AUTHORITY_DECISION_REASON.TENANT_LEGACY_DEFAULT));
  });
});

test('A3. modo inválido → LEGACY fail-safe', async () => {
  upsertInMemoryRolloutPolicy(EMP, { mode: 'INVALID_MODE', enabled: true });
  const policy = await getRolloutPolicyForEmpresa(EMP);
  assert.equal(policy.mode, ROLLOUT_MODE.LEGACY);
  assert.ok(policy.issues?.length > 0);
});

test('A4. canary determinístico — mesma emissão mesma decisão', () => {
  const b1 = computeDeterministicCanaryBucket(EMP, EMISSION_ID);
  const b2 = computeDeterministicCanaryBucket(EMP, EMISSION_ID);
  assert.equal(b1, b2);
  assert.equal(isCanarySelected(EMP, EMISSION_ID, 0), false);
  assert.equal(isCanarySelected(EMP, EMISSION_ID, 100), true);
});

test('A5. canary 0% nunca seleciona', () => {
  assert.equal(isCanarySelected(EMP, EMISSION_ID, 0), false);
});

test('A6. tenant diferente — namespace separado', () => {
  const empB = randomUUID();
  const bA = computeDeterministicCanaryBucket(EMP, EMISSION_ID);
  const bB = computeDeterministicCanaryBucket(empB, EMISSION_ID);
  assert.notEqual(bA, bB);
});

test('A7. NOT_READY_NO_ACCOUNTANT_CONFIG bloqueia authoritative fail-closed', async () => {
  resetFiscalConfigurationRepository();
  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    upsertInMemoryRolloutPolicy(EMP, {
      mode: ROLLOUT_MODE.AUTHORITATIVE,
      enabled: true,
      minimumShadowSamples: 0,
      readinessRequired: false,
    });
    const decision = await evaluateAuthorityDecision({
      empresaId: EMP,
      documentType: 'NFE',
      meiNotaRecordId: EMISSION_ID,
    });
    assert.equal(decision.engine, AUTHORITY_ENGINE.BLOCKED);
    assert.ok(decision.reasons.includes(AUTHORITY_DECISION_REASON.NOT_READY_NO_ACCOUNTANT_CONFIG));
    assert.equal(decision.authoritativeFiscalBlocked, true);
    assert.equal(hasAuthoritativeAccountantConfigReadiness(EMP), false);
  });
});

test('A8. com accountant config executável → V3 candidate (gates pass)', async () => {
  bootstrapPhase8cFixtures();
  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    upsertInMemoryRolloutPolicy(PHASE8C_TENANT_ID, {
      mode: ROLLOUT_MODE.AUTHORITATIVE,
      enabled: true,
      minimumShadowSamples: 0,
      readinessRequired: false,
    });
    const decision = await evaluateAuthorityDecision({
      empresaId: PHASE8C_TENANT_ID,
      documentType: 'NFE',
      meiNotaRecordId: EMISSION_ID,
    });
    assert.equal(decision.engine, AUTHORITY_ENGINE.V3);
    assert.ok(decision.reasons.includes(AUTHORITY_DECISION_REASON.V3_CANDIDATE));
    assert.equal(hasAuthoritativeAccountantConfigReadiness(PHASE8C_TENANT_ID), true);
  });
});

test('A9. readiness gate operacional — não certifica legalidade', async () => {
  __seedShadowComparisonsForReadinessTests([
    {
      empresaId: EMP,
      executionStatus: SHADOW_EXECUTION_STATUS.ERROR,
      differences: [],
      createdAt: new Date().toISOString(),
    },
  ]);
  const readiness = await evaluateFiscalV3RolloutReadiness(EMP);
  assert.equal(readiness.stats.executionErrors, 1);
  const gate = assessReadinessGate(readiness, { minimumShadowSamples: 0, readinessRequired: true });
  assert.equal(gate.ready, false);
  assert.ok(gate.reasons.some((r) => r.startsWith('EXECUTION_ERRORS')));
});

test('A10. preflight não muta payload legado', async () => {
  const legacyPayload = {
    emitente: { cpfCnpj: '12345678000199', uf: 'RJ' },
    destinatario: { cpfCnpj: '12345678901', indIEDest: '9' },
    itens: [{
      codigo: 'SKU1',
      produtoCatalogoId: 'prod-1',
      quantidade: '1',
      valorTotal: '10.00',
    }],
  };
  const before = clonePayloadForShadow(legacyPayload);
  await runAuthoritativePreflightReadOnly({
    empresaId: EMP,
    legacyPayload,
    inMemoryLotsByProduct: {},
  });
  assert.ok(assertLegacyPayloadUnmutated(before, legacyPayload));
});

test('A11. split authoritative ΣqCom=8 ΣvProd=original', () => {
  const legacyItem = { quantidade: '8.0000', valorTotal: '80.00', descricao: 'SKU X' };
  const built = buildAuthoritativeNfePayloadFromFiscalResults({
    legacyPayloadSnapshot: { itens: [legacyItem] },
    itemGroups: [{
      commercialItemIndex: 0,
      allocations: [
        { quantidade: '5.0000', id: 'lot-a' },
        { quantidade: '3.0000', id: 'lot-b' },
      ],
      fiscalResults: [
        { resolutions: { cfop: '5102', csosn: '102', xmlFields: { taxes: { icms: { fields: { CSOSN: '102' } } } } }, context: { origemMercadoria: { code: '0' } }, treatment: { currentOperationSt: 'NO_ST' }, issues: [], blocked: false, resolutionStatus: 'OK' },
        { resolutions: { cfop: '5102', csosn: '102', xmlFields: { taxes: { icms: { fields: { CSOSN: '102' } } } } }, context: { origemMercadoria: { code: '2' } }, treatment: { currentOperationSt: 'NO_ST' }, issues: [], blocked: false, resolutionStatus: 'OK' },
      ],
    }],
  });
  const inv = validateAuthoritativeSplitInvariants(legacyItem, built.payload.itens);
  assert.equal(inv.qtyMatch, true);
  assert.equal(inv.vProdMatch, true);
  assert.equal(built.payload.itens.length, 2);
});

test('A12. rateio Decimal residual — soma vProd', () => {
  const quantities = ['0.1', '0.2'];
  const v0 = allocateCommercialValueByQuantityShare('0.30', quantities, 0);
  const v1 = allocateCommercialValueByQuantityShare('0.30', quantities, 1);
  const sum = toDecimal(v0).plus(toDecimal(v1));
  assert.ok(sum.eq(toDecimal('0.30')));
});

test('A13. V3 + SHADOW podem coexistir (guard Fase 7A removido)', async () => {
  await __withFiscalEngineFlagsForTests({ v3: true, shadow: true }, async () => {
    assert.doesNotThrow(() => assertShadowDoesNotAuthorizeEmission());
    assert.equal(canFiscalEngineV3AndShadowCoexist(), true);
    assert.equal(isFiscalEngineV3Enabled(), true);
    assert.equal(isFiscalEngineV3ShadowEnabled(), true);
  });
});

test('A14. defaults permanecem OFF após testes', () => {
  assert.equal(isFiscalEngineV3Enabled(), false);
  assert.equal(isFiscalEngineV3ShadowEnabled(), false);
});

test('A15. network error → REQUEST_OUTCOME_UNKNOWN, não release', async () => {
  const outcome = classifyEmitRequestOutcome(Object.assign(new Error('socket timeout'), { code: 'ETIMEDOUT' }));
  assert.equal(outcome, REQUEST_OUTCOME.NETWORK_ERROR);
  const transition = resolveReservationTransition({ requestOutcome: outcome });
  assert.equal(transition.releaseReservation, false);
  assert.equal(transition.action, 'HOLD');

  const reconcile = await reconcileAuthoritativeReservationAfterEmit({
    attemptId: 'attempt-1',
    empresaId: EMP,
    allocationRequestIds: ['req-1'],
    error: Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }),
  });
  assert.equal(reconcile.outcome, REQUEST_OUTCOME.NETWORK_ERROR);
  assert.equal(reconcile.transition.releaseReservation, false);
});

test('A16. rejeição → release reserva', () => {
  const transition = resolveReservationTransition({
    requestOutcome: REQUEST_OUTCOME.REJECTED,
    providerStatus: 'rejeitado',
  });
  assert.equal(transition.releaseReservation, true);
});

test('A17. routing persiste attempt com meiNotaRecordId', async () => {
  const routing = await evaluateAuthoritativeEmissionRouting({
    empresaId: EMP,
    documentType: 'NFE',
    legacyPayload: { itens: [] },
    meiNotaRecordId: EMISSION_ID,
  });
  assert.equal(routing.route, AUTHORITY_ENGINE.LEGACY);
  const attempt = await findEmissionAttempt(routing.attemptId);
  assert.ok(attempt);
  assert.equal(attempt.emissionStableId, EMISSION_ID);
  assert.equal(attempt.attemptStatus, EMISSION_ATTEMPT_STATUS.ROUTING_LEGACY);
});

test('A18. resolveEmissionStableId prefere meiNotaRecordId', () => {
  assert.equal(
    resolveEmissionStableId({ meiNotaRecordId: EMISSION_ID, idIntegracao: 'other' }),
    EMISSION_ID,
  );
});

test('A19. CANARY not selected → LEGACY', async () => {
  registerFiscalRules([createValidatedProductionReadyCurrentStRule()]);
  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    upsertInMemoryRolloutPolicy(EMP, {
      mode: ROLLOUT_MODE.CANARY,
      enabled: true,
      canaryPercentage: 1,
      minimumShadowSamples: 0,
      readinessRequired: false,
    });
    let notSelected = false;
    for (let i = 0; i < 50; i += 1) {
      const id = randomUUID();
      const decision = await evaluateAuthorityDecision({
        empresaId: EMP,
        documentType: 'NFE',
        meiNotaRecordId: id,
      });
      if (decision.reasons.includes(AUTHORITY_DECISION_REASON.CANARY_NOT_SELECTED)) {
        notSelected = true;
        break;
      }
    }
    assert.equal(notSelected, true);
  });
});

test('A20. modo SHADOW tenant → LEGACY authoritative', async () => {
  await __withFiscalEngineFlagsForTests({ v3: true, shadow: true }, async () => {
    upsertInMemoryRolloutPolicy(EMP, { mode: ROLLOUT_MODE.SHADOW, enabled: true });
    const decision = await evaluateAuthorityDecision({
      empresaId: EMP,
      documentType: 'NFE',
      meiNotaRecordId: EMISSION_ID,
    });
    assert.equal(decision.engine, AUTHORITY_ENGINE.LEGACY);
    assert.ok(decision.reasons.includes(AUTHORITY_DECISION_REASON.TENANT_MODE_SHADOW));
  });
});
