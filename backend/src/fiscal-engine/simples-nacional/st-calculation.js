/**
 * Cálculo ICMS-ST rule-driven — Fase 8B (estrutura; datasets NOT_READY).
 */
import { toDecimal, formatDecimal } from '../money/decimal.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';

const MONEY_SCALE = 2;

/**
 * @typedef {object} StCalculationInput
 * @property {string} calculationMethod
 * @property {string | number} baseValue
 * @property {number} [mva]
 * @property {number} [mvaAdjusted]
 * @property {number} [internalRate]
 * @property {number} [interstateRate]
 * @property {number} [ownIcms]
 * @property {number} [fcpRate]
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
    const mva = toDecimal(input.mva ?? 0).div(100);
    const internalRate = toDecimal(input.internalRate ?? 0).div(100);
    const bcSt = base.mul(toDecimal(1).plus(mva));
    const icmsStRaw = bcSt.mul(internalRate).minus(toDecimal(input.ownIcms ?? 0));
    const icmsSt = icmsStRaw.lessThan(0) ? toDecimal(0) : icmsStRaw;
    return {
      ok: true,
      bcSt: formatDecimal(bcSt, MONEY_SCALE),
      icmsSt: formatDecimal(icmsSt, MONEY_SCALE),
      fcpSt: input.fcpRate
        ? formatDecimal(bcSt.mul(toDecimal(input.fcpRate).div(100)), MONEY_SCALE)
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
