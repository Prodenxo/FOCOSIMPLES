/**
 * Catálogo formal CSOSN — CRT 1 (Simples Nacional).
 * Provenance versionada por referenceDate — ver csosn-catalog-provenance.js.
 */
import {
  CSOSN_NFE_EFFECTIVE_FROM,
  OFFICIAL_CSOSN_CODES_CRT1,
  PRIOR_ST_RETAINED_SEMANTICS,
} from './simples-nacional-constants.js';
import {
  resolveCsosnCatalogProvenanceVersion,
  resolveCsosnCatalogSourceRefs,
} from './csosn-catalog-provenance.js';

/**
 * @typedef {object} CsosnCatalogEntry
 * @property {string} csosn
 * @property {string} icmsGroup
 * @property {string} description
 * @property {number[]} applicableCrt
 * @property {boolean} creditAllowed
 * @property {boolean} currentStChargePossible
 * @property {boolean} stRetainedReporting
 * @property {boolean} isImmune
 * @property {boolean} isNotTaxed
 * @property {boolean} isOther
 * @property {string[]} allowedPriorStStatus
 * @property {string[]} allowedCurrentOperationSt
 * @property {string[]} forbiddenCurrentOperationSt
 * @property {string[]} allowedItemSource
 * @property {string[]} requiredXmlFields — sempre vazio no catálogo; rule-driven na resolução
 * @property {string[]} forbiddenXmlFields
 * @property {string[]} forbiddenWithStScenarioKey
 * @property {string[]} sourceRefs
 * @property {string} effectiveFrom
 * @property {string} [effectiveTo]
 */

/** @type {CsosnCatalogEntry[]} */
const buildEntry = (entry) => ({
  forbiddenXmlFields: [],
  forbiddenWithStScenarioKey: [],
  forbiddenCurrentOperationSt: [],
  requiredXmlFields: [],
  effectiveFrom: CSOSN_NFE_EFFECTIVE_FROM,
  sourceRefs: ['ajuste-sinief-3-2010', 'ajuste-sinief-7-2005', 'encat-manual-csosn'],
  ...entry,
});

/** CSOSN oficiais CRT 1 — catálogo completo (10 códigos). */
export const CSOSN_CATALOG_CRT1 = Object.freeze([
  buildEntry({
    csosn: '101',
    icmsGroup: 'ICMSSN101',
    description: 'Tributada pelo Simples Nacional com permissão de crédito',
    applicableCrt: [1],
    creditAllowed: true,
    currentStChargePossible: false,
    stRetainedReporting: false,
    isImmune: false,
    isNotTaxed: false,
    isOther: false,
    allowedPriorStStatus: ['NO_ST_EVIDENCE', 'UNKNOWN'],
    allowedCurrentOperationSt: ['NOT_DUE', 'UNKNOWN'],
    forbiddenCurrentOperationSt: ['DUE_BY_ISSUER'],
    allowedItemSource: ['THIRD_PARTY', 'OWN_PRODUCTION'],
  }),
  buildEntry({
    csosn: '102',
    icmsGroup: 'ICMSSN102',
    description: 'Tributada pelo Simples Nacional sem permissão de crédito',
    applicableCrt: [1],
    creditAllowed: false,
    currentStChargePossible: false,
    stRetainedReporting: false,
    isImmune: false,
    isNotTaxed: false,
    isOther: false,
    allowedPriorStStatus: ['NO_ST_EVIDENCE', 'UNKNOWN'],
    allowedCurrentOperationSt: ['NOT_DUE'],
    forbiddenCurrentOperationSt: ['DUE_BY_ISSUER'],
    allowedItemSource: ['THIRD_PARTY', 'OWN_PRODUCTION'],
    forbiddenWithStScenarioKey: ['RETAINED+NOT_DUE', 'RETAINED+DUE_BY_ISSUER'],
  }),
  buildEntry({
    csosn: '103',
    icmsGroup: 'ICMSSN103',
    description: 'Isenção do ICMS no Simples Nacional para faixa de receita bruta',
    applicableCrt: [1],
    creditAllowed: false,
    currentStChargePossible: false,
    stRetainedReporting: false,
    isImmune: false,
    isNotTaxed: false,
    isOther: false,
    allowedPriorStStatus: ['NO_ST_EVIDENCE', 'UNKNOWN'],
    allowedCurrentOperationSt: ['NOT_DUE'],
    forbiddenCurrentOperationSt: ['DUE_BY_ISSUER'],
    allowedItemSource: ['THIRD_PARTY', 'OWN_PRODUCTION'],
    forbiddenWithStScenarioKey: ['RETAINED+NOT_DUE'],
  }),
  buildEntry({
    csosn: '201',
    icmsGroup: 'ICMSSN201',
    description: 'Tributada SN com permissão de crédito e cobrança do ICMS por ST',
    applicableCrt: [1],
    creditAllowed: true,
    currentStChargePossible: true,
    stRetainedReporting: false,
    isImmune: false,
    isNotTaxed: false,
    isOther: false,
    allowedPriorStStatus: ['NO_ST_EVIDENCE', 'UNKNOWN'],
    allowedCurrentOperationSt: ['DUE_BY_ISSUER'],
    allowedItemSource: ['THIRD_PARTY', 'OWN_PRODUCTION'],
  }),
  buildEntry({
    csosn: '202',
    icmsGroup: 'ICMSSN202',
    description: 'Tributada SN sem permissão de crédito e cobrança do ICMS por ST',
    applicableCrt: [1],
    creditAllowed: false,
    currentStChargePossible: true,
    stRetainedReporting: false,
    isImmune: false,
    isNotTaxed: false,
    isOther: false,
    allowedPriorStStatus: ['NO_ST_EVIDENCE', 'UNKNOWN'],
    allowedCurrentOperationSt: ['DUE_BY_ISSUER'],
    allowedItemSource: ['THIRD_PARTY', 'OWN_PRODUCTION'],
  }),
  buildEntry({
    csosn: '203',
    icmsGroup: 'ICMSSN203',
    description: 'Isenção ICMS SN faixa receita com cobrança do ICMS por ST',
    applicableCrt: [1],
    creditAllowed: false,
    currentStChargePossible: true,
    stRetainedReporting: false,
    isImmune: false,
    isNotTaxed: false,
    isOther: false,
    allowedPriorStStatus: ['NO_ST_EVIDENCE', 'UNKNOWN'],
    allowedCurrentOperationSt: ['DUE_BY_ISSUER'],
    allowedItemSource: ['THIRD_PARTY', 'OWN_PRODUCTION'],
  }),
  buildEntry({
    csosn: '300',
    icmsGroup: 'ICMSSN300',
    description: 'Imune',
    applicableCrt: [1],
    creditAllowed: false,
    currentStChargePossible: false,
    stRetainedReporting: false,
    isImmune: true,
    isNotTaxed: false,
    isOther: false,
    allowedPriorStStatus: ['NO_ST_EVIDENCE', 'RETAINED', 'UNKNOWN'],
    allowedCurrentOperationSt: ['NOT_DUE', 'UNKNOWN'],
    forbiddenCurrentOperationSt: ['DUE_BY_ISSUER'],
    allowedItemSource: ['THIRD_PARTY', 'OWN_PRODUCTION'],
  }),
  buildEntry({
    csosn: '400',
    icmsGroup: 'ICMSSN400',
    description: 'Não tributada pelo Simples Nacional',
    applicableCrt: [1],
    creditAllowed: false,
    currentStChargePossible: false,
    stRetainedReporting: false,
    isImmune: false,
    isNotTaxed: true,
    isOther: false,
    allowedPriorStStatus: ['NO_ST_EVIDENCE', 'RETAINED', 'UNKNOWN'],
    allowedCurrentOperationSt: ['NOT_DUE', 'UNKNOWN'],
    forbiddenCurrentOperationSt: ['DUE_BY_ISSUER'],
    allowedItemSource: ['THIRD_PARTY', 'OWN_PRODUCTION'],
  }),
  buildEntry({
    csosn: '500',
    icmsGroup: 'ICMSSN500',
    description: 'ICMS cobrado anteriormente por ST ou por antecipação',
    applicableCrt: [1],
    creditAllowed: false,
    currentStChargePossible: false,
    stRetainedReporting: true,
    isImmune: false,
    isNotTaxed: false,
    isOther: false,
    allowedPriorStStatus: ['RETAINED'],
    allowedCurrentOperationSt: ['NOT_DUE', 'UNKNOWN'],
    forbiddenCurrentOperationSt: ['DUE_BY_ISSUER'],
    allowedItemSource: ['THIRD_PARTY', 'OWN_PRODUCTION'],
    forbiddenWithStScenarioKey: ['NO_ST_EVIDENCE+NOT_DUE'],
    // requiredXmlFields: rule-driven — ver resolução CSOSN + xml-fields-resolver
    priorStSemanticNote: PRIOR_ST_RETAINED_SEMANTICS.auditNote,
  }),
  buildEntry({
    csosn: '900',
    icmsGroup: 'ICMSSN900',
    description: 'Outros',
    applicableCrt: [1],
    creditAllowed: false,
    currentStChargePossible: false,
    stRetainedReporting: false,
    isImmune: false,
    isNotTaxed: false,
    isOther: true,
    allowedPriorStStatus: ['NO_ST_EVIDENCE', 'RETAINED', 'UNKNOWN'],
    allowedCurrentOperationSt: ['NOT_DUE', 'DUE_BY_ISSUER', 'UNKNOWN'],
    allowedItemSource: ['THIRD_PARTY', 'OWN_PRODUCTION'],
  }),
]);

/** @param {string} csosn */
export const getCsosnCatalogEntryCrt1 = (csosn) => (
  CSOSN_CATALOG_CRT1.find((e) => e.csosn === String(csosn)) ?? null
);

/**
 * Entrada do catálogo enriquecida com provenance da referenceDate.
 * @param {string} csosn
 * @param {string | null | undefined} referenceDate
 */
export const getCsosnCatalogEntryForDate = (csosn, referenceDate) => {
  const entry = getCsosnCatalogEntryCrt1(csosn);
  if (!entry) return null;
  const provenanceVersion = resolveCsosnCatalogProvenanceVersion(referenceDate);
  return {
    ...entry,
    sourceRefs: resolveCsosnCatalogSourceRefs(referenceDate),
    provenanceVersionId: provenanceVersion?.id ?? null,
    // Catálogo nunca impõe requiredXmlFields — permanecem rule-driven
    requiredXmlFields: [],
  };
};

/** @param {string} referenceDate */
export const isCsosnCatalogEffectiveOn = (referenceDate) => {
  const ref = String(referenceDate ?? '').slice(0, 10);
  return ref >= CSOSN_NFE_EFFECTIVE_FROM;
};

/**
 * @param {object} params
 */
export const validateCsosnCatalogCompatibility = ({
  csosn,
  crt = 1,
  priorStStatus,
  currentOperationSt,
  stScenarioKey,
  itemSource,
  referenceDate,
}) => {
  if (referenceDate && !isCsosnCatalogEffectiveOn(referenceDate)) {
    return { compatible: false, reason: 'CSOSN_BEFORE_NFE_EFFECTIVE_DATE' };
  }

  const entry = getCsosnCatalogEntryCrt1(csosn);
  if (!entry) return { compatible: false, reason: 'CSOSN_NOT_IN_CATALOG' };
  if (!entry.applicableCrt.includes(crt)) return { compatible: false, reason: 'CRT_INCOMPATIBLE' };

  if (currentOperationSt && entry.forbiddenCurrentOperationSt.includes(currentOperationSt)) {
    return { compatible: false, reason: 'CURRENT_ST_FORBIDDEN' };
  }
  if (priorStStatus && !entry.allowedPriorStStatus.includes(priorStStatus)) {
    return { compatible: false, reason: 'PRIOR_ST_INCOMPATIBLE' };
  }
  if (currentOperationSt && !entry.allowedCurrentOperationSt.includes(currentOperationSt)) {
    return { compatible: false, reason: 'CURRENT_ST_INCOMPATIBLE' };
  }
  if (stScenarioKey && entry.forbiddenWithStScenarioKey.includes(stScenarioKey)) {
    return { compatible: false, reason: 'ST_SCENARIO_FORBIDDEN' };
  }
  if (itemSource && !entry.allowedItemSource.includes(itemSource)) {
    return { compatible: false, reason: 'ITEM_SOURCE_INCOMPATIBLE' };
  }
  return { compatible: true, entry: getCsosnCatalogEntryForDate(csosn, referenceDate) ?? entry };
};

export { OFFICIAL_CSOSN_CODES_CRT1 };
