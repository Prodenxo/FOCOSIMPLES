/**
 * Fase 8C — Runtime Postgres end-to-end (async boundary + prova zero fallback).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  __setFiscalConfigurationPostgresEnabledForTests,
  __resetFiscalConfigurationRepositoryServiceForTests,
  __isFiscalConfigurationPostgresEnabledForTests,
  resolveFiscalFromContextWithAccountantConfig,
  resolveFiscalFromContextWithAccountantConfigPure,
  evaluateFiscalConfigurationReadinessForTenant,
  APPROVED_RULE_MATCH_STATUS,
  ACCOUNTANT_RULE_STATUS,
  isFiscalEngineV3Enabled,
  isFiscalEngineV3ShadowEnabled,
} from '../../src/fiscal-engine/index.js';
import {
  saveAccountantApprovedRuleDraft,
  approveAccountantRuleAtomic,
  listAccountantApprovedRulesForTenant,
} from '../../src/fiscal-engine/fiscal-configuration/fiscal-configuration-repository.service.js';
import {
  resetFiscalConfigurationRepository,
  insertApprovedRuleForFixture,
  listAccountantApprovedRulesForTenant as listMemoryRulesForTenant,
} from '../../src/fiscal-engine/fiscal-configuration/fiscal-configuration-memory.repository.js';
import { buildTestFiscalContext } from './fixtures/fiscal-context-fixture.js';

const PG_E2E_TENANT = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const ACTOR_ID = '33333333-3333-3333-3333-333333333333';
const RULE_ID = 'pg-runtime-e2e-rule';

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

const STANDARD_APPROVED = {
  cfop: '5102',
  csosn: '102',
  currentOperationSt: 'NOT_DUE',
};

const buildRuntimeContext = (tenantId = PG_E2E_TENANT) => buildTestFiscalContext({
  empresaId: tenantId,
  allocation: { empresa_id: tenantId },
  issuer: { crt: 1, uf: 'RJ' },
  recipient: { uf: 'RJ', icmsTaxpayerStatus: 'NON_TAXPAYER' },
  operation: { destinationUf: 'RJ', tipo: 'VENDA' },
  item: { itemSource: 'THIRD_PARTY' },
});

const hasDatabaseUrl = () => Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);

const pgSchemaHelpers = async () => import('../../src/fiscal-engine/fiscal-configuration/fiscal-configuration.repository.js');

const seedPgTenantWithApprovedRule = async (tenantId, ruleId = RULE_ID) => {
  const draft = await saveAccountantApprovedRuleDraft({
    id: ruleId,
    tenantId,
    version: 1,
    conditions: STANDARD_CONDITIONS,
    approvedResult: STANDARD_APPROVED,
    validFrom: '2020-01-01',
    configuredBy: ACTOR_ID,
  });
  assert.equal(draft.status, ACCOUNTANT_RULE_STATUS.DRAFT);

  const approved = await approveAccountantRuleAtomic({
    tenantId,
    ruleId,
    version: 1,
    approvedBy: ACTOR_ID,
    approvedAt: new Date().toISOString(),
  });
  assert.equal(approved.status, ACCOUNTANT_RULE_STATUS.APPROVED);
  return approved;
};

const assertMemoryEmptyForTenant = (tenantId) => {
  const memoryRules = listMemoryRulesForTenant(tenantId);
  assert.equal(memoryRules.length, 0, 'memory store deve estar vazio');
};

test.beforeEach(() => __resetFiscalConfigurationRepositoryServiceForTests());
test.afterEach(async () => {
  if (hasDatabaseUrl()) {
    const { __deleteFiscalConfigurationForTenantTests } = await pgSchemaHelpers();
    await __deleteFiscalConfigurationForTenantTests(PG_E2E_TENANT);
  }
  __resetFiscalConfigurationRepositoryServiceForTests();
  resetFiscalConfigurationRepository();
});

test('8C-PG-E2E-01: pipeline async Postgres → FiscalResult (memory vazio)', async (t) => {
  if (!hasDatabaseUrl()) {
    t.skip('POSTGRES INTEGRATION: NOT EXECUTED — DATABASE_URL unavailable');
    return;
  }
  const { __ensureFiscalConfigurationSchemaForTests, __deleteFiscalConfigurationForTenantTests } = await pgSchemaHelpers();
  await __ensureFiscalConfigurationSchemaForTests();
  await __deleteFiscalConfigurationForTenantTests(PG_E2E_TENANT);

  __setFiscalConfigurationPostgresEnabledForTests(true);
  const approved = await seedPgTenantWithApprovedRule(PG_E2E_TENANT);

  const pgRules = await listAccountantApprovedRulesForTenant(PG_E2E_TENANT);
  assert.ok(pgRules.some((r) => r.id === RULE_ID && r.status === ACCOUNTANT_RULE_STATUS.APPROVED));

  resetFiscalConfigurationRepository();
  assertMemoryEmptyForTenant(PG_E2E_TENANT);

  const ctx = buildRuntimeContext();
  const result = await resolveFiscalFromContextWithAccountantConfig(ctx);

  assert.equal(result.resolutions.cfop, STANDARD_APPROVED.cfop);
  assert.equal(result.resolutions.csosn, STANDARD_APPROVED.csosn);
  assert.equal(result.audit.accountantConfig.accountantApprovedRuleId, RULE_ID);
  assert.equal(result.audit.accountantConfig.approvedBy, ACTOR_ID);
  assert.equal(result.audit.accountantConfig.ruleVersion, approved.version);
  assert.equal(result.audit.accountantConfig.matchStatus, APPROVED_RULE_MATCH_STATUS.MATCHED);
});

test('8C-PG-E2E-02: Postgres mode ignora regra existente apenas no memory', async (t) => {
  if (!hasDatabaseUrl()) {
    t.skip('POSTGRES INTEGRATION: NOT EXECUTED — DATABASE_URL unavailable');
    return;
  }
  const { __ensureFiscalConfigurationSchemaForTests, __deleteFiscalConfigurationForTenantTests } = await pgSchemaHelpers();
  await __ensureFiscalConfigurationSchemaForTests();
  await __deleteFiscalConfigurationForTenantTests(PG_E2E_TENANT);

  insertApprovedRuleForFixture({
    id: 'memory-only-rule',
    tenantId: PG_E2E_TENANT,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    conditions: STANDARD_CONDITIONS,
    approvedResult: STANDARD_APPROVED,
    validFrom: '2020-01-01',
    approvedBy: ACTOR_ID,
  });
  assert.equal(listMemoryRulesForTenant(PG_E2E_TENANT).length, 1);

  __setFiscalConfigurationPostgresEnabledForTests(true);
  const pgRules = await listAccountantApprovedRulesForTenant(PG_E2E_TENANT);
  assert.equal(pgRules.filter((r) => r.status === ACCOUNTANT_RULE_STATUS.APPROVED).length, 0);

  const result = await resolveFiscalFromContextWithAccountantConfig(buildRuntimeContext());
  assert.equal(result.resolutions.cfop, null);
  assert.equal(result.resolutions.csosn, null);
  assert.notEqual(result.audit.accountantConfig.matchStatus, APPROVED_RULE_MATCH_STATUS.MATCHED);
});

test('8C-PG-E2E-03: restart simulado — PG persiste após memory reset', async (t) => {
  if (!hasDatabaseUrl()) {
    t.skip('POSTGRES INTEGRATION: NOT EXECUTED — DATABASE_URL unavailable');
    return;
  }
  const { __ensureFiscalConfigurationSchemaForTests, __deleteFiscalConfigurationForTenantTests } = await pgSchemaHelpers();
  await __ensureFiscalConfigurationSchemaForTests();
  await __deleteFiscalConfigurationForTenantTests(PG_E2E_TENANT);

  __setFiscalConfigurationPostgresEnabledForTests(true);
  await seedPgTenantWithApprovedRule(PG_E2E_TENANT);

  const first = await resolveFiscalFromContextWithAccountantConfig(buildRuntimeContext());
  assert.equal(first.resolutions.cfop, '5102');

  resetFiscalConfigurationRepository();
  assertMemoryEmptyForTenant(PG_E2E_TENANT);

  const second = await resolveFiscalFromContextWithAccountantConfig(buildRuntimeContext());
  assert.equal(second.resolutions.cfop, '5102');
  assert.equal(second.resolutions.csosn, '102');
  assert.equal(second.audit.accountantConfig.accountantApprovedRuleId, RULE_ID);
});

test('8C-PG-E2E-04: paridade memory x Postgres (domínio puro)', async (t) => {
  if (!hasDatabaseUrl()) {
    t.skip('POSTGRES INTEGRATION: NOT EXECUTED — DATABASE_URL unavailable');
    return;
  }
  const { __ensureFiscalConfigurationSchemaForTests, __deleteFiscalConfigurationForTenantTests } = await pgSchemaHelpers();
  await __ensureFiscalConfigurationSchemaForTests();
  await __deleteFiscalConfigurationForTenantTests(PG_E2E_TENANT);

  const memoryRule = insertApprovedRuleForFixture({
    id: 'parity-rule',
    tenantId: PG_E2E_TENANT,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    conditions: STANDARD_CONDITIONS,
    approvedResult: STANDARD_APPROVED,
    validFrom: '2020-01-01',
    approvedBy: ACTOR_ID,
  });
  const ctx = buildRuntimeContext();
  const memoryResult = resolveFiscalFromContextWithAccountantConfigPure(ctx, [memoryRule]);

  resetFiscalConfigurationRepository();
  __setFiscalConfigurationPostgresEnabledForTests(true);
  const pgRule = await seedPgTenantWithApprovedRule(PG_E2E_TENANT, 'parity-rule-pg');
  const pgRules = await listAccountantApprovedRulesForTenant(PG_E2E_TENANT);
  const pgResult = await resolveFiscalFromContextWithAccountantConfig(ctx, { approvedRules: pgRules });

  assert.equal(memoryResult.resolutions.cfop, pgResult.resolutions.cfop);
  assert.equal(memoryResult.resolutions.csosn, pgResult.resolutions.csosn);
  assert.equal(memoryResult.resolutions.currentSt, pgResult.resolutions.currentSt);
  assert.equal(pgRule.approvedResult.cfop, STANDARD_APPROVED.cfop);
});

test('8C-PG-E2E-05: pipeline async memory (usePostgres=false)', async () => {
  __setFiscalConfigurationPostgresEnabledForTests(false);
  resetFiscalConfigurationRepository();

  const rule = insertApprovedRuleForFixture({
    id: 'memory-async-rule',
    tenantId: PG_E2E_TENANT,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    conditions: STANDARD_CONDITIONS,
    approvedResult: STANDARD_APPROVED,
    validFrom: '2020-01-01',
    approvedBy: ACTOR_ID,
  });

  const result = await resolveFiscalFromContextWithAccountantConfig(buildRuntimeContext());
  assert.equal(result.resolutions.cfop, STANDARD_APPROVED.cfop);
  assert.equal(result.audit.accountantConfig.accountantApprovedRuleId, rule.id);
});

test('8C-PG-E2E-06: readiness async Postgres', async (t) => {
  if (!hasDatabaseUrl()) {
    t.skip('POSTGRES INTEGRATION: NOT EXECUTED — DATABASE_URL unavailable');
    return;
  }
  const { __ensureFiscalConfigurationSchemaForTests, __deleteFiscalConfigurationForTenantTests } = await pgSchemaHelpers();
  await __ensureFiscalConfigurationSchemaForTests();
  await __deleteFiscalConfigurationForTenantTests(PG_E2E_TENANT);

  __setFiscalConfigurationPostgresEnabledForTests(true);
  await seedPgTenantWithApprovedRule(PG_E2E_TENANT);
  resetFiscalConfigurationRepository();

  const readiness = await evaluateFiscalConfigurationReadinessForTenant({
    tenantId: PG_E2E_TENANT,
    context: buildRuntimeContext(),
  });
  assert.equal(readiness.matchResult?.status, APPROVED_RULE_MATCH_STATUS.MATCHED);
});

test('8C-PG-E2E-07: flags produção OFF após runtime PG', () => {
  assert.equal(isFiscalEngineV3Enabled(), false);
  assert.equal(isFiscalEngineV3ShadowEnabled(), false);
  assert.equal(__isFiscalConfigurationPostgresEnabledForTests(), false);
});

test('8C-PG-SCHEMA-01: bootstrap schema concorrente sem deadlock', async (t) => {
  if (!hasDatabaseUrl()) {
    t.skip('POSTGRES INTEGRATION: NOT EXECUTED — DATABASE_URL unavailable');
    return;
  }
  const {
    __ensureFiscalConfigurationSchemaForTests,
    FISCAL_CONFIGURATION_PHASE8C_TEST_SCHEMA_LOCK_LABEL,
  } = await import('../../src/fiscal-engine/fiscal-configuration/fiscal-configuration.repository.js');

  assert.equal(
    FISCAL_CONFIGURATION_PHASE8C_TEST_SCHEMA_LOCK_LABEL,
    'fiscal_configuration_phase8c_test_schema',
  );

  const results = await Promise.all([
    __ensureFiscalConfigurationSchemaForTests(),
    __ensureFiscalConfigurationSchemaForTests(),
    __ensureFiscalConfigurationSchemaForTests(),
  ]);
  assert.equal(results.length, 3);
  results.forEach((r) => assert.equal(r, undefined));
});
