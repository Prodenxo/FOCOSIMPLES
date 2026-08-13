/**
 * Provenance versionada do catálogo CSOSN — reproduzível por referenceDate.
 * referenceDate histórica não aponta para legislação publicada posteriormente.
 */
import { CSOSN_NFE_EFFECTIVE_FROM } from './simples-nacional-constants.js';
import { getFiscalLegalSource, isLegalSourceEffectiveOn } from './legal-source-registry.js';

/**
 * @typedef {object} CsosnCatalogProvenanceVersion
 * @property {string} id
 * @property {string} effectiveFrom
 * @property {string} [effectiveTo]
 * @property {string[]} sourceRefs
 * @property {string} description
 */

/** Períodos de provenance — mesma lista de códigos, fontes distintas por vigência. */
export const CSOSN_CATALOG_PROVENANCE_VERSIONS = Object.freeze([
  {
    id: 'csosn-provenance-2010',
    effectiveFrom: CSOSN_NFE_EFFECTIVE_FROM,
    effectiveTo: '2023-11-30',
    sourceRefs: ['ajuste-sinief-3-2010', 'ajuste-sinief-7-2005', 'encat-manual-csosn'],
    description: 'Introdução CRT/CSOSN NF-e — Ajuste SINIEF 3/10 (efeitos 01/10/2010)',
  },
  {
    id: 'csosn-provenance-2023',
    effectiveFrom: '2023-12-01',
    sourceRefs: [
      'ajuste-sinief-3-2010',
      'ajuste-sinief-7-2005',
      'encat-manual-csosn',
      'sinief-ajuste-39-2023',
    ],
    description: 'Catálogo CSOSN com atualização normativa Ajuste SINIEF 39/2023 (demais dispositivos)',
  },
]);

/** Fontes que não existiam antes da publicação do Ajuste 39/2023. */
export const POST_2010_ANACHRONISTIC_SOURCE_IDS = Object.freeze([
  'sinief-ajuste-39-2023',
]);

/**
 * @param {string | null | undefined} referenceDate
 * @returns {CsosnCatalogProvenanceVersion | null}
 */
export const resolveCsosnCatalogProvenanceVersion = (referenceDate) => {
  const ref = String(referenceDate ?? '').slice(0, 10);
  if (!ref || ref < CSOSN_NFE_EFFECTIVE_FROM) return null;

  const match = CSOSN_CATALOG_PROVENANCE_VERSIONS.find((version) => {
    if (ref < version.effectiveFrom) return false;
    if (version.effectiveTo && ref > version.effectiveTo) return false;
    return true;
  });

  return match ?? CSOSN_CATALOG_PROVENANCE_VERSIONS[CSOSN_CATALOG_PROVENANCE_VERSIONS.length - 1];
};

/**
 * @param {string | null | undefined} referenceDate
 * @returns {string[]}
 */
export const resolveCsosnCatalogSourceRefs = (referenceDate) => {
  const version = resolveCsosnCatalogProvenanceVersion(referenceDate);
  return version?.sourceRefs ?? [];
};

/**
 * @param {string | null | undefined} referenceDate
 * @param {string[]} sourceRefs
 */
export const assertCsosnProvenanceNotAnachronistic = (referenceDate, sourceRefs) => {
  const ref = String(referenceDate ?? '').slice(0, 10);
  if (!ref || ref < '2023-12-01') {
    const anachronistic = (sourceRefs ?? []).filter((id) => POST_2010_ANACHRONISTIC_SOURCE_IDS.includes(id));
    if (anachronistic.length) {
      return {
        ok: false,
        reason: 'ANACHRONISTIC_SOURCE_REFS',
        anachronistic,
      };
    }
  }
  return { ok: true };
};

/**
 * @param {string | null | undefined} referenceDate
 * @param {string[]} sourceRefs
 */
export const filterEffectiveSourceRefsForDate = (referenceDate, sourceRefs) => (
  (sourceRefs ?? []).filter((id) => isLegalSourceEffectiveOn(getFiscalLegalSource(id), referenceDate))
);

/**
 * @param {string | null | undefined} referenceDate
 */
export const buildCsosnCatalogProvenanceAudit = (referenceDate) => {
  const version = resolveCsosnCatalogProvenanceVersion(referenceDate);
  const sourceRefs = resolveCsosnCatalogSourceRefs(referenceDate);
  const anachronism = assertCsosnProvenanceNotAnachronistic(referenceDate, sourceRefs);

  return {
    referenceDate: String(referenceDate ?? '').slice(0, 10) || null,
    versionId: version?.id ?? null,
    sourceRefs,
    effectiveSources: filterEffectiveSourceRefsForDate(referenceDate, sourceRefs),
    anachronismOk: anachronism.ok,
  };
};
