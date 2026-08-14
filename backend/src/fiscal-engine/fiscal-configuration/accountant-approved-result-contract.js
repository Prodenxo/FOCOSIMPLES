/**
 * Contrato Phase 8E — approvedResult allowlist, CSOSN executável vs catálogo, XML fields certificados.
 * Phase 8E.3 — ST devida CSOSN 201/202/203 + stParameters.
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { validateStParametersContract, CSOSN_ST_DUE_BY_ISSUER_CODES } from './accountant-st-parameters-contract.js';

export { CSOSN_ST_DUE_BY_ISSUER_CODES };

/** Campos permitidos em approvedResult para o runtime atual. */
export const APPROVED_RESULT_ALLOWED_KEYS = Object.freeze([
  'cfop',
  'csosn',
  'icmsGroup',
  'currentOperationSt',
  'stParameters',
  'requiredXmlFields',
  'cfopConstraints',
]);

/** CSOSN com builder XML executável completo. */
export const EXECUTABLE_CSOSN_CODES = Object.freeze(new Set(['102', '500', '201', '202', '203']));

/** Grupos XML ICMS com builder executável. */
export const EXECUTABLE_ICMS_GROUPS = Object.freeze(new Set([
  'ICMSSN102',
  'ICMSSN500',
  'ICMSSN201',
  'ICMSSN202',
  'ICMSSN203',
]));

/** currentOperationSt aceitos para configuração APPROVED executável. */
export const EXECUTABLE_CURRENT_OPERATION_ST = Object.freeze(new Set(['DUE_BY_ISSUER', 'NOT_DUE']));

/**
 * Campos ICMS certificados para AccountantApprovedConfiguration.
 * emission: required | requiredWhen | conditional | calculated
 */
export const CERTIFIED_ACCOUNTANT_ICMS_XML_FIELDS = Object.freeze({
  vBCSTRet: { namespace: 'taxes.icms.fields', hasResolver: true, certified: true, intrinsic: false, emission: 'rule-driven' },
  vICMSSTRet: { namespace: 'taxes.icms.fields', hasResolver: true, certified: true, intrinsic: false, emission: 'rule-driven' },
  pST: { namespace: 'taxes.icms.fields', hasResolver: true, certified: true, intrinsic: false, emission: 'rule-driven' },
  modBCST: { namespace: 'taxes.icms.fields', hasResolver: true, certified: true, intrinsic: true, emission: 'required' },
  pMVAST: { namespace: 'taxes.icms.fields', hasResolver: true, certified: true, intrinsic: true, emission: 'requiredWhen', requiredWhen: { modBCST: '4' } },
  pRedBCST: { namespace: 'taxes.icms.fields', hasResolver: true, certified: true, intrinsic: false, emission: 'conditional', emitWhen: 'configuredInStParameters' },
  pICMSST: { namespace: 'taxes.icms.fields', hasResolver: true, certified: true, intrinsic: true, emission: 'required' },
  vBCST: { namespace: 'taxes.icms.fields', hasResolver: true, certified: true, intrinsic: true, emission: 'calculated' },
  vICMSST: { namespace: 'taxes.icms.fields', hasResolver: true, certified: true, intrinsic: true, emission: 'calculated' },
});

export const CERTIFIED_ACCOUNTANT_ICMS_XML_FIELD_NAMES = Object.freeze(
  Object.keys(CERTIFIED_ACCOUNTANT_ICMS_XML_FIELDS),
);

export const INTRINSIC_ST_DUE_XML_FIELD_NAMES = Object.freeze(
  Object.entries(CERTIFIED_ACCOUNTANT_ICMS_XML_FIELDS)
    .filter(([, meta]) => meta.intrinsic === true)
    .map(([name]) => name),
);

export const CONDITIONAL_ST_DUE_XML_FIELD_NAMES = Object.freeze(
  Object.entries(CERTIFIED_ACCOUNTANT_ICMS_XML_FIELDS)
    .filter(([, meta]) => meta.emission === 'conditional')
    .map(([name]) => name),
);

/**
 * @param {object} approvedResult
 */
export const detectUnsupportedApprovedResultFields = (approvedResult = {}) => {
  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */
  const issues = [];
  for (const key of Object.keys(approvedResult ?? {})) {
    if (!APPROVED_RESULT_ALLOWED_KEYS.includes(key)) {
      issues.push(createFiscalIssue(
        'ACCOUNTANT_RULE_UNSUPPORTED_RESULT_FIELD',
        `Campo "${key}" não suportado em approvedResult — fora do contrato Phase 8E.`,
        { blocksEmission: true, overrideAllowed: false, meta: { field: key } },
      ));
    }
  }
  return issues;
};

/**
 * @param {object} approvedResult
 */
export const validateApprovedResultContract = (approvedResult = {}) => {
  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */
  const issues = [...detectUnsupportedApprovedResultFields(approvedResult)];

  if (approvedResult.requiredXmlFields != null && !Array.isArray(approvedResult.requiredXmlFields)) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_VALIDATION_FAILED',
      'requiredXmlFields deve ser array.',
      { blocksEmission: true, overrideAllowed: false },
    ));
  }

  if (approvedResult.stParameters != null
    && (typeof approvedResult.stParameters !== 'object' || Array.isArray(approvedResult.stParameters))) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_VALIDATION_FAILED',
      'stParameters deve ser objeto.',
      { blocksEmission: true, overrideAllowed: false },
    ));
  }

  if (approvedResult.cfopConstraints != null
    && (typeof approvedResult.cfopConstraints !== 'object' || Array.isArray(approvedResult.cfopConstraints))) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_VALIDATION_FAILED',
      'cfopConstraints deve ser objeto.',
      { blocksEmission: true, overrideAllowed: false },
    ));
  }

  const definesIcms = Boolean(approvedResult.cfop || approvedResult.csosn);
  if (definesIcms && !approvedResult.currentOperationSt) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_VALIDATION_FAILED',
      'currentOperationSt é obrigatório quando CFOP ou CSOSN são configurados.',
      { blocksEmission: true, overrideAllowed: false, meta: { field: 'currentOperationSt' } },
    ));
  }

  if (approvedResult.currentOperationSt === 'UNKNOWN') {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_VALIDATION_FAILED',
      'currentOperationSt UNKNOWN não é executável — informe NOT_DUE ou DUE_BY_ISSUER.',
      { blocksEmission: true, overrideAllowed: false, meta: { field: 'currentOperationSt' } },
    ));
  }

  issues.push(...validateStParametersContract(approvedResult));

  for (const field of approvedResult.requiredXmlFields ?? []) {
    const meta = CERTIFIED_ACCOUNTANT_ICMS_XML_FIELDS[String(field)];
    if (meta?.intrinsic) {
      issues.push(createFiscalIssue(
        'ACCOUNTANT_RULE_VALIDATION_FAILED',
        `Campo ${field} é intrínseco ao builder ST devida — não use requiredXmlFields.`,
        { blocksEmission: true, overrideAllowed: false, meta: { field } },
      ));
    }
  }

  return issues;
};

/**
 * @param {string} csosn
 */
export const resolveExecutableIcmsGroupForCsosn = (csosn, icmsGroupOverride = null) => (
  icmsGroupOverride ?? (csosn ? `ICMSSN${csosn}` : null)
);
