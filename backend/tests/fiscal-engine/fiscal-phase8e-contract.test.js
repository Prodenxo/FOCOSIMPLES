/**
 * Fase 8E.2 — Accountant Fiscal Rule Contract Hardening.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAccountantRuleForApproval,
  evaluateAccountantRuleEngineCapability,
  buildFiscalRulesFromApprovedRule,
  translateApprovedConditionsToFiscalRuleConditions,
  resolveFiscalFromContextWithAccountantConfig,
  APPROVED_RESULT_ALLOWED_KEYS,
  CERTIFIED_ACCOUNTANT_ICMS_XML_FIELD_NAMES,
  EXECUTABLE_CSOSN_CODES,
  OFFICIAL_CSOSN_CODES_CRT1,
  insertApprovedRuleForFixture,
  resetFiscalConfigurationRepository,
  ACCOUNTANT_RULE_STATUS,
  getAccountantApprovedRule,
} from '../../src/fiscal-engine/index.js';
import { ruleMatchesFacts } from '../../src/fiscal-engine/rules/fiscal-rule-engine.js';
import { extractFactsFromContext } from '../../src/fiscal-engine/resolution/fiscal-context-facts.js';
import { buildTestFiscalContext } from './fixtures/fiscal-context-fixture.js';
import {
  bootstrapPhase8cFixtures,
  PHASE8C_TENANT_ID,
  PHASE8C_PRODUCT_ID,
} from '../../src/fiscal-engine/fiscal-configuration/fixtures/phase8c-test-fixtures.js';

const TENANT = PHASE8C_TENANT_ID;

const baseConditions = {
  crt: [1],
  operationType: ['VENDA'],
  operationScope: ['INTERNAL'],
  itemSource: ['THIRD_PARTY'],
  recipientTaxpayerStatus: ['NON_TAXPAYER'],
  priorStStatus: ['NO_ST_EVIDENCE'],
  issuerUf: ['RJ'],
  destinationUf: ['RJ'],
};

const stdApproved = {
  cfop: '5102',
  csosn: '102',
  currentOperationSt: 'NOT_DUE',
};

const draftRule = (overrides = {}) => ({
  id: 'rule-draft',
  tenantId: TENANT,
  version: 1,
  conditions: baseConditions,
  approvedResult: stdApproved,
  validFrom: '2020-01-01',
  ...overrides,
});

const ctxInternalResale = (overrides = {}) => buildTestFiscalContext({
  empresaId: TENANT,
  allocation: {
    empresa_id: TENANT,
    prior_st_status: 'NO_ST_EVIDENCE',
    ...(overrides.allocation ?? {}),
  },
  issuer: { crt: 1, uf: 'RJ', ...(overrides.issuer ?? {}) },
  recipient: {
    uf: 'RJ',
    icmsTaxpayerStatus: 'NON_TAXPAYER',
    cpfCnpj: '12345678901',
    ...(overrides.recipient ?? {}),
  },
  operation: { destinationUf: 'RJ', tipo: 'VENDA', ...(overrides.operation ?? {}) },
  produto: { ncm: '22021000', produtoCatalogoId: PHASE8C_PRODUCT_ID, ...(overrides.produto ?? {}) },
  item: { itemSource: 'THIRD_PARTY', ...(overrides.item ?? {}) },
  referenceDate: '2026-06-15',
  ...overrides.rest,
});

test.beforeEach(() => {
  resetFiscalConfigurationRepository();
  bootstrapPhase8cFixtures();
});
test.afterEach(() => resetFiscalConfigurationRepository());

// --- approvedResult allowlist ---
test('8E-CONTRACT-01: approvedResult desconhecido bloqueia aprovação', () => {
  const result = validateAccountantRuleForApproval(draftRule({
    approvedResult: { ...stdApproved, pis: { cst: '49' } },
  }));
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.code === 'ACCOUNTANT_RULE_UNSUPPORTED_RESULT_FIELD'));
});

test('8E-CONTRACT-02: campo suportado não é silenciosamente removido', () => {
  const constraints = { allowedLocations: ['INTERNA'] };
  const rule = draftRule({
    approvedResult: { ...stdApproved, cfopConstraints: constraints },
  });
  const validation = validateAccountantRuleForApproval(rule);
  assert.equal(validation.ok, true);
  const fiscalRules = buildFiscalRulesFromApprovedRule(rule);
  const cfopRule = fiscalRules.find((r) => r.ruleType === 'CFOP');
  assert.deepEqual(cfopRule.result.cfopConstraints, constraints);
});

// --- conditions → resolution parity ---
test('8E-CONTRACT-03: conditions matchadas são preservadas semanticamente na execução', async () => {
  resetFiscalConfigurationRepository();
  insertApprovedRuleForFixture({
    id: 'aar-parity',
    tenantId: TENANT,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 50,
    conditions: {
      ...baseConditions,
      productId: [PHASE8C_PRODUCT_ID],
      priorStStatus: ['NO_ST_EVIDENCE'],
    },
    approvedResult: { ...stdApproved, cfop: '5101' },
    validFrom: '2020-01-01',
    approvedBy: 'acc',
  });

  const ctxMatch = ctxInternalResale({
    allocation: { produto_catalogo_id: PHASE8C_PRODUCT_ID },
    produto: { produtoCatalogoId: PHASE8C_PRODUCT_ID, ncm: '22021000' },
  });
  const ctxOtherProduct = ctxInternalResale({
    allocation: { produto_catalogo_id: 'other-product' },
    produto: { produtoCatalogoId: 'other-product', ncm: '22021000' },
  });

  const matched = await resolveFiscalFromContextWithAccountantConfig(ctxMatch);
  assert.equal(matched.resolutions.cfop, '5101');

  const unmatched = await resolveFiscalFromContextWithAccountantConfig(ctxOtherProduct);
  assert.notEqual(unmatched.resolutions.cfop, '5101');
});

test('8E-CONTRACT-04: product-specific accountant rule não perde productId na tradução', () => {
  const rule = getAccountantApprovedRule(TENANT, 'aar-t1-by-product');
  const fiscalRules = buildFiscalRulesFromApprovedRule(rule);
  assert.ok(fiscalRules.every((r) => r.conditions.productId?.includes(PHASE8C_PRODUCT_ID)));
});

test('8E-CONTRACT-05: group-specific rule não perde fiscalProductGroupId semanticamente', () => {
  const groupId = 'fpg-test-001';
  const rule = draftRule({
    conditions: { ...baseConditions, fiscalProductGroupId: [groupId] },
  });
  const translated = translateApprovedConditionsToFiscalRuleConditions(rule.conditions);
  assert.deepEqual(translated.fiscalProductGroupId, [groupId]);

  const fiscalRules = buildFiscalRulesFromApprovedRule(rule);
  const ctx = ctxInternalResale();
  const facts = extractFactsFromContext(ctx, {}, { matchingFacts: { fiscalProductGroupId: groupId } });
  assert.ok(fiscalRules.some((r) => ruleMatchesFacts(r, facts)));
});

test('8E-CONTRACT-06: issuer/destination UF da regra selecionada não são perdidas', () => {
  const rule = getAccountantApprovedRule(TENANT, 'aar-t1-internal-resale');
  const fiscalRules = buildFiscalRulesFromApprovedRule(rule);
  assert.ok(fiscalRules.every((r) => r.conditions.issuerUf?.includes('RJ')));
  assert.ok(fiscalRules.every((r) => r.conditions.destinationUf?.includes('RJ')));
});

// --- currentOperationSt ---
test('8E-CONTRACT-07: currentOperationSt ausente não vira NOT_DUE silenciosamente', () => {
  const result = validateAccountantRuleForApproval(draftRule({
    approvedResult: { cfop: '5102', csosn: '102' },
  }));
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.meta?.field === 'currentOperationSt'));
});

test('8E-CONTRACT-08: currentOperationSt explícito NOT_DUE continua funcionando no cenário 102', async () => {
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxInternalResale());
  assert.equal(result.resolutions.csosn, '102');
  assert.equal(result.resolutions.currentSt, 'NOT_DUE');
  assert.equal(result.resolutions.cfop, '5102');
});

// --- CSOSN capability ---
test('8E-CONTRACT-09: CSOSN 102 capability EXECUTABLE', () => {
  const cap = evaluateAccountantRuleEngineCapability(draftRule());
  assert.equal(cap.executable, true);
  assert.ok(EXECUTABLE_CSOSN_CODES.has('102'));
});

test('8E-CONTRACT-10: CSOSN 500 capability EXECUTABLE somente para shape suportado', () => {
  const supported = evaluateAccountantRuleEngineCapability(draftRule({
    approvedResult: {
      cfop: '5102',
      csosn: '500',
      currentOperationSt: 'NOT_DUE',
      requiredXmlFields: ['vBCSTRet', 'vICMSSTRet'],
    },
  }));
  assert.equal(supported.executable, true);

  const unsupportedFields = evaluateAccountantRuleEngineCapability(draftRule({
    approvedResult: {
      cfop: '5102',
      csosn: '500',
      currentOperationSt: 'NOT_DUE',
      requiredXmlFields: ['vBCST'],
    },
  }));
  assert.equal(unsupportedFields.executable, false);
});

for (const csosn of ['201', '202', '203']) {
  test(`8E-CONTRACT-${csosn === '201' ? '11' : csosn === '202' ? '12' : '13'}: CSOSN ${csosn} NÃO é EXECUTABLE`, () => {
    const cap = evaluateAccountantRuleEngineCapability(draftRule({
      approvedResult: { ...stdApproved, csosn },
    }));
    assert.equal(cap.executable, false);
    assert.ok(cap.issues.some((i) => i.code === 'ACCOUNTANT_RULE_NOT_EXECUTABLE'));
  });
}

test('8E-CONTRACT-14: outros CSOSN sem builder completo não são falsamente executable', () => {
  const nonExecutable = OFFICIAL_CSOSN_CODES_CRT1.filter((c) => !EXECUTABLE_CSOSN_CODES.has(c));
  assert.ok(nonExecutable.length > 0);
  for (const csosn of nonExecutable) {
    const cap = evaluateAccountantRuleEngineCapability(draftRule({
      approvedResult: { ...stdApproved, csosn },
    }));
    assert.equal(cap.executable, false, `CSOSN ${csosn} não deveria ser executable`);
  }
});

// --- XML fields ---
test('8E-CONTRACT-15: vBCST requiredXmlField não passa capability enquanto sem resolver', () => {
  const cap = evaluateAccountantRuleEngineCapability(draftRule({
    approvedResult: { ...stdApproved, requiredXmlFields: ['vBCST'] },
  }));
  assert.equal(cap.executable, false);
});

test('8E-CONTRACT-16: vICMSST idem', () => {
  const cap = evaluateAccountantRuleEngineCapability(draftRule({
    approvedResult: { ...stdApproved, requiredXmlFields: ['vICMSST'] },
  }));
  assert.equal(cap.executable, false);
});

test('8E-CONTRACT-17: vBCSTRet suportado percorre pipeline', async () => {
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxInternalResale({
    allocation: {
      prior_st_status: 'RETAINED',
      st_allocation_json: { allocatedValues: { vBCSTRet: '100.00', vICMSSTRet: '18.00' } },
    },
  }));
  assert.equal(result.resolutions.csosn, '500');
  assert.ok(result.resolutions.xmlFields?.taxes?.icms?.fields?.vBCSTRet);
});

test('8E-CONTRACT-18: vICMSSTRet suportado percorre pipeline', async () => {
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxInternalResale({
    allocation: {
      prior_st_status: 'RETAINED',
      st_allocation_json: { allocatedValues: { vBCSTRet: '100.00', vICMSSTRet: '18.00' } },
    },
  }));
  assert.ok(result.resolutions.xmlFields?.taxes?.icms?.fields?.vICMSSTRet);
});

test('8E-CONTRACT-19: campo resolvível mas não certificado não é liberado silenciosamente', () => {
  assert.ok(!CERTIFIED_ACCOUNTANT_ICMS_XML_FIELD_NAMES.includes('vICMSSubstituto'));
  const cap = evaluateAccountantRuleEngineCapability(draftRule({
    approvedResult: { ...stdApproved, requiredXmlFields: ['vICMSSubstituto'] },
  }));
  assert.equal(cap.executable, false);
});

// --- CRT / effectiveFrom ---
test('8E-CONTRACT-20: CRT4 não usa regra CRT1', () => {
  const crt4Rule = draftRule({ conditions: { ...baseConditions, crt: [4] } });
  const fiscalRules = buildFiscalRulesFromApprovedRule(crt4Rule);
  assert.ok(fiscalRules.every((r) => r.applicableCrt.includes(4)));
  assert.ok(fiscalRules.every((r) => !r.applicableCrt.includes(1)));

  const ctx = ctxInternalResale({ issuer: { crt: 4, uf: 'RJ' } });
  const facts = extractFactsFromContext(ctx);
  const matchable = fiscalRules.filter((r) => ruleMatchesFacts(r, facts));
  assert.ok(matchable.length > 0);

  const crt1Ctx = ctxInternalResale({ issuer: { crt: 1, uf: 'RJ' } });
  const crt1Facts = extractFactsFromContext(crt1Ctx);
  assert.equal(fiscalRules.filter((r) => ruleMatchesFacts(r, crt1Facts)).length, 0);
});

test('8E-CONTRACT-21: effectiveFrom não recebe data artificial', () => {
  const rule = draftRule({ validFrom: '2024-06-01', validUntil: undefined });
  const fiscalRules = buildFiscalRulesFromApprovedRule(rule);
  assert.ok(fiscalRules.every((r) => r.effectiveFrom === '2024-06-01'));
  assert.ok(fiscalRules.every((r) => r.effectiveFrom !== '2020-01-01' || rule.validFrom === '2020-01-01'));
});

// --- Regression A/B/C ---
test('8E-REG-A: venda interna comum CSOSN102 CFOP NOT_DUE preservada', async () => {
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxInternalResale());
  assert.equal(result.resolutions.cfop, '5102');
  assert.equal(result.resolutions.csosn, '102');
  assert.equal(result.resolutions.currentSt, 'NOT_DUE');
  assert.equal(result.issues.filter((i) => i.blocksEmission).length, 0);
});

test('8E-REG-B: CSOSN500 priorSt RETAINED com allocation preservada', async () => {
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxInternalResale({
    allocation: {
      prior_st_status: 'RETAINED',
      st_allocation_json: { allocatedValues: { vBCSTRet: '150.00', vICMSSTRet: '27.00' } },
    },
  }));
  assert.equal(result.resolutions.csosn, '500');
  assert.ok(result.resolutions.xmlFields?.taxes?.icms?.fields?.vBCSTRet);
});

test('8E-REG-C: interestadual contribuinte CSOSN102 preservada', async () => {
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxInternalResale({
    recipient: { uf: 'SP', icmsTaxpayerStatus: 'TAXPAYER', cpfCnpj: '12345678000199' },
    operation: { destinationUf: 'SP' },
  }));
  assert.equal(result.resolutions.cfop, '6102');
  assert.equal(result.resolutions.csosn, '102');
});

test('8E-META: allowlist approvedResult documentada', () => {
  assert.deepEqual([...APPROVED_RESULT_ALLOWED_KEYS], [
    'cfop', 'csosn', 'icmsGroup', 'currentOperationSt', 'requiredXmlFields', 'cfopConstraints',
  ]);
});
