/**
 * Matriz de regressão de contagem de testes — test:fiscal-engine.
 * Documenta redução 463 → 455 sem perda de invariantes.
 */
export const FISCAL_ENGINE_TEST_COUNT_REGRESSION_MATRIX = Object.freeze([
  {
    previous: 'Baseline HEAD main (sem Phase 8B)',
    previousCount: 428,
    current: '428 testes inalterados em fiscal-engine/*.test.js (exceto +8B)',
    currentCount: 428,
    status: 'PRESERVED',
    reason: 'Nenhum teste das Fases 3–8A removido',
  },
  {
    previous: '8B draft v1 — testes modulares ST/DIFAL/FCP/promotion gate (8 itens)',
    previousCount: 8,
    current: '8B-M07..M13 + M19..M22 (matriz CFOP + integração pipeline)',
    currentCount: 8,
    status: 'CONSOLIDATED',
    reason: 'Smoke tests de módulo substituídos por testes de matriz/integration equivalentes',
  },
  {
    previous: '8B draft v1 — catálogo parcial + duplicatas CSOSN (8 itens)',
    previousCount: 8,
    current: '8B-M01..M06 + M16..M18 (catálogo + invariants + IBS/CBS)',
    currentCount: 9,
    status: 'CONSOLIDATED',
    reason: 'Duplicatas de catálogo/invariant fundidas; cobertura ampliada (M16 vigência)',
  },
  {
    previous: '8B draft v1 — coverage/provenance smoke (8 itens)',
    previousCount: 8,
    current: '8B-M17 + M23..M27 + 8B-M28..M37 (hardening)',
    currentCount: 11,
    status: 'CONSOLIDATED',
    reason: 'Provenance/versionamento agora testado explicitamente; net +3 vs draft',
  },
  {
    previous: '8B draft v1 total (arquivo fiscal-phase8b-simples-nacional.test.js)',
    previousCount: 35,
    current: '8B-M01..M38 (hardening final)',
    currentCount: 38,
    status: 'NET -8 then +11 hardening',
    reason: '463=428+35; 455=428+27; 466=428+38 após hardening (+11)',
  },
]);

/** Contagens canônicas para auditoria de checkpoint. */
export const FISCAL_ENGINE_TEST_COUNT_AUDIT = Object.freeze({
  baselineHeadMain: 428,
  phase8bDraftV1Added: 35,
  phase8bCorrectedV2Added: 27,
  phase8bHardeningFinalAdded: 38,
  reported463: 428 + 35,
  reported455: 428 + 27,
  reported466: 428 + 38,
  deltaDraftToCorrected: -8,
  deltaCorrectedToHardening: +11,
  phase8cAdded: 36,
  phase8cHardeningAdded: 22,
  phase8cCheckpointAdded: 15,
  phase8cPostgresRuntimeAdded: 8,
  phase8dProductGroupsAdded: 45,
  reported539: 428 + 38 + 36 + 22 + 15,
  reported546: 428 + 38 + 36 + 22 + 15 + 7,
  reported547: 428 + 38 + 36 + 22 + 15 + 8,
  reported581: 428 + 38 + 36 + 22 + 15 + 8 + 34,
  reported586: 428 + 38 + 36 + 22 + 15 + 8 + 39,
  reported588: 428 + 38 + 36 + 22 + 15 + 8 + 41,
  reported592: 428 + 38 + 36 + 22 + 15 + 8 + 45,
  phase8eContractAdded: 25,
  reported617: 428 + 38 + 36 + 22 + 15 + 8 + 45 + 25,
  reported524: 428 + 38 + 36 + 22,
  explanation: '524 baseline hardening; checkpoint +15 = 539; postgres runtime +8 = 547; phase8d +45 semantic final = 592; phase8e contract +25 = 617; zero remoção em Phase 5/6/8A',
});
