/**
 * Capability gate — configuração aprovada só executa se o engine suporta tecnicamente.
 * Catálogo (CSOSN conhecido) ≠ executável (builder completo) — Phase 8E.2/8E.3.
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { FISCAL_ENGINE_CAPABILITY, FISCAL_ENGINE_CAPABILITY_VERSION } from './constants.js';
import {
  CERTIFIED_ACCOUNTANT_ICMS_XML_FIELD_NAMES,
  EXECUTABLE_CSOSN_CODES,
  EXECUTABLE_ICMS_GROUPS,
  EXECUTABLE_CURRENT_OPERATION_ST,
  CSOSN_ST_DUE_BY_ISSUER_CODES,
  INTRINSIC_ST_DUE_XML_FIELD_NAMES,
  resolveExecutableIcmsGroupForCsosn,
} from './accountant-approved-result-contract.js';
import { hasCompleteStParametersForExecution } from './accountant-st-parameters-contract.js';
import { getIssuerStDueXmlGroupContract } from '../simples-nacional/issuer-st-due-xml-group-contract.js';

const BUILDER_CAPABILITY_BY_GROUP = Object.freeze({
  ICMSSN102: FISCAL_ENGINE_CAPABILITY.ICMSSN102_BUILDER,
  ICMSSN500: FISCAL_ENGINE_CAPABILITY.ICMSSN500_BUILDER,
  ICMSSN201: FISCAL_ENGINE_CAPABILITY.ICMSSN201_BUILDER,
  ICMSSN202: FISCAL_ENGINE_CAPABILITY.ICMSSN202_BUILDER,
  ICMSSN203: FISCAL_ENGINE_CAPABILITY.ICMSSN203_BUILDER,
});

/**
 * @param {object} approvedResult
 */
export const resolveRequiredCapabilities = (approvedResult = {}) => {
  /** @type {string[]} */
  const required = [FISCAL_ENGINE_CAPABILITY.CROSS_VALIDATOR];

  if (approvedResult.cfop) {
    required.push(FISCAL_ENGINE_CAPABILITY.CFOP_RESOLUTION);
  }

  const csosn = approvedResult.csosn ? String(approvedResult.csosn) : null;
  if (csosn && EXECUTABLE_CSOSN_CODES.has(csosn)) {
    required.push(FISCAL_ENGINE_CAPABILITY.CSOSN_RESOLUTION);
    const group = resolveExecutableIcmsGroupForCsosn(csosn, approvedResult.icmsGroup ?? null);
    const builderCap = BUILDER_CAPABILITY_BY_GROUP[group];
    if (builderCap) required.push(builderCap);
    if (CSOSN_ST_DUE_BY_ISSUER_CODES.has(csosn)) {
      required.push(FISCAL_ENGINE_CAPABILITY.ST_DUE_CALCULATION);
    }
  }

  if (approvedResult.currentOperationSt
    && EXECUTABLE_CURRENT_OPERATION_ST.has(String(approvedResult.currentOperationSt))) {
    required.push(FISCAL_ENGINE_CAPABILITY.CURRENT_ST_RESOLUTION);
  }

  const xmlFields = Array.isArray(approvedResult.requiredXmlFields)
    ? approvedResult.requiredXmlFields
    : [];
  if (xmlFields.some((field) => CERTIFIED_ACCOUNTANT_ICMS_XML_FIELD_NAMES.includes(String(field))
    && !INTRINSIC_ST_DUE_XML_FIELD_NAMES.includes(String(field)))) {
    required.push(FISCAL_ENGINE_CAPABILITY.XML_FIELDS_BUILDER);
  }

  if (CSOSN_ST_DUE_BY_ISSUER_CODES.has(csosn ?? '')) {
    required.push(FISCAL_ENGINE_CAPABILITY.XML_FIELDS_BUILDER);
  }

  return [...new Set(required)];
};

/**
 * Capabilities atualmente suportadas pelo engine v3.1 Phase 8E.3.
 */
export const getSupportedEngineCapabilities = () => new Set([
  FISCAL_ENGINE_CAPABILITY.CFOP_RESOLUTION,
  FISCAL_ENGINE_CAPABILITY.CSOSN_RESOLUTION,
  FISCAL_ENGINE_CAPABILITY.CURRENT_ST_RESOLUTION,
  FISCAL_ENGINE_CAPABILITY.ICMSSN102_BUILDER,
  FISCAL_ENGINE_CAPABILITY.ICMSSN500_BUILDER,
  FISCAL_ENGINE_CAPABILITY.ICMSSN201_BUILDER,
  FISCAL_ENGINE_CAPABILITY.ICMSSN202_BUILDER,
  FISCAL_ENGINE_CAPABILITY.ICMSSN203_BUILDER,
  FISCAL_ENGINE_CAPABILITY.ST_DUE_CALCULATION,
  FISCAL_ENGINE_CAPABILITY.XML_FIELDS_BUILDER,
  FISCAL_ENGINE_CAPABILITY.CROSS_VALIDATOR,
]);

/**
 * @param {object} rule
 */
export const evaluateAccountantRuleEngineCapability = (rule) => {
  const approvedResult = rule.approvedResult ?? {};
  const required = resolveRequiredCapabilities(approvedResult);
  const supported = getSupportedEngineCapabilities();
  /** @type {string[]} */
  const missing = required.filter((cap) => !supported.has(cap));
  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */
  const issues = [];

  const csosn = approvedResult.csosn ? String(approvedResult.csosn) : null;
  if (csosn && !EXECUTABLE_CSOSN_CODES.has(csosn)) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_NOT_EXECUTABLE',
      `CSOSN ${csosn} existe no catálogo mas não possui builder executável no engine.`,
      { blocksEmission: true, overrideAllowed: false, meta: { csosn } },
    ));
  }

  if (CSOSN_ST_DUE_BY_ISSUER_CODES.has(csosn ?? '') && !hasCompleteStParametersForExecution(approvedResult)) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_NOT_EXECUTABLE',
      `CSOSN ${csosn} exige stParameters completos para ST devida.`,
      { blocksEmission: true, overrideAllowed: false, meta: { csosn } },
    ));
  }

  const groupContract = csosn ? getIssuerStDueXmlGroupContract(csosn) : null;
  if (CSOSN_ST_DUE_BY_ISSUER_CODES.has(csosn ?? '') && !groupContract?.executable) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_NOT_EXECUTABLE',
      `CSOSN ${csosn} não possui builder XML ST devida certificado.`,
      { blocksEmission: true, overrideAllowed: false, meta: { csosn } },
    ));
  }

  const icmsGroup = resolveExecutableIcmsGroupForCsosn(csosn, approvedResult.icmsGroup ?? null);
  if (icmsGroup && csosn && !EXECUTABLE_ICMS_GROUPS.has(icmsGroup)) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_NOT_EXECUTABLE',
      `Grupo XML ${icmsGroup} não possui builder executável no engine.`,
      { blocksEmission: true, overrideAllowed: false, meta: { icmsGroup } },
    ));
  }

  if (approvedResult.currentOperationSt
    && !EXECUTABLE_CURRENT_OPERATION_ST.has(String(approvedResult.currentOperationSt))) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_NOT_EXECUTABLE',
      `currentOperationSt ${approvedResult.currentOperationSt} não é executável.`,
      { blocksEmission: true, overrideAllowed: false, meta: { field: 'currentOperationSt' } },
    ));
  }

  for (const field of approvedResult.requiredXmlFields ?? []) {
    if (!CERTIFIED_ACCOUNTANT_ICMS_XML_FIELD_NAMES.includes(String(field))) {
      issues.push(createFiscalIssue(
        'ACCOUNTANT_RULE_NOT_EXECUTABLE',
        `Campo XML ${field} não certificado para execução via configuração do contador.`,
        { blocksEmission: true, overrideAllowed: false, meta: { field } },
      ));
    }
    if (INTRINSIC_ST_DUE_XML_FIELD_NAMES.includes(String(field))) {
      issues.push(createFiscalIssue(
        'ACCOUNTANT_RULE_NOT_EXECUTABLE',
        `Campo ${field} é intrínseco ao builder ST devida — remova de requiredXmlFields.`,
        { blocksEmission: true, overrideAllowed: false, meta: { field } },
      ));
    }
  }

  for (const cap of missing) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_NOT_EXECUTABLE',
      `Capability ${cap} não disponível no engine.`,
      { blocksEmission: true, overrideAllowed: false, meta: { capability: cap } },
    ));
  }

  return {
    executable: issues.length === 0 && missing.length === 0,
    requiredCapabilities: required,
    supportedCapabilities: [...supported],
    missingCapabilities: missing,
    engineCapabilityVersion: FISCAL_ENGINE_CAPABILITY_VERSION,
    issues,
  };
};
