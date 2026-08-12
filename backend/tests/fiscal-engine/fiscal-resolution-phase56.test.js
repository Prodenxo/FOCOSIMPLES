import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveFiscalRule,
  isRuleEffectiveOn,
  computeRuleSpecificity,
  ruleMatchesFacts,
  filterRulesByEffectiveDate,
  resetFiscalRulesRepository,
  registerFiscalRules,
  listFiscalRulesForEmpresa,
  resolveCurrentStLiability,
  resolveCsosn,
  resolveCfop,
  resolveXmlFields,
  crossValidateFiscalResolution,
  resolveFiscalFromContext,
  resolveFiscalFromContexts,
  buildTaxTreatment,
  extractFactsFromContext,
  createDefaultTestRules,
  createNcmFixtureRule,
  createValidatedProductionReadyCurrentStRule,
  validateRuleDependencies,
  normalizeResolverOptions,
  DEFAULT_RESOLVER_OPTIONS,
  CURRENT_OPERATION_ST,
  isFiscalEngineV3Enabled,
} from '../../src/fiscal-engine/index.js';
import { buildTestFiscalContext, TEST_EMPRESA_ID, allocationFixture } from './fixtures/fiscal-context-fixture.js';
import { buildFiscalContextFromAllocation } from '../../src/fiscal-engine/context/build-allocation-fiscal-context.js';

const FIXTURE_OPTS = { allowNonProductionRules: true };

const loadFixtures = () => {
  resetFiscalRulesRepository();
  registerFiscalRules(createDefaultTestRules());
};

test.beforeEach(() => {
  resetFiscalRulesRepository();
});

test.afterEach(() => {
  resetFiscalRulesRepository();
});

const rules = () => listFiscalRulesForEmpresa(TEST_EMPRESA_ID);

// --- Rule engine (1-12) ---
test('1. regra única aplicável', () => {
  loadFixtures();
  const ctx = buildTestFiscalContext();
  const facts = extractFactsFromContext(ctx);
  const r = resolveFiscalRule(rules(), 'CURRENT_ST', facts, FIXTURE_OPTS);
  assert.equal(r.ok, true);
  assert.equal(r.result.currentOperationSt, 'NOT_DUE');
});

test('2. regra fora da vigência (futura)', () => {
  loadFixtures();
  const rule = rules().find((x) => x.id === 'current-st-future');
  assert.equal(isRuleEffectiveOn(rule, '2026-06-15'), false);
});

test('3. regra futura não aplica', () => {
  loadFixtures();
  const ctx = buildTestFiscalContext({ referenceDate: '2026-06-15' });
  const facts = extractFactsFromContext(ctx);
  const effective = filterRulesByEffectiveDate(rules(), 'CURRENT_ST', facts, '2026-06-15');
  assert.ok(!effective.some((r) => r.id === 'current-st-future'));
});

test('4. regra expirada', () => {
  loadFixtures();
  const rule = rules().find((x) => x.id === 'current-st-expired');
  assert.equal(isRuleEffectiveOn(rule, '2026-06-15'), false);
});

test('5. regra genérica + específica — específica vence por prioridade', () => {
  loadFixtures();
  const specific = rules().find((x) => x.id === 'csosn-crt1-retained-not-due-internal');
  const generic = rules().find((x) => x.id === 'csosn-crt1-internal-not-due-non-taxpayer');
  assert.ok((specific.priority ?? 0) > (generic.priority ?? 0));
});

test('6. específica vence corretamente na resolução CSOSN', () => {
  loadFixtures();
  const ctx = buildTestFiscalContext({
    allocation: {
      prior_st_status: 'RETAINED',
      st_allocation_json: { allocatedValues: { vBCSTRet: '10.00', vICMSSTRet: '1.80' } },
    },
  });
  const current = resolveCurrentStLiability(ctx, rules(), FIXTURE_OPTS);
  const treatment = buildTaxTreatment(ctx, { currentOperationSt: current.currentOperationSt, issues: [] });
  const csosn = resolveCsosn(ctx, treatment, rules(), FIXTURE_OPTS);
  assert.equal(csosn.csosn, '500');
});

test('7. prioridade determinística', () => {
  loadFixtures();
  const sorted = [...rules()].filter((r) => r.ruleType === 'CSOSN' && r.id.startsWith('csosn-crt1'))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  assert.equal(sorted[0].id, 'csosn-crt1-retained-not-due-internal');
});

test('8. conflito não resolvível bloqueia', () => {
  loadFixtures();
  const ctx = buildTestFiscalContext({
    recipient: { uf: 'SP' },
    operation: { destinationUf: 'SP' },
  });
  const facts = extractFactsFromContext(ctx);
  facts.location = 'INTERESTADUAL';
  const r = resolveFiscalRule(rules(), 'CURRENT_ST', facts, FIXTURE_OPTS);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'RULE_CONFLICT');
});

test('9. productionReady=false bloqueado em modo SAFE', () => {
  loadFixtures();
  const ctx = buildTestFiscalContext();
  const r = resolveFiscalRule(rules(), 'CURRENT_ST', extractFactsFromContext(ctx));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'NO_PRODUCTION_RULE');
  assert.ok(r.audit.rejectedNonProductionRules?.length >= 1);
});

test('9b. productionReady=false resolve com allowNonProductionRules', () => {
  loadFixtures();
  const ctx = buildTestFiscalContext();
  const r = resolveFiscalRule(rules(), 'CURRENT_ST', extractFactsFromContext(ctx), FIXTURE_OPTS);
  assert.equal(r.ok, true);
  assert.ok(r.issues.some((i) => i.code === 'RULE_NOT_PRODUCTION_READY'));
});

test('10. nenhuma regra aplicável', () => {
  const r = resolveFiscalRule([], 'CFOP', extractFactsFromContext(buildTestFiscalContext()));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'NO_RULE');
});

test('11. sourceRefs preservados na regra', () => {
  loadFixtures();
  const rule = rules().find((x) => x.id === 'cfop-internal-third-party-crt1');
  assert.ok(Array.isArray(rule.sourceRefs));
  assert.ok(rule.sourceLegalReference);
});

test('12. decisão auditável', () => {
  loadFixtures();
  const r = resolveFiscalRule(rules(), 'CFOP', extractFactsFromContext(buildTestFiscalContext()), FIXTURE_OPTS);
  assert.ok(r.audit.selectedRule);
  assert.ok(r.audit.matchedRules.length >= 1);
});

// --- Current ST (13-19) ---
test('13. DUE_BY_ISSUER por regra válida', () => {
  resetFiscalRulesRepository();
  registerFiscalRules([{
    id: 'tmp-due',
    ruleType: 'CURRENT_ST',
    schemaVersion: '1.0',
    applicableCrt: [1],
    effectiveFrom: '2026-01-01',
    conditions: { location: ['INTERNA'] },
    result: { currentOperationSt: 'DUE_BY_ISSUER' },
    sourceLegalReference: 'FIX',
    productionReady: false,
  }]);
  const current = resolveCurrentStLiability(
    buildTestFiscalContext(),
    listFiscalRulesForEmpresa(TEST_EMPRESA_ID),
    FIXTURE_OPTS,
  );
  assert.equal(current.currentOperationSt, 'DUE_BY_ISSUER');
});

test('14. NOT_DUE por regra válida', () => {
  loadFixtures();
  const current = resolveCurrentStLiability(buildTestFiscalContext(), rules(), FIXTURE_OPTS);
  assert.equal(current.currentOperationSt, 'NOT_DUE');
});

test('15. UNKNOWN sem regra', () => {
  resetFiscalRulesRepository();
  const current = resolveCurrentStLiability(buildTestFiscalContext(), []);
  assert.equal(current.currentOperationSt, 'UNKNOWN');
});

test('16. CEST sozinho não gera DUE', () => {
  loadFixtures();
  const ctx = buildTestFiscalContext({
    allocation: { supplier_cest: '1234567' },
    produto: { cest: '1234567' },
  });
  const current = resolveCurrentStLiability(ctx, rules(), FIXTURE_OPTS);
  assert.notEqual(current.currentOperationSt, 'DUE_BY_ISSUER');
});

test('17. priorSt RETAINED não gera NOT_DUE automaticamente', () => {
  resetFiscalRulesRepository();
  registerFiscalRules([{
    id: 'only-retained-due',
    ruleType: 'CURRENT_ST',
    schemaVersion: '1.0',
    applicableCrt: [1],
    effectiveFrom: '2026-01-01',
    conditions: { priorStStatus: ['RETAINED'] },
    result: { currentOperationSt: 'DUE_BY_ISSUER' },
    sourceLegalReference: 'FIX',
    productionReady: false,
  }]);
  const ctx = buildTestFiscalContext({ allocation: { prior_st_status: 'RETAINED' } });
  const current = resolveCurrentStLiability(
    ctx,
    listFiscalRulesForEmpresa(TEST_EMPRESA_ID),
    FIXTURE_OPTS,
  );
  assert.equal(current.currentOperationSt, 'DUE_BY_ISSUER');
});

test('18. priorSt + currentST coexistem', () => {
  loadFixtures();
  const ctx = buildTestFiscalContext({ allocation: { prior_st_status: 'RETAINED' } });
  const current = resolveCurrentStLiability(ctx, rules(), FIXTURE_OPTS);
  const treatment = buildTaxTreatment(ctx, { currentOperationSt: current.currentOperationSt, issues: [] });
  assert.equal(treatment.priorStStatus, 'RETAINED');
  assert.equal(treatment.currentOperationSt, 'NOT_DUE');
  assert.equal(treatment.stScenarioKey, 'RETAINED+NOT_DUE');
});

test('19. rule conflict bloqueia current ST', () => {
  loadFixtures();
  const ctx = buildTestFiscalContext({ recipient: { uf: 'SP' }, operation: { destinationUf: 'SP' } });
  const current = resolveCurrentStLiability(ctx, rules(), FIXTURE_OPTS);
  assert.ok(current.issues.some((i) => i.code === 'RULE_CONFLICT'));
});

// --- TaxTreatment (20-25) ---
test('20. RETAINED + NOT_DUE stScenarioKey', () => {
  loadFixtures();
  const ctx = buildTestFiscalContext({ allocation: { prior_st_status: 'RETAINED' } });
  const current = resolveCurrentStLiability(ctx, rules(), FIXTURE_OPTS);
  const t = buildTaxTreatment(ctx, { currentOperationSt: current.currentOperationSt, issues: [] });
  assert.equal(t.stScenarioKey, 'RETAINED+NOT_DUE');
});

test('21. NO_ST_EVIDENCE + NOT_DUE', () => {
  loadFixtures();
  const current = resolveCurrentStLiability(buildTestFiscalContext(), rules(), FIXTURE_OPTS);
  const t = buildTaxTreatment(buildTestFiscalContext(), { currentOperationSt: current.currentOperationSt, issues: [] });
  assert.equal(t.stScenarioKey, 'NO_ST_EVIDENCE+NOT_DUE');
});

test('22. RETAINED + DUE_BY_ISSUER quando regra define', () => {
  loadFixtures();
  registerFiscalRules([{
    id: 'force-due',
    ruleType: 'CURRENT_ST',
    schemaVersion: '1.0',
    applicableCrt: [1],
    effectiveFrom: '2026-01-01',
    conditions: { priorStStatus: ['RETAINED'] },
    result: { currentOperationSt: 'DUE_BY_ISSUER' },
    sourceLegalReference: 'FIX',
    productionReady: false,
    priority: 999,
  }]);
  const ctx = buildTestFiscalContext({ allocation: { prior_st_status: 'RETAINED' } });
  const current = resolveCurrentStLiability(ctx, listFiscalRulesForEmpresa(TEST_EMPRESA_ID), FIXTURE_OPTS);
  const t = buildTaxTreatment(ctx, { currentOperationSt: current.currentOperationSt, issues: [] });
  assert.equal(t.stScenarioKey, 'RETAINED+DUE_BY_ISSUER');
});

test('23. UNKNOWN current ST no treatment', () => {
  const t = buildTaxTreatment(buildTestFiscalContext(), { currentOperationSt: 'UNKNOWN', issues: [] });
  assert.equal(t.stScenarioKey, null);
  assert.equal(t.resolved, false);
});

test('24. stScenarioKey correto', () => {
  const t = buildTaxTreatment(buildTestFiscalContext(), { currentOperationSt: 'NOT_DUE', issues: [] });
  assert.equal(t.stScenarioKey, 'NO_ST_EVIDENCE+NOT_DUE');
});

test('25. nenhum cenário composto gera dois grupos ICMS', () => {
  loadFixtures();
  const result = resolveFiscalFromContext(buildTestFiscalContext({
    allocation: {
      prior_st_status: 'RETAINED',
      st_allocation_json: { allocatedValues: { vBCSTRet: '10.00', vICMSSTRet: '1.80' } },
    },
  }), FIXTURE_OPTS);
  assert.equal(result.resolutions.xmlFields?.taxes?.icms ? 1 : 0, 1);
  assert.ok((result.audit?.steps?.xmlFields?.groupCount ?? 0) <= 1);
});

// --- CSOSN (26-32) ---
test('26. CRT1 suportado resolve CSOSN pela regra', () => {
  loadFixtures();
  const result = resolveFiscalFromContext(buildTestFiscalContext(), FIXTURE_OPTS);
  assert.equal(result.resolutions.csosn, '102');
});

test('27. nenhum fallback para 102 sem regra', () => {
  const result = resolveFiscalFromContext(buildTestFiscalContext());
  assert.notEqual(result.resolutions.csosn, '102');
});

test('28. nenhum fallback para 500 sem regra', () => {
  const result = resolveFiscalFromContext(buildTestFiscalContext({
    allocation: { prior_st_status: 'RETAINED' },
  }));
  assert.notEqual(result.resolutions.csosn, '500');
});

test('29. CRT4 não herda CRT1', () => {
  loadFixtures();
  const ctx = buildTestFiscalContext({ issuer: { crt: 4, uf: 'RJ' } });
  const result = resolveFiscalFromContext(ctx, FIXTURE_OPTS);
  assert.equal(result.resolutions.csosn, '102');
  assert.ok(result.ruleRefs.some((r) => r.id === 'csosn-crt4-mei-internal-not-due'));
});

test('30. CRT3 não recebe CSOSN', () => {
  loadFixtures();
  const ctx = buildTestFiscalContext({ issuer: { crt: 3, uf: 'RJ' } });
  const current = resolveCurrentStLiability(ctx, rules(), FIXTURE_OPTS);
  const treatment = buildTaxTreatment(ctx, { currentOperationSt: current.currentOperationSt, issues: current.issues });
  const csosn = resolveCsosn(ctx, treatment, rules(), FIXTURE_OPTS);
  assert.equal(csosn.csosn, null);
  assert.ok(csosn.issues.some((i) => i.code === 'UNSUPPORTED_SCENARIO'));
});

test('31. regra CSOSN ausente => unresolved', () => {
  const result = resolveFiscalFromContext(buildTestFiscalContext());
  assert.equal(result.resolutions.csosn, null);
});

test('32. conflito CSOSN => blocked', () => {
  loadFixtures();
  const ctx = buildTestFiscalContext();
  registerFiscalRules([
    {
      id: 'csosn-conflict-a', ruleType: 'CSOSN', schemaVersion: '1.0', applicableCrt: [1],
      effectiveFrom: '2026-01-01', priority: 50, conditions: { location: ['INTERNA'] },
      result: { csosn: '102' }, sourceLegalReference: 'X', productionReady: false,
    },
    {
      id: 'csosn-conflict-b', ruleType: 'CSOSN', schemaVersion: '1.0', applicableCrt: [1],
      effectiveFrom: '2026-01-01', priority: 50, conditions: { location: ['INTERNA'] },
      result: { csosn: '500' }, sourceLegalReference: 'Y', productionReady: false,
    },
  ]);
  const treatment = buildTaxTreatment(ctx, { currentOperationSt: 'NOT_DUE', issues: [] });
  const csosn = resolveCsosn(ctx, treatment, listFiscalRulesForEmpresa(TEST_EMPRESA_ID), FIXTURE_OPTS);
  assert.ok(csosn.issues.some((i) => i.code === 'RULE_CONFLICT'));
});

// --- CFOP (33-39) ---
test('33. operação interna suportada', () => {
  loadFixtures();
  const result = resolveFiscalFromContext(buildTestFiscalContext(), FIXTURE_OPTS);
  assert.equal(result.resolutions.cfop, '5102');
});

test('34. interestadual suportada para contribuinte', () => {
  loadFixtures();
  const result = resolveFiscalFromContext(buildTestFiscalContext({
    recipient: { uf: 'SP', cpfCnpj: '12345678901234', icmsTaxpayerStatus: 'TAXPAYER' },
    operation: { destinationUf: 'SP' },
  }), FIXTURE_OPTS);
  assert.equal(result.resolutions.cfop, '6102');
});

test('35. location UNKNOWN não resolve CFOP', () => {
  loadFixtures();
  const ctx = buildTestFiscalContext({ issuer: { crt: 1 }, recipient: { uf: 'SP' }, operation: { destinationUf: 'RJ' } });
  const cfop = resolveCfop(
    ctx,
    buildTaxTreatment(ctx, { currentOperationSt: 'NOT_DUE', issues: [] }),
    rules(),
    FIXTURE_OPTS,
  );
  assert.equal(cfop.cfop, null);
});

test('36. itemSource diferente altera CFOP', () => {
  loadFixtures();
  const result = resolveFiscalFromContext(buildTestFiscalContext({ item: { itemSource: 'OWN_PRODUCTION' } }), FIXTURE_OPTS);
  assert.equal(result.resolutions.cfop, '5101');
});

test('37. regra CFOP ausente', () => {
  const result = resolveFiscalFromContext(buildTestFiscalContext());
  assert.equal(result.resolutions.cfop, null);
});

test('38. conflito CFOP', () => {
  resetFiscalRulesRepository();
  const ctx = buildTestFiscalContext();
  const facts = extractFactsFromContext(ctx);
  registerFiscalRules([
    {
      id: 'cfop-conflict-a', ruleType: 'CFOP', schemaVersion: '1.0', applicableCrt: [1],
      effectiveFrom: '2026-01-01', priority: 40, conditions: { location: ['INTERNA'], itemSource: ['THIRD_PARTY'] },
      result: { cfop: '5102' }, sourceLegalReference: 'A', productionReady: false,
    },
    {
      id: 'cfop-conflict-b', ruleType: 'CFOP', schemaVersion: '1.0', applicableCrt: [1],
      effectiveFrom: '2026-01-01', priority: 40, conditions: { location: ['INTERNA'], itemSource: ['THIRD_PARTY'] },
      result: { cfop: '5405' }, sourceLegalReference: 'B', productionReady: false,
    },
  ]);
  const r2 = resolveFiscalRule(listFiscalRulesForEmpresa(TEST_EMPRESA_ID), 'CFOP', facts, FIXTURE_OPTS);
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, 'RULE_CONFLICT');
});

test('39. nenhuma regra fixa por NCM no resolver', () => {
  loadFixtures();
  registerFiscalRules([createNcmFixtureRule('40111000')]);
  const ctx = buildTestFiscalContext({ produto: { ncm: '40111000' } });
  const result = resolveFiscalFromContext(ctx, FIXTURE_OPTS);
  assert.equal(result.resolutions.csosn, '500');
});

// --- XML fields (40-47) ---
test('40. exatamente um grupo ICMS quando resolvido', () => {
  loadFixtures();
  const result = resolveFiscalFromContext(buildTestFiscalContext(), FIXTURE_OPTS);
  assert.ok(result.fiscalNFeItem);
  assert.ok(result.resolutions.xmlFields?.taxes?.icms);
  assert.equal(result.resolutions.xmlFields?.taxes?.icms?.group, 'ICMSSN102');
});

test('41. zero grupos em unresolved', () => {
  const result = resolveFiscalFromContext(buildTestFiscalContext());
  assert.equal(result.fiscalNFeItem, null);
});

test('42. nunca dois grupos', () => {
  const xml = resolveXmlFields({
    context: buildTestFiscalContext(),
    treatment: buildTaxTreatment(buildTestFiscalContext(), { currentOperationSt: 'NOT_DUE', issues: [] }),
    csosnResolution: { csosn: '102', icmsGroup: 'ICMSSN102', requiredXmlFields: [], issues: [] },
    cfopResolution: { cfop: '5102', issues: [] },
  });
  assert.equal(xml.icmsGroups.length, 1);
});

test('43. origem preservada no XML', () => {
  loadFixtures();
  const result = resolveFiscalFromContext(buildTestFiscalContext(), FIXTURE_OPTS);
  assert.equal(result.resolutions.xmlFields?.taxes?.icms?.fields?.orig, '0');
});

test('44. Decimal preservado', () => {
  loadFixtures();
  const result = resolveFiscalFromContext(buildTestFiscalContext({
    allocation: { quantidade: '2.5000000000' },
    item: { quantidade: '2.5000000000', valorUnitario: '10.0000000000' },
  }), FIXTURE_OPTS);
  assert.equal(result.resolutions.xmlFields?.product?.qCom, '2.5000000000');
});

test('45. campo obrigatório ausente gera issue (rule-driven requiredXmlFields)', () => {
  const xml = resolveXmlFields({
    context: buildTestFiscalContext({ allocation: { prior_st_status: 'RETAINED' } }),
    treatment: buildTaxTreatment(buildTestFiscalContext({ allocation: { prior_st_status: 'RETAINED' } }), {
      currentOperationSt: 'NOT_DUE',
      issues: [],
    }),
    csosnResolution: {
      csosn: '500',
      icmsGroup: 'ICMSSN500',
      requiredXmlFields: ['vBCSTRet', 'vICMSSTRet'],
      issues: [],
    },
    cfopResolution: { cfop: '5102', issues: [] },
  });
  assert.ok(xml.issues.some((i) => i.code === 'REQUIRED_FIELD_MISSING'));
});

test('46. não inventar zero genérico', () => {
  const ctx = buildTestFiscalContext({ allocation: { prior_st_status: 'RETAINED', st_allocation_json: {} } });
  const xml = resolveXmlFields({
    context: ctx,
    treatment: buildTaxTreatment(ctx, { currentOperationSt: 'NOT_DUE', issues: [] }),
    csosnResolution: {
      csosn: '500',
      icmsGroup: 'ICMSSN500',
      requiredXmlFields: ['vBCSTRet', 'vICMSSTRet'],
      issues: [],
    },
    cfopResolution: { cfop: '5102', issues: [] },
  });
  assert.equal(xml.resolved, false);
  assert.equal(xml.xmlFields?.taxes?.icms?.fields?.vBCSTRet, undefined);
});

test('47. não produz CSOSN composto', () => {
  loadFixtures();
  const result = resolveFiscalFromContext(buildTestFiscalContext(), FIXTURE_OPTS);
  const csosn = result.resolutions.xmlFields?.taxes?.icms?.fields?.CSOSN;
  assert.ok(csosn);
  assert.equal(typeof csosn, 'string');
  assert.ok(!String(csosn).includes('+'));
});

// --- CrossValidator (48-57) ---
test('48. cross validator resultado válido sem issues extras', () => {
  const ctx = buildTestFiscalContext();
  const cross = crossValidateFiscalResolution({
    context: ctx,
    treatment: buildTaxTreatment(ctx, { currentOperationSt: 'NOT_DUE', issues: [] }),
    currentStResolution: { currentOperationSt: 'NOT_DUE' },
    csosnResolution: { csosn: '102', resolved: true, constraints: {} },
    cfopResolution: { cfop: '5102', resolved: true, constraints: { location: 'INTERNA', itemSource: 'THIRD_PARTY' } },
    xmlResolution: {
      resolved: true,
      icmsGroups: [{ group: 'ICMSSN102' }],
      xmlFields: {
        product: { cfop: '5102' },
        taxes: { icms: { group: 'ICMSSN102', fields: { orig: '0', CSOSN: '102' } } },
      },
    },
    ruleRefs: [{ id: 'x' }],
    appliedRules: [],
  });
  assert.equal(cross.issues.length, 0);
});

test('49. CFOP x location incompatível', () => {
  const cross = crossValidateFiscalResolution({
    context: buildTestFiscalContext(),
    treatment: buildTaxTreatment(buildTestFiscalContext(), { currentOperationSt: 'NOT_DUE', issues: [] }),
    currentStResolution: { currentOperationSt: 'NOT_DUE' },
    csosnResolution: { csosn: '102' },
    cfopResolution: { cfop: '6102', constraints: { location: 'INTERESTADUAL' } },
    xmlResolution: { resolved: false, icmsGroups: [] },
    ruleRefs: [{ id: 'x' }],
    appliedRules: [],
  });
  assert.ok(cross.issues.some((i) => i.code === 'FISCAL_COMBINATION_FORBIDDEN'));
});

test('50. CFOP x itemSource incompatível', () => {
  const cross = crossValidateFiscalResolution({
    context: buildTestFiscalContext(),
    treatment: buildTaxTreatment(buildTestFiscalContext(), { currentOperationSt: 'NOT_DUE', issues: [] }),
    currentStResolution: { currentOperationSt: 'NOT_DUE' },
    csosnResolution: { csosn: '102' },
    cfopResolution: { cfop: '5101', constraints: { itemSource: 'OWN_PRODUCTION' } },
    xmlResolution: { resolved: false, icmsGroups: [] },
    ruleRefs: [{ id: 'x' }],
    appliedRules: [],
  });
  assert.ok(cross.issues.some((i) => i.code === 'FISCAL_COMBINATION_FORBIDDEN'));
});

test('51. current ST incompatível com CSOSN', () => {
  const cross = crossValidateFiscalResolution({
    context: buildTestFiscalContext(),
    treatment: buildTaxTreatment(buildTestFiscalContext(), { currentOperationSt: 'DUE_BY_ISSUER', issues: [] }),
    currentStResolution: { currentOperationSt: 'DUE_BY_ISSUER' },
    csosnResolution: { csosn: '102' },
    cfopResolution: { cfop: '5102', constraints: {} },
    xmlResolution: { resolved: false, icmsGroups: [] },
    ruleRefs: [{ id: 'x' }],
    appliedRules: [],
  });
  assert.ok(cross.issues.some((i) => i.code === 'FISCAL_COMBINATION_FORBIDDEN'));
});

test('52. CSOSN incompatível por constraint', () => {
  const cross = crossValidateFiscalResolution({
    context: buildTestFiscalContext(),
    treatment: buildTaxTreatment(buildTestFiscalContext(), { currentOperationSt: 'NOT_DUE', issues: [] }),
    currentStResolution: { currentOperationSt: 'NOT_DUE' },
    csosnResolution: { csosn: '500', constraints: { stScenarioKey: 'RETAINED+NOT_DUE' } },
    cfopResolution: { cfop: '5102', constraints: {} },
    xmlResolution: { resolved: false, icmsGroups: [] },
    ruleRefs: [{ id: 'x' }],
    appliedRules: [],
  });
  assert.ok(cross.issues.some((i) => i.code === 'FISCAL_COMBINATION_FORBIDDEN'));
});

test('53. origem desconhecida quando obrigatória', () => {
  const ctx = buildTestFiscalContext({ allocation: { origem_mercadoria: 'UNKNOWN', allocation_audit_json: {} } });
  const cross = crossValidateFiscalResolution({
    context: ctx,
    treatment: buildTaxTreatment(ctx, { currentOperationSt: 'NOT_DUE', issues: [] }),
    currentStResolution: { currentOperationSt: 'NOT_DUE' },
    csosnResolution: { csosn: '102' },
    cfopResolution: { cfop: '5102', constraints: {} },
    xmlResolution: { resolved: true, icmsGroups: [{}] },
    ruleRefs: [{ id: 'x' }],
    appliedRules: [],
  });
  assert.ok(cross.issues.some((i) => i.code === 'ORIGIN_UNKNOWN'));
});

test('54. grupo ICMS duplicado', () => {
  const cross = crossValidateFiscalResolution({
    context: buildTestFiscalContext(),
    treatment: buildTaxTreatment(buildTestFiscalContext(), { currentOperationSt: 'NOT_DUE', issues: [] }),
    currentStResolution: { currentOperationSt: 'NOT_DUE' },
    csosnResolution: { csosn: '102' },
    cfopResolution: { cfop: '5102', constraints: {} },
    xmlResolution: { resolved: true, icmsGroups: [{}, {}] },
    ruleRefs: [{ id: 'x' }],
    appliedRules: [],
  });
  assert.ok(cross.issues.some((i) => i.code === 'FISCAL_COMBINATION_FORBIDDEN'));
});

test('55. ruleRef inconsistente', () => {
  const cross = crossValidateFiscalResolution({
    context: buildTestFiscalContext(),
    treatment: buildTaxTreatment(buildTestFiscalContext(), { currentOperationSt: 'NOT_DUE', issues: [] }),
    currentStResolution: { currentOperationSt: 'NOT_DUE' },
    csosnResolution: { csosn: '102' },
    cfopResolution: { cfop: '5102', constraints: {} },
    xmlResolution: { resolved: false, icmsGroups: [] },
    ruleRefs: [{ id: '' }],
    appliedRules: [],
  });
  assert.ok(cross.issues.some((i) => i.code === 'REQUIRED_FIELD_MISSING'));
});

test('56. rule conflict propagado', () => {
  loadFixtures();
  const ctx = buildTestFiscalContext({ recipient: { uf: 'SP' }, operation: { destinationUf: 'SP' } });
  const result = resolveFiscalFromContext(ctx, FIXTURE_OPTS);
  assert.ok(result.issues.some((i) => i.code === 'RULE_CONFLICT'));
});

test('57. blocksEmission propagado', () => {
  loadFixtures();
  const result = resolveFiscalFromContext(buildTestFiscalContext({
    recipient: { uf: 'SP' },
    operation: { destinationUf: 'SP' },
  }), FIXTURE_OPTS);
  assert.equal(result.blocked, true);
});

// --- Pipeline scenarios A-D ---
test('pipeline A — cenário suportado OK', () => {
  loadFixtures();
  const result = resolveFiscalFromContext(buildTestFiscalContext(), FIXTURE_OPTS);
  assert.equal(result.resolutions.currentSt, 'NOT_DUE');
  assert.equal(result.resolutions.csosn, '102');
  assert.equal(result.resolutions.cfop, '5102');
  assert.ok(result.fiscalNFeItem);
  assert.equal(result.resolutions.currentSt, CURRENT_OPERATION_ST.NOT_DUE);
});

test('pipeline B — sem regra não inventa CFOP/CSOSN', () => {
  const result = resolveFiscalFromContext(buildTestFiscalContext());
  assert.equal(result.resolutions.cfop, null);
  assert.equal(result.resolutions.csosn, null);
  assert.ok(result.blocked || result.resolutionStatus !== 'OK');
});

test('pipeline C — conflito bloqueia', () => {
  loadFixtures();
  const result = resolveFiscalFromContext(buildTestFiscalContext({
    recipient: { uf: 'SP', cpfCnpj: '12345678901', icmsTaxpayerStatus: 'NON_TAXPAYER' },
    operation: { destinationUf: 'SP' },
  }), FIXTURE_OPTS);
  assert.ok(result.issues.some((i) => i.code === 'RULE_CONFLICT'));
  assert.equal(result.blocked, true);
});

test('pipeline D — split duas allocations separadas', () => {
  loadFixtures();
  const a1 = allocationFixture({ quantidade: '5.0000000000', prior_st_status: 'RETAINED', origem_mercadoria: '0' });
  const a2 = allocationFixture({ quantidade: '3.0000000000', prior_st_status: 'NO_ST_EVIDENCE', origem_mercadoria: '2' });
  const base = {
    empresaId: TEST_EMPRESA_ID,
    issuer: { crt: 1, uf: 'RJ' },
    recipient: { uf: 'RJ', cpfCnpj: '12345678901', icmsTaxpayerStatus: 'NON_TAXPAYER' },
    produto: { ncm: '22021000', descricao: 'Prod' },
    item: { itemSource: 'THIRD_PARTY', valorUnitario: 10 },
    operation: { tipo: 'VENDA' },
    referenceDate: '2026-06-15',
  };
  const contexts = [
    buildFiscalContextFromAllocation({ ...base, fiscalItemAllocation: a1 }),
    buildFiscalContextFromAllocation({ ...base, fiscalItemAllocation: a2 }),
  ];
  const results = resolveFiscalFromContexts(contexts, FIXTURE_OPTS);
  assert.equal(results.length, 2);
  assert.notEqual(results[0].context.allocationId, results[1].context.allocationId);
});

test('tenant — empresa B não usa regra privada de A', () => {
  loadFixtures();
  const ctxA = buildTestFiscalContext({ empresaId: 'tenant-a' });
  const ctxB = buildTestFiscalContext({ empresaId: 'tenant-b' });
  const stA = resolveCurrentStLiability(ctxA, listFiscalRulesForEmpresa('tenant-a'), FIXTURE_OPTS);
  const stB = resolveCurrentStLiability(ctxB, listFiscalRulesForEmpresa('tenant-b'), FIXTURE_OPTS);
  assert.equal(stA.currentOperationSt, 'DUE_BY_ISSUER');
  assert.equal(stB.currentOperationSt, 'NOT_DUE');
});

test('FISCAL_ENGINE_V3 permanece false após Fases 5+6', () => {
  assert.equal(isFiscalEngineV3Enabled(), false);
});

// --- Hardening segurança (checkpoint Fases 5+6) ---
test('hardening A — productionReady=false + modo SAFE => unresolved/blocked', () => {
  loadFixtures();
  const result = resolveFiscalFromContext(buildTestFiscalContext());
  assert.equal(result.resolutions.currentSt, 'UNKNOWN');
  assert.equal(result.resolutions.csosn, null);
  assert.equal(result.resolutions.cfop, null);
  assert.equal(result.fiscalNFeItem, null);
  assert.ok(result.issues.some((i) => i.code === 'RULE_NOT_PRODUCTION_READY'));
  assert.ok(result.blocked);
});

test('hardening B — productionReady=false + allowNonProductionRules => resolve', () => {
  loadFixtures();
  const result = resolveFiscalFromContext(buildTestFiscalContext(), FIXTURE_OPTS);
  assert.equal(result.resolutions.currentSt, 'NOT_DUE');
  assert.equal(result.resolutions.csosn, '102');
  assert.equal(result.resolutions.cfop, '5102');
});

test('hardening C — productionReady=true resolve em modo SAFE', () => {
  resetFiscalRulesRepository();
  registerFiscalRules([createValidatedProductionReadyCurrentStRule()]);
  const result = resolveFiscalFromContext(buildTestFiscalContext());
  assert.equal(result.resolutions.currentSt, 'NOT_DUE');
  assert.ok(!result.issues.some((i) => i.code === 'RULE_NOT_PRODUCTION_READY' && i.blocksEmission));
});

test('hardening D — mixed rules: só productionReady decide em SAFE', () => {
  resetFiscalRulesRepository();
  registerFiscalRules([
    createValidatedProductionReadyCurrentStRule(),
    {
      id: 'non-prod-would-win',
      ruleType: 'CURRENT_ST',
      schemaVersion: '1.0.0',
      applicableCrt: [1],
      effectiveFrom: '2026-01-01',
      priority: 9999,
      conditions: { location: ['INTERNA'], itemSource: ['THIRD_PARTY'] },
      result: { currentOperationSt: 'DUE_BY_ISSUER' },
      sourceLegalReference: 'FIXTURE:WOULD_WIN_IF_ALLOWED',
      productionReady: false,
    },
  ]);
  const result = resolveFiscalFromContext(buildTestFiscalContext());
  assert.equal(result.resolutions.currentSt, 'NOT_DUE');
});

test('hardening E — default repository vazio sem bootstrap silencioso', () => {
  assert.equal(listFiscalRulesForEmpresa(TEST_EMPRESA_ID).length, 0);
  assert.equal(normalizeResolverOptions({}).allowNonProductionRules, false);
  assert.equal(DEFAULT_RESOLVER_OPTIONS.allowNonProductionRules, false);
  const result = resolveFiscalFromContext(buildTestFiscalContext());
  assert.equal(result.resolutions.cfop, null);
  assert.equal(result.resolutions.csosn, null);
});

test('hardening F — INTERESTADUAL + THIRD_PARTY + NON_TAXPAYER não recebe 6102 genérico', () => {
  loadFixtures();
  const result = resolveFiscalFromContext(buildTestFiscalContext({
    recipient: { uf: 'SP', cpfCnpj: '12345678901', icmsTaxpayerStatus: 'NON_TAXPAYER' },
    operation: { destinationUf: 'SP' },
  }), FIXTURE_OPTS);
  assert.notEqual(result.resolutions.cfop, '6102');
});

test('hardening G — CURRENT_ST circular dependency rejeitada no register', () => {
  const validation = validateRuleDependencies({
    id: 'bad-current-st',
    ruleType: 'CURRENT_ST',
    conditions: { stScenarioKey: ['RETAINED+NOT_DUE'] },
  });
  assert.equal(validation.ok, false);
  assert.throws(() => registerFiscalRules([{
    id: 'bad-current-st',
    ruleType: 'CURRENT_ST',
    schemaVersion: '1.0.0',
    applicableCrt: [1],
    effectiveFrom: '2026-01-01',
    conditions: { currentOperationSt: ['NOT_DUE'] },
    result: { currentOperationSt: 'DUE_BY_ISSUER' },
    sourceLegalReference: 'FIX',
    productionReady: false,
  }]));
});

test('hardening H — NOT_DUE isolado não resolve CSOSN 102', () => {
  loadFixtures();
  const ctx = buildTestFiscalContext();
  const treatment = buildTaxTreatment(ctx, { currentOperationSt: 'NOT_DUE', issues: [] });
  const facts = extractFactsFromContext(ctx, treatment);
  delete facts.location;
  delete facts.itemSource;
  delete facts.recipientTaxpayerStatus;
  const r = resolveFiscalRule(rules(), 'CSOSN', facts, FIXTURE_OPTS);
  assert.equal(r.ok, false);
});

test('hardening I — RETAINED isolado não resolve CSOSN 500', () => {
  loadFixtures();
  const ctx = buildTestFiscalContext({ allocation: { prior_st_status: 'RETAINED' } });
  const treatment = buildTaxTreatment(ctx, { currentOperationSt: 'NOT_DUE', issues: [] });
  const facts = extractFactsFromContext(ctx, treatment);
  delete facts.location;
  delete facts.itemSource;
  delete facts.priorStStatus;
  const r = resolveFiscalRule(rules(), 'CSOSN', facts, FIXTURE_OPTS);
  assert.equal(r.ok, false);
});

test('hardening J — CEST + RETAINED isolado não resolve CSOSN 500', () => {
  loadFixtures();
  const ctx = buildTestFiscalContext({
    allocation: { prior_st_status: 'RETAINED', supplier_cest: '1234567' },
    produto: { cest: '1234567' },
  });
  const treatment = buildTaxTreatment(ctx, { currentOperationSt: 'NOT_DUE', issues: [] });
  const facts = extractFactsFromContext(ctx, treatment);
  delete facts.location;
  delete facts.itemSource;
  const r = resolveFiscalRule(rules(), 'CSOSN', facts, FIXTURE_OPTS);
  assert.equal(r.ok, false);
});

test('hardening K — CSOSN 500 sem requiredXmlFields na regra não exige vBCSTRet universalmente', () => {
  const xml = resolveXmlFields({
    context: buildTestFiscalContext({
      allocation: {
        prior_st_status: 'RETAINED',
        st_allocation_json: { allocatedValues: {} },
      },
    }),
    treatment: buildTaxTreatment(buildTestFiscalContext(), { currentOperationSt: 'NOT_DUE', issues: [] }),
    csosnResolution: { csosn: '500', icmsGroup: 'ICMSSN500', requiredXmlFields: [], issues: [] },
    cfopResolution: { cfop: '5102', issues: [] },
  });
  assert.equal(xml.resolved, true);
  assert.equal(xml.xmlFields?.taxes?.icms?.fields?.vBCSTRet, undefined);
});

test('hardening L — xmlFields separa product de taxes.icms', () => {
  loadFixtures();
  const result = resolveFiscalFromContext(buildTestFiscalContext(), FIXTURE_OPTS);
  assert.ok(result.resolutions.xmlFields?.product?.cfop);
  assert.ok(result.resolutions.xmlFields?.taxes?.icms?.fields?.CSOSN);
  assert.equal(result.resolutions.xmlFields?.product?.cfop, result.resolutions.cfop);
  assert.equal(result.resolutions.xmlFields?.taxes?.icms?.fields?.CFOP, undefined);
});
