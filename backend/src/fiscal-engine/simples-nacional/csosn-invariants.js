/**
 * Invariants CSOSN — Phase 8B.
 */
import {
  CSOSN_NFE_EFFECTIVE_FROM,
  CSOSN_ALLOWED_WHEN_DUE_BY_ISSUER,
  CSOSN_FORBIDDEN_WHEN_DUE_BY_ISSUER,
} from './simples-nacional-constants.js';
import { getCsosnCatalogEntryCrt1, isCsosnCatalogEffectiveOn } from './csosn-catalog-crt1.js';

/**
 * @param {string | null | undefined} currentOperationSt
 * @param {string | null | undefined} csosn
 */
export const assertCsosnInvariantForCurrentSt = (currentOperationSt, csosn) => {
  if (!csosn || !currentOperationSt) return { ok: true };

  if (currentOperationSt === 'DUE_BY_ISSUER') {
    if (csosn === '102') {
      return { ok: false, reason: 'CSOSN_102_FORBIDDEN_WHEN_DUE_BY_ISSUER' };
    }
    if (CSOSN_FORBIDDEN_WHEN_DUE_BY_ISSUER.includes(csosn)) {
      return { ok: false, reason: 'CSOSN_FORBIDDEN_WHEN_DUE_BY_ISSUER' };
    }
    if (!CSOSN_ALLOWED_WHEN_DUE_BY_ISSUER.includes(csosn)) {
      return { ok: false, reason: 'CSOSN_NOT_IN_DUE_BY_ISSUER_ALLOWLIST' };
    }
  }

  return { ok: true };
};

/**
 * @param {string | null | undefined} referenceDate
 * @param {string | null | undefined} csosn
 */
export const assertCsosnEffectiveForReferenceDate = (referenceDate, csosn) => {
  if (!referenceDate) return { ok: true };
  if (!isCsosnCatalogEffectiveOn(referenceDate)) {
    return { ok: false, reason: 'CSOSN_CATALOG_NOT_EFFECTIVE_BEFORE_2010_10_01' };
  }
  const entry = getCsosnCatalogEntryCrt1(csosn);
  if (!entry) return { ok: false, reason: 'CSOSN_NOT_IN_CATALOG' };
  return { ok: true, effectiveFrom: CSOSN_NFE_EFFECTIVE_FROM };
};

/**
 * Candidatos CSOSN quando ST devida na operação atual.
 * @param {object} [params]
 * @param {boolean} [params.creditAllowed]
 * @param {boolean} [params.revenueExemption]
 */
export const resolveCsosnCandidatesForDueByIssuer = ({
  creditAllowed = false,
  revenueExemption = false,
} = {}) => {
  if (revenueExemption) return ['203'];
  if (creditAllowed) return ['201'];
  return ['202'];
};

/**
 * @param {string | null | undefined} currentOperationSt
 */
export const resolveCsosnResolutionStatusForDueByIssuer = (currentOperationSt, {
  creditAllowed,
  revenueExemption,
  hasLegalBasis,
} = {}) => {
  if (currentOperationSt !== 'DUE_BY_ISSUER') return { status: 'NOT_APPLICABLE' };
  if (!hasLegalBasis) {
    return { status: 'NOT_READY', reason: 'DUE_BY_ISSUER sem condições jurídicas suficientes' };
  }
  const candidates = resolveCsosnCandidatesForDueByIssuer({ creditAllowed, revenueExemption });
  return { status: 'PARTIAL', candidates, reason: 'Resolver entre 201/202/203 conforme condições' };
};

/**
 * @param {Array<{ currentOperationSt?: string, csosn?: string }>} rows
 */
export const assertCoverageMatrixHasNoForbiddenCsosnCombo = (rows) => {
  const invalid = (rows ?? []).filter((r) => (
    r.currentOperationSt === 'DUE_BY_ISSUER'
    && (r.csosn === '102' || String(r.csosn ?? '').split('|').includes('102'))
  ));
  if (invalid.length) {
    throw new Error(`Coverage matrix contém combinação proibida DUE_BY_ISSUER+CSOSN102: ${invalid.length} linha(s)`);
  }
  return true;
};
