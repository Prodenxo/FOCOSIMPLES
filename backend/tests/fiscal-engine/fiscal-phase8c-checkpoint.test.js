/**
 * Fase 8C Checkpoint Gate — persistência, runtime, API, immutability.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createServer } from 'node:http';
import {
  __setFiscalConfigurationPostgresEnabledForTests,
  __resetFiscalConfigurationRepositoryServiceForTests,
  __isFiscalConfigurationPostgresEnabledForTests,
  listAccountantApprovedRulesForTenantSync,
  detectForbiddenMatchConditions,
  validateAccountantRuleForApproval,
  previewAccountantFiscalRule,
  resolveFiscalFromContextWithAccountantConfig,
  createAccountantApprovedRuleDraft,
  approveAccountantFiscalRule,
  createAccountantRuleNewVersion,
  suspendAccountantFiscalRule,
  getAccountantApprovedRule,
  assertActorPermission,
  isFiscalEngineV3Enabled,
  isFiscalEngineV3ShadowEnabled,
  ACCOUNTANT_RULE_STATUS,
  FISCAL_CONFIG_PERMISSIONS,
} from '../../src/fiscal-engine/index.js';
import { createFiscalConfigurationRouter } from '../../src/routes/fiscal-configuration.routes.js';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import { __setFiscalConfigMiddlewareDepsForTests } from '../../src/middlewares/requireFiscalConfiguration.js';
import { buildTestFiscalContext } from './fixtures/fiscal-context-fixture.js';
import { runFiscalConfigurationRepositoryContractTests } from './helpers/fiscal-configuration-repository.contract.js';

const TENANT = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const ACTOR_ID = '33333333-3333-3333-3333-333333333333';
const PRODUCT_ID = '44444444-4444-4444-4444-444444444444';
const CUSTOMER_ID = '55555555-5555-5555-5555-555555555555';

const adminActor = { userId: ACTOR_ID, empresaId: TENANT };
const adminActorContext = { profileRole: 'admin', memberships: [{ role: 'admin' }] };
const outsiderActorContext = { profileRole: 'outsider', memberships: [{ role: 'outsider' }] };

test.beforeEach(() => __resetFiscalConfigurationRepositoryServiceForTests());
test.afterEach(() => {
  __resetFiscalConfigurationRepositoryServiceForTests();
  __setFiscalConfigMiddlewareDepsForTests({});
});

const listenApp = (app) => new Promise((resolve) => {
  const server = createServer(app);
  server.listen(0, () => resolve(server));
});

const buildHttpApp = (actorContext = adminActorContext) => {
  __setFiscalConfigMiddlewareDepsForTests({
    getRequesterContext: async () => ({
      userId: ACTOR_ID,
      empresaId: TENANT,
    }),
    resolveActorMembershipsForUser: async () => ({
      profileRole: actorContext.profileRole,
      memberships: actorContext.memberships,
      hasSuperadminCapability: false,
      hasActiveMembership: true,
    }),
  });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: ACTOR_ID };
    req.accessToken = 'test-token';
    next();
  });
  app.use('/api/fiscal/configuration', createFiscalConfigurationRouter({
    requireAuth: (_req, _res, next) => next(),
  }));
  app.use(errorHandler);
  return app;
};

// --- Architecture ---
test('8C-CK-A: resolve-with-accountant-config não importa memory repository diretamente', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../../src/fiscal-engine/fiscal-configuration/resolve-with-accountant-config.js', import.meta.url)),
    'utf8',
  );
  assert.doesNotMatch(src, /fiscal-configuration-memory\.repository/);
  assert.match(src, /fiscal-configuration-loader/);
});

test('8C-CK-B: usePostgres=true não faz fallback memory no sync accessor', () => {
  __setFiscalConfigurationPostgresEnabledForTests(true);
  assert.throws(
    () => listAccountantApprovedRulesForTenantSync(TENANT),
    /Postgres.*async/i,
  );
});

// --- Forbidden conditions ---
test('8C-CK-C: forbidden match condition gera issue explícita', () => {
  const issues = detectForbiddenMatchConditions({ currentOperationSt: ['RETAINED'] });
  assert.ok(issues.some((i) => i.code === 'FORBIDDEN_MATCH_CONDITION'));
  const validation = validateAccountantRuleForApproval({
    conditions: { currentOperationSt: ['RETAINED'], crt: [1] },
    approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
  });
  assert.equal(validation.ok, false);
});

test('8C-CK-D: stApplicabilityStatus sem provenance rejeitado', () => {
  const issues = detectForbiddenMatchConditions({ stApplicabilityStatus: ['APPLICABLE'] });
  assert.ok(issues.length > 0);
});

// --- Memory contract ---
test('8C-CK-E: repository contract — memory', async () => {
  await runFiscalConfigurationRepositoryContractTests({
    label: 'memory',
    setup: async () => {
      __setFiscalConfigurationPostgresEnabledForTests(false);
      __resetFiscalConfigurationRepositoryServiceForTests();
    },
    teardown: async () => __resetFiscalConfigurationRepositoryServiceForTests(),
    tenantId: TENANT,
    actorId: ACTOR_ID,
    productId: PRODUCT_ID,
    customerId: CUSTOMER_ID,
  });
});

// --- Postgres contract (optional) ---
test('8C-CK-F: repository contract — postgres', async (t) => {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
    t.skip('POSTGRES INTEGRATION: NOT EXECUTED — DATABASE_URL unavailable');
    return;
  }
  const {
    __ensureFiscalConfigurationSchemaForTests,
    __deleteFiscalConfigurationForTenantTests,
    __deleteGlobalFiscalConfigurationForTests,
  } = await import('../../src/fiscal-engine/fiscal-configuration/fiscal-configuration.repository.js');
  const PG_CONTRACT_TENANT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  await __ensureFiscalConfigurationSchemaForTests();
  await __deleteFiscalConfigurationForTenantTests(PG_CONTRACT_TENANT);
  await __deleteGlobalFiscalConfigurationForTests();
  __setFiscalConfigurationPostgresEnabledForTests(true);
  await runFiscalConfigurationRepositoryContractTests({
    label: 'postgres',
    setup: async () => {},
    teardown: async () => {
      await __deleteFiscalConfigurationForTenantTests(PG_CONTRACT_TENANT);
      __setFiscalConfigurationPostgresEnabledForTests(false);
    },
    tenantId: PG_CONTRACT_TENANT,
    actorId: ACTOR_ID,
    productId: PRODUCT_ID,
    customerId: CUSTOMER_ID,
  });
});

// --- HTTP API ---
test('8C-CK-G: HTTP 401 sem autenticação', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/fiscal/configuration', createFiscalConfigurationRouter());
  app.use(errorHandler);
  const server = await listenApp(app);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/fiscal/configuration/rules`);
    assert.equal(res.status, 401);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('8C-CK-H: HTTP GET rules — view permitido para admin', async () => {
  const app = buildHttpApp(adminActorContext);
  const server = await listenApp(app);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/fiscal/configuration/rules`);
    assert.equal(res.status, 200);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('8C-CK-I: HTTP GET rules — negado sem view permission', async () => {
  const app = buildHttpApp(outsiderActorContext);
  const server = await listenApp(app);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/fiscal/configuration/rules`);
    assert.equal(res.status, 403);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('8C-CK-J: HTTP approve — actor real persistido, payload approvedBy ignorado', async () => {
  const draft = await createAccountantApprovedRuleDraft({
    id: 'http-rule-1',
    tenantId: TENANT,
    conditions: { crt: [1], operationType: ['VENDA'], operationScope: ['INTERNAL'], itemSource: ['THIRD_PARTY'], recipientTaxpayerStatus: ['NON_TAXPAYER'], priorStStatus: ['NO_ST_EVIDENCE'], issuerUf: ['RJ'], destinationUf: ['RJ'] },
    approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
    validFrom: '2020-01-01',
  }, adminActor, adminActorContext);

  const app = buildHttpApp(adminActorContext);
  const server = await listenApp(app);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/fiscal/configuration/rules/${draft.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedBy: 'spoof-user', justification: 'ok' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.rule.approvedBy, ACTOR_ID);
    assert.notEqual(body.rule.approvedBy, 'spoof-user');
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('8C-CK-K: HTTP preview não altera repository', async () => {
  await createAccountantApprovedRuleDraft({
    id: 'preview-rule',
    tenantId: TENANT,
    conditions: { crt: [1] },
    approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
    validFrom: '2020-01-01',
  }, adminActor, adminActorContext);
  const before = JSON.stringify(await import('../../src/fiscal-engine/fiscal-configuration/fiscal-configuration-repository.service.js').then((m) => m.listAccountantApprovedRulesForTenant(TENANT)));

  const app = buildHttpApp(adminActorContext);
  const server = await listenApp(app);
  const port = server.address().port;
  try {
    await fetch(`http://127.0.0.1:${port}/api/fiscal/configuration/rules/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rule: {
          conditions: { crt: [1], currentOperationSt: ['RETAINED'] },
          approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
        },
      }),
    });
    const after = JSON.stringify(await import('../../src/fiscal-engine/fiscal-configuration/fiscal-configuration-repository.service.js').then((m) => m.listAccountantApprovedRulesForTenant(TENANT)));
    assert.equal(before, after);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

// --- Full flow ---
test('8C-CK-L: fluxo contador → usuário sem CFOP/CSOSN', async () => {
  __setFiscalConfigurationPostgresEnabledForTests(false);
  const draft = await createAccountantApprovedRuleDraft({
    id: 'flow-rule',
    tenantId: TENANT,
    conditions: {
      crt: [1], operationType: ['VENDA'], operationScope: ['INTERNAL'],
      itemSource: ['THIRD_PARTY'], recipientTaxpayerStatus: ['NON_TAXPAYER'],
      priorStStatus: ['NO_ST_EVIDENCE'], issuerUf: ['RJ'], destinationUf: ['RJ'],
    },
    approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
    validFrom: '2020-01-01',
  }, adminActor, adminActorContext);
  previewAccountantFiscalRule(draft);
  await approveAccountantFiscalRule(TENANT, draft.id, adminActor, adminActorContext);

  const ctx = buildTestFiscalContext({
    empresaId: TENANT,
    allocation: { empresa_id: TENANT },
    issuer: { crt: 1, uf: 'RJ' },
    recipient: { uf: 'RJ', icmsTaxpayerStatus: 'NON_TAXPAYER' },
    operation: { destinationUf: 'RJ', tipo: 'VENDA' },
    item: { itemSource: 'THIRD_PARTY' },
  });
  const result = await resolveFiscalFromContextWithAccountantConfig(ctx);
  assert.equal(result.resolutions.cfop, '5102');
  assert.equal(result.resolutions.csosn, '102');
});

test('8C-CK-M: flags produção OFF', () => {
  assert.equal(isFiscalEngineV3Enabled(), false);
  assert.equal(isFiscalEngineV3ShadowEnabled(), false);
  assert.equal(__isFiscalConfigurationPostgresEnabledForTests(), false);
});

test('8C-CK-N: nova versão exige nova aprovação', async () => {
  const draft = await createAccountantApprovedRuleDraft({
    id: 'version-rule',
    tenantId: TENANT,
    conditions: { crt: [1], operationType: ['VENDA'] },
    approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
    validFrom: '2020-01-01',
  }, adminActor, adminActorContext);
  await approveAccountantFiscalRule(TENANT, draft.id, adminActor, adminActorContext);
  const v2 = await createAccountantRuleNewVersion(TENANT, draft.id, {
    approvedResult: { cfop: '5101', csosn: '102', currentOperationSt: 'NOT_DUE' },
  }, adminActor, adminActorContext);
  assert.equal(v2.status, ACCOUNTANT_RULE_STATUS.DRAFT);
  assert.equal(v2.approvedBy, null);
  const v1 = getAccountantApprovedRule(TENANT, draft.id, 1);
  assert.equal(v1.status, ACCOUNTANT_RULE_STATUS.APPROVED);
  assert.equal(v1.approvedResult.cfop, '5102');
});

test('8C-CK-O: suspend/revoke exigem permission', async () => {
  const draft = await createAccountantApprovedRuleDraft({
    id: 'suspend-rule',
    tenantId: TENANT,
    conditions: { crt: [1], operationType: ['VENDA'] },
    approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
    validFrom: '2020-01-01',
  }, adminActor, adminActorContext);
  await approveAccountantFiscalRule(TENANT, draft.id, adminActor, adminActorContext);
  assert.throws(
    () => assertActorPermission(outsiderActorContext, FISCAL_CONFIG_PERMISSIONS.SUSPEND),
    (e) => e.code === 'FISCAL_CONFIG_FORBIDDEN',
  );
  const suspended = await suspendAccountantFiscalRule(TENANT, draft.id, adminActor, adminActorContext);
  assert.equal(suspended.status, ACCOUNTANT_RULE_STATUS.SUSPENDED);
  assert.equal(suspended.suspendedBy, ACTOR_ID);
});
