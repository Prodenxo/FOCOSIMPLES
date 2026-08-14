/**
 * Fase 8D — Grupos fiscais + cenários sobre AccountantApprovedFiscalRule.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  __resetFiscalConfigurationRepositoryServiceForTests,
  __setFiscalConfigurationPostgresEnabledForTests,
  resetFiscalConfigurationRepository,
  createFiscalProductGroup,
  updateFiscalProductGroup,
  listFiscalProductGroupsForTenant,
  assignProductsToFiscalGroup,
  listProductsByFiscalProductGroupId,
  removeProductFromFiscalGroup,
  listUnassignedFiscalProducts,
  createFiscalScenarioDraft,
  approveAccountantFiscalRule,
  createAccountantRuleNewVersion,
  suspendAccountantFiscalRule,
  revokeAccountantFiscalRule,
  resolveAccountantApprovedFiscalRule,
  resolveFiscalFromContextWithAccountantConfig,
  resolveFiscalFromContextWithAccountantConfigPure,
  enrichMatchingFactsForContext,
  extractMatchingFactsFromContext,
  insertApprovedRuleForFixture,
  getAccountantApprovedRule,
  getFiscalProductGroupForProduct,
  FISCAL_PRODUCT_GROUP_STATUS,
  ACCOUNTANT_RULE_AUTHORING_TYPE,
  ACCOUNTANT_RULE_STATUS,
  APPROVED_RULE_MATCH_STATUS,
  APPROVED_RULE_SPECIFICITY_WEIGHTS,
  isFiscalEngineV3Enabled,
  isFiscalEngineV3ShadowEnabled,
  __registerCatalogProductForTests,
  __registerCatalogProductForTenantTests,
  __setCatalogProductMetadataForTests,
  __resetFiscalProductCatalogPortForTests,
  FISCAL_ENGINE_TEST_COUNT_AUDIT,
} from '../../src/fiscal-engine/index.js';
import { buildTestFiscalContext } from './fixtures/fiscal-context-fixture.js';
import { runFiscalProductGroupRepositoryContractTests } from './helpers/fiscal-configuration-repository.contract.js';

const TENANT = 'tenant-phase8d-t1';
const TENANT_B = 'tenant-phase8d-t2';
const ACTOR_ID = 'actor-phase8d-001';
const PG_TENANT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PG_ACTOR_ID = '33333333-3333-3333-3333-333333333333';
const PG_PRODUCT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PG_PRODUCT_ID_2 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const adminActor = { userId: ACTOR_ID, empresaId: TENANT };
const adminActorContext = { profileRole: 'admin', memberships: [{ role: 'admin' }] };

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

const STD_APPROVED = { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' };

const ctxForProduct = (productId, overrides = {}) => buildTestFiscalContext({
  empresaId: TENANT,
  allocation: {
    empresa_id: TENANT,
    prior_st_status: overrides.priorSt ?? 'NO_ST_EVIDENCE',
    produto_catalogo_id: productId,
    ...(overrides.allocation ?? {}),
  },
  issuer: { crt: 1, uf: 'RJ' },
  recipient: { uf: 'RJ', icmsTaxpayerStatus: 'NON_TAXPAYER' },
  operation: { destinationUf: 'RJ', tipo: 'VENDA' },
  item: { itemSource: 'THIRD_PARTY' },
  produto: { produtoCatalogoId: productId, ncm: '22021000' },
  ...(overrides.context ?? {}),
});

test.beforeEach(() => {
  __resetFiscalConfigurationRepositoryServiceForTests();
  __resetFiscalProductCatalogPortForTests();
  resetFiscalConfigurationRepository();
  __setFiscalConfigurationPostgresEnabledForTests(false);
  __registerCatalogProductForTests(ACTOR_ID, 'prod-a');
  __registerCatalogProductForTests(ACTOR_ID, 'prod-b');
  __registerCatalogProductForTests(ACTOR_ID, 'prod-c');
  __registerCatalogProductForTests(ACTOR_ID, 'prod-x');
});

test.afterEach(() => {
  __resetFiscalConfigurationRepositoryServiceForTests();
  __resetFiscalProductCatalogPortForTests();
  resetFiscalConfigurationRepository();
});

const createGroup = async (name, tenantId = TENANT) => createFiscalProductGroup({
  name,
  tenantId,
}, adminActor, adminActorContext);

// --- GROUP ---
test('8D-GROUP-01: create fiscal product group', async () => {
  const group = await createGroup('REVENDAS');
  assert.equal(group.status, FISCAL_PRODUCT_GROUP_STATUS.ACTIVE);
  assert.equal(group.name, 'REVENDAS');
});

test('8D-GROUP-02: tenant isolation', async () => {
  const g1 = await createGroup('GRUPO-T1');
  const groupsB = await listFiscalProductGroupsForTenant(TENANT_B);
  assert.ok(!groupsB.some((g) => g.id === g1.id));
});

test('8D-GROUP-03: suspend group', async () => {
  const group = await createGroup('SUSPEND-ME');
  const suspended = await updateFiscalProductGroup(
    TENANT,
    group.id,
    { status: FISCAL_PRODUCT_GROUP_STATUS.SUSPENDED },
    adminActor,
    adminActorContext,
  );
  assert.equal(suspended.status, FISCAL_PRODUCT_GROUP_STATUS.SUSPENDED);
});

test('8D-GROUP-04: duplicate name rejected', async () => {
  await createGroup('DUPLICATE');
  await assert.rejects(
    () => createGroup('DUPLICATE'),
    (err) => err.code === 'FISCAL_PRODUCT_GROUP_DUPLICATE_NAME',
  );
});

// --- MEM ---
test('8D-MEM-01: assign products to group', async () => {
  const group = await createGroup('ASSIGN');
  const result = await assignProductsToFiscalGroup({
    tenantId: TENANT,
    fiscalProductGroupId: group.id,
    productIds: ['prod-a', 'prod-b'],
    actor: adminActor,
    actorContext: adminActorContext,
  });
  assert.deepEqual(result.assigned.sort(), ['prod-a', 'prod-b']);
});

test('8D-MEM-02: idempotent same group', async () => {
  const group = await createGroup('IDEM');
  await assignProductsToFiscalGroup({
    tenantId: TENANT, fiscalProductGroupId: group.id, productIds: ['prod-a'],
    actor: adminActor, actorContext: adminActorContext,
  });
  const second = await assignProductsToFiscalGroup({
    tenantId: TENANT, fiscalProductGroupId: group.id, productIds: ['prod-a'],
    actor: adminActor, actorContext: adminActorContext,
  });
  assert.deepEqual(second.skipped, ['prod-a']);
});

test('8D-MEM-03: different group conflict without replace', async () => {
  const g1 = await createGroup('G1');
  const g2 = await createGroup('G2');
  await assignProductsToFiscalGroup({
    tenantId: TENANT, fiscalProductGroupId: g1.id, productIds: ['prod-a'],
    actor: adminActor, actorContext: adminActorContext,
  });
  await assert.rejects(
    () => assignProductsToFiscalGroup({
      tenantId: TENANT, fiscalProductGroupId: g2.id, productIds: ['prod-a'],
      replaceExisting: false, actor: adminActor, actorContext: adminActorContext,
    }),
    (err) => err.code === 'FISCAL_PRODUCT_GROUP_MEMBERSHIP_CONFLICT',
  );
});

test('8D-MEM-04: replaceExisting explicit', async () => {
  const g1 = await createGroup('REPLACE-G1');
  const g2 = await createGroup('REPLACE-G2');
  await assignProductsToFiscalGroup({
    tenantId: TENANT, fiscalProductGroupId: g1.id, productIds: ['prod-a'],
    actor: adminActor, actorContext: adminActorContext,
  });
  const replaced = await assignProductsToFiscalGroup({
    tenantId: TENANT, fiscalProductGroupId: g2.id, productIds: ['prod-a'],
    replaceExisting: true, actor: adminActor, actorContext: adminActorContext,
  });
  assert.deepEqual(replaced.replaced, ['prod-a']);
  const members = await listProductsByFiscalProductGroupId({
    tenantId: TENANT, fiscalProductGroupId: g2.id,
  });
  assert.equal(members.length, 1);
});

test('8D-MEM-05: cross tenant rejected', async () => {
  const group = await createGroup('CROSS');
  await assert.rejects(
    () => assignProductsToFiscalGroup({
      tenantId: TENANT_B,
      fiscalProductGroupId: group.id,
      productIds: ['prod-a'],
      actor: { userId: ACTOR_ID, empresaId: TENANT_B },
      actorContext: adminActorContext,
    }),
    (err) => /Cross-tenant|FISCAL_PRODUCT_GROUP_NOT_FOUND/.test(String(err?.message ?? err)),
  );
});

test('8D-MEM-06: bulk rollback on invalid product', async () => {
  const group = await createGroup('ROLLBACK');
  await assert.rejects(
    () => assignProductsToFiscalGroup({
      tenantId: TENANT, fiscalProductGroupId: group.id,
      productIds: ['prod-a', 'invalid-product-id'],
      actor: adminActor, actorContext: adminActorContext,
    }),
  );
  const members = await listProductsByFiscalProductGroupId({
    tenantId: TENANT, fiscalProductGroupId: group.id,
  });
  assert.equal(members.length, 0);
});

test('8D-MEM-07: remove product from group', async () => {
  const group = await createGroup('REMOVE');
  await assignProductsToFiscalGroup({
    tenantId: TENANT, fiscalProductGroupId: group.id, productIds: ['prod-a'],
    actor: adminActor, actorContext: adminActorContext,
  });
  await removeProductFromFiscalGroup({
    tenantId: TENANT, fiscalProductGroupId: group.id, productId: 'prod-a',
    actor: adminActor, actorContext: adminActorContext,
  });
  const members = await listProductsByFiscalProductGroupId({
    tenantId: TENANT, fiscalProductGroupId: group.id,
  });
  assert.equal(members.length, 0);
});

test('8D-MEM-08: list products by group', async () => {
  const group = await createGroup('LIST');
  await assignProductsToFiscalGroup({
    tenantId: TENANT, fiscalProductGroupId: group.id, productIds: ['prod-a', 'prod-b'],
    actor: adminActor, actorContext: adminActorContext,
  });
  const members = await listProductsByFiscalProductGroupId({
    tenantId: TENANT, fiscalProductGroupId: group.id,
  });
  assert.equal(members.length, 2);
});

test('8D-MEM-09: list unassigned products', async () => {
  const group = await createGroup('UNASSIGNED');
  await assignProductsToFiscalGroup({
    tenantId: TENANT, fiscalProductGroupId: group.id, productIds: ['prod-a'],
    actor: adminActor, actorContext: adminActorContext,
  });
  const unassigned = await listUnassignedFiscalProducts({
    tenantId: TENANT, actor: adminActor, actorContext: adminActorContext,
  });
  assert.ok(unassigned.includes('prod-b'));
  assert.ok(!unassigned.includes('prod-a'));
});

test('8D-MEM-10: PG bulk assign concurrency', async (t) => {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
    t.skip('DATABASE_URL unavailable');
    return;
  }
  const { __ensureFiscalConfigurationSchemaForTests, __deleteFiscalConfigurationForTenantTests } = await import('../../src/fiscal-engine/fiscal-configuration/fiscal-configuration.repository.js');
  await __ensureFiscalConfigurationSchemaForTests();
  await __deleteFiscalConfigurationForTenantTests(PG_TENANT);
  __setFiscalConfigurationPostgresEnabledForTests(true);
  __registerCatalogProductForTests(PG_ACTOR_ID, PG_PRODUCT_ID);

  const pgActor = { userId: PG_ACTOR_ID, empresaId: PG_TENANT };
  const group = await createFiscalProductGroup({ name: 'PG-CONCURRENT', tenantId: PG_TENANT }, pgActor, adminActorContext);

  const p1 = assignProductsToFiscalGroup({
    tenantId: PG_TENANT, fiscalProductGroupId: group.id, productIds: [PG_PRODUCT_ID],
    replaceExisting: true, actor: pgActor, actorContext: adminActorContext,
  });
  const p2 = assignProductsToFiscalGroup({
    tenantId: PG_TENANT, fiscalProductGroupId: group.id, productIds: [PG_PRODUCT_ID],
    replaceExisting: true, actor: pgActor, actorContext: adminActorContext,
  });
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.ok(r1.assigned.length + r1.skipped.length >= 1);
  assert.ok(r2.assigned.length + r2.skipped.length >= 1);
});

// --- MATCH ---
test('8D-MATCH-01: group condition matches', async () => {
  const group = await createGroup('MATCH-G');
  await assignProductsToFiscalGroup({
    tenantId: TENANT, fiscalProductGroupId: group.id, productIds: ['prod-a'],
    actor: adminActor, actorContext: adminActorContext,
  });
  insertApprovedRuleForFixture({
    id: 'rule-group', tenantId: TENANT, version: 1, status: ACCOUNTANT_RULE_STATUS.APPROVED,
    conditions: { ...STD_CONDITIONS, fiscalProductGroupId: [group.id] },
    approvedResult: STD_APPROVED, validFrom: '2020-01-01', approvedBy: ACTOR_ID,
  });
  const facts = await enrichMatchingFactsForContext(ctxForProduct('prod-a'));
  const match = resolveAccountantApprovedFiscalRule(ctxForProduct('prod-a'), [
    getAccountantApprovedRule(TENANT, 'rule-group'),
  ], { matchingFacts: facts });
  assert.equal(match.status, APPROVED_RULE_MATCH_STATUS.MATCHED);
});

test('8D-MATCH-02: no membership no group match', async () => {
  const group = await createGroup('NO-MEM');
  insertApprovedRuleForFixture({
    id: 'rule-no-mem', tenantId: TENANT, version: 1, status: ACCOUNTANT_RULE_STATUS.APPROVED,
    conditions: { ...STD_CONDITIONS, fiscalProductGroupId: [group.id] },
    approvedResult: STD_APPROVED, validFrom: '2020-01-01', approvedBy: ACTOR_ID,
  });
  const facts = await enrichMatchingFactsForContext(ctxForProduct('prod-x'));
  const match = resolveAccountantApprovedFiscalRule(ctxForProduct('prod-x'), [
    getAccountantApprovedRule(TENANT, 'rule-no-mem'),
  ], { matchingFacts: facts });
  assert.equal(match.status, APPROVED_RULE_MATCH_STATUS.NO_MATCH);
});

test('8D-MATCH-03: suspended group does not match', async () => {
  const group = await createGroup('SUSP-G');
  await assignProductsToFiscalGroup({
    tenantId: TENANT, fiscalProductGroupId: group.id, productIds: ['prod-a'],
    actor: adminActor, actorContext: adminActorContext,
  });
  await updateFiscalProductGroup(TENANT, group.id, { status: FISCAL_PRODUCT_GROUP_STATUS.SUSPENDED }, adminActor, adminActorContext);
  insertApprovedRuleForFixture({
    id: 'rule-susp-g', tenantId: TENANT, version: 1, status: ACCOUNTANT_RULE_STATUS.APPROVED,
    conditions: { ...STD_CONDITIONS, fiscalProductGroupId: [group.id] },
    approvedResult: STD_APPROVED, validFrom: '2020-01-01', approvedBy: ACTOR_ID,
  });
  const facts = await enrichMatchingFactsForContext(ctxForProduct('prod-a'));
  assert.equal(facts.fiscalProductGroupId, null);
  const match = resolveAccountantApprovedFiscalRule(ctxForProduct('prod-a'), [
    getAccountantApprovedRule(TENANT, 'rule-susp-g'),
  ], { matchingFacts: facts });
  assert.equal(match.status, APPROVED_RULE_MATCH_STATUS.NO_MATCH);
});

test('8D-MATCH-04: product-specific beats group same shared conditions', async () => {
  const group = await createGroup('PREC-G');
  await assignProductsToFiscalGroup({
    tenantId: TENANT, fiscalProductGroupId: group.id, productIds: ['prod-a'],
    actor: adminActor, actorContext: adminActorContext,
  });
  const shared = {
    crt: [1], issuerUf: ['RJ'], destinationUf: ['RJ'], operationType: ['VENDA'],
    operationScope: ['INTERNAL'], itemSource: ['THIRD_PARTY'],
    recipientTaxpayerStatus: ['NON_TAXPAYER'], priorStStatus: ['NO_ST_EVIDENCE'],
  };
  insertApprovedRuleForFixture({
    id: 'rule-group-prec', tenantId: TENANT, version: 1, status: ACCOUNTANT_RULE_STATUS.APPROVED,
    conditions: { ...shared, fiscalProductGroupId: [group.id] },
    approvedResult: { ...STD_APPROVED, cfop: '5102' }, validFrom: '2020-01-01', approvedBy: ACTOR_ID,
  });
  insertApprovedRuleForFixture({
    id: 'rule-product-prec', tenantId: TENANT, version: 1, status: ACCOUNTANT_RULE_STATUS.APPROVED,
    conditions: { ...shared, productId: ['prod-a'] },
    approvedResult: { ...STD_APPROVED, cfop: '5101' }, validFrom: '2020-01-01', approvedBy: ACTOR_ID,
  });
  const rules = [
    getAccountantApprovedRule(TENANT, 'rule-group-prec'),
    getAccountantApprovedRule(TENANT, 'rule-product-prec'),
  ];
  const facts = await enrichMatchingFactsForContext(ctxForProduct('prod-a'));
  const match = resolveAccountantApprovedFiscalRule(ctxForProduct('prod-a'), rules, { matchingFacts: facts });
  assert.equal(match.ruleId, 'rule-product-prec');
  assert.equal(match.approvedResult.cfop, '5101');
  assert.ok(APPROVED_RULE_SPECIFICITY_WEIGHTS.productId > APPROVED_RULE_SPECIFICITY_WEIGHTS.fiscalProductGroupId);
});

test('8D-MATCH-05: group + priorStStatus beats group generic', async () => {
  const group = await createGroup('ST-G');
  await assignProductsToFiscalGroup({
    tenantId: TENANT, fiscalProductGroupId: group.id, productIds: ['prod-a'],
    actor: adminActor, actorContext: adminActorContext,
  });
  const base = { ...STD_CONDITIONS, fiscalProductGroupId: [group.id] };
  insertApprovedRuleForFixture({
    id: 'rule-g-generic', tenantId: TENANT, version: 1, status: ACCOUNTANT_RULE_STATUS.APPROVED,
    conditions: base,
    approvedResult: { ...STD_APPROVED, csosn: '102' }, validFrom: '2020-01-01', approvedBy: ACTOR_ID,
  });
  insertApprovedRuleForFixture({
    id: 'rule-g-retained', tenantId: TENANT, version: 1, status: ACCOUNTANT_RULE_STATUS.APPROVED,
    conditions: { ...base, priorStStatus: ['RETAINED'] },
    approvedResult: { ...STD_APPROVED, csosn: '500' }, validFrom: '2020-01-01', approvedBy: ACTOR_ID,
  });
  const ctx = ctxForProduct('prod-a', {
    priorSt: 'RETAINED',
    allocation: { prior_st_status: 'RETAINED', st_allocation_json: { allocatedValues: { vBCSTRet: '1' } } },
  });
  const facts = await enrichMatchingFactsForContext(ctx);
  const match = resolveAccountantApprovedFiscalRule(ctx, [
    getAccountantApprovedRule(TENANT, 'rule-g-generic'),
    getAccountantApprovedRule(TENANT, 'rule-g-retained'),
  ], { matchingFacts: facts });
  assert.equal(match.ruleId, 'rule-g-retained');
  assert.equal(match.approvedResult.csosn, '500');
});

test('8D-MATCH-06: product-specific works without group', async () => {
  insertApprovedRuleForFixture({
    id: 'rule-prod-only', tenantId: TENANT, version: 1, status: ACCOUNTANT_RULE_STATUS.APPROVED,
    conditions: { ...STD_CONDITIONS, productId: ['prod-x'] },
    approvedResult: STD_APPROVED, validFrom: '2020-01-01', approvedBy: ACTOR_ID,
  });
  const facts = await enrichMatchingFactsForContext(ctxForProduct('prod-x'));
  assert.equal(facts.fiscalProductGroupId, null);
  const match = resolveAccountantApprovedFiscalRule(ctxForProduct('prod-x'), [
    getAccountantApprovedRule(TENANT, 'rule-prod-only'),
  ], { matchingFacts: facts });
  assert.equal(match.status, APPROVED_RULE_MATCH_STATUS.MATCHED);
});

test('8D-MATCH-07: no NCM auto grouping', async () => {
  const group = await createGroup('NCM-G');
  await assignProductsToFiscalGroup({
    tenantId: TENANT, fiscalProductGroupId: group.id, productIds: ['prod-a'],
    actor: adminActor, actorContext: adminActorContext,
  });
  const facts = extractMatchingFactsFromContext(ctxForProduct('prod-b'));
  assert.equal(facts.fiscalProductGroupId, undefined);
  const enriched = await enrichMatchingFactsForContext(ctxForProduct('prod-b'));
  assert.equal(enriched.fiscalProductGroupId, null);
  assert.notEqual(enriched.ncm, group.id);
});

// --- SCN ---
test('8D-SCN-01: scenario creates DRAFT with authoringType', async () => {
  const rule = await createFiscalScenarioDraft({
    id: 'scenario-1',
    tenantId: TENANT,
    name: 'Venda interna padrão',
    description: 'Cenário teste',
    conditions: STD_CONDITIONS,
    approvedResult: STD_APPROVED,
    validFrom: '2020-01-01',
  }, adminActor, adminActorContext);
  assert.equal(rule.status, ACCOUNTANT_RULE_STATUS.DRAFT);
  assert.equal(rule.authoringType, ACCOUNTANT_RULE_AUTHORING_TYPE.FISCAL_SCENARIO);
  assert.equal(rule.name, 'Venda interna padrão');
});

test('8D-SCN-02: approve uses 8C workflow', async () => {
  const draft = await createFiscalScenarioDraft({
    id: 'scenario-approve', tenantId: TENANT, name: 'Approve me',
    conditions: STD_CONDITIONS, approvedResult: STD_APPROVED, validFrom: '2020-01-01',
  }, adminActor, adminActorContext);
  const approved = await approveAccountantFiscalRule(TENANT, draft.id, adminActor, adminActorContext);
  assert.equal(approved.status, ACCOUNTANT_RULE_STATUS.APPROVED);
  assert.equal(approved.approvedBy, ACTOR_ID);
});

test('8D-SCN-03: APPROVED immutable', async () => {
  const draft = await createFiscalScenarioDraft({
    id: 'scenario-immutable', tenantId: TENANT, name: 'Immutable',
    conditions: STD_CONDITIONS, approvedResult: STD_APPROVED, validFrom: '2020-01-01',
  }, adminActor, adminActorContext);
  await approveAccountantFiscalRule(TENANT, draft.id, adminActor, adminActorContext);
  const { updateAccountantApprovedRuleDraft } = await import('../../src/fiscal-engine/fiscal-configuration/fiscal-configuration.service.js');
  await assert.rejects(
    () => updateAccountantApprovedRuleDraft(TENANT, draft.id, 1, { name: 'x' }, adminActor, adminActorContext),
    /ACCOUNTANT_RULE_IMMUTABLE/,
  );
});

test('8D-SCN-04: new version uses 8C versioning', async () => {
  const draft = await createFiscalScenarioDraft({
    id: 'scenario-version', tenantId: TENANT, name: 'Version',
    conditions: STD_CONDITIONS, approvedResult: STD_APPROVED, validFrom: '2020-01-01',
  }, adminActor, adminActorContext);
  await approveAccountantFiscalRule(TENANT, draft.id, adminActor, adminActorContext);
  const v2 = await createAccountantRuleNewVersion(TENANT, draft.id, {
    approvedResult: { ...STD_APPROVED, csosn: '103' },
  }, adminActor, adminActorContext);
  assert.equal(v2.version, 2);
  assert.equal(v2.status, ACCOUNTANT_RULE_STATUS.DRAFT);
});

test('8D-SCN-05: suspend/revoke 8C workflow', async () => {
  const draft = await createFiscalScenarioDraft({
    id: 'scenario-lifecycle', tenantId: TENANT, name: 'Lifecycle',
    conditions: STD_CONDITIONS, approvedResult: STD_APPROVED, validFrom: '2020-01-01',
  }, adminActor, adminActorContext);
  await approveAccountantFiscalRule(TENANT, draft.id, adminActor, adminActorContext);
  const suspended = await suspendAccountantFiscalRule(TENANT, draft.id, adminActor, adminActorContext);
  assert.equal(suspended.status, ACCOUNTANT_RULE_STATUS.SUSPENDED);
  const revoked = await revokeAccountantFiscalRule(TENANT, draft.id, adminActor, adminActorContext);
  assert.equal(revoked.status, ACCOUNTANT_RULE_STATUS.REVOKED);
});

test('8D-SCN-06: scenario is not separate runtime engine', async () => {
  const group = await createGroup('SCN-RUNTIME');
  await assignProductsToFiscalGroup({
    tenantId: TENANT, fiscalProductGroupId: group.id, productIds: ['prod-a'],
    actor: adminActor, actorContext: adminActorContext,
  });
  const draft = await createFiscalScenarioDraft({
    id: 'scenario-runtime', tenantId: TENANT, name: 'Runtime scenario',
    conditions: { ...STD_CONDITIONS, fiscalProductGroupId: [group.id] },
    approvedResult: STD_APPROVED, validFrom: '2020-01-01',
  }, adminActor, adminActorContext);
  await approveAccountantFiscalRule(TENANT, draft.id, adminActor, adminActorContext);
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxForProduct('prod-a'));
  assert.equal(result.resolutions.cfop, '5102');
  assert.equal(result.audit.accountantConfig.accountantApprovedRuleId, 'scenario-runtime');
});

// --- E2E ---
test('8D-E2E-01: product → group → rule → FiscalResult', async () => {
  const group = await createGroup('E2E-G');
  await assignProductsToFiscalGroup({
    tenantId: TENANT, fiscalProductGroupId: group.id, productIds: ['prod-a'],
    actor: adminActor, actorContext: adminActorContext,
  });
  const draft = await createFiscalScenarioDraft({
    id: 'e2e-scenario', tenantId: TENANT, name: 'E2E',
    conditions: { ...STD_CONDITIONS, fiscalProductGroupId: [group.id] },
    approvedResult: STD_APPROVED, validFrom: '2020-01-01',
  }, adminActor, adminActorContext);
  await approveAccountantFiscalRule(TENANT, draft.id, adminActor, adminActorContext);
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxForProduct('prod-a'));
  assert.equal(result.resolutions.cfop, '5102');
  assert.equal(result.resolutions.csosn, '102');
});

test('8D-E2E-02: same group different priorSt rules', async () => {
  const group = await createGroup('E2E-ST');
  await assignProductsToFiscalGroup({
    tenantId: TENANT, fiscalProductGroupId: group.id, productIds: ['prod-a'],
    actor: adminActor, actorContext: adminActorContext,
  });
  const base = { ...STD_CONDITIONS, fiscalProductGroupId: [group.id] };
  insertApprovedRuleForFixture({
    id: 'e2e-no-st', tenantId: TENANT, version: 1, status: ACCOUNTANT_RULE_STATUS.APPROVED,
    conditions: { ...base, priorStStatus: ['NO_ST_EVIDENCE'] },
    approvedResult: { ...STD_APPROVED, csosn: '102' }, validFrom: '2020-01-01', approvedBy: ACTOR_ID,
  });
  insertApprovedRuleForFixture({
    id: 'e2e-retained', tenantId: TENANT, version: 1, status: ACCOUNTANT_RULE_STATUS.APPROVED,
    conditions: { ...base, priorStStatus: ['RETAINED'] },
    approvedResult: { cfop: '5102', csosn: '500', currentOperationSt: 'NOT_DUE', requiredXmlFields: ['vBCSTRet'] },
    validFrom: '2020-01-01', approvedBy: ACTOR_ID,
  });
  const ctxNoSt = ctxForProduct('prod-a');
  const ctxRetained = ctxForProduct('prod-a', {
    priorSt: 'RETAINED',
    allocation: { prior_st_status: 'RETAINED', st_allocation_json: { allocatedValues: { vBCSTRet: '10' } } },
  });
  const r1 = await resolveFiscalFromContextWithAccountantConfig(ctxNoSt);
  const r2 = await resolveFiscalFromContextWithAccountantConfig(ctxRetained);
  assert.equal(r1.resolutions.csosn, '102');
  assert.equal(r2.resolutions.csosn, '500');
});

test('8D-E2E-03: Postgres authoritative memory empty', async (t) => {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
    t.skip('DATABASE_URL unavailable');
    return;
  }
  const { __ensureFiscalConfigurationSchemaForTests, __deleteFiscalConfigurationForTenantTests } = await import('../../src/fiscal-engine/fiscal-configuration/fiscal-configuration.repository.js');
  const { saveAccountantApprovedRuleDraft, approveAccountantRuleAtomic, listAccountantApprovedRulesForTenant } = await import('../../src/fiscal-engine/fiscal-configuration/fiscal-configuration-repository.service.js');

  await __ensureFiscalConfigurationSchemaForTests();
  await __deleteFiscalConfigurationForTenantTests(PG_TENANT);
  __setFiscalConfigurationPostgresEnabledForTests(true);
  __registerCatalogProductForTests(PG_ACTOR_ID, PG_PRODUCT_ID_2);

  const pgActor = { userId: PG_ACTOR_ID, empresaId: PG_TENANT };
  const group = await createFiscalProductGroup({ name: 'PG-E2E', tenantId: PG_TENANT }, pgActor, adminActorContext);
  await assignProductsToFiscalGroup({
    tenantId: PG_TENANT, fiscalProductGroupId: group.id, productIds: [PG_PRODUCT_ID_2],
    actor: pgActor, actorContext: adminActorContext,
  });

  const draft = await saveAccountantApprovedRuleDraft({
    id: 'pg-e2e-rule', tenantId: PG_TENANT, version: 1,
    name: 'PG E2E', authoringType: ACCOUNTANT_RULE_AUTHORING_TYPE.FISCAL_SCENARIO,
    conditions: { ...STD_CONDITIONS, fiscalProductGroupId: [group.id] },
    approvedResult: STD_APPROVED, validFrom: '2020-01-01',
  });
  await approveAccountantRuleAtomic({
    tenantId: PG_TENANT, ruleId: draft.id, version: 1,
    approvedBy: PG_ACTOR_ID, approvedAt: new Date().toISOString(),
  });

  resetFiscalConfigurationRepository();

  const ctx = buildTestFiscalContext({
    empresaId: PG_TENANT,
    allocation: { empresa_id: PG_TENANT, produto_catalogo_id: PG_PRODUCT_ID_2, prior_st_status: 'NO_ST_EVIDENCE' },
    issuer: { crt: 1, uf: 'RJ' },
    recipient: { uf: 'RJ', icmsTaxpayerStatus: 'NON_TAXPAYER' },
    operation: { destinationUf: 'RJ', tipo: 'VENDA' },
    item: { itemSource: 'THIRD_PARTY' },
    produto: { produtoCatalogoId: PG_PRODUCT_ID_2, ncm: '22021000' },
  });
  const pgRules = await listAccountantApprovedRulesForTenant(PG_TENANT);
  assert.ok(pgRules.some((r) => r.status === ACCOUNTANT_RULE_STATUS.APPROVED));
  const result = await resolveFiscalFromContextWithAccountantConfig(ctx);
  assert.equal(result.resolutions.cfop, '5102');
});

// --- HARDENING (8D.2 checkpoint) ---
const HARD_USER = 'user-x-same-accountant';
const HARD_TENANT_A = 'tenant-a-same-accountant';
const HARD_TENANT_B = 'tenant-b-same-accountant';
const HARD_PRODUCT_A = 'product-a-tenant-a-only';

test('8D-HARD-01: scope explícito (registry tenant) — produto restrito a A rejeitado em B (memory)', async () => {
  __registerCatalogProductForTenantTests(HARD_USER, HARD_TENANT_A, HARD_PRODUCT_A);
  const actorB = { userId: HARD_USER, empresaId: HARD_TENANT_B };
  const groupB = await createFiscalProductGroup(
    { name: 'GROUP-B-HARD', tenantId: HARD_TENANT_B },
    actorB,
    adminActorContext,
  );
  await assert.rejects(
    () => assignProductsToFiscalGroup({
      tenantId: HARD_TENANT_B,
      fiscalProductGroupId: groupB.id,
      productIds: [HARD_PRODUCT_A],
      actor: actorB,
      actorContext: adminActorContext,
    }),
    (err) => err.code === 'CATALOG_PRODUCT_TENANT_FORBIDDEN',
  );
});

test('8D-HARD-02: scope explícito (registry tenant) — produto restrito a A rejeitado em B (postgres)', async (t) => {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
    t.skip('DATABASE_URL unavailable');
    return;
  }
  const { __ensureFiscalConfigurationSchemaForTests, __deleteFiscalConfigurationForTenantTests } = await import('../../src/fiscal-engine/fiscal-configuration/fiscal-configuration.repository.js');
  const PG_HARD_TENANT_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb001';
  const PG_HARD_TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002';
  const PG_HARD_PRODUCT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb003';

  await __ensureFiscalConfigurationSchemaForTests();
  await __deleteFiscalConfigurationForTenantTests(PG_HARD_TENANT_A);
  await __deleteFiscalConfigurationForTenantTests(PG_HARD_TENANT_B);
  __setFiscalConfigurationPostgresEnabledForTests(true);
  __registerCatalogProductForTenantTests(PG_ACTOR_ID, PG_HARD_TENANT_A, PG_HARD_PRODUCT);

  const actorB = { userId: PG_ACTOR_ID, empresaId: PG_HARD_TENANT_B };
  const groupB = await createFiscalProductGroup(
    { name: 'PG-GROUP-B-HARD', tenantId: PG_HARD_TENANT_B },
    actorB,
    adminActorContext,
  );
  await assert.rejects(
    () => assignProductsToFiscalGroup({
      tenantId: PG_HARD_TENANT_B,
      fiscalProductGroupId: groupB.id,
      productIds: [PG_HARD_PRODUCT],
      actor: actorB,
      actorContext: adminActorContext,
    }),
    (err) => err.code === 'CATALOG_PRODUCT_TENANT_FORBIDDEN',
  );
});

test('8D-HARD-03: bulk assign parcial conflito — zero writes (memory)', async () => {
  const g1 = await createGroup('ATOMIC-G1');
  const g2 = await createGroup('ATOMIC-G2');
  await assignProductsToFiscalGroup({
    tenantId: TENANT, fiscalProductGroupId: g1.id, productIds: ['prod-a'],
    actor: adminActor, actorContext: adminActorContext,
  });
  await assert.rejects(
    () => assignProductsToFiscalGroup({
      tenantId: TENANT, fiscalProductGroupId: g2.id,
      productIds: ['prod-a', 'prod-b'],
      replaceExisting: false,
      actor: adminActor, actorContext: adminActorContext,
    }),
    (err) => err.code === 'FISCAL_PRODUCT_GROUP_MEMBERSHIP_CONFLICT',
  );
  const g2Members = await listProductsByFiscalProductGroupId({
    tenantId: TENANT, fiscalProductGroupId: g2.id,
  });
  assert.equal(g2Members.length, 0);
  const g1Members = await listProductsByFiscalProductGroupId({
    tenantId: TENANT, fiscalProductGroupId: g1.id,
  });
  assert.equal(g1Members.length, 1);
  assert.equal(g1Members[0].productId, 'prod-a');
});

test('8D-HARD-04: bulk assign parcial conflito — zero writes (postgres)', async (t) => {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
    t.skip('DATABASE_URL unavailable');
    return;
  }
  const { __ensureFiscalConfigurationSchemaForTests, __deleteFiscalConfigurationForTenantTests } = await import('../../src/fiscal-engine/fiscal-configuration/fiscal-configuration.repository.js');
  const PG_ATOMIC_TENANT = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01';
  const PG_ATOMIC_P1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccc02';
  const PG_ATOMIC_P2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccc03';

  await __ensureFiscalConfigurationSchemaForTests();
  await __deleteFiscalConfigurationForTenantTests(PG_ATOMIC_TENANT);
  __setFiscalConfigurationPostgresEnabledForTests(true);
  __registerCatalogProductForTests(PG_ACTOR_ID, PG_ATOMIC_P1);
  __registerCatalogProductForTests(PG_ACTOR_ID, PG_ATOMIC_P2);

  const pgActor = { userId: PG_ACTOR_ID, empresaId: PG_ATOMIC_TENANT };
  const g1 = await createFiscalProductGroup({ name: 'PG-ATOMIC-G1', tenantId: PG_ATOMIC_TENANT }, pgActor, adminActorContext);
  const g2 = await createFiscalProductGroup({ name: 'PG-ATOMIC-G2', tenantId: PG_ATOMIC_TENANT }, pgActor, adminActorContext);
  await assignProductsToFiscalGroup({
    tenantId: PG_ATOMIC_TENANT, fiscalProductGroupId: g1.id, productIds: [PG_ATOMIC_P1],
    actor: pgActor, actorContext: adminActorContext,
  });
  await assert.rejects(
    () => assignProductsToFiscalGroup({
      tenantId: PG_ATOMIC_TENANT, fiscalProductGroupId: g2.id,
      productIds: [PG_ATOMIC_P1, PG_ATOMIC_P2],
      replaceExisting: false,
      actor: pgActor, actorContext: adminActorContext,
    }),
    (err) => err.code === 'FISCAL_PRODUCT_GROUP_MEMBERSHIP_CONFLICT',
  );
  const g2Members = await listProductsByFiscalProductGroupId({
    tenantId: PG_ATOMIC_TENANT, fiscalProductGroupId: g2.id,
  });
  assert.equal(g2Members.length, 0);
});

test('8D-HARD-05: concorrência PG — linha inexistente, grupos diferentes', async (t) => {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
    t.skip('DATABASE_URL unavailable');
    return;
  }
  const { __ensureFiscalConfigurationSchemaForTests, __deleteFiscalConfigurationForTenantTests } = await import('../../src/fiscal-engine/fiscal-configuration/fiscal-configuration.repository.js');
  const PG_CONC_TENANT = 'dddddddd-dddd-4ddd-8ddd-ddddddddd001';
  const PG_CONC_PRODUCT = 'dddddddd-dddd-4ddd-8ddd-ddddddddd002';

  await __ensureFiscalConfigurationSchemaForTests();
  await __deleteFiscalConfigurationForTenantTests(PG_CONC_TENANT);
  __setFiscalConfigurationPostgresEnabledForTests(true);
  __registerCatalogProductForTests(PG_ACTOR_ID, PG_CONC_PRODUCT);

  const pgActor = { userId: PG_ACTOR_ID, empresaId: PG_CONC_TENANT };
  const g1 = await createFiscalProductGroup({ name: 'PG-CONC-G1', tenantId: PG_CONC_TENANT }, pgActor, adminActorContext);
  const g2 = await createFiscalProductGroup({ name: 'PG-CONC-G2', tenantId: PG_CONC_TENANT }, pgActor, adminActorContext);

  const p1 = assignProductsToFiscalGroup({
    tenantId: PG_CONC_TENANT, fiscalProductGroupId: g1.id, productIds: [PG_CONC_PRODUCT],
    replaceExisting: true, actor: pgActor, actorContext: adminActorContext,
  });
  const p2 = assignProductsToFiscalGroup({
    tenantId: PG_CONC_TENANT, fiscalProductGroupId: g2.id, productIds: [PG_CONC_PRODUCT],
    replaceExisting: true, actor: pgActor, actorContext: adminActorContext,
  });
  const [r1, r2] = await Promise.allSettled([p1, p2]);
  const fulfilled = [r1, r2].filter((r) => r.status === 'fulfilled');
  const rejected = [r1, r2].filter((r) => r.status === 'rejected');
  assert.ok(fulfilled.length >= 1, 'pelo menos uma operação deve concluir');
  assert.ok(fulfilled.length + rejected.length === 2);
  const memberships = await listProductsByFiscalProductGroupId({
    tenantId: PG_CONC_TENANT, fiscalProductGroupId: g1.id,
  });
  const memberships2 = await listProductsByFiscalProductGroupId({
    tenantId: PG_CONC_TENANT, fiscalProductGroupId: g2.id,
  });
  const totalAssigned = memberships.length + memberships2.length;
  assert.equal(totalAssigned, 1, 'produto deve pertencer a exatamente um grupo');
});

// --- SEMANTIC (8D.2 final) ---
const SEM_USER = 'user-x-semantic';
const SEM_TENANT_A = 'tenant-semantic-a';
const SEM_TENANT_B = 'tenant-semantic-b';
const SEM_PRODUCT_FRESH = 'product-fresh-no-profile';

test('8D-SEM-01: produto novo sem profile/lot — primeira associação permitida', async () => {
  __registerCatalogProductForTests(SEM_USER, SEM_PRODUCT_FRESH);
  const actorA = { userId: SEM_USER, empresaId: SEM_TENANT_A };
  const groupA = await createFiscalProductGroup(
    { name: 'GROUP-A-FRESH', tenantId: SEM_TENANT_A },
    actorA,
    adminActorContext,
  );
  const result = await assignProductsToFiscalGroup({
    tenantId: SEM_TENANT_A,
    fiscalProductGroupId: groupA.id,
    productIds: [SEM_PRODUCT_FRESH],
    actor: actorA,
    actorContext: adminActorContext,
  });
  assert.equal(result.assigned.length, 1);
  const lookup = await getFiscalProductGroupForProduct({
    tenantId: SEM_TENANT_A,
    productId: SEM_PRODUCT_FRESH,
  });
  assert.equal(lookup?.group?.id, groupA.id);
});

test('8D-SEM-02: catálogo compartilhado — mesmo productId em TENANT-A e TENANT-B', async () => {
  const sharedProduct = 'product-shared-ab';
  __registerCatalogProductForTests(SEM_USER, sharedProduct);
  const actorA = { userId: SEM_USER, empresaId: SEM_TENANT_A };
  const actorB = { userId: SEM_USER, empresaId: SEM_TENANT_B };
  const groupA = await createFiscalProductGroup(
    { name: 'GROUP-A-SHARED', tenantId: SEM_TENANT_A },
    actorA,
    adminActorContext,
  );
  const groupB = await createFiscalProductGroup(
    { name: 'GROUP-B-SHARED', tenantId: SEM_TENANT_B },
    actorB,
    adminActorContext,
  );
  await assignProductsToFiscalGroup({
    tenantId: SEM_TENANT_A,
    fiscalProductGroupId: groupA.id,
    productIds: [sharedProduct],
    actor: actorA,
    actorContext: adminActorContext,
  });
  await assignProductsToFiscalGroup({
    tenantId: SEM_TENANT_B,
    fiscalProductGroupId: groupB.id,
    productIds: [sharedProduct],
    actor: actorB,
    actorContext: adminActorContext,
  });
  const lookupA = await getFiscalProductGroupForProduct({
    tenantId: SEM_TENANT_A,
    productId: sharedProduct,
  });
  const lookupB = await getFiscalProductGroupForProduct({
    tenantId: SEM_TENANT_B,
    productId: sharedProduct,
  });
  assert.equal(lookupA?.group?.id, groupA.id);
  assert.equal(lookupB?.group?.id, groupB.id);
  assert.notEqual(lookupA?.group?.id, lookupB?.group?.id);
});

test('8D-SEM-03: metadata scopedEmpresaIds autoritativo — rejeita tenant fora do scope', async () => {
  const scopedProduct = 'product-scoped-metadata';
  __registerCatalogProductForTests(SEM_USER, scopedProduct);
  __setCatalogProductMetadataForTests(scopedProduct, {
    scopedEmpresaIds: [SEM_TENANT_A],
  });
  const actorB = { userId: SEM_USER, empresaId: SEM_TENANT_B };
  const groupB = await createFiscalProductGroup(
    { name: 'GROUP-B-SCOPED', tenantId: SEM_TENANT_B },
    actorB,
    adminActorContext,
  );
  await assert.rejects(
    () => assignProductsToFiscalGroup({
      tenantId: SEM_TENANT_B,
      fiscalProductGroupId: groupB.id,
      productIds: [scopedProduct],
      actor: actorB,
      actorContext: adminActorContext,
    }),
    (err) => err.code === 'CATALOG_PRODUCT_TENANT_FORBIDDEN',
  );
});

test('8D-SEM-04: locks runtime tenant+product — sem lock global no bulk (PG)', async (t) => {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
    t.skip('DATABASE_URL unavailable');
    return;
  }
  const {
    __ensureFiscalConfigurationSchemaForTests,
    __deleteFiscalConfigurationForTenantTests,
    buildFiscalProductGroupMembershipAdvisoryLockKey,
    bulkAssignProductsToFiscalGroupPg,
  } = await import('../../src/fiscal-engine/fiscal-configuration/fiscal-configuration.repository.js');

  const PG_SEM_TENANT_A = 'dddddddd-dddd-4ddd-8ddd-dddddddddd01';
  const PG_SEM_TENANT_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddd02';
  const PG_SEM_PROD_A = 'dddddddd-dddd-4ddd-8ddd-dddddddddd03';
  const PG_SEM_PROD_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddd04';

  const keyA = buildFiscalProductGroupMembershipAdvisoryLockKey(PG_SEM_TENANT_A, PG_SEM_PROD_A);
  const keyB = buildFiscalProductGroupMembershipAdvisoryLockKey(PG_SEM_TENANT_B, PG_SEM_PROD_B);
  assert.notEqual(keyA, keyB);
  assert.match(keyA, /^fpg-membership:/);
  assert.match(keyB, /^fpg-membership:/);

  const bulkSource = bulkAssignProductsToFiscalGroupPg.toString();
  assert.match(bulkSource, /maybeAcquireFiscalProductGroupTestDmlSerialLock/);
  assert.match(bulkSource, /buildFiscalProductGroupMembershipAdvisoryLockKey/);
  assert.doesNotMatch(bulkSource, /acquireFiscalProductGroupTestDmlSerialLock\(client\)/);

  await __ensureFiscalConfigurationSchemaForTests();
  await __deleteFiscalConfigurationForTenantTests(PG_SEM_TENANT_A);
  await __deleteFiscalConfigurationForTenantTests(PG_SEM_TENANT_B);
  __setFiscalConfigurationPostgresEnabledForTests(true);
  __registerCatalogProductForTests(PG_ACTOR_ID, PG_SEM_PROD_A);
  __registerCatalogProductForTests(PG_ACTOR_ID, PG_SEM_PROD_B);

  const actorA = { userId: PG_ACTOR_ID, empresaId: PG_SEM_TENANT_A };
  const actorB = { userId: PG_ACTOR_ID, empresaId: PG_SEM_TENANT_B };
  const groupA = await createFiscalProductGroup(
    { name: 'PG-SEM-G-A', tenantId: PG_SEM_TENANT_A },
    actorA,
    adminActorContext,
  );
  const groupB = await createFiscalProductGroup(
    { name: 'PG-SEM-G-B', tenantId: PG_SEM_TENANT_B },
    actorB,
    adminActorContext,
  );

  await Promise.all([
    assignProductsToFiscalGroup({
      tenantId: PG_SEM_TENANT_A,
      fiscalProductGroupId: groupA.id,
      productIds: [PG_SEM_PROD_A],
      actor: actorA,
      actorContext: adminActorContext,
    }),
    assignProductsToFiscalGroup({
      tenantId: PG_SEM_TENANT_B,
      fiscalProductGroupId: groupB.id,
      productIds: [PG_SEM_PROD_B],
      actor: actorB,
      actorContext: adminActorContext,
    }),
  ]);

  const lookupA = await getFiscalProductGroupForProduct({
    tenantId: PG_SEM_TENANT_A,
    productId: PG_SEM_PROD_A,
  });
  const lookupB = await getFiscalProductGroupForProduct({
    tenantId: PG_SEM_TENANT_B,
    productId: PG_SEM_PROD_B,
  });
  assert.equal(lookupA?.group?.id, groupA.id);
  assert.equal(lookupB?.group?.id, groupB.id);
});

test('8D-HARD-06: concorrência PG — ordem reversa P1,P2 vs P2,P1 sem deadlock', async (t) => {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
    t.skip('DATABASE_URL unavailable');
    return;
  }
  const { __ensureFiscalConfigurationSchemaForTests, __deleteFiscalConfigurationForTenantTests } = await import('../../src/fiscal-engine/fiscal-configuration/fiscal-configuration.repository.js');
  const PG_REV_TENANT = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01';
  const PG_P1 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02';
  const PG_P2 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03';

  await __ensureFiscalConfigurationSchemaForTests();
  await __deleteFiscalConfigurationForTenantTests(PG_REV_TENANT);
  __setFiscalConfigurationPostgresEnabledForTests(true);
  __registerCatalogProductForTests(PG_ACTOR_ID, PG_P1);
  __registerCatalogProductForTests(PG_ACTOR_ID, PG_P2);

  const pgActor = { userId: PG_ACTOR_ID, empresaId: PG_REV_TENANT };
  const g1 = await createFiscalProductGroup({ name: 'PG-REV-G1', tenantId: PG_REV_TENANT }, pgActor, adminActorContext);
  const g2 = await createFiscalProductGroup({ name: 'PG-REV-G2', tenantId: PG_REV_TENANT }, pgActor, adminActorContext);

  const tx1 = assignProductsToFiscalGroup({
    tenantId: PG_REV_TENANT, fiscalProductGroupId: g1.id, productIds: [PG_P1, PG_P2],
    replaceExisting: true, actor: pgActor, actorContext: adminActorContext,
  });
  const tx2 = assignProductsToFiscalGroup({
    tenantId: PG_REV_TENANT, fiscalProductGroupId: g2.id, productIds: [PG_P2, PG_P1],
    replaceExisting: true, actor: pgActor, actorContext: adminActorContext,
  });

  const results = await Promise.allSettled([tx1, tx2]);
  for (const r of results) {
    if (r.status === 'rejected') {
      assert.notEqual(r.reason?.code, '40P01', 'não deve ocorrer deadlock');
      assert.notEqual(String(r.reason?.message ?? r.reason), 'deadlock detected');
    }
  }

  const m1 = await listProductsByFiscalProductGroupId({ tenantId: PG_REV_TENANT, fiscalProductGroupId: g1.id });
  const m2 = await listProductsByFiscalProductGroupId({ tenantId: PG_REV_TENANT, fiscalProductGroupId: g2.id });
  const allProductIds = [...m1, ...m2].map((m) => m.productId);
  assert.equal(new Set(allProductIds).size, allProductIds.length, 'sem membership duplicada');
  assert.equal(allProductIds.length, 2, 'P1 e P2 devem ter membership final');
});

test('8D-HARD-07: concorrência PG — ordem reversa P1,P2,P3 vs P3,P2,P1 sem deadlock', async (t) => {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
    t.skip('DATABASE_URL unavailable');
    return;
  }
  const { __ensureFiscalConfigurationSchemaForTests, __deleteFiscalConfigurationForTenantTests } = await import('../../src/fiscal-engine/fiscal-configuration/fiscal-configuration.repository.js');
  const PG_REV3_TENANT = 'ffffffff-ffff-4fff-8fff-ffffffffff01';
  const PG_R1 = 'ffffffff-ffff-4fff-8fff-ffffffffff02';
  const PG_R2 = 'ffffffff-ffff-4fff-8fff-ffffffffff03';
  const PG_R3 = 'ffffffff-ffff-4fff-8fff-ffffffffff04';

  await __ensureFiscalConfigurationSchemaForTests();
  await __deleteFiscalConfigurationForTenantTests(PG_REV3_TENANT);
  __setFiscalConfigurationPostgresEnabledForTests(true);
  __registerCatalogProductForTests(PG_ACTOR_ID, PG_R1);
  __registerCatalogProductForTests(PG_ACTOR_ID, PG_R2);
  __registerCatalogProductForTests(PG_ACTOR_ID, PG_R3);

  const pgActor = { userId: PG_ACTOR_ID, empresaId: PG_REV3_TENANT };
  const g1 = await createFiscalProductGroup({ name: 'PG-REV3-G1', tenantId: PG_REV3_TENANT }, pgActor, adminActorContext);
  const g2 = await createFiscalProductGroup({ name: 'PG-REV3-G2', tenantId: PG_REV3_TENANT }, pgActor, adminActorContext);

  const tx1 = assignProductsToFiscalGroup({
    tenantId: PG_REV3_TENANT, fiscalProductGroupId: g1.id, productIds: [PG_R1, PG_R2, PG_R3],
    replaceExisting: true, actor: pgActor, actorContext: adminActorContext,
  });
  const tx2 = assignProductsToFiscalGroup({
    tenantId: PG_REV3_TENANT, fiscalProductGroupId: g2.id, productIds: [PG_R3, PG_R2, PG_R1],
    replaceExisting: true, actor: pgActor, actorContext: adminActorContext,
  });

  const results = await Promise.allSettled([tx1, tx2]);
  for (const r of results) {
    if (r.status === 'rejected') {
      assert.notEqual(r.reason?.code, '40P01', 'não deve ocorrer deadlock');
    }
  }

  const m1 = await listProductsByFiscalProductGroupId({ tenantId: PG_REV3_TENANT, fiscalProductGroupId: g1.id });
  const m2 = await listProductsByFiscalProductGroupId({ tenantId: PG_REV3_TENANT, fiscalProductGroupId: g2.id });
  const allProductIds = [...m1, ...m2].map((m) => m.productId);
  assert.equal(new Set(allProductIds).size, 3, 'cada produto em no máximo um grupo');
  assert.equal(allProductIds.length, 3, 'P1,P2,P3 com membership final');
});

test('8D-REG-01: baseline preserved', () => {
  assert.equal(FISCAL_ENGINE_TEST_COUNT_AUDIT.baselineHeadMain, 428);
});

test('8D-REG-02: flags OFF', () => {
  assert.equal(isFiscalEngineV3Enabled(), false);
  assert.equal(isFiscalEngineV3ShadowEnabled(), false);
});

test('8D-CK-A: repository contract — product groups memory', async () => {
  await runFiscalProductGroupRepositoryContractTests({
    label: 'memory-8d',
    setup: async () => {
      __resetFiscalConfigurationRepositoryServiceForTests();
      __resetFiscalProductCatalogPortForTests();
      resetFiscalConfigurationRepository();
      __setFiscalConfigurationPostgresEnabledForTests(false);
    },
    teardown: async () => {
      __resetFiscalProductCatalogPortForTests();
      __resetFiscalConfigurationRepositoryServiceForTests();
    },
    tenantId: TENANT,
    actorId: ACTOR_ID,
    productId: 'prod-a',
    productIdB: 'prod-b',
    actorContext: adminActorContext,
  });
});

test('8D-CK-B: repository contract — product groups postgres', async (t) => {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
    t.skip('DATABASE_URL unavailable');
    return;
  }
  const { __ensureFiscalConfigurationSchemaForTests, __deleteFiscalConfigurationForTenantTests } = await import('../../src/fiscal-engine/fiscal-configuration/fiscal-configuration.repository.js');
  const PG_CONTRACT_TENANT = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const PG_CONTRACT_PRODUCT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
  const PG_CONTRACT_PRODUCT_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02';

  await __ensureFiscalConfigurationSchemaForTests();
  await __deleteFiscalConfigurationForTenantTests(PG_CONTRACT_TENANT);
  __setFiscalConfigurationPostgresEnabledForTests(true);

  await runFiscalProductGroupRepositoryContractTests({
    label: 'postgres-8d',
    setup: async () => {},
    teardown: async () => {
      await __deleteFiscalConfigurationForTenantTests(PG_CONTRACT_TENANT);
      __setFiscalConfigurationPostgresEnabledForTests(false);
      __resetFiscalProductCatalogPortForTests();
    },
    tenantId: PG_CONTRACT_TENANT,
    actorId: PG_ACTOR_ID,
    productId: PG_CONTRACT_PRODUCT_A,
    productIdB: PG_CONTRACT_PRODUCT_B,
    actorContext: adminActorContext,
  });
});
