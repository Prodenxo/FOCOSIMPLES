/**
 * Contrato Phase 8E — approvedResult allowlist, CSOSN executável vs catálogo, XML fields certificados.
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';

/** Campos permitidos em approvedResult para o runtime atual. */
export const APPROVED_RESULT_ALLOWED_KEYS = Object.freeze([
  'cfop',
  'csosn',
  'icmsGroup',
  'currentOperationSt',
  'requiredXmlFields',
  'cfopConstraints',
]);

/** CSOSN com builder XML executável completo (Phase 8E.2). */
export const EXECUTABLE_CSOSN_CODES = Object.freeze(new Set(['102', '500']));

/** Grupos XML ICMS com builder executável. */
export const EXECUTABLE_ICMS_GROUPS = Object.freeze(new Set(['ICMSSN102', 'ICMSSN500']));

/** currentOperationSt aceitos para configuração APPROVED executável. */
export const EXECUTABLE_CURRENT_OPERATION_ST = Object.freeze(new Set(['DUE_BY_ISSUER', 'NOT_DUE']));

/**
 * Campos ICMS rule-driven certificados para AccountantApprovedConfiguration.
 * hasResolver: existe em xml-fields-resolver RULE_DRIVEN_FIELD_RESOLVERS
 * certified: liberado no capability gate e testes de contrato
 */
export const CERTIFIED_ACCOUNTANT_ICMS_XML_FIELDS = Object.freeze({
  vBCSTRet: { namespace: 'taxes.icms.fields', hasResolver: true, certified: true },
  vICMSSTRet: { namespace: 'taxes.icms.fields', hasResolver: true, certified: true },
  pST: { namespace: 'taxes.icms.fields', hasResolver: true, certified: true },
});

export const CERTIFIED_ACCOUNTANT_ICMS_XML_FIELD_NAMES = Object.freeze(
  Object.keys(CERTIFIED_ACCOUNTANT_ICMS_XML_FIELDS),
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

  return issues;
};

/**
 * @param {string} csosn
 */
export const resolveExecutableIcmsGroupForCsosn = (csosn, icmsGroupOverride = null) => (
  icmsGroupOverride ?? (csosn ? `ICMSSN${csosn}` : null)
);
