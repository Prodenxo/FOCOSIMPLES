/**
 * Capability gate — configuração aprovada só executa se o engine suporta tecnicamente.
 * NÃO valida correção fiscal/jurídica — apenas suporte técnico e invariants conhecidos.
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { FISCAL_ENGINE_CAPABILITY, FISCAL_ENGINE_CAPABILITY_VERSION } from './constants.js';
import { OFFICIAL_CSOSN_CODES_CRT1 } from '../simples-nacional/csosn-catalog-crt1.js';

const KNOWN_ICMS_GROUPS = new Set([
  'ICMSSN101', 'ICMSSN102', 'ICMSSN103', 'ICMSSN201', 'ICMSSN202', 'ICMSSN203',
  'ICMSSN300', 'ICMSSN400', 'ICMSSN500', 'ICMSSN900',
]);

const KNOWN_XML_FIELDS = new Set([
  'vBCSTRet', 'vICMSSTRet', 'pST', 'vBCST', 'vICMSST',
]);

/**
 * @param {object} approvedResult
 */
export const resolveRequiredCapabilities = (approvedResult = {}) => {
  /** @type {string[]} */
  const required = [FISCAL_ENGINE_CAPABILITY.CROSS_VALIDATOR];

  if (approvedResult.cfop) {
    required.push(FISCAL_ENGINE_CAPABILITY.CFOP_RESOLUTION);
  }
  if (approvedResult.csosn) {
    required.push(FISCAL_ENGINE_CAPABILITY.CSOSN_RESOLUTION);
    const group = approvedResult.icmsGroup ?? `ICMSSN${approvedResult.csosn}`;
    if (group === 'ICMSSN102' || approvedResult.csosn === '102') {
      required.push(FISCAL_ENGINE_CAPABILITY.ICMSSN102_BUILDER);
    }
    if (group === 'ICMSSN500' || approvedResult.csosn === '500') {
      required.push(FISCAL_ENGINE_CAPABILITY.ICMSSN500_BUILDER);
    }
  }
  if (approvedResult.currentOperationSt) {
    required.push(FISCAL_ENGINE_CAPABILITY.CURRENT_ST_RESOLUTION);
  }
  if (Array.isArray(approvedResult.requiredXmlFields) && approvedResult.requiredXmlFields.length) {
    required.push(FISCAL_ENGINE_CAPABILITY.XML_FIELDS_BUILDER);
  }

  return [...new Set(required)];
};

/**
 * Capabilities atualmente suportadas pelo engine v3.1 Phase 8C.
 */
export const getSupportedEngineCapabilities = () => new Set([
  FISCAL_ENGINE_CAPABILITY.CFOP_RESOLUTION,
  FISCAL_ENGINE_CAPABILITY.CSOSN_RESOLUTION,
  FISCAL_ENGINE_CAPABILITY.CURRENT_ST_RESOLUTION,
  FISCAL_ENGINE_CAPABILITY.ICMSSN102_BUILDER,
  FISCAL_ENGINE_CAPABILITY.ICMSSN500_BUILDER,
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

  if (approvedResult.csosn && !OFFICIAL_CSOSN_CODES_CRT1.includes(String(approvedResult.csosn))) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_NOT_EXECUTABLE',
      `CSOSN ${approvedResult.csosn} não possui builder/catálogo suportado.`,
      { blocksEmission: true, overrideAllowed: false },
    ));
  }

  const icmsGroup = approvedResult.icmsGroup ?? (approvedResult.csosn ? `ICMSSN${approvedResult.csosn}` : null);
  if (icmsGroup && !KNOWN_ICMS_GROUPS.has(icmsGroup)) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_NOT_EXECUTABLE',
      `Grupo XML ${icmsGroup} não implementado no engine.`,
      { blocksEmission: true, overrideAllowed: false },
    ));
  }

  for (const field of approvedResult.requiredXmlFields ?? []) {
    if (!KNOWN_XML_FIELDS.has(field)) {
      issues.push(createFiscalIssue(
        'ACCOUNTANT_RULE_NOT_EXECUTABLE',
        `Campo XML ${field} não suportado pelo engine.`,
        { blocksEmission: true, overrideAllowed: false },
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
