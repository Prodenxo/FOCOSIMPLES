/**
 * Fase 8E.4 — PIS + COFINS parametrizáveis pelo contador.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAccountantRuleForApproval,
  evaluateAccountantRuleEngineCapability,
  resolveFiscalFromContextWithAccountantConfig,
  resolveFiscalFromContext,
  validatePisCofinsConfigBlock,
  validatePisCofinsContract,
  calculatePisCofinsFromConfig,
  resolveAccountantPisCofinsCalculation,
  buildPisCofinsXmlEntry,
  buildPisCofinsAuditMetadata,
  assertPisCofinsXmlFieldsComplete,
  PIS_COFINS_CALCULATION_MODES,
  PIS_COFINS_EXECUTABLE_CSTS,
  insertApprovedRuleForFixture,
  resetFiscalConfigurationRepository,
  ACCOUNTANT_RULE_STATUS,
  buildFiscalRulesFromApprovedRule,
  resolveCanonicalCommercialBase,
  buildAuthoritativeNfePayloadFromFiscalResults,
  buildV3FiscalSnapshotFromResult,
  getDecimalFieldPolicy,
  validatePisCofinsPairAtomicity,
  ACCOUNTANT_RULE_AUTHORING_TYPE,
} from '../../src/fiscal-engine/index.js';
import { buildTestFiscalContext } from './fixtures/fiscal-context-fixture.js';
import {
  bootstrapPhase8cFixtures,
  PHASE8C_TENANT_ID,
  PHASE8C_PRODUCT_ID,
} from '../../src/fiscal-engine/fiscal-configuration/fixtures/phase8c-test-fixtures.js';

const TENANT = PHASE8C_TENANT_ID;
const TENANT_CRT4 = 'tenant-phase8e4-crt4';

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

const STD_CONDITIONS_CRT4 = { ...STD_CONDITIONS, crt: [4] };

const outrZeroPis = (cst = '49', pPIS = '0') => ({
  cst,
  calculationMode: PIS_COFINS_CALCULATION_MODES.OUTR_ZERO,
  pPIS,
});

const outrZeroCofins = (cst = '49', pCOFINS = '0') => ({
  cst,
  calculationMode: PIS_COFINS_CALCULATION_MODES.OUTR_ZERO,
  pCOFINS,
});

const pisCofinsApproved = (overrides = {}) => ({
  cfop: '5102',
  csosn: '102',
  currentOperationSt: 'NOT_DUE',
  pis: outrZeroPis(),
  cofins: outrZeroCofins(),
  ...overrides,
});

const draftRule = (overrides = {}) => ({
  id: 'rule-pis-cofins',
  tenantId: TENANT,
  version: 1,
  conditions: STD_CONDITIONS,
  approvedResult: pisCofinsApproved(),
  validFrom: '2020-01-01',
  ...overrides,
});

const ctxBase = (overrides = {}) => buildTestFiscalContext({
  empresaId: TENANT,
  allocation: {
    empresa_id: TENANT,
    prior_st_status: 'NO_ST_EVIDENCE',
    origem_mercadoria: '0',
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
  item: { itemSource: 'THIRD_PARTY', quantidade: 2, valorUnitario: 50, ...(overrides.item ?? {}) },
  referenceDate: '2026-06-15',
  ...overrides.rest,
});

const insertPisCofinsRule = (id, approvedOverrides = {}, conditionOverrides = {}) => {
  insertApprovedRuleForFixture({
    id,
    tenantId: TENANT,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 100,
    conditions: { ...STD_CONDITIONS, ...conditionOverrides },
    approvedResult: pisCofinsApproved(approvedOverrides),
    validFrom: '2020-01-01',
    approvedBy: 'acc',
  });
};

test.beforeEach(() => {
  resetFiscalConfigurationRepository();
  bootstrapPhase8cFixtures();
});
test.afterEach(() => resetFiscalConfigurationRepository());

// --- Contract validation ---
test('8E4-PC-01: approvedResult.pis aceito quando shape válido', () => {
  const result = validateAccountantRuleForApproval(draftRule());
  assert.equal(result.ok, true);
  assert.ok(!result.issues.some((i) => i.code === 'ACCOUNTANT_RULE_UNSUPPORTED_RESULT_FIELD'));
});

test('8E4-PC-02: approvedResult.cofins aceito (NT derivável CST 07)', () => {
  const issues = validatePisCofinsConfigBlock({ cst: '07' }, 'cofins');
  assert.equal(issues.length, 0);
});

test('8E4-PC-03: campo PIS desconhecido rejeitado', () => {
  const issues = validatePisCofinsConfigBlock({
    cst: '49',
    calculationMode: 'OUTR_ZERO',
    pPIS: '0',
    fooBar: 'x',
  }, 'pis');
  assert.ok(issues.some((i) => i.code === 'ACCOUNTANT_RULE_UNSUPPORTED_PIS_FIELD'));
});

test('8E4-PC-04: campo COFINS desconhecido rejeitado', () => {
  const issues = validatePisCofinsConfigBlock({
    cst: '49',
    calculationMode: 'OUTR_ZERO',
    pCOFINS: '0',
    extra: 1,
  }, 'cofins');
  assert.ok(issues.some((i) => i.code === 'ACCOUNTANT_RULE_UNSUPPORTED_COFINS_FIELD'));
});

test('8E4-PC-05: CST PIS sem builder → NOT_EXECUTABLE', () => {
  const cap = evaluateAccountantRuleEngineCapability(draftRule({
    approvedResult: pisCofinsApproved({ pis: { cst: '01', pPIS: '1.65' } }),
  }));
  assert.equal(cap.executable, false);
  assert.ok(cap.issues.some((i) => i.code === 'ACCOUNTANT_RULE_NOT_EXECUTABLE' && i.meta?.tax === 'pis'));
});

test('8E4-PC-06: CST COFINS sem builder → NOT_EXECUTABLE', () => {
  const cap = evaluateAccountantRuleEngineCapability(draftRule({
    approvedResult: pisCofinsApproved({ cofins: { cst: '03', qBCProd: '1', vAliqProd: '1' } }),
  }));
  assert.equal(cap.executable, false);
  assert.ok(cap.issues.some((i) => i.code === 'ACCOUNTANT_RULE_NOT_EXECUTABLE' && i.meta?.tax === 'cofins'));
});

// --- E2E certified groups ---
test('8E4-PC-07: primeiro grupo PIS certificado end-to-end (PISOutr CST 49)', async () => {
  insertPisCofinsRule('pc-pis-49');
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxBase());
  const pis = result.resolutions.xmlFields?.taxes?.pis;
  assert.equal(pis?.group, 'PISOutr');
  assert.equal(pis?.fields?.CST, '49');
  assert.equal(pis?.fields?.vBC, '0.00');
  assert.equal(pis?.fields?.pPIS, '0.0000');
  assert.equal(pis?.fields?.vPIS, '0.00');
});

test('8E4-PC-08: primeiro grupo COFINS certificado end-to-end (COFINSOutr CST 49)', async () => {
  insertPisCofinsRule('pc-cofins-49');
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxBase());
  const cofins = result.resolutions.xmlFields?.taxes?.cofins;
  assert.equal(cofins?.group, 'COFINSOutr');
  assert.equal(cofins?.fields?.CST, '49');
  assert.equal(cofins?.fields?.vBC, '0.00');
  assert.equal(cofins?.fields?.pCOFINS, '0.0000');
  assert.equal(cofins?.fields?.vCOFINS, '0.00');
});

// --- Decimal / rounding ---
test('8E4-PC-09: base Decimal via commercial-base-policy', () => {
  const base = resolveCanonicalCommercialBase({ quantidade: 3, valorUnitario: '33.3333' }, '2026-06-15');
  assert.equal(base.baseSource, 'item.quantidade×valorUnitario');
  assert.equal(base.commercialBase, '100.00');
});

test('8E4-PC-10: rounding PIS OUTR_ZERO determinístico', () => {
  const calc = calculatePisCofinsFromConfig(
    { cst: '49', calculationMode: 'OUTR_ZERO', pPIS: '0' },
    'pis',
    '100.00',
    '2026-06-15',
  );
  assert.equal(calc.ok, true);
  assert.equal(calc.result.vPIS, '0.00');
  assert.equal(calc.result.pPIS, '0.0000');
});

test('8E4-PC-11: rounding COFINS OUTR_ZERO determinístico', () => {
  const calc = calculatePisCofinsFromConfig(
    { cst: '99', calculationMode: 'OUTR_ZERO', pCOFINS: '0.0000' },
    'cofins',
    '100.00',
    '2026-06-15',
  );
  assert.equal(calc.ok, true);
  assert.equal(calc.result.vCOFINS, '0.00');
});

test('8E4-PC-12: alíquota zero preservada', () => {
  const calc = calculatePisCofinsFromConfig(
    { cst: '49', calculationMode: 'OUTR_ZERO', pPIS: '0' },
    'pis',
    '100.00',
    '2026-06-15',
  );
  assert.equal(calc.result.pPIS, '0.0000');
});

test('8E4-PC-13: null vs zero — ausência de pPIS rejeitada em OUTR_ZERO', () => {
  const absent = calculatePisCofinsFromConfig(
    { cst: '49', calculationMode: 'OUTR_ZERO' },
    'pis',
    '100.00',
    '2026-06-15',
  );
  assert.equal(absent.ok, false);
  const explicitZero = calculatePisCofinsFromConfig(
    { cst: '49', calculationMode: 'OUTR_ZERO', pPIS: '0' },
    'pis',
    '100.00',
    '2026-06-15',
  );
  assert.equal(explicitZero.ok, true);
  assert.equal(explicitZero.result.pPIS, '0.0000');
});

// --- Builder idempotência (não recalcula) ---
test('8E4-PC-14: builder PIS não recalcula', () => {
  const calc = calculatePisCofinsFromConfig(
    { cst: '49', calculationMode: 'OUTR_ZERO', pPIS: '0' },
    'pis',
    '999.99',
    '2026-06-15',
  );
  const entry = buildPisCofinsXmlEntry(calc);
  assert.equal(entry.fields.vPIS, calc.result.vPIS);
  assert.equal(entry.fields.vBC, calc.result.vBC);
});

test('8E4-PC-15: builder COFINS não recalcula', () => {
  const calc = calculatePisCofinsFromConfig(
    { cst: '49', calculationMode: 'OUTR_ZERO', pCOFINS: '0' },
    'cofins',
    '999.99',
    '2026-06-15',
  );
  const entry = buildPisCofinsXmlEntry(calc);
  assert.equal(entry.fields.vCOFINS, calc.result.vCOFINS);
  assert.equal(entry.fields.vBC, calc.result.vBC);
});

// --- FiscalResult ---
test('8E4-PC-16: FiscalResult contém PIS', async () => {
  insertPisCofinsRule('pc-result-pis');
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxBase());
  assert.ok(result.resolutions.pisCofins?.pis);
  assert.equal(result.resolutions.pisCofins.pis.cst, '49');
  assert.ok(result.fiscalNFeItem?.taxes?.pis);
});

test('8E4-PC-17: FiscalResult contém COFINS', async () => {
  insertPisCofinsRule('pc-result-cofins');
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxBase());
  assert.ok(result.resolutions.pisCofins?.cofins);
  assert.equal(result.resolutions.pisCofins.cofins.cst, '49');
  assert.ok(result.fiscalNFeItem?.taxes?.cofins);
});

// --- Audit ---
test('8E4-PC-18: audit PIS reproduz cálculo', () => {
  const resolution = resolveAccountantPisCofinsCalculation(ctxBase(), {
    pisConfig: { cst: '49', calculationMode: 'OUTR_ZERO', pPIS: '0' },
    cofinsConfig: null,
    referenceDate: '2026-06-15',
  });
  const audit = buildPisCofinsAuditMetadata(resolution);
  assert.equal(audit.pis.calculationMode, PIS_COFINS_CALCULATION_MODES.OUTR_ZERO);
  assert.equal(audit.pis.value, '0.00');
  assert.equal(audit.pis.rate, '0.0000');
});

test('8E4-PC-19: audit COFINS reproduz cálculo', () => {
  const resolution = resolveAccountantPisCofinsCalculation(ctxBase(), {
    pisConfig: null,
    cofinsConfig: { cst: '49', calculationMode: 'OUTR_ZERO', pCOFINS: '0' },
    referenceDate: '2026-06-15',
  });
  const audit = buildPisCofinsAuditMetadata(resolution);
  assert.equal(audit.cofins.calculationMode, PIS_COFINS_CALCULATION_MODES.OUTR_ZERO);
  assert.equal(audit.cofins.value, '0.00');
});

test('8E4-PC-20: mesmo input → resultado determinístico', () => {
  const ctx = ctxBase();
  const cfg = {
    pisConfig: outrZeroPis(),
    cofinsConfig: outrZeroCofins(),
    referenceDate: '2026-06-15',
  };
  const a = resolveAccountantPisCofinsCalculation(ctx, cfg);
  const b = resolveAccountantPisCofinsCalculation(ctx, cfg);
  assert.deepEqual(a.pis.result, b.pis.result);
  assert.deepEqual(a.cofins.result, b.cofins.result);
});

test('8E4-PC-21: produto/grupo não sugere CST', async () => {
  insertPisCofinsRule('pc-no-suggest');
  const ctx = ctxBase({
    produto: { ncm: '99999999', produtoCatalogoId: PHASE8C_PRODUCT_ID },
    allocation: { purchaseXmlPisCst: '01', purchaseXmlCofinsCst: '01' },
  });
  const result = await resolveFiscalFromContextWithAccountantConfig(ctx);
  assert.equal(result.resolutions.pisCofins?.pis?.cst, '49');
  assert.equal(result.resolutions.pisCofins?.cofins?.cst, '49');
});

test('8E4-PC-22: purchase XML não determina saída', async () => {
  insertPisCofinsRule('pc-purchase');
  const ctx = ctxBase({
    allocation: {
      purchaseHistory: { pisCst: '07', cofinsCst: '08' },
    },
  });
  const result = await resolveFiscalFromContextWithAccountantConfig(ctx);
  assert.equal(result.resolutions.xmlFields?.taxes?.pis?.fields?.CST, '49');
  assert.equal(result.resolutions.xmlFields?.taxes?.cofins?.fields?.CST, '49');
});

test('8E4-PC-23: CRT4 não herda configuração CRT1', async () => {
  insertApprovedRuleForFixture({
    id: 'crt1-only',
    tenantId: TENANT,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 200,
    conditions: STD_CONDITIONS,
    approvedResult: pisCofinsApproved(),
    validFrom: '2020-01-01',
    approvedBy: 'acc',
  });
  insertApprovedRuleForFixture({
    id: 'crt4-rule',
    tenantId: TENANT_CRT4,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 200,
    conditions: STD_CONDITIONS_CRT4,
    approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
    validFrom: '2020-01-01',
    approvedBy: 'acc',
  });
  const crt4Ctx = buildTestFiscalContext({
    empresaId: TENANT_CRT4,
    allocation: { empresa_id: TENANT_CRT4, prior_st_status: 'NO_ST_EVIDENCE', origem_mercadoria: '0' },
    issuer: { crt: 4, uf: 'RJ' },
    recipient: { uf: 'RJ', icmsTaxpayerStatus: 'NON_TAXPAYER' },
    operation: { destinationUf: 'RJ', tipo: 'VENDA' },
    item: { itemSource: 'THIRD_PARTY' },
    referenceDate: '2026-06-15',
  });
  const result = await resolveFiscalFromContextWithAccountantConfig(crt4Ctx);
  assert.equal(result.resolutions.pisCofins, null);
  assert.equal(result.resolutions.xmlFields?.taxes?.pis, undefined);
});

// --- Regressão ICMS/ST ---
test('8E4-PC-24: CSOSN/ICMS 102 continua funcionando', async () => {
  insertPisCofinsRule('pc-reg-102');
  const result = await resolveFiscalFromContextWithAccountantConfig(ctxBase());
  assert.equal(result.resolutions.csosn, '102');
  assert.equal(result.resolutions.xmlFields?.taxes?.icms?.group, 'ICMSSN102');
});

test('8E4-PC-25: CSOSN500 continua funcionando', async () => {
  insertApprovedRuleForFixture({
    id: 'pc-500',
    tenantId: TENANT,
    version: 1,
    status: ACCOUNTANT_RULE_STATUS.APPROVED,
    baseSpecificity: 200,
    conditions: {
      ...STD_CONDITIONS,
      priorStStatus: ['RETAINED'],
    },
    approvedResult: {
      cfop: '5102',
      csosn: '500',
      currentOperationSt: 'NOT_DUE',
      requiredXmlFields: ['vBCSTRet', 'vICMSSTRet'],
      pis: { cst: '07' },
      cofins: { cst: '08' },
    },
    validFrom: '2020-01-01',
    approvedBy: 'acc',
  });
  const ctx = ctxBase({
    allocation: {
      prior_st_status: 'RETAINED',
      st_allocation_json: { allocatedValues: { vBCSTRet: '100.00', vICMSSTRet: '18.00', pST: '18.0000' } },
    },
  });
  const result = await resolveFiscalFromContextWithAccountantConfig(ctx);
  assert.equal(result.resolutions.csosn, '500');
  assert.equal(result.resolutions.xmlFields?.taxes?.pis?.group, 'PISNT');
  assert.equal(result.resolutions.xmlFields?.taxes?.cofins?.group, 'COFINSNT');
});

test('8E4-PC-26: CSOSN201/202/203 continuam funcionando com PIS/COFINS', async () => {
  const VALID_ST = { modBCST: '4', pMVAST: '40.0000', pICMSST: '18.0000' };
  for (const csosn of ['201', '202', '203']) {
    resetFiscalConfigurationRepository();
    bootstrapPhase8cFixtures();
    insertApprovedRuleForFixture({
      id: `pc-st-${csosn}`,
      tenantId: TENANT,
      version: 1,
      status: ACCOUNTANT_RULE_STATUS.APPROVED,
      baseSpecificity: 100,
      conditions: STD_CONDITIONS,
      approvedResult: {
        cfop: '5405',
        csosn,
        currentOperationSt: 'DUE_BY_ISSUER',
        stParameters: VALID_ST,
        pis: outrZeroPis(),
        cofins: outrZeroCofins(),
      },
      validFrom: '2020-01-01',
      approvedBy: 'acc',
    });
    const result = await resolveFiscalFromContextWithAccountantConfig(ctxBase({
      item: { quantidade: 1, valorUnitario: 100 },
    }));
    assert.equal(result.resolutions.csosn, csosn);
    assert.equal(result.resolutions.xmlFields?.taxes?.icms?.group, `ICMSSN${csosn}`);
    assert.ok(result.resolutions.xmlFields?.taxes?.icms?.fields?.vBCST);
    assert.equal(result.resolutions.xmlFields?.taxes?.pis?.group, 'PISOutr');
  }
});

// --- Grupo NT shape ---
test('8E4-PC-NT: PISNT/COFINSNT shape completo CST 07/08', () => {
  for (const cst of ['07', '08']) {
    const pisCalc = calculatePisCofinsFromConfig({ cst }, 'pis', '100.00', '2026-06-15');
    const pisEntry = buildPisCofinsXmlEntry(pisCalc);
    const pisCheck = assertPisCofinsXmlFieldsComplete(cst, pisEntry.fields, 'pis');
    assert.equal(pisCheck.ok, true);
    assert.equal(Object.keys(pisEntry.fields).length, 1);

    const cofinsCalc = calculatePisCofinsFromConfig({ cst }, 'cofins', '100.00', '2026-06-15');
    const cofinsEntry = buildPisCofinsXmlEntry(cofinsCalc);
    const cofinsCheck = assertPisCofinsXmlFieldsComplete(cst, cofinsEntry.fields, 'cofins');
    assert.equal(cofinsCheck.ok, true);
  }
});

test('8E4-PC-EXEC: CSTs executáveis catalogados', () => {
  assert.ok(PIS_COFINS_EXECUTABLE_CSTS.has('49'));
  assert.ok(PIS_COFINS_EXECUTABLE_CSTS.has('07'));
  assert.ok(!PIS_COFINS_EXECUTABLE_CSTS.has('01'));
});

test('8E4-PC-FORBIDDEN: vPIS manual bloqueado no contrato', () => {
  const issues = validatePisCofinsConfigBlock({ cst: '49', vPIS: '10.00' }, 'pis');
  assert.ok(issues.some((i) => i.code === 'ACCOUNTANT_RULE_UNSUPPORTED_PIS_FIELD'));
});

test('8E4-PC-SYNTH: buildFiscalRulesFromApprovedRule não injeta PIS', () => {
  const rules = buildFiscalRulesFromApprovedRule(draftRule());
  assert.ok(!rules.some((r) => r.result?.pis || r.result?.cstPis));
});

// --- Hardening 8E.4 ---
test('8E4-HARD-01: OUTR_ZERO PIS sem pPIS → rejeitado', () => {
  const issues = validatePisCofinsConfigBlock({
    cst: '49',
    calculationMode: 'OUTR_ZERO',
  }, 'pis');
  assert.ok(issues.some((i) => i.meta?.field === 'pPIS'));
});

test('8E4-HARD-02: OUTR_ZERO COFINS sem pCOFINS → rejeitado', () => {
  const issues = validatePisCofinsConfigBlock({
    cst: '99',
    calculationMode: 'OUTR_ZERO',
  }, 'cofins');
  assert.ok(issues.some((i) => i.meta?.field === 'pCOFINS'));
});

test('8E4-HARD-03: pPIS=0 explícito preservado', () => {
  const calc = calculatePisCofinsFromConfig(
    { cst: '49', calculationMode: 'OUTR_ZERO', pPIS: 0 },
    'pis',
    '100.00',
    '2026-06-15',
  );
  assert.equal(calc.ok, true);
  assert.equal(calc.result.pPIS, '0.0000');
});

test('8E4-HARD-04: pCOFINS=0 explícito preservado', () => {
  const calc = calculatePisCofinsFromConfig(
    { cst: '49', calculationMode: 'OUTR_ZERO', pCOFINS: 0 },
    'cofins',
    '100.00',
    '2026-06-15',
  );
  assert.equal(calc.ok, true);
  assert.equal(calc.result.pCOFINS, '0.0000');
});

test('8E4-HARD-05: CST 49/99 não deriva OUTR_ZERO silenciosamente', () => {
  for (const cst of ['49', '99']) {
    const issues = validatePisCofinsConfigBlock({ cst, pPIS: '0' }, 'pis');
    assert.ok(issues.some((i) => i.meta?.field === 'calculationMode'), `CST ${cst} deveria exigir calculationMode`);
    const calc = calculatePisCofinsFromConfig({ cst }, 'pis', '100.00', '2026-06-15');
    assert.equal(calc.ok, false);
  }
});

test('8E4-HARD-06: PIS sem COFINS → rejeitado', () => {
  const issues = validatePisCofinsPairAtomicity({
    cfop: '5102',
    csosn: '102',
    currentOperationSt: 'NOT_DUE',
    pis: outrZeroPis(),
  });
  assert.ok(issues.some((i) => i.code === 'ACCOUNTANT_RULE_PIS_COFINS_PAIR_REQUIRED'));
  const approval = validateAccountantRuleForApproval(draftRule({
    authoringType: ACCOUNTANT_RULE_AUTHORING_TYPE.FISCAL_SCENARIO,
    approvedResult: {
      cfop: '5102',
      csosn: '102',
      currentOperationSt: 'NOT_DUE',
      pis: outrZeroPis(),
    },
  }));
  assert.equal(approval.ok, false);
});

test('8E4-HARD-07: COFINS sem PIS → rejeitado', () => {
  const issues = validatePisCofinsPairAtomicity({
    cofins: outrZeroCofins(),
  });
  assert.ok(issues.some((i) => i.code === 'ACCOUNTANT_RULE_PIS_COFINS_PAIR_REQUIRED'));
});

test('8E4-HARD-08: ambos ausentes mantém backward compatibility', () => {
  const issues = validatePisCofinsPairAtomicity({
    cfop: '5102',
    csosn: '102',
    currentOperationSt: 'NOT_DUE',
  });
  assert.equal(issues.length, 0);
  const approval = validateAccountantRuleForApproval(draftRule({
    approvedResult: { cfop: '5102', csosn: '102', currentOperationSt: 'NOT_DUE' },
  }));
  assert.equal(approval.ok, true);
});

test('8E4-HARD-09: PIS/COFINS chegam ao authoritative payload', async () => {
  insertPisCofinsRule('hard-auth');
  const fiscalResult = await resolveFiscalFromContextWithAccountantConfig(ctxBase());
  const built = buildAuthoritativeNfePayloadFromFiscalResults({
    legacyPayloadSnapshot: {
      itens: [{ quantidade: '2', valorTotal: '100.00', descricao: 'SKU' }],
    },
    itemGroups: [{
      commercialItemIndex: 0,
      allocations: [{ quantidade: '2', id: 'lot-1' }],
      fiscalResults: [fiscalResult],
    }],
  });
  const item = built.payload.itens[0];
  assert.equal(item.impostos?.pis?.group, 'PISOutr');
  assert.equal(item.impostos?.pis?.fields?.CST, '49');
  assert.equal(item.impostos?.cofins?.group, 'COFINSOutr');
  assert.equal(item.impostos?.cofins?.fields?.CST, '49');
});

test('8E4-HARD-10: PIS/COFINS chegam ao shadow snapshot', async () => {
  insertPisCofinsRule('hard-shadow');
  const fiscalResult = await resolveFiscalFromContextWithAccountantConfig(ctxBase());
  const snapshot = buildV3FiscalSnapshotFromResult(fiscalResult);
  assert.equal(snapshot.pisGroup, 'PISOutr');
  assert.equal(snapshot.pisFields?.CST, '49');
  assert.equal(snapshot.cofinsGroup, 'COFINSOutr');
  assert.equal(snapshot.cofinsFields?.CST, '49');
});

test('8E4-HARD-11: payload não descarta taxes.pis/cofins', async () => {
  insertPisCofinsRule('hard-drop');
  const fiscalResult = await resolveFiscalFromContextWithAccountantConfig(ctxBase());
  assert.ok(fiscalResult.resolutions.xmlFields?.taxes?.pis);
  assert.ok(fiscalResult.resolutions.xmlFields?.taxes?.cofins);
  const built = buildAuthoritativeNfePayloadFromFiscalResults({
    legacyPayloadSnapshot: { itens: [{ quantidade: '1', valorTotal: '50.00' }] },
    itemGroups: [{
      commercialItemIndex: 0,
      allocations: [{ quantidade: '1' }],
      fiscalResults: [fiscalResult],
    }],
  });
  const item = built.payload.itens[0];
  assert.ok(item.impostos?.pis, 'authoritative payload omitiu PIS');
  assert.ok(item.impostos?.cofins, 'authoritative payload omitiu COFINS');
});

test('8E4-HARD-12: rounding policies PIS/COFINS explícitas', () => {
  for (const field of ['vPIS', 'vCOFINS', 'pPIS', 'pCOFINS']) {
    const policy = getDecimalFieldPolicy(field, '2026-06-15');
    assert.ok(policy, `policy ausente para ${field}`);
    assert.equal(policy.field, field);
    assert.ok(!policy.technicalSource.includes('ICMS'), `${field} não deve referenciar ICMS`);
  }
});
