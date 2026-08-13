/**
 * IBS/CBS — camada separada da lógica CSOSN (Reforma Tributária / NF-e 2026).
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { CONSUMPTION_TAX_PROFILE } from './simples-nacional-constants.js';

/**
 * @typedef {object} ConsumptionTaxContext
 * @property {string | null} referenceDate
 * @property {number | null} crt
 * @property {string | null} cClassTrib
 * @property {string | null} cstIbsCbs
 * @property {string} technicalProfileVersion
 * @property {string} profile
 */

/**
 * @param {object} context
 * @param {object} [options]
 * @param {string} [options.profile]
 * @returns {ConsumptionTaxContext}
 */
export const buildConsumptionTaxContext = (context, { profile = CONSUMPTION_TAX_PROFILE.SIMPLES_2026 } = {}) => ({
  referenceDate: context.operacao?.referenceDate ?? context.dataOperacao ?? null,
  crt: context.emitente?.crt ?? null,
  cClassTrib: context.produto?.cClassTrib ?? null,
  cstIbsCbs: context.produto?.cstIbsCbs ?? null,
  technicalProfileVersion: context.metadata?.nfeTechnicalProfile?.layoutVersion ?? 'UNKNOWN',
  profile,
});

/**
 * @param {ConsumptionTaxContext} ctx
 */
export const resolveConsumptionTaxLayer = (ctx) => {
  if (ctx.crt === 1 && ctx.profile === CONSUMPTION_TAX_PROFILE.REGULAR) {
    return {
      status: 'FORBIDDEN',
      ibs: null,
      cbs: null,
      sourceRefs: [],
      issues: [
        createFiscalIssue(
          'FISCAL_COMBINATION_FORBIDDEN',
          'Regime regular IBS/CBS não se aplica a CRT 1 (Simples Nacional).',
          { severity: 'ERROR', blocksEmission: true, overrideAllowed: false },
        ),
      ],
    };
  }

  if (ctx.profile === CONSUMPTION_TAX_PROFILE.SIMPLES_2027_REGULAR_IBS_CBS) {
    return {
      status: 'NOT_READY',
      ibs: null,
      cbs: null,
      sourceRefs: [],
      issues: [
        createFiscalIssue(
          'UNSUPPORTED_SCENARIO',
          'Perfil SIMPLES_2027_REGULAR_IBS_CBS documentado — regras futuras não implementadas.',
          { severity: 'INFO', blocksEmission: false, overrideAllowed: false },
        ),
      ],
    };
  }

  return {
    status: 'NOT_READY',
    ibs: null,
    cbs: null,
    sourceRefs: [],
    issues: [
      createFiscalIssue(
        'UNSUPPORTED_SCENARIO',
        `IBS/CBS layer NOT_READY para perfil ${ctx.profile} / CRT ${ctx.crt ?? '?'}.`,
        { severity: 'INFO', blocksEmission: false, overrideAllowed: false },
      ),
    ],
  };
};

export { CONSUMPTION_TAX_PROFILE };
