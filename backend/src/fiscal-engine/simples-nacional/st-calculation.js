/**
 * Cálculo ICMS-ST rule-driven — Fase 8B/8E.3.
 */
import { toDecimal } from '../money/decimal.js';
import { formatFieldByPolicy } from '../money/decimal-field-policy.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { ST_MOD_BCST_MVA } from '../fiscal-configuration/accountant-st-parameters-contract.js';

/**
 * CRT1 SN ST devida: FiscalContext não fornece vICMS próprio para dedução.
 * Política explícita — não é constante fiscal silenciosa.
 */
export const ST_DUE_OWN_ICMS_POLICY = 'NO_OWN_ICMS_IN_FISCAL_CONTEXT_CRT1_SN';

/**
 * @typedef {object} StCalculationInput
 * @property {string} calculationMethod
 * @property {string | number} baseValue
 * @property {number} [mva]
 * @property {number} [mvaAdjusted]
 * @property {number} [internalRate]
 * @property {number} [interstateRate]
 * @property {number} [ownIcms]
 * @property {string} [ownIcmsPolicy]
 * @property {number} [fcpRate]
 * @property {number} [pRedBCST]
 * @property {string} [referenceDate]
 */

/**
 * @param {StCalculationInput} input
 */
export const calculateIcmsStByMethod = (input) => {
  const issues = [];
  const method = String(input.calculationMethod ?? 'UNKNOWN');

  if (method === 'UNKNOWN' || !method) {
    return {
      ok: false,
      issues: [createFiscalIssue(
        'UNSUPPORTED_SCENARIO',
        'Método de cálculo ST desconhecido.',
        { severity: 'REVIEW', blocksEmission: true, overrideAllowed: false },
      )],
    };
  }

  if (method === 'MVA_INTERNA') {
    const base = toDecimal(input.baseValue);
    const pRed = input.pRedBCST != null && input.pRedBCST !== ''
      ? toDecimal(input.pRedBCST).div(100)
      : toDecimal(0);
    const reducedBase = base.times(toDecimal(1).minus(pRed));
    const mva = toDecimal(input.mva ?? 0).div(100);
    const internalRate = toDecimal(input.internalRate ?? 0).div(100);
    const bcSt = reducedBase.times(toDecimal(1).plus(mva));
    const ownIcms = toDecimal(input.ownIcms ?? 0);
    const icmsStRaw = bcSt.times(internalRate).minus(ownIcms);
    const icmsSt = icmsStRaw.lessThan(0) ? toDecimal(0) : icmsStRaw;
    return {
      ok: true,
      calculationMethod: method,
      ownIcmsPolicy: input.ownIcmsPolicy ?? null,
      ownIcms: formatFieldByPolicy(ownIcms, 'vICMS', input.referenceDate),
      bcSt: formatFieldByPolicy(bcSt, 'vBCST', input.referenceDate),
      icmsSt: formatFieldByPolicy(icmsSt, 'vICMSST', input.referenceDate),
      reducedBase: formatFieldByPolicy(reducedBase, 'vProd', input.referenceDate),
      fcpSt: input.fcpRate
        ? formatFieldByPolicy(bcSt.times(toDecimal(input.fcpRate).div(100)), 'vICMSST', input.referenceDate)
        : null,
      issues,
    };
  }

  return {
    ok: false,
    issues: [createFiscalIssue(
      'UNSUPPORTED_SCENARIO',
      `Método ST ${method} não implementado.`,
      { severity: 'REVIEW', blocksEmission: true, overrideAllowed: false },
    )],
  };
};

/**
 * ST devida — parâmetros informados pelo contador (Phase 8E.3).
 * @param {object} stParameters
 * @param {string | number} baseValue
 * @param {string} [referenceDate]
 */
export const calculateAccountantStDueFromParameters = (stParameters, baseValue, referenceDate) => {
  const modBCST = String(stParameters.modBCST ?? '');

  if (modBCST === ST_MOD_BCST_MVA) {
    const pRedBCST = stParameters.pRedBCST != null && stParameters.pRedBCST !== ''
      ? Number(String(stParameters.pRedBCST).replace(',', '.'))
      : undefined;

    return calculateIcmsStByMethod({
      calculationMethod: 'MVA_INTERNA',
      baseValue,
      mva: Number(String(stParameters.pMVAST).replace(',', '.')),
      internalRate: Number(String(stParameters.pICMSST).replace(',', '.')),
      ownIcms: 0,
      ownIcmsPolicy: ST_DUE_OWN_ICMS_POLICY,
      pRedBCST,
      referenceDate,
    });
  }

  return {
    ok: false,
    issues: [createFiscalIssue(
      'UNSUPPORTED_SCENARIO',
      `modBCST ${modBCST} não suportado para cálculo ST devida.`,
      { blocksEmission: true, overrideAllowed: false },
    )],
  };
};
