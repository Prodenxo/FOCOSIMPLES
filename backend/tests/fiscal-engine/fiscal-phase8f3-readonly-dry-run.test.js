/**
 * Fase 8F.3 — dry-run NF-e authoritative read-only (zero side effects).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import {
  runAuthoritativeNfeDryRunReadOnly,
  resolveNfeEmitPayloadForPlugnotas,
  evaluateAuthorityDecision,
  evaluateAuthorityDecisionForDryRunReadOnly,
  upsertInMemoryRolloutPolicy,
  __resetRolloutPolicyMemoryForTests,
  resetFiscalConfigurationRepository,
  insertApprovedRuleForFixture,
  ACCOUNTANT_RULE_STATUS,
  AUTHORITY_ENGINE,
  ROLLOUT_MODE,
  PIS_COFINS_CALCULATION_MODES,
  isFiscalEngineV3Enabled,
  __forceProductionBootstrapMemoryModeForTests,
  __resetFiscalEngineRepositoryBootstrapForTests,
  __setRolloutPolicyPostgresEnabledForTests,
  __setFiscalConfigurationPostgresEnabledForTests,
  __resetRolloutPolicyServiceForTests,
  __resetFiscalConfigurationRepositoryServiceForTests,
} from '../../src/fiscal-engine/index.js';
import { bootstrapPhase8cFixtures, PHASE8C_TENANT_ID, PHASE8C_PRODUCT_ID } from '../../src/fiscal-engine/fiscal-configuration/fixtures/phase8c-test-fixtures.js';
import { FISCAL_PROFILE_STATUS } from '../../src/fiscal-engine/fiscal-configuration/constants.js';
import { buildUsableStockLot } from './fixtures/stock-lot-builder.js';
import {
  __getLotsByIdMapForTests,
  __resetFiscalPurchaseMemoryRepo,
} from '../../src/fiscal-engine/acquisition/fiscal-purchase-memory.repository.js';
import { listEmissionAttemptsByEmpresaMemory, __resetEmissionAttemptsMemoryForTests } from '../../src/fiscal-engine/authoritative/emission-attempt-memory.repository.js';
import { getInMemoryRolloutPolicy } from '../../src/fiscal-engine/rollout/rollout-policy-memory.repository.js';
import { recalculateNfeLikePayloadTaxForEmit } from '../../src/lib/nfe-like-payload-tax-apply.js';
import {
  saveCompanyFiscalProfile,
  saveAccountantApprovedRuleDraft,
  approveAccountantRuleAtomic,
} from '../../src/fiscal-engine/fiscal-configuration/fiscal-configuration-repository.service.js';
import { saveCompanyFiscalProfile as saveCompanyFiscalProfileMemory } from '../../src/fiscal-engine/fiscal-configuration/fiscal-configuration-memory.repository.js';

const DRY_RUN_SOURCE = readFileSync(
  new URL('../../src/fiscal-engine/authoritative/authoritative-nfe-dry-run-readonly.js', import.meta.url),
  'utf8',
);

const TENANT = PHASE8C_TENANT_ID;
const PG_TENANT = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const ACTOR_ID = '33333333-3333-3333-3333-333333333333';

const STD_CONDITIONS = {
  crt: [1],
  operationType: ['VENDA'],
  operationScope: ['INTERNAL'],
  itemSource: ['THIRD_PARTY'],
  recipientTaxpayerStatus: ['NON_TAXPAYER'],
  priorStStatus: ['NO_ST_EVIDENCE'],
  issuerUf: ['RJ'],
  destinationUf: ['RJ'],
};

const ntPis = (cst = '07') => ({ cst });
const ntCofins = (cst = '08') => ({ cst });

const approvedBase = (overrides = {}) => ({
  cfop: '5102',
  csosn: '102',
  currentOperationSt: 'NOT_DUE',
  pis: ntPis(),
  cofins: ntCofins(),
  ...overrides,
});

const insertRule = (id, approvedOverrides = {}, conditionOverrides = {}) => {
  insertApprovedRuleForFixture({
    id,
    tenantId: TENANT,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 200,
    conditions: { ...STD_CONDITIONS, ...conditionOverrides },
    approvedResult: approvedBase(approvedOverrides),
    validFrom: '2020-01-01',
    approvedBy: 'acc-8f3',
  });
};

const commercialPayloadMinimal = (overrides = {}) => ({
  config: { producao: false },
  emitente: {
    cpfCnpj: '12345678000199',
    crt: 1,
    endereco: { estado: 'RJ' },
  },
  destinatario: {
    cpfCnpj: '12345678901',
    razaoSocial: 'Cliente Teste',
    indIEDest: '9',
    endereco: {
      cep: '20040020',
      logradouro: 'Rua Teste',
      numero: '100',
      bairro: 'Centro',
      codigoCidade: '3304557',
      descricaoCidade: 'Rio de Janeiro',
      estado: 'RJ',
    },
  },
  natureza: 'VENDA',
  itens: [{
    codigo: 'SKU-8F3',
    descricao: 'Produto dry-run',
    ncm: '22021000',
    cfop: '9999',
    unidade: 'UN',
    quantidade: '2.0000',
    valorUnitario: '50.00',
    valorTotal: '100.00',
    produtoCatalogoId: PHASE8C_PRODUCT_ID,
    itemSource: 'THIRD_PARTY',
    commercialSaleItemId: 'csi-8f3-minimal',
    ...((overrides.itens?.[0]) ?? {}),
  }],
  ...overrides,
});

const seedLot = (qty = '10.0000000000') => {
  const lot = buildUsableStockLot({
    empresaId: TENANT,
    produtoCatalogoId: PHASE8C_PRODUCT_ID,
    quantidade: qty,
    origem: '0',
  });
  __getLotsByIdMapForTests().set(lot.id, lot);
  return lot;
};

const dryRunParams = (lot, payloadOverrides = {}) => ({
  empresaId: TENANT,
  userId: TENANT,
  documentType: 'NFE',
  businessType: 'RESELLER',
  commercialPayload: commercialPayloadMinimal(payloadOverrides),
  rolloutPolicy: {
    empresaId: TENANT,
    mode: ROLLOUT_MODE.AUTHORITATIVE,
    enabled: true,
    configured: true,
    readinessRequired: false,
    minimumShadowSamples: 0,
  },
  inMemoryLotsByProduct: { [PHASE8C_PRODUCT_ID]: [lot] },
});

const hashPayload = (payload) => createHash('sha256').update(JSON.stringify(payload)).digest('hex');

const hasDatabaseUrl = () => Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);

const pgConfigRepo = async () => import('../../src/fiscal-engine/fiscal-configuration/fiscal-configuration.repository.js');
const pgRolloutRepo = async () => import('../../src/fiscal-engine/rollout/rollout-policy.repository.js');
const pgAttemptRepo = async () => import('../../src/fiscal-engine/authoritative/emission-attempt.repository.js');

const enablePgMode = () => {
  __setFiscalConfigurationPostgresEnabledForTests(true);
  __setRolloutPolicyPostgresEnabledForTests(true);
};

const setupPgTenant = async (tenantId = PG_TENANT) => {
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

const seedPgTenant = async (tenantId = PG_TENANT) => {
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
  await saveAccountantApprovedRuleDraft({
    id: '8f3-pg-rule',
    tenantId,
    version: 1,
    conditions: STD_CONDITIONS,
    approvedResult: approvedBase(),
    validFrom: '2020-01-01',
    configuredBy: ACTOR_ID,
  });
  await approveAccountantRuleAtomic({
    tenantId,
    ruleId: '8f3-pg-rule',
    version: 1,
    approvedBy: ACTOR_ID,
    approvedAt: new Date().toISOString(),
  });
};

const countPgRows = async (tenantId) => {
  const pool = (await import('../../src/config/pg.js')).getPgPool();
  const attemptCount = await pool.query(
    'select count(*)::int as c from fiscal_v3_emission_attempts where empresa_id = $1',
    [tenantId],
  );
  const allocCount = await pool.query(
    'select count(*)::int as c from fiscal_stock_allocation_requests where empresa_id = $1',
    [tenantId],
  );
  return {
    attempts: attemptCount.rows[0]?.c ?? 0,
    allocations: allocCount.rows[0]?.c ?? 0,
  };
};

test.beforeEach(() => {
  resetFiscalConfigurationRepository();
  bootstrapPhase8cFixtures();
  __resetRolloutPolicyMemoryForTests();
  __resetFiscalPurchaseMemoryRepo();
  __resetEmissionAttemptsMemoryForTests();
  __resetFiscalEngineRepositoryBootstrapForTests();
  upsertInMemoryRolloutPolicy(TENANT, {
    mode: ROLLOUT_MODE.AUTHORITATIVE,
    enabled: true,
    readinessRequired: false,
  });
});

test('8F3-DRY-01: dry-run usa preflight read-only', async () => {
  insertRule('dry-01');
  const lot = seedLot();
  const result = await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  assert.equal(result.dryRun, true);
  assert.equal(result.preflight.ok, true);
  assert.ok(result.preflight.plannedAllocations.length > 0);
  assert.equal(result.preflight.itemPlans?.[0]?.plannedAllocations?.length > 0, true);
});

test('8F3-DRY-02: não chama prepareAuthoritativeEmissionCandidate', async () => {
  assert.equal(DRY_RUN_SOURCE.includes('prepareAuthoritativeEmissionCandidate'), false);
  assert.equal(DRY_RUN_SOURCE.includes('allocateFiscalStockForSaleItem'), false);
  assert.equal(DRY_RUN_SOURCE.includes('persistAuthorityRoutingAttempt'), false);
  insertRule('dry-02');
  const lot = seedLot();
  const result = await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  assert.equal(result.sideEffects.emissionAttemptsCreated, 0);
  assert.equal(result.sideEffects.reservationsCreated, 0);
});

test('8F3-DRY-03: planned allocation gera FiscalContext', async () => {
  insertRule('dry-03');
  const lot = seedLot();
  const result = await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  assert.ok(result.fiscal.results.length > 0);
  assert.ok(result.fiscal.results[0]?.context);
  assert.ok(result.preflight.itemPlans?.[0]?.fiscalContexts?.length > 0);
});

test('8F3-DRY-04: usa AccountantApprovedFiscalRule', async () => {
  insertRule('dry-04');
  const lot = seedLot();
  const result = await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  assert.equal(result.fiscal.results[0]?.audit?.accountantConfig?.accountantApprovedRuleId, 'dry-04');
});

test('8F3-DRY-05: CFOP chega ao authoritative payload', async () => {
  insertRule('dry-05', { cfop: '5102' });
  const lot = seedLot();
  const result = await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  assert.equal(result.ok, true);
  assert.equal(result.normalizedPayload.itens[0].cfop, '5102');
  assert.equal(result.readinessSemantics?.fiscalReady, true);
  assert.equal(result.readinessSemantics?.providerShapeReady, true);
  assert.equal(result.readinessSemantics?.readyForRealEmission, false);
  assert.equal(result.readinessSemantics?.ieHydration, 'NOT_EVALUATED');
  assert.equal(result.readinessSemantics?.ibptTransparencia, 'NOT_EVALUATED');
});

test('8F3-DRY-06: CSOSN 102 chega à bridge', async () => {
  insertRule('dry-06');
  const lot = seedLot();
  const result = await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  assert.equal(
    result.normalizedPayload.itens[0].tributos.icms.csosn
      ?? result.normalizedPayload.itens[0].tributos.icms.cst,
    '102',
  );
});

test('8F3-DRY-07: PIS chega à bridge', async () => {
  insertRule('dry-07', { pis: ntPis('07') });
  const lot = seedLot();
  const result = await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  assert.equal(result.normalizedPayload.itens[0].tributos.pis.cst, '07');
});

test('8F3-DRY-08: COFINS chega à bridge', async () => {
  insertRule('dry-08', { cofins: ntCofins('08') });
  const lot = seedLot();
  const result = await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  assert.equal(result.normalizedPayload.itens[0].tributos.cofins.cst, '08');
});

test('8F3-DRY-09: validateNfeLikePayload passa', async () => {
  insertRule('dry-09');
  const lot = seedLot();
  const result = await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  assert.equal(result.validation.ready, true);
});

test('8F3-DRY-10: normalizePlugnotasNfePayload passa', async () => {
  insertRule('dry-10');
  const lot = seedLot();
  const result = await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  assert.ok(result.normalizedPayload);
  assert.ok(Array.isArray(result.normalizedPayload.itens));
});

test('8F3-DRY-11: producao=false preservado', async () => {
  insertRule('dry-11');
  const lot = seedLot();
  const result = await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  assert.equal(result.normalizedPayload.config?.producao, false);
});

test('8F3-DRY-12: provider call = 0 e flags globais OFF', async () => {
  insertRule('dry-12');
  const lot = seedLot();
  const result = await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  assert.equal(result.sideEffects.providerCalls, 0);
  assert.equal(isFiscalEngineV3Enabled(), false);
});

test('8F3-DRY-13: emission attempt = 0 writes', async () => {
  insertRule('dry-13');
  const lot = seedLot();
  __resetEmissionAttemptsMemoryForTests();
  const before = listEmissionAttemptsByEmpresaMemory(TENANT).length;
  await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  const after = listEmissionAttemptsByEmpresaMemory(TENANT).length;
  assert.equal(before, after);
  assert.equal((await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot))).sideEffects.emissionAttemptsCreated, 0);
});

test('8F3-DRY-14: stock reservation = 0 writes', async () => {
  insertRule('dry-14');
  const lot = seedLot();
  const result = await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  assert.equal(DRY_RUN_SOURCE.includes('allocateFiscalStockForSaleItem'), false);
  assert.equal(result.sideEffects.reservationsCreated, 0);
});

test('8F3-DRY-15: quantidade estoque não muda', async () => {
  insertRule('dry-15');
  const lot = seedLot('8.0000000000');
  const before = __getLotsByIdMapForTests().get(lot.id)?.quantidade_disponivel;
  const result = await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  const after = __getLotsByIdMapForTests().get(lot.id)?.quantidade_disponivel;
  assert.equal(before, after);
  assert.equal(result.sideEffects.stockQuantityChanged, false);
});

test('8F3-DRY-16: mei_notas não recebe insert', async () => {
  insertRule('dry-16');
  const lot = seedLot();
  const result = await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  assert.equal(result.sideEffects.meiNotaCreated, false);
});

test('8F3-DRY-17: numeração não muda', async () => {
  insertRule('dry-17');
  const lot = seedLot();
  const result = await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  assert.equal(result.sideEffects.numberingChanged, false);
});

test('8F3-DRY-18: rollout não muda', async () => {
  insertRule('dry-18');
  const lot = seedLot();
  const before = JSON.stringify(getInMemoryRolloutPolicy(TENANT));
  await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  const after = JSON.stringify(getInMemoryRolloutPolicy(TENANT));
  assert.equal(before, after);
  assert.equal((await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot))).sideEffects.rolloutChanged, false);
});

test('8F3-DRY-19: accountant config inválida → dry-run NOT_READY', async () => {
  resetFiscalConfigurationRepository();
  saveCompanyFiscalProfileMemory({
    id: 'cfp-dry-19',
    tenantId: TENANT,
    companyId: TENANT,
    establishmentId: 'default',
    crt: 1,
    taxRegime: 'SIMPLES_NACIONAL',
    issuerUf: 'RJ',
    status: FISCAL_PROFILE_STATUS.ACTIVE,
    validFrom: '2020-01-01',
    approvedBy: 'acc-8f3',
    approvedAt: '2026-01-01T00:00:00.000Z',
  });
  const lot = seedLot();
  const result = await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  assert.equal(result.ok, false);
  assert.equal(result.dryRunFiscalReady, false);
  assert.equal(result.routing.route, AUTHORITY_ENGINE.BLOCKED);
});

test('8F3-DRY-20: estoque insuficiente → NOT_READY sem reservar', async () => {
  insertRule('dry-20');
  const result = await runAuthoritativeNfeDryRunReadOnly({
    ...dryRunParams(seedLot('10.0000000000')),
    inMemoryLotsByProduct: {},
  });
  assert.equal(result.ok, false);
  assert.equal(result.preflight.ok, false);
  assert.equal(result.sideEffects.reservationsCreated, 0);
});

test('8F3-DRY-21: repository PG permite reads sem writes', async (t) => {
  if (!hasDatabaseUrl()) { t.skip('DATABASE_URL unavailable'); return; }
  await setupPgTenant(PG_TENANT);
  enablePgMode();
  await seedPgTenant(PG_TENANT);
  const before = await countPgRows(PG_TENANT);
  const result = await runAuthoritativeNfeDryRunReadOnly({
    empresaId: PG_TENANT,
    documentType: 'NFE',
    businessType: 'RESELLER',
    commercialPayload: commercialPayloadMinimal(),
    rolloutPolicy: {
      empresaId: PG_TENANT,
      mode: ROLLOUT_MODE.AUTHORITATIVE,
      enabled: true,
      configured: true,
      readinessRequired: false,
      minimumShadowSamples: 0,
    },
  });
  const after = await countPgRows(PG_TENANT);
  assert.equal(before.attempts, after.attempts);
  assert.equal(before.allocations, after.allocations);
  assert.equal(result.sideEffects.emissionAttemptsCreated, 0);
  assert.equal(result.sideEffects.reservationsCreated, 0);
  __resetRolloutPolicyServiceForTests();
  __resetFiscalConfigurationRepositoryServiceForTests();
});

test('8F3-DRY-22: runtime memory não é marcado ready for real emission', async () => {
  insertRule('dry-22');
  const lot = seedLot();
  __forceProductionBootstrapMemoryModeForTests();
  const result = await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  assert.equal(result.persistence.mode, 'memory');
  assert.equal(result.persistence.readyForRealEmission, false);
});

test('8F3-DRY-23: policy minimumShadowSamples > 0 não é ignorada', async () => {
  insertRule('dry-23');
  const lot = seedLot();
  const result = await runAuthoritativeNfeDryRunReadOnly({
    ...dryRunParams(lot),
    rolloutPolicy: {
      empresaId: TENANT,
      mode: ROLLOUT_MODE.AUTHORITATIVE,
      enabled: true,
      configured: true,
      readinessRequired: true,
      minimumShadowSamples: 5,
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.readiness.ready, false);
  assert.ok(result.readiness.reasons.some((r) => r.includes('INSUFFICIENT_SHADOW_SAMPLES')));
});

test('8F3-DRY-24: nenhum fallback legacy fiscal', async () => {
  insertRule('dry-24');
  const lot = seedLot();
  let legacyCalled = false;
  const result = await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  assert.equal(result.routing.route, AUTHORITY_ENGINE.V3);
  assert.equal(result.dryRunFiscalReady, true);
  const legacyProbe = await resolveNfeEmitPayloadForPlugnotas({
    empresaId: TENANT,
    documentType: 'NFE',
    commercialPayload: commercialPayloadMinimal(),
    applyLegacyFiscalTransform: async (p) => {
      legacyCalled = true;
      return recalculateNfeLikePayloadTaxForEmit(p, { businessType: 'RESELLER' });
    },
    applyTechnicalTransforms: async (p) => p,
  });
  assert.equal(legacyProbe.engine, AUTHORITY_ENGINE.LEGACY);
  assert.equal(legacyCalled, true);
  assert.notEqual(result.routing.route, AUTHORITY_ENGINE.LEGACY);
});

test('8F3-DRY-25: mesmo input → mesmo resultado fiscal/provider', async () => {
  insertRule('dry-25');
  const lot = seedLot();
  const params = dryRunParams(lot);
  const run = async () => {
    const r = await runAuthoritativeNfeDryRunReadOnly(params);
    return hashPayload(r.normalizedPayload?.itens?.[0]?.tributos);
  };
  assert.equal(await run(), await run());
});

test('8F3-HARD-01: payload comercial com dryRunEvaluation não ativa V3 no fluxo normal', async () => {
  insertRule('hard-01');
  upsertInMemoryRolloutPolicy(TENANT, {
    mode: ROLLOUT_MODE.AUTHORITATIVE,
    enabled: true,
    readinessRequired: false,
  });
  const decision = await evaluateAuthorityDecision({
    empresaId: TENANT,
    documentType: 'NFE',
    dryRunEvaluation: true,
  });
  assert.equal(isFiscalEngineV3Enabled(), false);
  assert.equal(decision.engine, AUTHORITY_ENGINE.LEGACY);
  assert.ok(decision.reasons.includes('MASTER_SWITCH_OFF'));
});

test('8F3-HARD-02: resolveNfeEmitPayload ignora dryRunEvaluation malicioso com V3 OFF', async () => {
  insertRule('hard-02');
  let legacyCalled = false;
  const result = await resolveNfeEmitPayloadForPlugnotas({
    empresaId: TENANT,
    documentType: 'NFE',
    commercialPayload: {
      ...commercialPayloadMinimal(),
      dryRunEvaluation: true,
    },
    metadata: { dryRunEvaluation: true },
    dryRunEvaluation: true,
    applyLegacyFiscalTransform: async (p) => {
      legacyCalled = true;
      return recalculateNfeLikePayloadTaxForEmit(p, { businessType: 'RESELLER' });
    },
    applyTechnicalTransforms: async (p) => p,
  });
  assert.equal(result.engine, AUTHORITY_ENGINE.LEGACY);
  assert.equal(legacyCalled, true);
});

test('8F3-HARD-03: somente dry-run read-only bypassa master switch na avaliação', async () => {
  insertRule('hard-03');
  upsertInMemoryRolloutPolicy(TENANT, {
    mode: ROLLOUT_MODE.AUTHORITATIVE,
    enabled: true,
    configured: true,
    readinessRequired: false,
    minimumShadowSamples: 0,
  });
  const blockedNormal = await evaluateAuthorityDecision({
    empresaId: TENANT,
    documentType: 'NFE',
    dryRunEvaluation: true,
  });
  assert.equal(blockedNormal.engine, AUTHORITY_ENGINE.LEGACY);

  const dryRunDecision = await evaluateAuthorityDecisionForDryRunReadOnly({
    empresaId: TENANT,
    documentType: 'NFE',
    rolloutPolicy: {
      empresaId: TENANT,
      mode: ROLLOUT_MODE.AUTHORITATIVE,
      enabled: true,
      configured: true,
      readinessRequired: false,
      minimumShadowSamples: 0,
    },
  });
  assert.equal(dryRunDecision.engine, AUTHORITY_ENGINE.V3);
});

test('8F3-HARD-04: dry-run nunca retorna runtimeEmissionEnabled=true com V3 OFF', async () => {
  insertRule('hard-04');
  const lot = seedLot();
  const result = await runAuthoritativeNfeDryRunReadOnly(dryRunParams(lot));
  assert.equal(isFiscalEngineV3Enabled(), false);
  assert.equal(result.runtimeEmissionEnabled, false);
  assert.equal(result.persistence.readyForRealEmission, false);
  assert.equal(result.readinessSemantics?.readyForRealEmission, false);
});
