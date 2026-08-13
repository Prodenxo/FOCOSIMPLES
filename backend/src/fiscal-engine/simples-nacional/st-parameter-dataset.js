/**
 * Dataset versionado de parâmetros ST — separado de regra jurídica.
 * Phase 8B: estrutura vazia + fixtures de teste; dados estaduais reais NOT_READY.
 */

/**
 * @typedef {object} StParameterEntry
 * @property {string} id
 * @property {string} issuerUf
 * @property {string} destinationUf
 * @property {string} [ncm]
 * @property {string} [cest]
 * @property {string} [segment]
 * @property {'APPLICABLE' | 'NOT_APPLICABLE'} status
 * @property {'SUBSTITUTE' | 'SUBSTITUTED' | 'NOT_RESPONSIBLE'} issuerLiability
 * @property {string} [calculationMethod]
 * @property {string} [protocolRef]
 * @property {number} [mva]
 * @property {number} [mvaAdjusted]
 * @property {number} [internalRate]
 * @property {number} [fcpRate]
 * @property {string} effectiveFrom
 * @property {string} [effectiveTo]
 * @property {string[]} sourceRefs
 */

/** Dataset nacional vazio — preenchimento por UF exige fonte SEFAZ. */
export const ST_PARAMETER_DATASET_PHASE8B = Object.freeze([]);

/** Fixture de teste — RJ→RJ acordo interno fictício para validação estrutural. */
export const ST_PARAMETER_TEST_FIXTURES = Object.freeze([
  {
    id: 'test-rj-rj-st-22021000',
    issuerUf: 'RJ',
    destinationUf: 'RJ',
    ncm: '22021000',
    cest: '0300100',
    status: 'APPLICABLE',
    issuerLiability: 'SUBSTITUTE',
    calculationMethod: 'MVA_INTERNA',
    mva: 40,
    internalRate: 20,
    effectiveFrom: '2020-01-01',
    sourceRefs: ['confaz-convenio-142-2018'],
  },
]);

/**
 * @param {string} referenceDate
 * @param {boolean} [includeTestFixtures]
 */
export const getStParameterEntriesForDate = (referenceDate, includeTestFixtures = false) => {
  const ref = String(referenceDate ?? '').slice(0, 10);
  const base = [...ST_PARAMETER_DATASET_PHASE8B];
  if (includeTestFixtures) base.push(...ST_PARAMETER_TEST_FIXTURES);
  return base.filter((e) => {
    if (ref < e.effectiveFrom) return false;
    if (e.effectiveTo && ref > e.effectiveTo) return false;
    return true;
  });
};
