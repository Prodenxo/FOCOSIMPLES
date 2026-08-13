/**
 * Fase 8C Hardening — productionReady separation, capability gate, security, immutability.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFiscalRulesFromApprovedRule,
  isAccountantApprovedConfigurationRule,
  FISCAL_RULE_SOURCE_TYPE,
  validateAccountantRuleForApproval,
  previewAccountantFiscalRule,
  evaluateAccountantRuleEngineCapability,
  resolveFiscalFromContextWithAccountantConfig,
  normalizeResolverOptions,
  normalizeTestOnlyResolverOptions,
  isRuleEligibleForExecution,
  sanitizeMatchConditions,
  FORBIDDEN_MATCH_CONDITION_KEYS,
  createAccountantApprovedRuleDraft,
  approveAccountantFiscalRule,
  createAccountantRuleNewVersion,
  updateAccountantApprovedRuleDraft,
  assertActorPermission,
  saveAccountantApprovedRule,
  insertApprovedRuleForFixture,
  getAccountantApprovedRule,
  resetFiscalConfigurationRepository,
  ACCOUNTANT_RULE_STATUS,
  FISCAL_CONFIG_PERMISSIONS,
} from '../../src/fiscal-engine/index.js';
import { buildTestFiscalContext } from './fixtures/fiscal-context-fixture.js';
import {
  bootstrapPhase8cFixtures,
  PHASE8C_TENANT_ID,
  PHASE8C_TENANT_B,
} from '../../src/fiscal-engine/fiscal-configuration/fixtures/phase8c-test-fixtures.js';
import { approvedRuleMatchesFacts } from '../../src/fiscal-engine/fiscal-configuration/approved-rule-matcher.js';
import { extractMatchingFactsFromContext } from '../../src/fiscal-engine/fiscal-configuration/matching-facts.js';

const adminActor = { userId: 'admin-user-001', empresaId: PHASE8C_TENANT_ID };
const adminActorContext = { profileRole: 'admin', memberships: [{ role: 'admin' }] };
const usuarioActor = { userId: 'usuario-001', empresaId: PHASE8C_TENANT_ID };
const usuarioActorContext = { profileRole: 'usuario', memberships: [{ role: 'usuario' }] };

test.beforeEach(() => {
  resetFiscalConfigurationRepository();
  bootstrapPhase8cFixtures();
});
test.afterEach(() => resetFiscalConfigurationRepository());

// --- Semantics (24) ---
test('8C-H01: regras efêmeras NÃO recebem productionReady=true', () => {
  const rule = getAccountantApprovedRule(PHASE8C_TENANT_ID, 'aar-t1-internal-resale');
  const fiscalRules = buildFiscalRulesFromApprovedRule(rule);
  assert.ok(fiscalRules.length > 0);
  assert.ok(fiscalRules.every((r) => r.productionReady === false));
  assert.ok(fiscalRules.every((r) => r.accountantApproved === true));
  assert.ok(fiscalRules.every((r) => r.sourceType === FISCAL_RULE_SOURCE_TYPE.ACCOUNTANT_APPROVED_CONFIGURATION));
});

test('8C-H02: isAccountantApprovedConfigurationRule distingue TaxRule', () => {
  const ephemeral = buildFiscalRulesFromApprovedRule(getAccountantApprovedRule(PHASE8C_TENANT_ID, 'aar-t1-internal-resale'))[0];
  assert.equal(isAccountantApprovedConfigurationRule(ephemeral), true);
  assert.equal(isAccountantApprovedConfigurationRule({ productionReady: true }), false);
});

test('8C-H03: runtime usa allowAccountantApprovedConfiguration, não allowNonProductionRules genérico', () => {
  const prodOpts = normalizeResolverOptions({});
  const testOpts = normalizeTestOnlyResolverOptions({});
  assert.equal(prodOpts.allowNonProductionRules, false);
  assert.equal(prodOpts.allowAccountantApprovedConfiguration, false);
  assert.equal(testOpts.allowNonProductionRules, true);

  const acctRule = buildFiscalRulesFromApprovedRule(getAccountantApprovedRule(PHASE8C_TENANT_ID, 'aar-t1-internal-resale'))[0];
  const genericRule = { productionReady: false, id: 'x' };
  assert.equal(isRuleEligibleForExecution(acctRule, prodOpts), false);
  assert.equal(isRuleEligibleForExecution(acctRule, { ...prodOpts, allowAccountantApprovedConfiguration: true }), true);
  assert.equal(isRuleEligibleForExecution(genericRule, testOpts), true);
  assert.equal(isRuleEligibleForExecution(genericRule, prodOpts), false);
});

// --- Approval validation (25) ---
test('8C-H04: DUE_BY_ISSUER + CSOSN102 rejeitado na aprovação', () => {
  const result = validateAccountantRuleForApproval({
    id: 'bad-rule',
    tenantId: PHASE8C_TENANT_ID,
    version: 1,
    conditions: { crt: [1] },
    approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'DUE_BY_ISSUER' },
    validFrom: '2020-01-01',
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === 'ACCOUNTANT_RULE_VALIDATION_FAILED'));
});

test('8C-H05: CSOSN inexistente rejeitado', () => {
  const result = validateAccountantRuleForApproval({
    id: 'bad-csosn',
    tenantId: PHASE8C_TENANT_ID,
    conditions: { crt: [1] },
    approvedResult: { cfop: '5102', csosn: '999', currentOperationSt: 'NOT_DUE' },
    validFrom: '2020-01-01',
  });
  assert.equal(result.ok, false);
});

test('8C-H06: vigência inválida rejeitada', () => {
  const result = validateAccountantRuleForApproval({
    id: 'bad-dates',
    tenantId: PHASE8C_TENANT_ID,
    conditions: { crt: [1] },
    approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
    validFrom: '2026-12-01',
    validUntil: '2026-01-01',
  });
  assert.equal(result.ok, false);
});

test('8C-H07: requiredXmlField desconhecido rejeitado', () => {
  const result = validateAccountantRuleForApproval({
    id: 'bad-xml',
    tenantId: PHASE8C_TENANT_ID,
    conditions: { crt: [1] },
    approvedResult: {
      cfop: '5102', csosn: '500', currentOperationSt: 'NOT_DUE',
      requiredXmlFields: ['campoInventado'],
    },
    validFrom: '2020-01-01',
  });
  assert.equal(result.ok, false);
});

test('8C-H08: regra suportada pode ser APPROVED', async () => {
  resetFiscalConfigurationRepository();
  await createAccountantApprovedRuleDraft({
    id: 'good-rule',
    tenantId: PHASE8C_TENANT_ID,
    version: 1,
    conditions: { crt: [1], operationType: ['VENDA'], operationScope: ['INTERNAL'], itemSource: ['THIRD_PARTY'] },
    approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
    validFrom: '2020-01-01',
  }, adminActor, adminActorContext);
  const approved = await approveAccountantFiscalRule(PHASE8C_TENANT_ID, 'good-rule', adminActor, adminActorContext);
  assert.equal(approved.status, ACCOUNTANT_RULE_STATUS.APPROVED);
  assert.equal(approved.approvedBy, adminActor.userId);
});

// --- ST circularity (26) ---
test('8C-H09: currentOperationSt em conditions rejeitado na validação', () => {
  const result = validateAccountantRuleForApproval({
    id: 'circular',
    tenantId: PHASE8C_TENANT_ID,
    conditions: { crt: [1], currentOperationSt: ['NOT_DUE'] },
    approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
    validFrom: '2020-01-01',
  });
  assert.equal(result.ok, false);
});

test('8C-H10: priorStStatus pode participar do matching como fato', () => {
  const rule = getAccountantApprovedRule(PHASE8C_TENANT_ID, 'aar-t1-retained-st');
  const ctx = buildTestFiscalContext({
    empresaId: PHASE8C_TENANT_ID,
    allocation: { empresa_id: PHASE8C_TENANT_ID, prior_st_status: 'RETAINED' },
  });
  const facts = extractMatchingFactsFromContext(ctx);
  assert.equal(facts.priorStStatus, 'RETAINED');
  const match = approvedRuleMatchesFacts(rule, facts);
  assert.equal(match.matches, true);
});

test('8C-H11: sanitizeMatchConditions remove resultados ST', () => {
  const sanitized = sanitizeMatchConditions({
    priorStStatus: ['RETAINED'],
    currentOperationSt: ['NOT_DUE'],
    stApplicabilityStatus: ['KNOWN'],
  });
  assert.ok(sanitized.priorStStatus);
  for (const key of FORBIDDEN_MATCH_CONDITION_KEYS) {
    assert.equal(sanitized[key], undefined);
  }
});

// --- Security (28) ---
test('8C-H12: actor sem approve permission não aprova', async () => {
  resetFiscalConfigurationRepository();
  await createAccountantApprovedRuleDraft({
    id: 'perm-test',
    tenantId: PHASE8C_TENANT_ID,
    version: 1,
    conditions: { crt: [1], operationType: ['VENDA'], operationScope: ['INTERNAL'], itemSource: ['THIRD_PARTY'] },
    approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
    validFrom: '2020-01-01',
  }, adminActor, adminActorContext);
  await assert.rejects(
    () => approveAccountantFiscalRule(PHASE8C_TENANT_ID, 'perm-test', usuarioActor, usuarioActorContext),
    (err) => err.code === 'FISCAL_CONFIG_FORBIDDEN',
  );
});

test('8C-H13: approvedBy do payload é ignorado — actor real persistido', async () => {
  resetFiscalConfigurationRepository();
  await createAccountantApprovedRuleDraft({
    id: 'spoof-test',
    tenantId: PHASE8C_TENANT_ID,
    version: 1,
    approvedBy: 'attacker-id',
    conditions: { crt: [1], operationType: ['VENDA'], operationScope: ['INTERNAL'], itemSource: ['THIRD_PARTY'] },
    approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
    validFrom: '2020-01-01',
  }, adminActor, adminActorContext);
  const approved = await approveAccountantFiscalRule(
    PHASE8C_TENANT_ID,
    'spoof-test',
    adminActor,
    adminActorContext,
  );
  assert.equal(approved.approvedBy, adminActor.userId);
  assert.notEqual(approved.approvedBy, 'attacker-id');
});

test('8C-H14: tenant T1 não aprova regra T2', async () => {
  resetFiscalConfigurationRepository();
  await createAccountantApprovedRuleDraft({
    id: 't2-rule',
    tenantId: PHASE8C_TENANT_B,
    version: 1,
    conditions: { crt: [1], operationType: ['VENDA'], operationScope: ['INTERNAL'], itemSource: ['THIRD_PARTY'] },
    approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
    validFrom: '2020-01-01',
  }, { userId: adminActor.userId, empresaId: PHASE8C_TENANT_B }, adminActorContext);
  await assert.rejects(
    () => approveAccountantFiscalRule(PHASE8C_TENANT_B, 't2-rule', adminActor, adminActorContext),
    /Cross-tenant/,
  );
});

// --- Immutability (29) ---
test('8C-H15: APPROVED v1 imutável — edit direto bloqueado', () => {
  const rule = getAccountantApprovedRule(PHASE8C_TENANT_ID, 'aar-t1-internal-resale');
  assert.throws(
    () => saveAccountantApprovedRule({ ...rule, approvedResult: { cfop: '9999' } }),
    (err) => /IMMUTABLE|transição|não-DRAFT/i.test(err.message),
  );
});

test('8C-H16: createAccountantRuleNewVersion cria v2 DRAFT preservando v1', async () => {
  await createAccountantRuleNewVersion(PHASE8C_TENANT_ID, 'aar-t1-internal-resale', {
    validFrom: '2026-09-01',
    approvedResult: { cfop: '5102', csosn: '103', currentOperationSt: 'NOT_DUE' },
  }, adminActor, adminActorContext);
  const v1 = getAccountantApprovedRule(PHASE8C_TENANT_ID, 'aar-t1-internal-resale', 1);
  const v2 = getAccountantApprovedRule(PHASE8C_TENANT_ID, 'aar-t1-internal-resale', 2);
  assert.equal(v1.status, ACCOUNTANT_RULE_STATUS.APPROVED);
  assert.equal(v1.approvedResult.csosn, '102');
  assert.equal(v2.status, ACCOUNTANT_RULE_STATUS.DRAFT);
  assert.equal(v2.approvedResult.csosn, '103');
});

test('8C-H17: updateAccountantApprovedRuleDraft só altera DRAFT', async () => {
  await assert.rejects(
    () => updateAccountantApprovedRuleDraft(
      PHASE8C_TENANT_ID,
      'aar-t1-internal-resale',
      1,
      { approvedResult: { cfop: '9999' } },
      adminActor,
      adminActorContext,
    ),
    /ACCOUNTANT_RULE_IMMUTABLE/,
  );
});

// --- Capability + execution (31 preserved) ---
test('8C-H18: preview não altera estado', () => {
  const draft = getAccountantApprovedRule(PHASE8C_TENANT_ID, 'aar-t1-draft-only');
  const before = JSON.stringify(draft);
  previewAccountantFiscalRule(draft);
  const after = JSON.stringify(getAccountantApprovedRule(PHASE8C_TENANT_ID, 'aar-t1-draft-only'));
  assert.equal(before, after);
});

test('8C-H19: capability gate bloqueia CSOSN não suportado na execução', async () => {
  resetFiscalConfigurationRepository();
  insertApprovedRuleForFixture({
    id: 'unsupported-csosn',
    tenantId: PHASE8C_TENANT_ID,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    conditions: { crt: [1], operationType: ['VENDA'], operationScope: ['INTERNAL'], itemSource: ['THIRD_PARTY'], recipientTaxpayerStatus: ['NON_TAXPAYER'], priorStStatus: ['NO_ST_EVIDENCE'], issuerUf: ['RJ'], destinationUf: ['RJ'] },
    approvedResult: { cfop: '5102', csosn: '999', currentOperationSt: 'NOT_DUE' },
    validFrom: '2020-01-01',
    approvedBy: 'acc',
  });

  const ctx = buildTestFiscalContext({
    empresaId: PHASE8C_TENANT_ID,
    allocation: { empresa_id: PHASE8C_TENANT_ID },
    issuer: { crt: 1, uf: 'RJ' },
    recipient: { uf: 'RJ', icmsTaxpayerStatus: 'NON_TAXPAYER' },
    operation: { destinationUf: 'RJ', tipo: 'VENDA' },
    item: { itemSource: 'THIRD_PARTY' },
  });
  const result = await resolveFiscalFromContextWithAccountantConfig(ctx);
  assert.ok(result.issues.some((i) => i.code === 'ACCOUNTANT_RULE_NOT_EXECUTABLE')
    || result.resolutions.cfop === null);
});

test('8C-H20: assertActorPermission usa permission não role hardcoded', () => {
  const allowed = assertActorPermission(adminActorContext, FISCAL_CONFIG_PERMISSIONS.APPROVE);
  assert.equal(allowed.allowed, true);
  assert.throws(
    () => assertActorPermission(usuarioActorContext, FISCAL_CONFIG_PERMISSIONS.APPROVE),
    (err) => err.code === 'FISCAL_CONFIG_FORBIDDEN',
  );
});

test('8C-H21: evaluateAccountantRuleEngineCapability executável para regra válida', () => {
  const rule = getAccountantApprovedRule(PHASE8C_TENANT_ID, 'aar-t1-internal-resale');
  const cap = evaluateAccountantRuleEngineCapability(rule);
  assert.equal(cap.executable, true);
});

// --- Postgres repo unit (27) — skipped if no DATABASE_URL ---
test('8C-H22: postgres repository — tenant isolation (skip sem DB)', async (t) => {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
    t.skip('DATABASE_URL não configurada — integração Postgres omitida');
    return;
  }
  const {
    __ensureFiscalConfigurationSchemaForTests,
    __deleteFiscalConfigurationForTenantTests,
    upsertAccountantRuleDraftPg,
    fetchAccountantRulePg,
    approveAccountantRulePg,
  } = await import('../../src/fiscal-engine/fiscal-configuration/fiscal-configuration.repository.js');

  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';
  await __ensureFiscalConfigurationSchemaForTests();
  await __deleteFiscalConfigurationForTenantTests(tenantA);
  await __deleteFiscalConfigurationForTenantTests(tenantB);

  await upsertAccountantRuleDraftPg({
    id: 'pg-rule-1',
    tenantId: tenantA,
    version: 1,
    conditions: { crt: [1] },
    approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
    validFrom: '2020-01-01',
  });

  const cross = await fetchAccountantRulePg({ tenantId: tenantB, ruleId: 'pg-rule-1' });
  assert.equal(cross, null);

  const approved = await approveAccountantRulePg({
    tenantId: tenantA,
    ruleId: 'pg-rule-1',
    version: 1,
    approvedBy: '33333333-3333-3333-3333-333333333333',
    approvedAt: new Date().toISOString(),
  });
  assert.equal(approved.status, 'APPROVED');

  await __deleteFiscalConfigurationForTenantTests(tenantA);
});
