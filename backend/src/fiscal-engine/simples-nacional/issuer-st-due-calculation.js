/**
 * Cálculo ST devida pelo emitente — parâmetros do contador + base comercial do item.
 * Phase 8E.3 — uma única passagem; resultado consumido pelo XML builder.
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { calculateAccountantStDueFromParameters, ST_DUE_OWN_ICMS_POLICY } from './st-calculation.js';
import { ST_MOD_BCST_MVA } from '../fiscal-configuration/accountant-st-parameters-contract.js';
import { resolveCanonicalCommercialBase } from './commercial-base-policy.js';

/**
 * @param {object} context
 * @param {string} referenceDate
 */
export const resolveCommercialBaseForStDue = (context, referenceDate) => (
  resolveCanonicalCommercialBase(context.item ?? {}, referenceDate)
);

/**
 * @param {object} context
 * @param {object} options
 * @param {object} options.stParameters
 * @param {string} [options.referenceDate]
 */
export const resolveIssuerStDueCalculation = (context, options = {}) => {
  const stParameters = options.stParameters ?? context.fiscalExtensions?.accountantApprovedStParameters;
  const referenceDate = options.referenceDate
    ?? context.operacao?.referenceDate
    ?? context.dataOperacao
    ?? new Date().toISOString().slice(0, 10);

  if (!stParameters) {
    return {
      ok: false,
      issues: [createFiscalIssue(
        'REQUIRED_FIELD_MISSING',
        'stParameters ausente para cálculo de ST devida.',
        { blocksEmission: true, overrideAllowed: false, meta: { field: 'stParameters' } },
      )],
      audit: { reason: 'missing_st_parameters' },
    };
  }

  const commercial = resolveCommercialBaseForStDue(context, referenceDate);
  const calc = calculateAccountantStDueFromParameters(stParameters, commercial.baseValue, referenceDate);

  if (!calc.ok) {
    return {
      ok: false,
      issues: calc.issues,
      audit: { reason: 'calculation_failed', baseSource: commercial.baseSource },
    };
  }

  return {
    ok: true,
    result: {
      bcSt: calc.bcSt,
      icmsSt: calc.icmsSt,
      reducedBase: calc.reducedBase ?? null,
      fcpSt: calc.fcpSt ?? null,
      calculationMethod: calc.calculationMethod ?? 'MVA_INTERNA',
      ownIcmsPolicy: calc.ownIcmsPolicy ?? ST_DUE_OWN_ICMS_POLICY,
      ownIcms: calc.ownIcms ?? '0.00',
      parameters: { ...stParameters },
      baseSource: commercial.baseSource,
      commercialBase: commercial.commercialBase,
      baseComposition: commercial.composition,
      qCom: commercial.qCom,
      vUnCom: commercial.vUnCom,
    },
    audit: {
      method: ST_MOD_BCST_MVA,
      calculationMethod: calc.calculationMethod ?? 'MVA_INTERNA',
      ownIcmsPolicy: calc.ownIcmsPolicy ?? ST_DUE_OWN_ICMS_POLICY,
      ownIcms: calc.ownIcms ?? '0.00',
      baseSource: commercial.baseSource,
      commercialBase: commercial.commercialBase,
      baseComposition: commercial.composition,
      bcSt: calc.bcSt,
      icmsSt: calc.icmsSt,
    },
    issues: [],
  };
};
