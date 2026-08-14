/**
 * Fase 8E.3 — ST devida pelo emitente (CSOSN 201/202/203).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAccountantRuleForApproval,
  evaluateAccountantRuleEngineCapability,
  resolveFiscalFromContextWithAccountantConfig,
  resolveFiscalFromContext,
  calculateAccountantStDueFromParameters,
  resolveIssuerStDueCalculation,
  buildIssuerStDueIcmsFields,
  validateStParametersContract,
  insertApprovedRuleForFixture,
  resetFiscalConfigurationRepository,
  ACCOUNTANT_RULE_STATUS,
  buildFiscalRulesFromApprovedRule,
  ST_DUE_OWN_ICMS_POLICY,
  ST_PERCENT_FIELD_RULES,
  assertIssuerStDueXmlFieldsComplete,
  ISSUER_ST_DUE_XML_GROUP_CONTRACT,
  resolveCanonicalCommercialBase,
} from '../../src/fiscal-engine/index.js';
import { buildTestFiscalContext } from './fixtures/fiscal-context-fixture.js';

const TENANT = 'tenant-phase8e3-t1';

const VALID_ST_PARAMS = {
  modBCST: '4',
  pMVAST: '40.0000',
  pICMSST: '18.0000',
};

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

const dueApproved = (csosn, stOverrides = {}) => ({
  cfop: '5405',
  csosn,
  icmsGroup: `ICMSSN${csosn}`,
  currentOperationSt: 'DUE_BY_ISSUER',
  stParameters: { ...VALID_ST_PARAMS, ...stOverrides },
});

const draftRule = (overrides = {}) => ({
  id: 'rule-st-due',
  tenantId: TENANT,
  version: 1,
  conditions: STD_CONDITIONS,
  approvedResult: dueApproved('201'),
  validFrom: '2020-01-01',
  ...overrides,
});

const ctxStDue = (overrides = {}) => buildTestFiscalContext({
  empresaId: TENANT,
  allocation: {
    empresa_id: TENANT,
    prior_st_status: 'NO_ST_EVIDENCE',
    origem_mercadoria: '0',
    ...(overrides.allocation ?? {}),
  },
  issuer: { crt: 1, uf: 'RJ', ...(overrides.issuer ?? {}) },
  recipient: { uf: 'RJ', icmsTaxpayerStatus: 'NON_TAXPAYER', ...(overrides.recipient ?? {}) },
  operation: { destinationUf: 'RJ', tipo: 'VENDA', ...(overrides.operation ?? {}) },
  item: { itemSource: 'THIRD_PARTY', quantidade: 1, valorUnitario: 100, ...(overrides.item ?? {}) },
  referenceDate: '2026-06-15',
});

const insertDueRule = (id, csosn, stOverrides = {}) => {
  insertApprovedRuleForFixture({
    id,
    tenantId: TENANT,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 100,
    conditions: STD_CONDITIONS,
    approvedResult: dueApproved(csosn, stOverrides),
    validFrom: '2020-01-01',
    approvedBy: 'acc',
  });
};

test.beforeEach(() => resetFiscalConfigurationRepository());
test.afterEach(() => resetFiscalConfigurationRepository());

// --- Capability / validation ---
test('8E3-ST-01: CSOSN201 + DUE + params válidos → executable', () => {
  const cap = evaluateAccountantRuleEngineCapability(draftRule());
  assert.equal(cap.executable, true);
});

test('8E3-ST-02: CSOSN202 + DUE → executable', () => {
  const cap = evaluateAccountantRuleEngineCapability(draftRule({
    approvedResult: dueApproved('202'),
  }));
  assert.equal(cap.executable, true);
});

test('8E3-ST-03: CSOSN203 + DUE → executable', () => {
  const cap = evaluateAccountantRuleEngineCapability(draftRule({
    approvedResult: dueApproved('203'),
  }));
  assert.equal(cap.executable, true);
});

test('8E3-ST-04: 201 + NOT_DUE → rejeitado', () => {
  const result = validateAccountantRuleForApproval(draftRule({
    approvedResult: { cfop: '5405', csosn: '201', currentOperationSt: 'NOT_DUE' },
  }));
  assert.equal(result.ok, false);
});

test('8E3-ST-05: DUE sem stParameters → rejeitado', () => {
  const result = validateAccountantRuleForApproval(draftRule({
    approvedResult: { cfop: '5405', csosn: '201', currentOperationSt: 'DUE_BY_ISSUER' },
  }));
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.meta?.field === 'stParameters' || i.message.includes('stParameters')));
});

test('8E3-ST-06: pICMSST ausente → rejeitado', () => {
  const issues = validateStParametersContract({
    csosn: '201',
    currentOperationSt: 'DUE_BY_ISSUER',
    stParameters: { modBCST: '4', pMVAST: '40.0000' },
  });
  assert.ok(issues.some((i) => i.meta?.field === 'pICMSST'));
});

test('8E3-ST-07: campo stParameters desconhecido → rejeitado', () => {
  const issues = validateStParametersContract({
    csosn: '201',
    currentOperationSt: 'DUE_BY_ISSUER',
    stParameters: { ...VALID_ST_PARAMS, vBCST: '999.00' },
  });
  assert.ok(issues.some((i) => i.code === 'ACCOUNTANT_RULE_UNSUPPORTED_ST_PARAMETER_FIELD'));
});

test('8E3-ST-08: pRedBCST=0 preservado', () => {
  const issues = validateStParametersContract({
    csosn: '202',
    currentOperationSt: 'DUE_BY_ISSUER',
    stParameters: { ...VALID_ST_PARAMS, pRedBCST: '0' },
  });
  assert.equal(issues.length, 0);
  const calc = calculateAccountantStDueFromParameters(
    { ...VALID_ST_PARAMS, pRedBCST: '0' },
    '100.00',
    '2026-06-15',
  );
  assert.equal(calc.bcSt, '140.00');
});

// --- Calculation ---
test('8E3-ST-09: MVA decimal determinístico', () => {
  const calc = calculateAccountantStDueFromParameters(
    { modBCST: '4', pMVAST: '33.3333', pICMSST: '18.0000' },
    '100.00',
    '2026-06-15',
  );
  assert.equal(calc.ok, true);
  assert.equal(calc.bcSt, '133.33');
  assert.equal(calc.icmsSt, '24.00');
});

test('8E3-ST-10: rounding determinístico com redução', () => {
  const calc = calculateAccountantStDueFromParameters(
    { modBCST: '4', pMVAST: '40.0000', pICMSST: '18.0000', pRedBCST: '10' },
    '100.00',
    '2026-06-15',
  );
  assert.equal(calc.bcSt, '126.00');
  assert.equal(calc.icmsSt, '22.68');
});

// --- Pipeline E2E ---
test('8E3-ST-11: vBCST produzido', async () => {
  insertDueRule('due-201', '201');
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxStDue());
  assert.equal(result.resolutions.csosn, '201');
  assert.equal(result.resolutions.currentSt, 'DUE_BY_ISSUER');
  assert.equal(result.resolutions.xmlFields?.taxes?.icms?.fields?.vBCST, '140.00');
});

test('8E3-ST-12: vICMSST produzido', async () => {
  insertDueRule('due-202', '202');
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxStDue());
  assert.equal(result.resolutions.xmlFields?.taxes?.icms?.fields?.vICMSST, '25.20');
});

test('8E3-ST-13: ICMSSN201 XML completo', async () => {
  insertDueRule('due-201-xml', '201');
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxStDue());
  const fields = result.resolutions.xmlFields?.taxes?.icms?.fields ?? {};
  assert.equal(result.resolutions.xmlFields?.taxes?.icms?.group, 'ICMSSN201');
  assert.equal(fields.CSOSN, '201');
  assert.equal(fields.modBCST, '4');
  assert.ok(fields.pMVAST);
  assert.ok(fields.pICMSST);
  assert.ok(fields.vBCST);
  assert.ok(fields.vICMSST);
});

test('8E3-ST-14: ICMSSN202 XML completo', async () => {
  insertDueRule('due-202-xml', '202');
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxStDue());
  assert.equal(result.resolutions.xmlFields?.taxes?.icms?.group, 'ICMSSN202');
  assert.equal(result.resolutions.xmlFields?.taxes?.icms?.fields?.CSOSN, '202');
});

test('8E3-ST-15: ICMSSN203 XML completo', async () => {
  insertDueRule('due-203-xml', '203');
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxStDue());
  assert.equal(result.resolutions.xmlFields?.taxes?.icms?.group, 'ICMSSN203');
  assert.equal(result.resolutions.xmlFields?.taxes?.icms?.fields?.CSOSN, '203');
});

test('8E3-ST-16: builder não recalcula ST', async () => {
  insertDueRule('due-no-recalc', '201');
  const ctx = ctxStDue();
  const stCalc = resolveIssuerStDueCalculation({
    ...ctx,
    fiscalExtensions: { accountantApprovedStParameters: VALID_ST_PARAMS },
  });
  const xmlFields = buildIssuerStDueIcmsFields({
    csosn: '201',
    stParameters: VALID_ST_PARAMS,
    stCalculation: stCalc,
    referenceDate: '2026-06-15',
  });
  assert.equal(xmlFields.vBCST, stCalc.result.bcSt);
  assert.equal(xmlFields.vICMSST, stCalc.result.icmsSt);
});

test('8E3-ST-17: mesmo input → mesmo resultado', async () => {
  insertDueRule('due-idempotent', '202');
  const ctx = ctxStDue();
  const r1 = await resolveFiscalFromContextWithAccountantConfig(ctx);
  const r2 = await resolveFiscalFromContextWithAccountantConfig(ctx);
  assert.deepEqual(r1.resolutions.stCalculation, r2.resolutions.stCalculation);
  assert.equal(r1.resolutions.xmlFields?.taxes?.icms?.fields?.vICMSST,
    r2.resolutions.xmlFields?.taxes?.icms?.fields?.vICMSST);
});

test('8E3-ST-18: priorStStatus não decide currentOperationSt', async () => {
  insertApprovedRuleForFixture({
    id: 'due-any-prior',
    tenantId: TENANT,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 100,
    conditions: {
      crt: [1],
      operationType: ['VENDA'],
      operationScope: ['INTERNAL'],
      itemSource: ['THIRD_PARTY'],
    },
    approvedResult: dueApproved('201'),
    validFrom: '2020-01-01',
    approvedBy: 'acc',
  });
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxStDue({
    allocation: { prior_st_status: 'RETAINED', st_allocation_json: { allocatedValues: { vBCSTRet: '10' } } },
  }));
  assert.equal(result.resolutions.currentSt, 'DUE_BY_ISSUER');
  assert.equal(result.resolutions.csosn, '201');
});

test('8E3-ST-19: produto/grupo não sugere parâmetros ST', () => {
  const fiscalRules = buildFiscalRulesFromApprovedRule(draftRule({
    conditions: { ...STD_CONDITIONS, productId: ['prod-x'], fiscalProductGroupId: ['grp-x'] },
  }));
  const csosnRule = fiscalRules.find((r) => r.ruleType === 'CSOSN');
  assert.deepEqual(csosnRule.result.stParameters, VALID_ST_PARAMS);
});

test('8E3-ST-20: CRT4 não herda caminho CRT1', () => {
  const fiscalRules = buildFiscalRulesFromApprovedRule(draftRule());
  const ctx = ctxStDue({ issuer: { crt: 4, uf: 'RJ' } });
  const result = resolveFiscalFromContext(ctx, {
    rules: fiscalRules,
    allowAccountantApprovedConfiguration: true,
  });
  assert.notEqual(result.resolutions.csosn, '201');
  assert.equal(result.resolutions.csosn, null);
});

// --- Regressão 102/500 ---
test('8E3-REG-102: CSOSN102 NOT_DUE preservado', async () => {
  insertApprovedRuleForFixture({
    id: 'reg-102',
    tenantId: TENANT,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    conditions: STD_CONDITIONS,
    approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
    validFrom: '2020-01-01',
    approvedBy: 'acc',
  });
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxStDue());
  assert.equal(result.resolutions.csosn, '102');
  assert.equal(result.resolutions.currentSt, 'NOT_DUE');
});

test('8E3-REG-500: CSOSN500 RETAINED preservado', async () => {
  insertApprovedRuleForFixture({
    id: 'reg-500',
    tenantId: TENANT,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    conditions: { ...STD_CONDITIONS, priorStStatus: ['RETAINED'] },
    approvedResult: {
      cfop: '5102', csosn: '500', currentOperationSt: 'NOT_DUE',
      requiredXmlFields: ['vBCSTRet', 'vICMSSTRet'],
    },
    validFrom: '2020-01-01',
    approvedBy: 'acc',
  });
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxStDue({
    allocation: {
      prior_st_status: 'RETAINED',
      st_allocation_json: { allocatedValues: { vBCSTRet: '50.00', vICMSSTRet: '9.00' } },
    },
  }));
  assert.equal(result.resolutions.csosn, '500');
});

// --- Hardening 8E.3 ---
test('8E3-HARD-01: completude XML ICMSSN201', async () => {
  insertDueRule('hard-201', '201');
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxStDue());
  const fields = result.resolutions.xmlFields?.taxes?.icms?.fields ?? {};
  const check = assertIssuerStDueXmlFieldsComplete('201', fields);
  assert.equal(check.ok, true, `missing: ${check.missing.join(',')}`);
  assert.deepEqual(Object.keys(fields).sort(), ['CSOSN', 'modBCST', 'orig', 'pICMSST', 'pMVAST', 'vBCST', 'vICMSST']);
});

test('8E3-HARD-02: completude XML ICMSSN202', async () => {
  insertDueRule('hard-202', '202');
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxStDue());
  const fields = result.resolutions.xmlFields?.taxes?.icms?.fields ?? {};
  const check = assertIssuerStDueXmlFieldsComplete('202', fields);
  assert.equal(check.ok, true);
  assert.equal(result.resolutions.xmlFields?.taxes?.icms?.group, 'ICMSSN202');
});

test('8E3-HARD-03: completude XML ICMSSN203', async () => {
  insertDueRule('hard-203', '203');
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxStDue());
  const fields = result.resolutions.xmlFields?.taxes?.icms?.fields ?? {};
  const check = assertIssuerStDueXmlFieldsComplete('203', fields);
  assert.equal(check.ok, true);
  assert.equal(fields.CSOSN, '203');
});

test('8E3-HARD-04: pRedBCST ausente preserva ausência semanticamente', async () => {
  insertDueRule('hard-no-pred', '202');
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxStDue());
  const fields = result.resolutions.xmlFields?.taxes?.icms?.fields ?? {};
  assert.equal('pRedBCST' in fields, false);
  const calc = result.resolutions.stCalculation;
  assert.equal(calc.parameters?.pRedBCST, undefined);
});

test('8E3-HARD-05: pRedBCST=0 preserva zero explicitamente', async () => {
  insertDueRule('hard-pred-zero', '201', { pRedBCST: '0' });
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxStDue());
  const fields = result.resolutions.xmlFields?.taxes?.icms?.fields ?? {};
  assert.equal(fields.pRedBCST, '0.0000');
  assert.equal(result.resolutions.stCalculation.parameters.pRedBCST, '0');
});

test('8E3-HARD-06: baseSource reproduz exatamente commercialBase', async () => {
  insertDueRule('hard-base', '202');
  const fallback = resolveCanonicalCommercialBase({ quantidade: 2, valorUnitario: 50 }, '2026-06-15');
  assert.equal(fallback.baseSource, 'item.quantidade×valorUnitario');
  assert.equal(fallback.commercialBase, '100.00');

  const ctx = ctxStDue({ item: { quantidade: 2, valorUnitario: 50, valorTotal: '100.00' } });
  const result = await resolveFiscalFromContextWithAccountantConfig(ctx);
  assert.equal(result.resolutions.stCalculation.baseSource, 'item.valorTotal');
  assert.equal(result.resolutions.stCalculation.commercialBase, '100.00');

  const explicit = resolveCanonicalCommercialBase({ valorTotal: '250.50', quantidade: 1, valorUnitario: 100 }, '2026-06-15');
  assert.equal(explicit.baseSource, 'item.valorTotal');
  assert.equal(explicit.commercialBase, '250.50');
  assert.equal(explicit.composition.includesFrete, false);
});

test('8E3-HARD-07: ownIcms não é constante fiscal inexplicada', async () => {
  insertDueRule('hard-own', '203');
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxStDue());
  assert.equal(result.resolutions.stCalculation.ownIcmsPolicy, ST_DUE_OWN_ICMS_POLICY);
  assert.equal(result.resolutions.stCalculation.ownIcms, '0.00');
  const calc = calculateAccountantStDueFromParameters(VALID_ST_PARAMS, '100.00', '2026-06-15');
  assert.equal(calc.ownIcmsPolicy, ST_DUE_OWN_ICMS_POLICY);
});

test('8E3-HARD-08: validação percentual é field-specific', () => {
  const pRedOver = validateStParametersContract({
    csosn: '201',
    currentOperationSt: 'DUE_BY_ISSUER',
    stParameters: { ...VALID_ST_PARAMS, pRedBCST: '101' },
  });
  assert.ok(pRedOver.some((i) => i.meta?.field === 'pRedBCST'));

  const pMvaHigh = validateStParametersContract({
    csosn: '202',
    currentOperationSt: 'DUE_BY_ISSUER',
    stParameters: { ...VALID_ST_PARAMS, pMVAST: '150.0000' },
  });
  assert.equal(pMvaHigh.length, 0);

  assert.equal(ST_PERCENT_FIELD_RULES.pRedBCST.max, 100);
  assert.equal(ST_PERCENT_FIELD_RULES.pMVAST.max, null);
});
