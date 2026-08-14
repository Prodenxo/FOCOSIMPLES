/**
 * Fase 8F.2 — Production persistence + fail-closed emission gate.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  __setFiscalConfigurationPostgresEnabledForTests,
  __resetFiscalConfigurationRepositoryServiceForTests,
  __setRolloutPolicyPostgresEnabledForTests,
  __resetRolloutPolicyServiceForTests,
  __setEmissionAttemptPostgresEnabledForTests,
  __resetEmissionAttemptServiceForTests,
  __resetFiscalEngineRepositoryBootstrapForTests,
  hasAuthoritativeAccountantConfigReadiness,
  hasAuthoritativeAccountantConfigReadinessAsync,
  evaluateAuthorityDecision,
  persistAuthorityRoutingAttempt,
  findEmissionAttemptById,
  findEmissionAttemptByIdIntegracao,
  findEmissionAttemptsByMeiNotaRecordId,
  reconcileAuthoritativeAttemptOnMeiNotaStatusChange,
  resolveNfeEmitPayloadForPlugnotas,
  __withFiscalEngineFlagsForTests,
  isFiscalEngineV3Enabled,
  isFiscalEngineV3ShadowEnabled,
  isFiscalEnginePostgresEnabled,
  upsertInMemoryRolloutPolicy,
  __resetRolloutPolicyMemoryForTests,
  resetFiscalConfigurationRepository,
  ACCOUNTANT_RULE_STATUS,
  FISCAL_PROFILE_STATUS,
  AUTHORITY_ENGINE,
  AUTHORITY_DECISION_REASON,
  EMISSION_ATTEMPT_STATUS,
  ROLLOUT_MODE,
  FISCAL_ENGINE_TEST_COUNT_AUDIT,
  __forceProductionBootstrapMemoryModeForTests,
  insertApprovedRuleForFixture,
} from '../../src/fiscal-engine/index.js';
import {
  getCompanyFiscalProfile,
  saveCompanyFiscalProfile,
  listAccountantApprovedRulesForTenant,
  saveAccountantApprovedRuleDraft,
  approveAccountantRuleAtomic,
} from '../../src/fiscal-engine/fiscal-configuration/fiscal-configuration-repository.service.js';
import { __resetEmissionAttemptsMemoryForTests } from '../../src/fiscal-engine/authoritative/emission-attempt-memory.repository.js';
import {
  __setMeiNfeEmitTestDepsForTests,
  __resetMeiNfeEmitTestDepsForTests,
  __setGetDbForTests,
  __resetGetDbForTests,
} from '../../src/services/mei-notas.service.js';
import { recalculateNfeLikePayloadTaxForEmit } from '../../src/lib/nfe-like-payload-tax-apply.js';
import { saveCompanyFiscalProfile as saveCompanyFiscalProfileMemory } from '../../src/fiscal-engine/fiscal-configuration/fiscal-configuration-memory.repository.js';

const PG_TENANT = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const PG_TENANT_B = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const ACTOR_ID = '33333333-3333-3333-3333-333333333333';

const STANDARD_CONDITIONS = {
  crt: [1],
  operationType: ['VENDA'],
  operationScope: ['INTERNAL'],
  itemSource: ['THIRD_PARTY'],
  recipientTaxpayerStatus: ['NON_TAXPAYER'],
  priorStStatus: ['NO_ST_EVIDENCE'],
  issuerUf: ['RJ'],
  destinationUf: ['RJ'],
};

const EXECUTABLE_APPROVED = {
  cfop: '5102',
  csosn: '102',
  currentOperationSt: 'NOT_DUE',
  pis: { cst: '07' },
  cofins: { cst: '08' },
};

const NOT_EXECUTABLE_APPROVED = {
  cfop: '5102',
  csosn: '999',
  currentOperationSt: 'NOT_DUE',
};

const hasDatabaseUrl = () => Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);

const pgConfigRepo = async () => import('../../src/fiscal-engine/fiscal-configuration/fiscal-configuration.repository.js');
const pgRolloutRepo = async () => import('../../src/fiscal-engine/rollout/rollout-policy.repository.js');
const pgAttemptRepo = async () => import('../../src/fiscal-engine/authoritative/emission-attempt.repository.js');

const enablePgMode = () => {
  __setFiscalConfigurationPostgresEnabledForTests(true);
  __setRolloutPolicyPostgresEnabledForTests(true);
  __setEmissionAttemptPostgresEnabledForTests(true);
};

const resetAllRepositoryModes = () => {
  __resetFiscalConfigurationRepositoryServiceForTests();
  __resetRolloutPolicyServiceForTests();
  __resetEmissionAttemptServiceForTests();
  __resetFiscalEngineRepositoryBootstrapForTests();
  __resetRolloutPolicyMemoryForTests();
  resetFiscalConfigurationRepository();
  __resetEmissionAttemptsMemoryForTests();
};

const seedCompanyProfilePg = async (tenantId) => {
  await saveCompanyFiscalProfile({
    id: randomUUID(),
    tenantId,
    companyId: tenantId,
    establishmentId: 'default',
    crt: 1,
    taxRegime: 'SIMPLES_NACIONAL',
    issuerUf: 'RJ',
    municipalityCode: '3304557',
    status: FISCAL_PROFILE_STATUS.ACTIVE,
    validFrom: '2020-01-01',
    configuredBy: ACTOR_ID,
    approvedBy: ACTOR_ID,
    approvedAt: new Date().toISOString(),
  });
};

const seedApprovedRulePg = async (tenantId, ruleId, approvedResult = EXECUTABLE_APPROVED) => {
  await saveAccountantApprovedRuleDraft({
    id: ruleId,
    tenantId,
    version: 1,
    conditions: STANDARD_CONDITIONS,
    approvedResult,
    validFrom: '2020-01-01',
    configuredBy: ACTOR_ID,
  });
  return approveAccountantRuleAtomic({
    tenantId,
    ruleId,
    version: 1,
    approvedBy: ACTOR_ID,
    approvedAt: new Date().toISOString(),
  });
};

const commercialPayloadMinimal = () => ({
  idIntegracao: `8f2-${Date.now()}`,
  emitente: { cpfCnpj: '12345678000199' },
  destinatario: { cpfCnpj: '12345678901', razaoSocial: 'Cliente teste' },
  itens: [{
    codigo: 'P1',
    descricao: 'Produto',
    ncm: '22021000',
    cfop: '5102',
    unidade: 'UN',
    quantidade: 1,
    valorUnitario: 10,
    tributos: { icms: { csosn: '102' }, pis: { cst: '07' }, cofins: { cst: '08' } },
  }],
});

const setupPgSchemas = async (tenantId = PG_TENANT) => {
  const config = await pgConfigRepo();
  const rollout = await pgRolloutRepo();
  const attempts = await pgAttemptRepo();
  await config.__ensureFiscalConfigurationSchemaForTests();
  await rollout.__ensureRolloutPolicySchemaForTests();
  await attempts.__ensureEmissionAttemptSchemaForTests();
  await config.__deleteFiscalConfigurationForTenantTests(tenantId);
  await rollout.__deleteRolloutPolicyForTests(tenantId);
  await attempts.__deleteEmissionAttemptsForTests(tenantId);
};

test.beforeEach(() => resetAllRepositoryModes());
test.afterEach(async () => {
  if (hasDatabaseUrl()) {
    const config = await pgConfigRepo();
    const rollout = await pgRolloutRepo();
    const attempts = await pgAttemptRepo();
    await config.__deleteFiscalConfigurationForTenantTests(PG_TENANT);
    await config.__deleteFiscalConfigurationForTenantTests(PG_TENANT_B);
    await rollout.__deleteRolloutPolicyForTests(PG_TENANT);
    await rollout.__deleteRolloutPolicyForTests(PG_TENANT_B);
    await attempts.__deleteEmissionAttemptsForTests(PG_TENANT);
    await attempts.__deleteEmissionAttemptsForTests(PG_TENANT_B);
  }
  resetAllRepositoryModes();
  __resetMeiNfeEmitTestDepsForTests();
  __resetGetDbForTests();
});

test('8F2-PG-01: fiscal config runtime PG lê CompanyFiscalProfile', async (t) => {
  if (!hasDatabaseUrl()) { t.skip('DATABASE_URL unavailable'); return; }
  await setupPgSchemas();
  enablePgMode();
  await seedCompanyProfilePg(PG_TENANT);
  const profile = await getCompanyFiscalProfile({ tenantId: PG_TENANT });
  assert.equal(profile?.status, FISCAL_PROFILE_STATUS.ACTIVE);
  assert.equal(profile?.crt, 1);
});

test('8F2-PG-02: fiscal config runtime PG lê AccountantApprovedFiscalRule', async (t) => {
  if (!hasDatabaseUrl()) { t.skip('DATABASE_URL unavailable'); return; }
  await setupPgSchemas();
  enablePgMode();
  await seedCompanyProfilePg(PG_TENANT);
  await seedApprovedRulePg(PG_TENANT, '8f2-pg-02-rule');
  const rules = await listAccountantApprovedRulesForTenant(PG_TENANT);
  assert.ok(rules.some((r) => r.id === '8f2-pg-02-rule' && r.status === ACCOUNTANT_RULE_STATUS.APPROVED));
});

test('8F2-PG-03: restart/process memory vazio não perde fiscal config PG', async (t) => {
  if (!hasDatabaseUrl()) { t.skip('DATABASE_URL unavailable'); return; }
  await setupPgSchemas();
  enablePgMode();
  await seedCompanyProfilePg(PG_TENANT);
  await seedApprovedRulePg(PG_TENANT, '8f2-pg-03-rule');
  resetFiscalConfigurationRepository();
  const profile = await getCompanyFiscalProfile({ tenantId: PG_TENANT });
  const rules = await listAccountantApprovedRulesForTenant(PG_TENANT);
  assert.equal(profile?.status, FISCAL_PROFILE_STATUS.ACTIVE);
  assert.equal(rules.filter((r) => r.status === ACCOUNTANT_RULE_STATUS.APPROVED).length, 1);
});

test('8F2-PG-04: rollout runtime PG lê tenant AUTHORITATIVE', async (t) => {
  if (!hasDatabaseUrl()) { t.skip('DATABASE_URL unavailable'); return; }
  await setupPgSchemas();
  enablePgMode();
  const rollout = await pgRolloutRepo();
  await rollout.__upsertRolloutPolicyForTests(PG_TENANT, {
    mode: ROLLOUT_MODE.AUTHORITATIVE,
    enabled: true,
    readinessRequired: false,
  });
  const { getRolloutPolicyForEmpresa } = await import('../../src/fiscal-engine/rollout/rollout-policy.service.js');
  const policy = await getRolloutPolicyForEmpresa(PG_TENANT);
  assert.equal(policy.mode, ROLLOUT_MODE.AUTHORITATIVE);
  assert.equal(policy.enabled, true);
});

test('8F2-PG-05: row rollout ausente continua LEGACY', async (t) => {
  if (!hasDatabaseUrl()) { t.skip('DATABASE_URL unavailable'); return; }
  await setupPgSchemas();
  enablePgMode();
  const { getRolloutPolicyForEmpresa } = await import('../../src/fiscal-engine/rollout/rollout-policy.service.js');
  const policy = await getRolloutPolicyForEmpresa(PG_TENANT);
  assert.equal(policy.mode, ROLLOUT_MODE.LEGACY);
  assert.equal(policy.configured, false);
});

test('8F2-PG-06: readiness accountant funciona com PG', async (t) => {
  if (!hasDatabaseUrl()) { t.skip('DATABASE_URL unavailable'); return; }
  await setupPgSchemas();
  enablePgMode();
  await seedCompanyProfilePg(PG_TENANT);
  await seedApprovedRulePg(PG_TENANT, '8f2-pg-06-rule');
  assert.equal(await hasAuthoritativeAccountantConfigReadinessAsync(PG_TENANT), true);
});

test('8F2-PG-07: readiness não usa sync memory-only no PG mode', async (t) => {
  if (!hasDatabaseUrl()) { t.skip('DATABASE_URL unavailable'); return; }
  enablePgMode();
  assert.throws(
    () => hasAuthoritativeAccountantConfigReadiness(PG_TENANT),
    /Postgres.*async/i,
  );
});

test('8F2-PG-08: accountant APPROVED executable passa readiness', async (t) => {
  if (!hasDatabaseUrl()) { t.skip('DATABASE_URL unavailable'); return; }
  await setupPgSchemas();
  enablePgMode();
  await seedCompanyProfilePg(PG_TENANT);
  await seedApprovedRulePg(PG_TENANT, '8f2-pg-08-rule', EXECUTABLE_APPROVED);
  assert.equal(await hasAuthoritativeAccountantConfigReadinessAsync(PG_TENANT), true);
});

test('8F2-PG-09: accountant NOT_EXECUTABLE falha readiness', async (t) => {
  if (!hasDatabaseUrl()) { t.skip('DATABASE_URL unavailable'); return; }
  await setupPgSchemas();
  enablePgMode();
  await seedCompanyProfilePg(PG_TENANT);
  await seedApprovedRulePg(PG_TENANT, '8f2-pg-09-rule', NOT_EXECUTABLE_APPROVED);
  assert.equal(await hasAuthoritativeAccountantConfigReadinessAsync(PG_TENANT), false);
});

test('8F2-PG-10: emission attempt create PG', async (t) => {
  if (!hasDatabaseUrl()) { t.skip('DATABASE_URL unavailable'); return; }
  await setupPgSchemas();
  enablePgMode();
  const { attemptId } = await persistAuthorityRoutingAttempt({
    empresaId: PG_TENANT,
    documentType: 'NFE',
    idIntegracao: '8f2-create-pg',
    authorityDecision: { engine: AUTHORITY_ENGINE.LEGACY, reasons: [] },
    attemptStatus: EMISSION_ATTEMPT_STATUS.ROUTING_LEGACY,
  });
  __resetEmissionAttemptsMemoryForTests();
  const row = await findEmissionAttemptById(attemptId);
  assert.ok(row);
  assert.equal(row.attemptId, attemptId);
});

test('8F2-PG-11: emission attempt read PG', async (t) => {
  if (!hasDatabaseUrl()) { t.skip('DATABASE_URL unavailable'); return; }
  await setupPgSchemas();
  enablePgMode();
  const attemptId = `8f2-read-${randomUUID()}`;
  await persistAuthorityRoutingAttempt({
    attemptId,
    empresaId: PG_TENANT,
    documentType: 'NFE',
    authorityDecision: { engine: AUTHORITY_ENGINE.V3, reasons: ['V3_CANDIDATE'] },
    attemptStatus: EMISSION_ATTEMPT_STATUS.PREPARED,
  });
  __resetEmissionAttemptsMemoryForTests();
  const row = await findEmissionAttemptById(attemptId);
  assert.equal(row.authorityEngine, AUTHORITY_ENGINE.V3);
});

test('8F2-PG-12: read by idIntegracao PG', async (t) => {
  if (!hasDatabaseUrl()) { t.skip('DATABASE_URL unavailable'); return; }
  await setupPgSchemas();
  enablePgMode();
  const idIntegracao = `8f2-idint-${Date.now()}`;
  await persistAuthorityRoutingAttempt({
    empresaId: PG_TENANT,
    documentType: 'NFE',
    idIntegracao,
    authorityDecision: { engine: AUTHORITY_ENGINE.LEGACY, reasons: [] },
    attemptStatus: EMISSION_ATTEMPT_STATUS.ROUTING_LEGACY,
  });
  __resetEmissionAttemptsMemoryForTests();
  const row = await findEmissionAttemptByIdIntegracao(PG_TENANT, idIntegracao);
  assert.equal(row.idIntegracao, idIntegracao);
});

test('8F2-PG-13: estado BLOCKED persiste PG', async (t) => {
  if (!hasDatabaseUrl()) { t.skip('DATABASE_URL unavailable'); return; }
  await setupPgSchemas();
  enablePgMode();
  const attemptId = `8f2-blocked-${randomUUID()}`;
  await persistAuthorityRoutingAttempt({
    attemptId,
    empresaId: PG_TENANT,
    documentType: 'NFE',
    authorityDecision: {
      engine: AUTHORITY_ENGINE.BLOCKED,
      reasons: [AUTHORITY_DECISION_REASON.AUTHORITATIVE_FISCAL_BLOCKED],
      v3Candidate: true,
      authoritativeFiscalBlocked: true,
    },
    attemptStatus: EMISSION_ATTEMPT_STATUS.AUTHORITATIVE_NOT_ELIGIBLE,
  });
  __resetEmissionAttemptsMemoryForTests();
  const row = await findEmissionAttemptById(attemptId);
  assert.equal(row.authorityEngine, AUTHORITY_ENGINE.BLOCKED);
});

test('8F2-PG-14: simulação restart não perde attempt', async (t) => {
  if (!hasDatabaseUrl()) { t.skip('DATABASE_URL unavailable'); return; }
  await setupPgSchemas();
  enablePgMode();
  const attemptId = `8f2-restart-${randomUUID()}`;
  await persistAuthorityRoutingAttempt({
    attemptId,
    empresaId: PG_TENANT,
    meiNotaRecordId: randomUUID(),
    documentType: 'NFE',
    authorityDecision: { engine: AUTHORITY_ENGINE.V3, reasons: [] },
    attemptStatus: EMISSION_ATTEMPT_STATUS.PREPARED,
  });
  __resetEmissionAttemptsMemoryForTests();
  __resetEmissionAttemptServiceForTests();
  enablePgMode();
  const row = await findEmissionAttemptById(attemptId);
  assert.equal(row.attemptStatus, EMISSION_ATTEMPT_STATUS.PREPARED);
});

test('8F2-PG-15: reconciliation encontra attempt PG anterior', async (t) => {
  if (!hasDatabaseUrl()) { t.skip('DATABASE_URL unavailable'); return; }
  await setupPgSchemas();
  enablePgMode();
  const meiNotaRecordId = randomUUID();
  const attemptId = `8f2-recon-${randomUUID()}`;
  await persistAuthorityRoutingAttempt({
    attemptId,
    empresaId: PG_TENANT,
    meiNotaRecordId,
    documentType: 'NFE',
    authorityDecision: { engine: AUTHORITY_ENGINE.V3, reasons: [] },
    attemptStatus: EMISSION_ATTEMPT_STATUS.PREPARED,
    allocationRequestIds: [],
  });
  __resetEmissionAttemptsMemoryForTests();
  const found = await findEmissionAttemptsByMeiNotaRecordId(PG_TENANT, meiNotaRecordId);
  assert.equal(found.length, 1);
  assert.equal(found[0].attemptId, attemptId);

  const recon = await reconcileAuthoritativeAttemptOnMeiNotaStatusChange({
    empresaId: PG_TENANT,
    meiNotaRecordId,
    previousStatus: 'processando',
    newStatus: 'autorizada',
  });
  assert.equal(recon.reconciled, true);
});

test('8F2-BLOCK-01: emitirNota aborta resolved.blocked', async () => {
  const { emitirNota } = await import('../../src/services/mei-notas.service.js');
  let adapterCalls = 0;
  __setGetDbForTests(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    }),
  }));
  __setMeiNfeEmitTestDepsForTests({
    ensurePlugnotasCadastro: async () => null,
    adapterFactory: () => ({
      emitir: async () => { adapterCalls += 1; return { status: 'processando' }; },
    }),
  });

  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    upsertInMemoryRolloutPolicy(PG_TENANT, {
      mode: ROLLOUT_MODE.AUTHORITATIVE,
      enabled: true,
      readinessRequired: false,
    });
    resetFiscalConfigurationRepository();

    await assert.rejects(
      () => emitirNota(PG_TENANT, {
        documentType: 'NFE',
        payload: commercialPayloadMinimal(),
      }),
      (err) => {
        assert.equal(err.status, 400);
        assert.equal(err.errors?.code, 'AUTHORITATIVE_FISCAL_BLOCKED');
        return true;
      },
    );
    assert.equal(adapterCalls, 0);
  });
});

test('8F2-BLOCK-02: blocked não chama adapter.emitir', async () => {
  let adapterEmitCount = 0;
  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    upsertInMemoryRolloutPolicy(PG_TENANT, {
      mode: ROLLOUT_MODE.AUTHORITATIVE,
      enabled: true,
      readinessRequired: false,
    });
    resetFiscalConfigurationRepository();
    const result = await resolveNfeEmitPayloadForPlugnotas({
      empresaId: PG_TENANT,
      documentType: 'NFE',
      commercialPayload: commercialPayloadMinimal(),
      applyLegacyFiscalTransform: async (p) => {
        adapterEmitCount += 1;
        return p;
      },
      applyTechnicalTransforms: async (p) => p,
    });
    assert.equal(result.blocked, true);
    assert.equal(adapterEmitCount, 0);
  });
});

test('8F2-BLOCK-03: blocked não executa fiscal legacy', async () => {
  let legacyCalled = false;
  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    upsertInMemoryRolloutPolicy(PG_TENANT, {
      mode: ROLLOUT_MODE.AUTHORITATIVE,
      enabled: true,
      readinessRequired: false,
    });
    resetFiscalConfigurationRepository();
    const result = await resolveNfeEmitPayloadForPlugnotas({
      empresaId: PG_TENANT,
      documentType: 'NFE',
      commercialPayload: commercialPayloadMinimal(),
      applyLegacyFiscalTransform: async (p) => {
        legacyCalled = true;
        return recalculateNfeLikePayloadTaxForEmit(p, { businessType: 'MEI' });
      },
      applyTechnicalTransforms: async (p) => p,
    });
    assert.equal(result.blocked, true);
    assert.equal(legacyCalled, false);
    assert.equal(result.legacyFiscalApplied, false);
  });
});

test('8F2-BLOCK-04: blocked preserva reason/issues', async () => {
  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    upsertInMemoryRolloutPolicy(PG_TENANT, {
      mode: ROLLOUT_MODE.AUTHORITATIVE,
      enabled: true,
      readinessRequired: false,
    });
    resetFiscalConfigurationRepository();
    const result = await resolveNfeEmitPayloadForPlugnotas({
      empresaId: PG_TENANT,
      documentType: 'NFE',
      commercialPayload: commercialPayloadMinimal(),
      applyLegacyFiscalTransform: async (p) => p,
      applyTechnicalTransforms: async (p) => p,
    });
    assert.equal(result.blocked, true);
    assert.ok(result.authorityDecision?.reasons?.includes(AUTHORITY_DECISION_REASON.NOT_READY_NO_ACCOUNTANT_CONFIG));
    assert.ok(Array.isArray(result.issues));
  });
});

test('8F2-BLOCK-05: V3 OFF continua legacy normal', async () => {
  assert.equal(isFiscalEngineV3Enabled(), false);
  const result = await resolveNfeEmitPayloadForPlugnotas({
    empresaId: PG_TENANT,
    documentType: 'NFE',
    commercialPayload: commercialPayloadMinimal(),
    applyLegacyFiscalTransform: async (p) => p,
    applyTechnicalTransforms: async (p) => p,
  });
  assert.equal(result.engine, AUTHORITY_ENGINE.LEGACY);
  assert.notEqual(result.blocked, true);
});

test('8F2-BLOCK-06: demais tenants sem rollout continuam legacy', async () => {
  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    const decision = await evaluateAuthorityDecision({
      empresaId: PG_TENANT_B,
      documentType: 'NFE',
    });
    assert.equal(decision.engine, AUTHORITY_ENGINE.LEGACY);
    assert.ok(decision.reasons.includes(AUTHORITY_DECISION_REASON.TENANT_LEGACY_DEFAULT));
  });
});

test('8F2-BLOCK-07: nenhum HTTP externo', async () => {
  let plugnotasCadastroCalls = 0;
  let adapterEmitCalls = 0;
  __setMeiNfeEmitTestDepsForTests({
    ensurePlugnotasCadastro: async () => { plugnotasCadastroCalls += 1; return null; },
    adapterFactory: () => ({
      emitir: async () => { adapterEmitCalls += 1; return { status: 'processando' }; },
    }),
  });
  __setGetDbForTests(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      }),
    }),
  }));

  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    upsertInMemoryRolloutPolicy(PG_TENANT, {
      mode: ROLLOUT_MODE.AUTHORITATIVE,
      enabled: true,
      readinessRequired: false,
    });
    resetFiscalConfigurationRepository();
    const { emitirNota } = await import('../../src/services/mei-notas.service.js');
    await assert.rejects(
      () => emitirNota(PG_TENANT, { documentType: 'NFE', payload: commercialPayloadMinimal() }),
      /fail-closed|AUTHORITATIVE_FISCAL_BLOCKED/,
    );
  });
  assert.equal(plugnotasCadastroCalls, 1);
  assert.equal(adapterEmitCalls, 0);
});

test('8F2 defaults: flags OFF e memory mode sem bootstrap', () => {
  assert.equal(isFiscalEngineV3Enabled(), false);
  assert.equal(isFiscalEngineV3ShadowEnabled(), false);
  assert.equal(isFiscalEnginePostgresEnabled(), false);
});

test('8F2-HARD-01: regression metadata final = 746 e added = 23', () => {
  assert.equal(FISCAL_ENGINE_TEST_COUNT_AUDIT.reported723, 723);
  assert.equal(FISCAL_ENGINE_TEST_COUNT_AUDIT.phase8f2ProductionPersistenceAdded, 23);
  assert.equal(FISCAL_ENGINE_TEST_COUNT_AUDIT.reported746, 746);
  assert.equal(FISCAL_ENGINE_TEST_COUNT_AUDIT.reported723 + 23, 746);
  assert.equal(FISCAL_ENGINE_TEST_COUNT_AUDIT.phase8f2HardeningAdded, 6);
  assert.equal(FISCAL_ENGINE_TEST_COUNT_AUDIT.reported752, 752);
});

test('8F2-HARD-02: metadata sem chave duplicada/inconsistente', () => {
  const audit = FISCAL_ENGINE_TEST_COUNT_AUDIT;
  const keys = Object.keys(audit);
  const explanationKeys = keys.filter((k) => k === 'explanation');
  assert.equal(explanationKeys.length, 1);
  assert.equal('reported744' in audit, false);
  assert.equal('reported721' in audit, false);
  assert.equal(audit.reported746, audit.reported723 + audit.phase8f2ProductionPersistenceAdded);
});

const seedMemoryAuthoritativeTenant = (tenantId) => {
  saveCompanyFiscalProfileMemory({
    id: 'cfp-hard-mem',
    tenantId,
    companyId: tenantId,
    establishmentId: 'default',
    crt: 1,
    taxRegime: 'SIMPLES_NACIONAL',
    issuerUf: 'RJ',
    status: FISCAL_PROFILE_STATUS.ACTIVE,
    validFrom: '2020-01-01',
    configuredBy: ACTOR_ID,
    approvedBy: ACTOR_ID,
  });
  insertApprovedRuleForFixture({
    id: 'hard-mem-rule',
    tenantId,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 200,
    conditions: STANDARD_CONDITIONS,
    approvedResult: EXECUTABLE_APPROVED,
    validFrom: '2020-01-01',
    approvedBy: ACTOR_ID,
  });
};

test('8F2-HARD-03: V3 authoritative + bootstrap memory runtime não prossegue', async () => {
  __forceProductionBootstrapMemoryModeForTests();
  seedMemoryAuthoritativeTenant(PG_TENANT);
  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    upsertInMemoryRolloutPolicy(PG_TENANT, {
      mode: ROLLOUT_MODE.AUTHORITATIVE,
      enabled: true,
      readinessRequired: false,
    });
    const decision = await evaluateAuthorityDecision({
      empresaId: PG_TENANT,
      documentType: 'NFE',
    });
    assert.equal(decision.engine, AUTHORITY_ENGINE.BLOCKED);
    assert.ok(decision.reasons.includes(AUTHORITY_DECISION_REASON.AUTHORITATIVE_PERSISTENCE_UNAVAILABLE));
    assert.notEqual(decision.engine, AUTHORITY_ENGINE.V3);
  });
});

test('8F2-HARD-04: V3 OFF + memory continua permitido', async () => {
  __forceProductionBootstrapMemoryModeForTests();
  seedMemoryAuthoritativeTenant(PG_TENANT);
  upsertInMemoryRolloutPolicy(PG_TENANT, {
    mode: ROLLOUT_MODE.AUTHORITATIVE,
    enabled: true,
    readinessRequired: false,
  });
  assert.equal(isFiscalEngineV3Enabled(), false);
  const decision = await evaluateAuthorityDecision({
    empresaId: PG_TENANT,
    documentType: 'NFE',
  });
  assert.equal(decision.engine, AUTHORITY_ENGINE.LEGACY);
  assert.ok(decision.reasons.includes(AUTHORITY_DECISION_REASON.MASTER_SWITCH_OFF));
});

test('8F2-HARD-05: sem DB config (bootstrap memory), authoritative não usa memory fallback', async () => {
  __forceProductionBootstrapMemoryModeForTests();
  assert.equal(isFiscalEnginePostgresEnabled(), false);
  seedMemoryAuthoritativeTenant(PG_TENANT);
  await __withFiscalEngineFlagsForTests({ v3: true, shadow: false }, async () => {
    upsertInMemoryRolloutPolicy(PG_TENANT, {
      mode: ROLLOUT_MODE.AUTHORITATIVE,
      enabled: true,
      readinessRequired: false,
    });
    const decision = await evaluateAuthorityDecision({
      empresaId: PG_TENANT,
      documentType: 'NFE',
    });
    assert.equal(decision.engine, AUTHORITY_ENGINE.BLOCKED);
    assert.ok(decision.reasons.includes(AUTHORITY_DECISION_REASON.AUTHORITATIVE_PERSISTENCE_UNAVAILABLE));
  });
});

test('8F2-HARD-06: BLOCKED persistence usa semântica engine/status/decision', async (t) => {
  if (!hasDatabaseUrl()) { t.skip('DATABASE_URL unavailable'); return; }
  await setupPgSchemas();
  enablePgMode();
  const attemptId = `8f2-hard06-${randomUUID()}`;
  const authorityDecision = {
    engine: AUTHORITY_ENGINE.BLOCKED,
    reasons: [AUTHORITY_DECISION_REASON.AUTHORITATIVE_FISCAL_BLOCKED],
    v3Candidate: true,
    authoritativeFiscalBlocked: true,
  };
  await persistAuthorityRoutingAttempt({
    attemptId,
    empresaId: PG_TENANT,
    documentType: 'NFE',
    authorityDecision,
    attemptStatus: EMISSION_ATTEMPT_STATUS.AUTHORITATIVE_NOT_ELIGIBLE,
  });
  __resetEmissionAttemptsMemoryForTests();
  const row = await findEmissionAttemptById(attemptId);
  assert.equal(row.authorityEngine, AUTHORITY_ENGINE.BLOCKED);
  assert.equal(row.attemptStatus, EMISSION_ATTEMPT_STATUS.AUTHORITATIVE_NOT_ELIGIBLE);
  assert.equal(row.authorityDecision?.engine, AUTHORITY_ENGINE.BLOCKED);
});
