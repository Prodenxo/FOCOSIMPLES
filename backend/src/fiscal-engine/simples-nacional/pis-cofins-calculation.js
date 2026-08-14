/**
 * Cálculo PIS/COFINS — parâmetros do contador + base comercial quando aplicável.
 * Phase 8E.4 — uma passagem; resultado consumido pelo XML builder.
 * Sem defaults fiscais silenciosos — config explícita obrigatória para OUTR_ZERO.
 */
import { toDecimal } from '../money/decimal.js';
import { formatFieldByPolicy } from '../money/decimal-field-policy.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { resolveCanonicalCommercialBase } from './commercial-base-policy.js';
import {
  getPisCofinsGroupForCst,
  PIS_COFINS_CALCULATION_MODES,
} from './pis-cofins-xml-group-contract.js';
import { resolvePisCofinsCalculationMode } from '../fiscal-configuration/accountant-pis-cofins-contract.js';

const normalizeCst = (value) => String(value ?? '').padStart(2, '0').slice(0, 2);

const isPresent = (value) => value !== null && value !== undefined && value !== '';

/**
 * @param {object} config
 * @param {'pis' | 'cofins'} tax
 * @param {string | number} [commercialBase]
 * @param {string} referenceDate
 */
export const calculatePisCofinsFromConfig = (config, tax, commercialBase, referenceDate) => {
  const cst = normalizeCst(config.cst);
  const groupMeta = getPisCofinsGroupForCst(cst, tax);

  if (!groupMeta) {
    return {
      ok: false,
      issues: [createFiscalIssue(
        'UNSUPPORTED_SCENARIO',
        `CST ${cst} sem grupo ${tax}.`,
        { blocksEmission: true, overrideAllowed: false },
      )],
    };
  }

  if (!groupMeta.executable) {
    return {
      ok: false,
      issues: [createFiscalIssue(
        'ACCOUNTANT_RULE_NOT_EXECUTABLE',
        `Grupo ${groupMeta.group} não possui builder executável.`,
        { blocksEmission: true, overrideAllowed: false, meta: { cst, group: groupMeta.group } },
      )],
    };
  }

  const mode = resolvePisCofinsCalculationMode(config);
  const rateField = tax === 'pis' ? 'pPIS' : 'pCOFINS';
  const valueField = tax === 'pis' ? 'vPIS' : 'vCOFINS';
  const ratePolicyField = rateField;
  const valuePolicyField = valueField;

  if (mode == null) {
    return {
      ok: false,
      issues: [createFiscalIssue(
        'ACCOUNTANT_RULE_VALIDATION_FAILED',
        `calculationMode ausente para CST ${cst} em ${tax}.`,
        { blocksEmission: true, overrideAllowed: false, meta: { cst, tax } },
      )],
    };
  }

  if (mode === PIS_COFINS_CALCULATION_MODES.NT) {
    return {
      ok: true,
      result: {
        cst,
        calculationMode: mode,
        group: groupMeta.group,
        baseSource: null,
        base: null,
        rate: null,
        value: null,
        parameters: { ...config },
      },
      issues: [],
    };
  }

  if (mode === PIS_COFINS_CALCULATION_MODES.OUTR_ZERO) {
    if (!isPresent(config[rateField])) {
      return {
        ok: false,
        issues: [createFiscalIssue(
          'ACCOUNTANT_RULE_VALIDATION_FAILED',
          `${rateField} é obrigatório para OUTR_ZERO — zero deve ser configurado explicitamente.`,
          { blocksEmission: true, overrideAllowed: false, meta: { field: rateField, tax } },
        )],
      };
    }

    const rateRaw = config[rateField];
    const rateDec = toDecimal(rateRaw);
    const vBc = formatFieldByPolicy(0, 'vBC', referenceDate);
    const rate = formatFieldByPolicy(rateDec, ratePolicyField, referenceDate);
    const value = formatFieldByPolicy(toDecimal(0), valuePolicyField, referenceDate);

    return {
      ok: true,
      result: {
        cst,
        calculationMode: mode,
        group: groupMeta.group,
        baseSource: 'outr_zero_explicit_config',
        base: vBc,
        rate,
        value,
        parameters: { ...config, [rateField]: String(rateRaw) },
        vBC: vBc,
        [rateField]: rate,
        [valueField]: value,
      },
      issues: [],
    };
  }

  if (mode === PIS_COFINS_CALCULATION_MODES.ALIQ_PERCENT) {
    if (!isPresent(config[rateField])) {
      return {
        ok: false,
        issues: [createFiscalIssue(
          'ACCOUNTANT_RULE_VALIDATION_FAILED',
          `${rateField} é obrigatório para ALIQ_PERCENT.`,
          { blocksEmission: true, overrideAllowed: false, meta: { field: rateField, tax } },
        )],
      };
    }
    const rateRaw = config[rateField];
    const rateDec = toDecimal(rateRaw).div(100);
    const baseDec = toDecimal(commercialBase ?? 0);
    const valueDec = baseDec.times(rateDec);
    const vBc = formatFieldByPolicy(baseDec, 'vBC', referenceDate);
    const rate = formatFieldByPolicy(toDecimal(rateRaw), ratePolicyField, referenceDate);
    const value = formatFieldByPolicy(valueDec, valuePolicyField, referenceDate);

    return {
      ok: true,
      result: {
        cst,
        calculationMode: mode,
        baseSource: 'commercialBase',
        base: vBc,
        rate,
        value,
        parameters: { ...config },
        vBC: vBc,
        [rateField]: rate,
        [valueField]: value,
      },
      issues: [],
    };
  }

  return {
    ok: false,
    issues: [createFiscalIssue(
      'UNSUPPORTED_SCENARIO',
      `Modalidade ${mode} não implementada para ${tax}.`,
      { blocksEmission: true, overrideAllowed: false },
    )],
  };
};

/**
 * @param {object} context
 * @param {object} options
 * @param {object} [options.pisConfig]
 * @param {object} [options.cofinsConfig]
 * @param {string} [options.referenceDate]
 */
export const resolveAccountantPisCofinsCalculation = (context, options = {}) => {
  const pisConfig = options.pisConfig ?? context.fiscalExtensions?.accountantApprovedPis;
  const cofinsConfig = options.cofinsConfig ?? context.fiscalExtensions?.accountantApprovedCofins;
  const referenceDate = options.referenceDate
    ?? context.operacao?.referenceDate
    ?? context.dataOperacao
    ?? new Date().toISOString().slice(0, 10);

  const commercial = resolveCanonicalCommercialBase(context.item ?? {}, referenceDate);

  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */
  const issues = [];
  let pis = null;
  let cofins = null;

  if (pisConfig) {
    const calc = calculatePisCofinsFromConfig(
      pisConfig,
      'pis',
      commercial.baseValue,
      referenceDate,
    );
    if (!calc.ok) issues.push(...calc.issues);
    else pis = calc;
  }

  if (cofinsConfig) {
    const calc = calculatePisCofinsFromConfig(
      cofinsConfig,
      'cofins',
      commercial.baseValue,
      referenceDate,
    );
    if (!calc.ok) issues.push(...calc.issues);
    else cofins = calc;
  }

  if (issues.length > 0) {
    return { ok: false, pis, cofins, issues, audit: { reason: 'calculation_failed' } };
  }

  if (!pis && !cofins) {
    return {
      ok: true,
      pis: null,
      cofins: null,
      issues: [],
      audit: { reason: 'not_configured' },
    };
  }

  return {
    ok: true,
    pis,
    cofins,
    issues: [],
    audit: {
      commercialBase: commercial.commercialBase,
      baseSource: commercial.baseSource,
      baseComposition: commercial.composition,
    },
  };
};
