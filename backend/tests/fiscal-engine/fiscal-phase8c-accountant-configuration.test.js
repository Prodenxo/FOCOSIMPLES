/**
 * Fase 8C — Configuração fiscal do cliente + regras aprovadas pelo contador.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isFiscalEngineV3Enabled,
  isFiscalEngineV3ShadowEnabled,
  FISCAL_ENGINE_TEST_COUNT_AUDIT,
  resolveAccountantApprovedFiscalRule,
  evaluateFiscalConfigurationReadiness,
  mapMatchStatusToTrafficLight,
  resolveFiscalFromContextWithAccountantConfig,
  previewAccountantRuleMatch,
  approveAccountantFiscalRule,
  createAccountantApprovedRuleDraft,
  createAccountantRuleNewVersion,
  suspendAccountantFiscalRule,
  revokeAccountantFiscalRule,
  buildFiscalRulesFromApprovedRule,
  FISCAL_PROFILE_STATUS,
  ACCOUNTANT_RULE_STATUS,
  APPROVED_RULE_MATCH_STATUS,
  FISCAL_CONFIGURATION_READINESS,
  FISCAL_TRAFFIC_LIGHT,
  FISCAL_CONFIG_PERMISSIONS,
  insertApprovedRuleForFixture,
} from '../../src/fiscal-engine/index.js';
import { buildTestFiscalContext } from './fixtures/fiscal-context-fixture.js';
import {
  bootstrapPhase8cFixtures,
  resetFiscalConfigurationRepository,
  PHASE8C_TENANT_ID,
  PHASE8C_TENANT_B,
  PHASE8C_PRODUCT_ID,
  getCompanyFiscalProfile,
  saveCompanyFiscalProfile,
  listAccountantApprovedRulesForTenant,
  saveAccountantApprovedRule,
  getProductFiscalProfile,
} from '../../src/fiscal-engine/fiscal-configuration/fixtures/phase8c-test-fixtures.js';

test.beforeEach(() => bootstrapPhase8cFixtures());
test.afterEach(() => resetFiscalConfigurationRepository());

const adminActor = { userId: 'accountant-fixture', empresaId: PHASE8C_TENANT_ID };
const adminActorContext = { profileRole: 'admin', memberships: [{ role: 'admin' }] };
const usuarioActor = { userId: 'usuario-001', empresaId: PHASE8C_TENANT_ID };
const usuarioActorContext = { profileRole: 'usuario', memberships: [{ role: 'usuario' }] };

const ctxInternalResale = (overrides = {}) => {
  const empresaId = overrides.empresaId ?? PHASE8C_TENANT_ID;
  const {
    allocation: allocationOverrides = {},
    issuer: issuerOverrides = {},
    recipient: recipientOverrides = {},
    produto: produtoOverrides = {},
    item: itemOverrides = {},
    operation: operationOverrides = {},
    ...restOverrides
  } = overrides;

  return buildTestFiscalContext({
    empresaId,
    allocation: {
      empresa_id: empresaId,
      ...allocationOverrides,
    },
    issuer: { crt: 1, uf: 'RJ', ...issuerOverrides },
    recipient: {
      uf: 'RJ',
      icmsTaxpayerStatus: 'NON_TAXPAYER',
      cpfCnpj: '12345678901',
      ...recipientOverrides,
    },
    operation: { destinationUf: 'RJ', tipo: 'VENDA', ...operationOverrides },
    produto: { ncm: '22021000', produtoCatalogoId: PHASE8C_PRODUCT_ID, ...produtoOverrides },
    item: { itemSource: 'THIRD_PARTY', ...itemOverrides },
    referenceDate: '2026-06-15',
    ...restOverrides,
  });
};

// --- Company Profile (47) ---
test('8C-C01: CompanyFiscalProfile CRT1 ACTIVE', () => {
  const p = getCompanyFiscalProfile(PHASE8C_TENANT_ID);
  assert.equal(p.crt, 1);
  assert.equal(p.status, FISCAL_PROFILE_STATUS.ACTIVE);
  assert.equal(p.issuerUf, 'RJ');
});

test('8C-C02: CRT4 não herda CRT1 no profile', () => {
  const p = getCompanyFiscalProfile(PHASE8C_TENANT_ID);
  assert.notEqual(p.crt, 4);
});

test('8C-C03: tenant isolation company profile', () => {
  assert.equal(getCompanyFiscalProfile(PHASE8C_TENANT_B), null);
});

test('8C-C04: perfil DRAFT não é ACTIVE', () => {
  const p = getCompanyFiscalProfile(PHASE8C_TENANT_ID);
  assert.notEqual(p.status, FISCAL_PROFILE_STATUS.DRAFT);
});

// --- Product Profile (48) ---
test('8C-P01: produto possui NCM configurado', () => {
  const p = getProductFiscalProfile(PHASE8C_TENANT_ID, PHASE8C_PRODUCT_ID);
  assert.equal(p.ncm, '22021000');
  assert.ok(p.itemSource);
});

test('8C-P02: NCM sozinho não gera ST na resolução 8C', async () => {
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxInternalResale());
  assert.notEqual(result.resolutions.currentSt, 'DUE_BY_ISSUER');
});

// --- Customer Profile (49) ---
test('8C-U01: PF NON_TAXPAYER no contexto', () => {
  const ctx = ctxInternalResale();
  assert.equal(ctx.destinatario.icmsTaxpayerStatus, 'NON_TAXPAYER');
});

test('8C-U02: PJ TAXPAYER interestadual', () => {
  const ctx = ctxInternalResale({
    recipient: { uf: 'SP', icmsTaxpayerStatus: 'TAXPAYER', cpfCnpj: '12345678000199' },
    operation: { destinationUf: 'SP' },
  });
  assert.equal(ctx.operacao.localizacao, 'INTERESTADUAL');
});

test('8C-U03: operation override finalConsumer', async () => {
  const ctx = ctxInternalResale({
    recipient: { consumidorFinal: false },
    operation: { consumidorFinal: true },
  });
  const preview = await previewAccountantRuleMatch(ctx);
  assert.ok(preview);
});

// --- Accountant Approved Rule (50) ---
test('8C-R01: DRAFT não pode ser usada', () => {
  const rules = listAccountantApprovedRulesForTenant(PHASE8C_TENANT_ID);
  const draft = rules.find((r) => r.status === ACCOUNTANT_RULE_STATUS.DRAFT);
  const match = resolveAccountantApprovedFiscalRule(ctxInternalResale(), [draft]);
  assert.equal(match.status, APPROVED_RULE_MATCH_STATUS.NO_MATCH);
});

test('8C-R02: APPROVED participa do matching', () => {
  const match = resolveAccountantApprovedFiscalRule(
    ctxInternalResale(),
    listAccountantApprovedRulesForTenant(PHASE8C_TENANT_ID),
  );
  assert.equal(match.status, APPROVED_RULE_MATCH_STATUS.MATCHED);
});

test('8C-R03: SUSPENDED não aplica', async () => {
  await suspendAccountantFiscalRule(PHASE8C_TENANT_ID, 'aar-t1-internal-resale', adminActor, adminActorContext);
  const rules = listAccountantApprovedRulesForTenant(PHASE8C_TENANT_ID)
    .filter((r) => r.status === ACCOUNTANT_RULE_STATUS.APPROVED);
  const match = resolveAccountantApprovedFiscalRule(ctxInternalResale(), rules);
  assert.notEqual(match.ruleId, 'aar-t1-internal-resale');
});

test('8C-R04: REVOKED não aplica', async () => {
  await revokeAccountantFiscalRule(PHASE8C_TENANT_ID, 'aar-t1-internal-resale', adminActor, adminActorContext);
  const rules = listAccountantApprovedRulesForTenant(PHASE8C_TENANT_ID)
    .filter((r) => r.status === ACCOUNTANT_RULE_STATUS.APPROVED);
  const specific = rules.filter((r) => r.id === 'aar-t1-internal-resale');
  assert.equal(specific.length, 0);
});

test('8C-R05: validFrom future não aplica', () => {
  insertApprovedRuleForFixture({
    id: 'aar-future',
    tenantId: PHASE8C_TENANT_ID,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    conditions: { crt: [1], operationType: ['VENDA'] },
    approvedResult: { cfop: '9999', csosn: '102', currentOperationSt: 'NOT_DUE' },
    validFrom: '2030-01-01',
    approvedBy: 'acc',
  });
  const match = resolveAccountantApprovedFiscalRule(
    ctxInternalResale({ referenceDate: '2026-06-15' }),
    listAccountantApprovedRulesForTenant(PHASE8C_TENANT_ID),
  );
  assert.notEqual(match.approvedResult?.cfop, '9999');
});

test('8C-R06: tenant diferente não aplica', () => {
  const match = resolveAccountantApprovedFiscalRule(
    ctxInternalResale({ empresaId: PHASE8C_TENANT_B }),
    listAccountantApprovedRulesForTenant(PHASE8C_TENANT_ID),
  );
  assert.equal(match.status, APPROVED_RULE_MATCH_STATUS.NO_MATCH);
});

// --- Matching (51) ---
test('8C-M01: regra mais específica por produto vence', () => {
  const match = resolveAccountantApprovedFiscalRule(
    ctxInternalResale({ produto: { produtoCatalogoId: PHASE8C_PRODUCT_ID, ncm: '22021000' } }),
    listAccountantApprovedRulesForTenant(PHASE8C_TENANT_ID),
  );
  assert.equal(match.status, APPROVED_RULE_MATCH_STATUS.MATCHED);
  assert.ok(match.specificity >= 10);
});

test('8C-M02: interestadual contribuinte usa regra correspondente', async () => {
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxInternalResale({
    recipient: { uf: 'SP', icmsTaxpayerStatus: 'TAXPAYER', cpfCnpj: '12345678000199' },
    operation: { destinationUf: 'SP' },
  }));
  assert.equal(result.resolutions.cfop, '6102');
});

test('8C-M03: conflito mesma especificidade bloqueia', () => {
  resetFiscalConfigurationRepository();
  insertApprovedRuleForFixture({
    id: 'aar-conflict-a',
    tenantId: PHASE8C_TENANT_ID,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 100,
    conditions: {
      crt: [1], operationType: ['VENDA'], operationScope: ['INTERNAL'],
      itemSource: ['THIRD_PARTY'], recipientTaxpayerStatus: ['NON_TAXPAYER'],
      priorStStatus: ['NO_ST_EVIDENCE'], issuerUf: ['RJ'], destinationUf: ['RJ'],
    },
    approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
    validFrom: '2020-01-01',
    approvedBy: 'acc',
  });
  insertApprovedRuleForFixture({
    id: 'aar-conflict-b',
    tenantId: PHASE8C_TENANT_ID,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 100,
    conditions: {
      crt: [1], operationType: ['VENDA'], operationScope: ['INTERNAL'],
      itemSource: ['THIRD_PARTY'], recipientTaxpayerStatus: ['NON_TAXPAYER'],
      priorStStatus: ['NO_ST_EVIDENCE'], issuerUf: ['RJ'], destinationUf: ['RJ'],
    },
    approvedResult: { cfop: '5405', csosn: '500', currentOperationSt: 'NOT_DUE' },
    validFrom: '2020-01-01',
    approvedBy: 'acc',
  });
  const match = resolveAccountantApprovedFiscalRule(
    ctxInternalResale(),
    listAccountantApprovedRulesForTenant(PHASE8C_TENANT_ID),
  );
  assert.equal(match.status, APPROVED_RULE_MATCH_STATUS.CONFLICT);
});

// --- Incomplete context (52) ---
test('8C-I01: taxpayerStatus UNKNOWN => INCOMPLETE_CONTEXT', () => {
  resetFiscalConfigurationRepository();
  insertApprovedRuleForFixture({
    id: 'aar-needs-taxpayer',
    tenantId: PHASE8C_TENANT_ID,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    conditions: {
      crt: [1],
      recipientTaxpayerStatus: ['TAXPAYER'],
      operationType: ['VENDA'],
    },
    approvedResult: { cfop: '6102', csosn: '102', currentOperationSt: 'NOT_DUE' },
    validFrom: '2020-01-01',
    approvedBy: 'acc',
  });
  const match = resolveAccountantApprovedFiscalRule(
    ctxInternalResale({ recipient: { icmsTaxpayerStatus: 'UNKNOWN' } }),
    listAccountantApprovedRulesForTenant(PHASE8C_TENANT_ID),
  );
  assert.equal(match.status, APPROVED_RULE_MATCH_STATUS.INCOMPLETE_CONTEXT);
  assert.ok(match.missingFacts.includes('recipientTaxpayerStatus'));
});

test('8C-I02: NCM ausente => INCOMPLETE_CONTEXT quando regra exige', () => {
  resetFiscalConfigurationRepository();
  insertApprovedRuleForFixture({
    id: 'aar-needs-ncm',
    tenantId: PHASE8C_TENANT_ID,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    conditions: { crt: [1], ncm: ['22021000'], operationType: ['VENDA'] },
    approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
    validFrom: '2020-01-01',
    approvedBy: 'acc',
  });
  const match = resolveAccountantApprovedFiscalRule(
    ctxInternalResale({ produto: { ncm: null } }),
    listAccountantApprovedRulesForTenant(PHASE8C_TENANT_ID),
  );
  assert.equal(match.status, APPROVED_RULE_MATCH_STATUS.INCOMPLETE_CONTEXT);
});

// --- Auto application (53-54) ---
test('8C-A01: usuário emite sem CFOP/CSOSN — sistema aplica regra aprovada', async () => {
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxInternalResale());
  assert.equal(result.resolutions.cfop, '5102');
  assert.equal(result.resolutions.csosn, '102');
  assert.equal(result.audit.accountantConfig.fiscalConfigurationSource, 'ACCOUNTANT_APPROVED_RULE');
  assert.equal(result.audit.accountantConfig.accountantApprovedRuleId, 'aar-t1-internal-resale');
});

test('8C-A02: cenário diferente não usa regra interna', async () => {
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxInternalResale({
    recipient: { uf: 'SP', icmsTaxpayerStatus: 'TAXPAYER', cpfCnpj: '12345678000199' },
    operation: { destinationUf: 'SP' },
  }));
  assert.equal(result.resolutions.cfop, '6102');
  assert.notEqual(result.audit.accountantConfig.accountantApprovedRuleId, 'aar-t1-internal-resale');
});

// --- ST split (55) ---
test('8C-S01: RETAINED usa regra ST aprovada com requiredXmlFields', async () => {
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxInternalResale({
    allocation: {
      prior_st_status: 'RETAINED',
      st_allocation_json: { allocatedValues: { vBCSTRet: '10.00', vICMSSTRet: '1.80' } },
    },
  }));
  assert.equal(result.resolutions.csosn, '500');
});

test('8C-S02: NO_ST_EVIDENCE não usa regra RETAINED', async () => {
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxInternalResale());
  assert.equal(result.resolutions.csosn, '102');
});

// --- Audit (56) ---
test('8C-AUDIT01: FiscalResult registra regra, versão e aprovador', async () => {
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxInternalResale());
  assert.ok(result.audit.accountantConfig.approvedBy);
  assert.ok(result.audit.accountantConfig.ruleVersion);
  assert.ok(Array.isArray(result.audit.accountantConfig.matchReasons));
});

// --- Readiness (57) ---
test('8C-READY01: tenant configurado => readiness não INCOMPLETE', () => {
  const r = evaluateFiscalConfigurationReadiness({ tenantId: PHASE8C_TENANT_ID });
  assert.notEqual(r.readiness, FISCAL_CONFIGURATION_READINESS.INCOMPLETE);
});

test('8C-READY02: sem regras aprovadas => PARTIAL', () => {
  resetFiscalConfigurationRepository();
  saveCompanyFiscalProfile({
    id: 'cfp-partial',
    tenantId: PHASE8C_TENANT_ID,
    companyId: PHASE8C_TENANT_ID,
    establishmentId: 'default',
    crt: 1,
    issuerUf: 'RJ',
    status: FISCAL_PROFILE_STATUS.ACTIVE,
    validFrom: '2020-01-01',
  });
  const r = evaluateFiscalConfigurationReadiness({ tenantId: PHASE8C_TENANT_ID });
  assert.equal(r.readiness, FISCAL_CONFIGURATION_READINESS.PARTIAL);
});

test('8C-READY03: semáforo FISCAL_VALIDATED quando matched', () => {
  const r = evaluateFiscalConfigurationReadiness({
    tenantId: PHASE8C_TENANT_ID,
    context: ctxInternalResale(),
  });
  assert.equal(r.trafficLight, FISCAL_TRAFFIC_LIGHT.FISCAL_VALIDATED);
});

// --- NO MATCH (58) ---
test('8C-NM01: sem regra aprovada não inventa 5102/102', async () => {
  resetFiscalConfigurationRepository();
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxInternalResale());
  assert.equal(result.resolutions.cfop, null);
  assert.equal(result.resolutions.csosn, null);
  assert.ok(result.issues.some((i) => i.code === 'REQUIRES_ACCOUNTANT_REVIEW'));
});

// --- Versioning (36) ---
test('8C-V01: nova versão preserva histórico', async () => {
  await createAccountantRuleNewVersion(PHASE8C_TENANT_ID, 'aar-t1-internal-resale', {
    validFrom: '2026-09-01',
    approvedResult: { cfop: '5102', csosn: '103', currentOperationSt: 'NOT_DUE' },
  }, adminActor, adminActorContext);
  const rules = listAccountantApprovedRulesForTenant(PHASE8C_TENANT_ID)
    .filter((r) => r.id === 'aar-t1-internal-resale');
  assert.equal(rules.length, 2);
  assert.ok(rules.some((r) => r.version === 1 && r.status === ACCOUNTANT_RULE_STATUS.APPROVED));
  assert.ok(rules.some((r) => r.version === 2 && r.status === ACCOUNTANT_RULE_STATUS.DRAFT));
});

// --- Regression invariants (59) ---
test('8C-REG01: baseline test count audit preservado', () => {
  assert.equal(FISCAL_ENGINE_TEST_COUNT_AUDIT.baselineHeadMain, 428);
});

test('8C-REG02: FISCAL_ENGINE_V3=false', () => {
  assert.equal(isFiscalEngineV3Enabled(), false);
});

test('8C-REG03: FISCAL_ENGINE_V3_SHADOW=false', () => {
  assert.equal(isFiscalEngineV3ShadowEnabled(), false);
});

test('8C-REG04: permissões fiscal configuration definidas', () => {
  assert.ok(FISCAL_CONFIG_PERMISSIONS.APPROVE);
});

test('8C-REG05: buildFiscalRulesFromApprovedRule gera regras efêmeras sem productionReady', () => {
  const rule = listAccountantApprovedRulesForTenant(PHASE8C_TENANT_ID)
    .find((r) => r.id === 'aar-t1-internal-resale');
  const fiscalRules = buildFiscalRulesFromApprovedRule(rule);
  assert.ok(fiscalRules.some((r) => r.ruleType === 'CFOP'));
  assert.ok(fiscalRules.some((r) => r.ruleType === 'CSOSN'));
  assert.ok(fiscalRules.every((r) => r.productionReady === false));
  assert.ok(fiscalRules.every((r) => r.accountantApproved === true));
});

test('8C-REG06: approve draft workflow', async () => {
  resetFiscalConfigurationRepository();
  await createAccountantApprovedRuleDraft({
    id: 'aar-new-draft',
    tenantId: PHASE8C_TENANT_ID,
    version: 1,
    conditions: { crt: [1], operationType: ['VENDA'], operationScope: ['INTERNAL'], itemSource: ['THIRD_PARTY'] },
    approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
    validFrom: '2020-01-01',
  }, adminActor, adminActorContext);
  await approveAccountantFiscalRule(PHASE8C_TENANT_ID, 'aar-new-draft', adminActor, adminActorContext);
  const approved = listAccountantApprovedRulesForTenant(PHASE8C_TENANT_ID)
    .find((r) => r.id === 'aar-new-draft');
  assert.equal(approved.status, ACCOUNTANT_RULE_STATUS.APPROVED);
  assert.equal(approved.approvedBy, adminActor.userId);
});
