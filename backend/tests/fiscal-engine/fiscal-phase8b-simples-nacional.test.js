/**
 * Fase 8B — Motor Fiscal Real Simples Nacional (CRT 1) — matriz corrigida.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CSOSN_CATALOG_CRT1,
  OFFICIAL_CSOSN_CODES_CRT1,
  getCsosnCatalogEntryCrt1,
  validateCsosnCatalogCompatibility,
  CSOSN_NFE_EFFECTIVE_FROM,
  SINIEF_AJUSTE_39_2023_EFFECTIVE_FROM,
  PRIOR_ST_RETAINED_SEMANTICS,
  getCsosnCatalogEntryForDate,
  resolveCsosnCatalogSourceRefs,
  resolveCsosnCatalogProvenanceVersion,
  assertCsosnProvenanceNotAnachronistic,
  buildCsosnCatalogProvenanceAudit,
  FISCAL_ENGINE_TEST_COUNT_REGRESSION_MATRIX,
  FISCAL_ENGINE_TEST_COUNT_AUDIT,
  resolveXmlFields,
  assertCsosnInvariantForCurrentSt,
  assertCsosnEffectiveForReferenceDate,
  resolveCsosnResolutionStatusForDueByIssuer,
  assertCoverageMatrixHasNoForbiddenCsosnCombo,
  resolveCfopNatureFromFacts,
  assertCfopCsosnIndependence,
  validateFiscalLegalSource,
  getFiscalLegalSource,
  buildStApplicabilityContext,
  evaluateStApplicability,
  getStParameterEntriesForDate,
  resolveDifalFromContext,
  buildConsumptionTaxContext,
  resolveConsumptionTaxLayer,
  CONSUMPTION_TAX_PROFILE,
  validateProductionReadyPromotion,
  createSimplesNacionalPhase8bRules,
  buildSimplesNacionalCoverageMatrix,
  formatCoverageMatrixReport,
  evaluateScenarioResolutionStatus,
  evaluateCfopNatureForContext,
  calculateIcmsStByMethod,
  buildPriorStRetainedXmlFields,
  resetFiscalRulesRepository,
  registerFiscalRules,
  bootstrapDefaultTestRules,
  resolveFiscalFromContext,
  resolveFiscalFromContexts,
  extractFactsFromContext,
  crossValidateFiscalResolution,
  buildTaxTreatment,
  isFiscalEngineV3Enabled,
} from '../../src/fiscal-engine/index.js';
import { buildTestFiscalContext } from './fixtures/fiscal-context-fixture.js';

const FIXTURE_OPTS = { allowNonProductionRules: true };

test.beforeEach(() => {
  resetFiscalRulesRepository();
});

test.afterEach(() => {
  resetFiscalRulesRepository();
});

// --- 1-4: Catálogo completo ---
test('8B-M01: catálogo contém 10 CSOSN oficiais', () => {
  assert.equal(CSOSN_CATALOG_CRT1.length, 10);
  assert.deepEqual(CSOSN_CATALOG_CRT1.map((e) => e.csosn).sort(), [...OFFICIAL_CSOSN_CODES_CRT1].sort());
});

test('8B-M02: CSOSN 203 presente no catálogo', () => {
  assert.ok(getCsosnCatalogEntryCrt1('203'));
});

test('8B-M03: CSOSN 300 presente no catálogo', () => {
  const e = getCsosnCatalogEntryCrt1('300');
  assert.ok(e);
  assert.equal(e.isImmune, true);
});

test('8B-M04: CSOSN 400 presente no catálogo', () => {
  const e = getCsosnCatalogEntryCrt1('400');
  assert.ok(e);
  assert.equal(e.isNotTaxed, true);
});

// --- 5-6: Invariant DUE_BY_ISSUER ---
test('8B-M05: DUE_BY_ISSUER nunca resolve CSOSN 102', () => {
  const inv = assertCsosnInvariantForCurrentSt('DUE_BY_ISSUER', '102');
  assert.equal(inv.ok, false);
  assert.equal(inv.reason, 'CSOSN_102_FORBIDDEN_WHEN_DUE_BY_ISSUER');
});

test('8B-M06: DUE_BY_ISSUER sem condições suficientes => NOT_READY', () => {
  const r = resolveCsosnResolutionStatusForDueByIssuer('DUE_BY_ISSUER', { hasLegalBasis: false });
  assert.equal(r.status, 'NOT_READY');
});

// --- 7-9: CFOP interno ---
test('8B-M07: internal reseller common => 5102 quando aplicável', () => {
  const r = resolveCfopNatureFromFacts({
    location: 'INTERNA',
    itemSource: 'THIRD_PARTY',
    operationType: 'VENDA',
    priorStStatus: 'NO_ST_EVIDENCE',
    currentOperationSt: 'NOT_DUE',
    issuerStLiability: 'NOT_RESPONSIBLE',
  });
  assert.equal(r.cfop, '5102');
});

test('8B-M08: internal reseller substituted ST => 5405 quando aplicável', () => {
  const r = resolveCfopNatureFromFacts({
    location: 'INTERNA',
    itemSource: 'THIRD_PARTY',
    operationType: 'VENDA',
    priorStStatus: 'RETAINED',
    currentOperationSt: 'NOT_DUE',
    issuerStLiability: 'SUBSTITUTED',
    stApplicabilityStatus: 'APPLICABLE',
  });
  assert.equal(r.cfop, '5405');
});

test('8B-M09: RETAINED sozinho não gera 5405', () => {
  const r = resolveCfopNatureFromFacts({
    location: 'INTERNA',
    itemSource: 'THIRD_PARTY',
    priorStStatus: 'RETAINED',
    currentOperationSt: 'NOT_DUE',
    issuerStLiability: 'UNKNOWN',
  });
  assert.equal(r.cfop, null);
  assert.equal(r.status, 'NOT_READY');
});

// --- 10-13: CFOP interestadual ---
test('8B-M10: interstate taxpayer common => 6102 quando aplicável', () => {
  const r = resolveCfopNatureFromFacts({
    location: 'INTERESTADUAL',
    itemSource: 'THIRD_PARTY',
    operationType: 'VENDA',
    priorStStatus: 'NO_ST_EVIDENCE',
    currentOperationSt: 'NOT_DUE',
    recipientTaxpayerStatus: 'TAXPAYER',
    issuerStLiability: 'NOT_RESPONSIBLE',
  });
  assert.equal(r.cfop, '6102');
});

test('8B-M11: interstate non-taxpayer => 6108 quando aplicável', () => {
  const r = resolveCfopNatureFromFacts({
    location: 'INTERESTADUAL',
    itemSource: 'THIRD_PARTY',
    operationType: 'VENDA',
    priorStStatus: 'NO_ST_EVIDENCE',
    currentOperationSt: 'NOT_DUE',
    recipientTaxpayerStatus: 'NON_TAXPAYER',
  });
  assert.equal(r.cfop, '6108');
});

test('8B-M12: interstate ST substitute => 6403 quando aplicável', () => {
  const r = resolveCfopNatureFromFacts({
    location: 'INTERESTADUAL',
    itemSource: 'THIRD_PARTY',
    operationType: 'VENDA',
    currentOperationSt: 'DUE_BY_ISSUER',
    issuerStLiability: 'SUBSTITUTE',
    stApplicabilityStatus: 'APPLICABLE',
    recipientTaxpayerStatus: 'TAXPAYER',
  });
  assert.equal(r.cfop, '6403');
});

test('8B-M13: prior retained sozinho não gera 6404', () => {
  const r = resolveCfopNatureFromFacts({
    location: 'INTERESTADUAL',
    itemSource: 'THIRD_PARTY',
    priorStStatus: 'RETAINED',
    currentOperationSt: 'NOT_DUE',
    recipientTaxpayerStatus: 'TAXPAYER',
    interstatePriorRetainedEligible: false,
  });
  assert.equal(r.cfop, null);
  assert.match(r.reason, /6404/);
});

// --- 14-15: CFOP/CSOSN independentes ---
test('8B-M14: CSOSN 500 sozinho não determina CFOP', () => {
  const check = assertCfopCsosnIndependence({
    csosn: '500',
    cfop: '5405',
    facts: { issuerStLiability: 'UNKNOWN', priorStStatus: 'RETAINED' },
  });
  assert.equal(check.ok, false);
});

test('8B-M15: CFOP ST sozinho não determina CSOSN', () => {
  const check = assertCfopCsosnIndependence({
    cfop: '5405',
    csosn: '102',
    facts: { priorStStatus: 'RETAINED', issuerStLiability: 'UNKNOWN' },
  });
  assert.equal(check.ok, false);
});

// --- 16: Vigência ---
test('8B-M16: vigência anterior a 01/10/2010 não usa CSOSN da NF-e', () => {
  const v = validateCsosnCatalogCompatibility({
    csosn: '102',
    crt: 1,
    referenceDate: '2010-09-30',
  });
  assert.equal(v.compatible, false);
  assert.equal(v.reason, 'CSOSN_BEFORE_NFE_EFFECTIVE_DATE');
  assert.equal(assertCsosnEffectiveForReferenceDate('2010-09-30', '102').ok, false);
  assert.equal(CSOSN_NFE_EFFECTIVE_FROM, '2010-10-01');
});

// --- 17: Coverage matrix ---
test('8B-M17: coverage matrix não contém DUE_BY_ISSUER + CSOSN102', () => {
  const rows = buildSimplesNacionalCoverageMatrix();
  assert.doesNotThrow(() => assertCoverageMatrixHasNoForbiddenCsosnCombo(rows));
  const bad = rows.filter((r) => r.currentOperationSt === 'DUE_BY_ISSUER' && r.csosn === '102');
  assert.equal(bad.length, 0);
});

// --- 18: IBS/CBS ---
test('8B-M18: regime regular IBS/CBS não vaza para CRT1', () => {
  const ctx = buildConsumptionTaxContext(buildTestFiscalContext(), {
    profile: CONSUMPTION_TAX_PROFILE.REGULAR,
  });
  const r = resolveConsumptionTaxLayer(ctx);
  assert.equal(r.status, 'FORBIDDEN');
  assert.ok(r.issues.some((i) => i.code === 'FISCAL_COMBINATION_FORBIDDEN'));
});

// --- Integração pipeline ---
test('8B-M19: revenda interna comum CSOSN 102 CFOP 5102', () => {
  bootstrapDefaultTestRules();
  registerFiscalRules(createSimplesNacionalPhase8bRules());
  const result = evaluateScenarioResolutionStatus(buildTestFiscalContext({
    fiscalExtensions: { issuerStLiability: 'NOT_RESPONSIBLE' },
  }));
  assert.equal(result.cfop, '5102');
  assert.equal(result.csosn, '102');
});

test('8B-M20: interna substituído resolve CFOP 5405 independente de CSOSN', () => {
  bootstrapDefaultTestRules();
  registerFiscalRules(createSimplesNacionalPhase8bRules());
  const ctx = buildTestFiscalContext({
    allocation: {
      prior_st_status: 'RETAINED',
      st_allocation_json: { allocatedValues: { vBCSTRet: '10.00', vICMSSTRet: '1.80' } },
    },
    fiscalExtensions: {
      issuerStLiability: 'SUBSTITUTED',
      stApplicabilityStatus: 'APPLICABLE',
    },
  });
  const cfopNature = resolveCfopNatureFromFacts({
    ...extractFactsFromContext(ctx),
    currentOperationSt: 'NOT_DUE',
  });
  const result = evaluateScenarioResolutionStatus(ctx);
  assert.equal(cfopNature.cfop, '5405');
  assert.equal(result.csosn, '500');
  assert.equal(result.cfop, '5405');
});

test('8B-M21: interestadual não contribuinte CFOP 6108', () => {
  bootstrapDefaultTestRules();
  registerFiscalRules(createSimplesNacionalPhase8bRules());
  const result = evaluateScenarioResolutionStatus(buildTestFiscalContext({
    recipient: { uf: 'SP', icmsTaxpayerStatus: 'NON_TAXPAYER' },
    operation: { destinationUf: 'SP' },
    fiscalExtensions: { issuerStLiability: 'NOT_RESPONSIBLE' },
  }));
  assert.equal(result.cfop, '6108');
});

test('8B-M22: RETAINED interno sem substituído não resolve CFOP 5102', () => {
  bootstrapDefaultTestRules();
  registerFiscalRules(createSimplesNacionalPhase8bRules());
  const result = evaluateScenarioResolutionStatus(buildTestFiscalContext({
    allocation: {
      prior_st_status: 'RETAINED',
      st_allocation_json: { allocatedValues: { vBCSTRet: '10.00', vICMSSTRet: '1.80' } },
    },
  }));
  assert.notEqual(result.cfop, '5102');
});

test('8B-M23: fonte Ajuste SINIEF 3/2010 registrada com vigência 2010-10-01', () => {
  const src2010 = getFiscalLegalSource('ajuste-sinief-3-2010');
  assert.ok(src2010);
  assert.equal(validateFiscalLegalSource(src2010).ok, true);
  assert.equal(src2010.effectiveFrom, '2010-10-01');
  assert.equal(src2010.documentNumber, '3/2010');
});

test('8B-M28: referenceDate 2010-10-01 usa provenance Ajuste SINIEF 3/10', () => {
  const refs = resolveCsosnCatalogSourceRefs('2010-10-01');
  assert.ok(refs.includes('ajuste-sinief-3-2010'));
  assert.ok(refs.includes('encat-manual-csosn'));
  assert.equal(refs.includes('sinief-ajuste-39-2023'), false);
  const entry = getCsosnCatalogEntryForDate('102', '2010-10-01');
  assert.equal(entry?.provenanceVersionId, 'csosn-provenance-2010');
});

test('8B-M29: regras Phase8B vigentes em 2010 não apontam para Ajuste 39/23', () => {
  const rules = createSimplesNacionalPhase8bRules().filter(
    (r) => r.effectiveFrom === CSOSN_NFE_EFFECTIVE_FROM,
  );
  assert.ok(rules.length > 0);
  for (const rule of rules) {
    assert.equal(
      (rule.sourceRefs ?? []).includes('sinief-ajuste-39-2023'),
      false,
      `Regra ${rule.id} não deve referenciar Ajuste 39/23 com effectiveFrom 2010`,
    );
  }
});

test('8B-M30: source Ajuste 39/2023 possui vigência real (não 2010)', () => {
  const src = getFiscalLegalSource('sinief-ajuste-39-2023');
  assert.ok(src);
  assert.equal(src.effectiveFrom, SINIEF_AJUSTE_39_2023_EFFECTIVE_FROM);
  assert.equal(src.effectiveFrom, '2023-12-01');
  assert.notEqual(src.effectiveFrom, CSOSN_NFE_EFFECTIVE_FROM);
  const refs2023 = resolveCsosnCatalogSourceRefs('2024-01-01');
  assert.ok(refs2023.includes('sinief-ajuste-39-2023'));
});

test('8B-M31: catálogo CSOSN 500 não exige ST fields universalmente', () => {
  const entry = getCsosnCatalogEntryCrt1('500');
  assert.ok(entry);
  assert.equal(entry.requiredXmlFields.length, 0);
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

test('8B-M32: CSOSN 500 com requiredXmlFields explícitos na regra exige campos', () => {
  const xml = resolveXmlFields({
    context: buildTestFiscalContext({
      allocation: {
        prior_st_status: 'RETAINED',
        st_allocation_json: { allocatedValues: {} },
      },
    }),
    treatment: buildTaxTreatment(buildTestFiscalContext(), { currentOperationSt: 'NOT_DUE', issues: [] }),
    csosnResolution: {
      csosn: '500',
      icmsGroup: 'ICMSSN500',
      requiredXmlFields: ['vBCSTRet', 'vICMSSTRet'],
      issues: [],
    },
    cfopResolution: { cfop: '5102', issues: [] },
  });
  assert.equal(xml.resolved, false);
  assert.ok(xml.issues.some((i) => i.code === 'REQUIRED_FIELD_MISSING'));
});

test('8B-M33: regra pode exigir pST junto de vBCSTRet/vICMSSTRet', () => {
  const xml = resolveXmlFields({
    context: buildTestFiscalContext({
      allocation: {
        prior_st_status: 'RETAINED',
        st_allocation_json: {
          allocatedValues: { vBCSTRet: '10.00', vICMSSTRet: '1.80' },
        },
      },
    }),
    treatment: buildTaxTreatment(buildTestFiscalContext(), { currentOperationSt: 'NOT_DUE', issues: [] }),
    csosnResolution: {
      csosn: '500',
      icmsGroup: 'ICMSSN500',
      requiredXmlFields: ['vBCSTRet', 'pST', 'vICMSSTRet'],
      issues: [],
    },
    cfopResolution: { cfop: '5102', issues: [] },
  });
  assert.equal(xml.resolved, false);
  assert.ok(xml.issues.some((i) => i.meta?.field === 'pST'));
});

test('8B-M34: ausência de campo ST não inventa zero', () => {
  const r = buildPriorStRetainedXmlFields({
    allocation: { quantity: '1' },
    lotEvidence: {},
  });
  assert.equal(r.xmlFields, null);
  assert.ok(r.issues.some((i) => i.code === 'REQUIRED_FIELD_MISSING'));
  assert.ok(r.issues.some((i) => i.message.includes('não inventar zero')));
});

test('8B-M35: provenance histórica reproduzível por referenceDate', () => {
  const audit2010 = buildCsosnCatalogProvenanceAudit('2010-10-01');
  assert.equal(audit2010.anachronismOk, true);
  assert.ok(audit2010.sourceRefs.includes('ajuste-sinief-3-2010'));

  const audit2024 = buildCsosnCatalogProvenanceAudit('2024-06-15');
  assert.equal(audit2024.anachronismOk, true);
  assert.ok(audit2024.sourceRefs.includes('sinief-ajuste-39-2023'));

  const anachronism = assertCsosnProvenanceNotAnachronistic('2010-10-01', ['sinief-ajuste-39-2023']);
  assert.equal(anachronism.ok, false);
});

test('8B-M36: matriz explica redução 463 → 455', () => {
  assert.equal(FISCAL_ENGINE_TEST_COUNT_AUDIT.reported463, 463);
  assert.equal(FISCAL_ENGINE_TEST_COUNT_AUDIT.reported455, 455);
  assert.equal(FISCAL_ENGINE_TEST_COUNT_AUDIT.deltaDraftToCorrected, -8);
  assert.ok(FISCAL_ENGINE_TEST_COUNT_REGRESSION_MATRIX.length >= 4);
  const consolidated = FISCAL_ENGINE_TEST_COUNT_REGRESSION_MATRIX.filter((r) => r.status === 'CONSOLIDATED');
  assert.equal(consolidated.reduce((sum, r) => sum + r.previousCount, 0), 24);
});

test('8B-M37: priorSt RETAINED documenta ST anterior + antecipação via semântica auditável', () => {
  assert.equal(PRIOR_ST_RETAINED_SEMANTICS.domainValue, 'RETAINED');
  assert.ok(PRIOR_ST_RETAINED_SEMANTICS.documentClassifications.includes('PRIOR_RETAINED'));
  assert.ok(PRIOR_ST_RETAINED_SEMANTICS.documentClassifications.includes('COLLECTED_IN_PURCHASE'));
  assert.equal(PRIOR_ST_RETAINED_SEMANTICS.antecipationExplicitEnum, 'NOT_READY');
  const version = resolveCsosnCatalogProvenanceVersion('2010-10-01');
  assert.equal(version?.id, 'csosn-provenance-2010');
});

test('8B-M38: nenhum invariant anterior da Fase 5/6 foi removido', () => {
  assert.equal(CSOSN_CATALOG_CRT1.length, 10);
  assert.equal(assertCsosnInvariantForCurrentSt('DUE_BY_ISSUER', '102').ok, false);
  const retainedAlone = resolveCfopNatureFromFacts({
    location: 'INTERNA',
    itemSource: 'THIRD_PARTY',
    priorStStatus: 'RETAINED',
    currentOperationSt: 'NOT_DUE',
    issuerStLiability: 'UNKNOWN',
  });
  assert.equal(retainedAlone.cfop, null);
  assert.equal(FISCAL_ENGINE_TEST_COUNT_AUDIT.baselineHeadMain, 428);
  assert.equal(createSimplesNacionalPhase8bRules().every((r) => r.productionReady === false), true);
});

test('8B-M24: cross-validator bloqueia 5405 sem substituído', () => {
  const ctx = buildTestFiscalContext({
    allocation: { prior_st_status: 'RETAINED' },
  });
  const treatment = buildTaxTreatment(ctx, { currentOperationSt: 'NOT_DUE', issues: [] });
  const cross = crossValidateFiscalResolution({
    context: ctx,
    treatment,
    currentStResolution: { currentOperationSt: 'NOT_DUE', issues: [] },
    csosnResolution: { csosn: '500', issues: [] },
    cfopResolution: { cfop: '5405', issues: [] },
    xmlResolution: { resolved: false, issues: [] },
  });
  assert.ok(cross.issues.some((i) => i.message.includes('5405')));
});

test('8B-M25: pacote Phase8B permanece productionReady=false', () => {
  assert.equal(createSimplesNacionalPhase8bRules().every((r) => r.productionReady === false), true);
});

test('8B-M26: coverage matrix regera relatório sem combinações perigosas', () => {
  const report = formatCoverageMatrixReport(buildSimplesNacionalCoverageMatrix());
  assert.ok(report.includes('MOTIVO'));
  assert.ok(!report.includes('DUE_BY_ISSUER | 5403 | 102'));
});

test('8B-M27: FISCAL_ENGINE_V3 permanece false', () => {
  assert.equal(isFiscalEngineV3Enabled(), false);
});
