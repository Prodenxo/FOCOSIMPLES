/**
 * ST applicability — Fase 8B.
 * NCM/CEST sozinhos NÃO determinam ST; requer contexto jurídico versionado.
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';

/** @typedef {'APPLICABLE' | 'NOT_APPLICABLE' | 'UNKNOWN'} StApplicabilityStatus */
/** @typedef {'SUBSTITUTE' | 'SUBSTITUTED' | 'NOT_RESPONSIBLE' | 'UNKNOWN'} StIssuerLiability */

/**
 * @typedef {object} StApplicabilityContext
 * @property {string | null} ncm
 * @property {string | null} cest
 * @property {string | null} [segment]
 * @property {string | null} issuerUf
 * @property {string | null} destinationUf
 * @property {string | null} operationType
 * @property {string | null} itemSource
 * @property {string | null} recipientTaxpayerStatus
 * @property {boolean | null} [recipientFinalConsumer]
 * @property {string | null} referenceDate
 * @property {number | null} crt
 * @property {string[]} [relevantAgreementRefs]
 * @property {string[]} [stateRuleRefs]
 */

/**
 * @typedef {object} StApplicabilityResult
 * @property {StApplicabilityStatus} status
 * @property {StIssuerLiability} issuerLiability
 * @property {string | null} [calculationMethod]
 * @property {string[]} legalBasisRefs
 * @property {string | null} effectiveFrom
 * @property {string | null} [effectiveTo]
 * @property {import('../types/fiscal-issue.js').FiscalIssue[]} issues
 */

/**
 * @param {object} context FiscalContext parcial
 * @returns {StApplicabilityContext}
 */
export const buildStApplicabilityContext = (context) => ({
  ncm: context.produto?.ncm ?? null,
  cest: context.produto?.supplierCest ?? context.produto?.cest ?? null,
  segment: context.produto?.segment ?? null,
  issuerUf: context.emitente?.uf ?? null,
  destinationUf: context.operacao?.destinationUf ?? null,
  operationType: context.operacao?.operationType ?? context.operacao?.tipo ?? null,
  itemSource: context.item?.itemSource ?? null,
  recipientTaxpayerStatus: context.destinatario?.icmsTaxpayerStatus ?? null,
  recipientFinalConsumer: context.destinatario?.consumidorFinal ?? null,
  referenceDate: context.operacao?.referenceDate ?? context.dataOperacao ?? null,
  crt: context.emitente?.crt ?? null,
  relevantAgreementRefs: [],
  stateRuleRefs: [],
});

const reviewIssue = (code, message) => createFiscalIssue(
  'UNSUPPORTED_SCENARIO',
  message,
  { severity: 'REVIEW', blocksEmission: false, overrideAllowed: false, meta: { stApplicabilityCode: code } },
);

/**
 * Avalia ST sem inferir de NCM/CEST isolados.
 * @param {StApplicabilityContext} ctx
 * @param {object} [options]
 * @param {import('./st-parameter-dataset.js').StParameterEntry[]} [options.parameterEntries]
 */
export const evaluateStApplicability = (ctx, { parameterEntries = [] } = {}) => {
  const issues = [];

  if (!ctx.issuerUf || !ctx.destinationUf) {
    issues.push(reviewIssue('ST_APPLICABILITY_UNKNOWN', 'UF emitente/destino ausente — ST applicability UNKNOWN.'));
    return {
      status: 'UNKNOWN',
      issuerLiability: 'UNKNOWN',
      legalBasisRefs: [],
      effectiveFrom: null,
      issues,
    };
  }

  const matched = (parameterEntries ?? []).filter((entry) => {
    if (entry.issuerUf !== ctx.issuerUf) return false;
    if (entry.destinationUf !== ctx.destinationUf) return false;
    if (entry.ncm && entry.ncm !== ctx.ncm) return false;
    if (entry.cest && entry.cest !== ctx.cest) return false;
    const ref = String(ctx.referenceDate ?? '').slice(0, 10);
    if (ref < entry.effectiveFrom) return false;
    if (entry.effectiveTo && ref > entry.effectiveTo) return false;
    return true;
  });

  if (matched.length > 1) {
    issues.push(createFiscalIssue(
      'RULE_CONFLICT',
      'Conflito de regras ST aplicáveis — emissão bloqueada.',
      { severity: 'ERROR', blocksEmission: true, overrideAllowed: false },
    ));
    return {
      status: 'UNKNOWN',
      issuerLiability: 'UNKNOWN',
      legalBasisRefs: matched.flatMap((m) => m.sourceRefs ?? []),
      effectiveFrom: null,
      issues,
    };
  }

  if (matched.length === 1) {
    const entry = matched[0];
    return {
      status: entry.status,
      issuerLiability: entry.issuerLiability,
      calculationMethod: entry.calculationMethod ?? null,
      legalBasisRefs: entry.sourceRefs ?? [],
      effectiveFrom: entry.effectiveFrom,
      effectiveTo: entry.effectiveTo ?? null,
      issues,
    };
  }

  if (ctx.cest && !ctx.ncm) {
    issues.push(reviewIssue('ST_CEST_WITHOUT_RULE', 'CEST presente sem regra ST versionada — não inferir ST.'));
  } else if (ctx.ncm && !ctx.cest) {
    issues.push(reviewIssue('ST_NCM_WITHOUT_RULE', 'NCM presente sem regra ST versionada — não inferir ST.'));
  } else if (ctx.ncm || ctx.cest) {
    issues.push(reviewIssue('ST_PRODUCT_WITHOUT_RULE', 'NCM/CEST presentes sem regra ST versionada — não inferir ST.'));
  }

  return {
    status: 'UNKNOWN',
    issuerLiability: 'UNKNOWN',
    legalBasisRefs: [],
    effectiveFrom: null,
    issues,
  };
};

/** Nunca promover UNKNOWN → NOT_APPLICABLE silenciosamente. */
export const assertStApplicabilityNotSilentlyDowngraded = (result) => {
  if (result?.status === 'NOT_APPLICABLE' && result?.issues?.some((i) => i.meta?.stApplicabilityCode?.includes('UNKNOWN'))) {
    throw new Error('ST applicability downgraded silently from UNKNOWN');
  }
  return true;
};
