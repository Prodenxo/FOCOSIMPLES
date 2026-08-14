/**
 * Contrato Phase 8E.3 — stParameters para ST devida pelo emitente (CSOSN 201/202/203).
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { assertCsosnInvariantForCurrentSt } from '../simples-nacional/csosn-invariants.js';

/** CSOSN ST devida pelo emitente — exigem stParameters. */
export const CSOSN_ST_DUE_BY_ISSUER_CODES = Object.freeze(new Set(['201', '202', '203']));

/** Parâmetros permitidos — contador informa; engine calcula vBCST/vICMSST. */
export const ST_PARAMETERS_ALLOWED_KEYS = Object.freeze([
  'modBCST',
  'pMVAST',
  'pRedBCST',
  'pICMSST',
]);

/** Campos proibidos em stParameters — resultado calculado, não parâmetro. */
export const ST_PARAMETERS_FORBIDDEN_VALUE_KEYS = Object.freeze([
  'vBCST',
  'vICMSST',
  'vBC',
  'vICMS',
  'calculationMethod',
]);

/** modBCST suportado nesta fase — 4 = Margem Valor Agregado (%). */
export const ST_MOD_BCST_MVA = '4';

export const ST_MOD_BCST_SUPPORTED = Object.freeze(new Set([ST_MOD_BCST_MVA]));

/** Validação percentual por campo — sem teto genérico arbitrário. */
export const ST_PERCENT_FIELD_RULES = Object.freeze({
  pICMSST: Object.freeze({ min: 0, max: null }),
  pMVAST: Object.freeze({ min: 0, max: null }),
  pRedBCST: Object.freeze({ min: 0, max: 100 }),
});

const isPresent = (value) => value !== null && value !== undefined && value !== '';

/**
 * @param {unknown} value
 * @param {string} field
 */
const parsePercent = (value, field) => {
  if (!isPresent(value)) return { ok: false, missing: true };
  const num = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(num)) {
    return { ok: false, issue: createFiscalIssue(
      'ACCOUNTANT_RULE_VALIDATION_FAILED',
      `${field} deve ser numérico.`,
      { blocksEmission: true, overrideAllowed: false, meta: { field } },
    ) };
  }
  const rules = ST_PERCENT_FIELD_RULES[field] ?? { min: 0, max: null };
  if (num < rules.min) {
    return { ok: false, issue: createFiscalIssue(
      'ACCOUNTANT_RULE_VALIDATION_FAILED',
      `${field} deve ser >= ${rules.min}.`,
      { blocksEmission: true, overrideAllowed: false, meta: { field, value: num } },
    ) };
  }
  if (rules.max != null && num > rules.max) {
    return { ok: false, issue: createFiscalIssue(
      'ACCOUNTANT_RULE_VALIDATION_FAILED',
      `${field} deve ser <= ${rules.max}.`,
      { blocksEmission: true, overrideAllowed: false, meta: { field, value: num } },
    ) };
  }
  return { ok: true, value: num };
};

/**
 * @param {object} stParameters
 */
export const detectUnsupportedStParameterFields = (stParameters = {}) => {
  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */
  const issues = [];
  for (const key of Object.keys(stParameters ?? {})) {
    if (ST_PARAMETERS_FORBIDDEN_VALUE_KEYS.includes(key)) {
      issues.push(createFiscalIssue(
        'ACCOUNTANT_RULE_UNSUPPORTED_ST_PARAMETER_FIELD',
        `Campo "${key}" não permitido em stParameters — valores finais são calculados pelo engine.`,
        { blocksEmission: true, overrideAllowed: false, meta: { field: key } },
      ));
      continue;
    }
    if (!ST_PARAMETERS_ALLOWED_KEYS.includes(key)) {
      issues.push(createFiscalIssue(
        'ACCOUNTANT_RULE_UNSUPPORTED_ST_PARAMETER_FIELD',
        `Campo "${key}" desconhecido em stParameters.`,
        { blocksEmission: true, overrideAllowed: false, meta: { field: key } },
      ));
    }
  }
  return issues;
};

/**
 * @param {object} approvedResult
 */
export const validateStParametersContract = (approvedResult = {}) => {
  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */
  const issues = [];
  const csosn = approvedResult.csosn ? String(approvedResult.csosn) : null;
  const currentOperationSt = approvedResult.currentOperationSt ?? null;
  const stParameters = approvedResult.stParameters;

  const requiresStParams = csosn && CSOSN_ST_DUE_BY_ISSUER_CODES.has(csosn);

  if (requiresStParams && currentOperationSt !== 'DUE_BY_ISSUER') {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_VALIDATION_FAILED',
      `CSOSN ${csosn} exige currentOperationSt DUE_BY_ISSUER.`,
      { blocksEmission: true, overrideAllowed: false, meta: { csosn, currentOperationSt } },
    ));
  }

  if (currentOperationSt === 'DUE_BY_ISSUER' && csosn && !CSOSN_ST_DUE_BY_ISSUER_CODES.has(csosn)) {
    const invariant = assertCsosnInvariantForCurrentSt(currentOperationSt, csosn);
    if (!invariant.ok) {
      issues.push(createFiscalIssue(
        'ACCOUNTANT_RULE_VALIDATION_FAILED',
        `Combinação proibida: ${invariant.reason}`,
        { blocksEmission: true, overrideAllowed: false, meta: { reason: invariant.reason } },
      ));
    }
  }

  if (requiresStParams) {
    if (!stParameters || typeof stParameters !== 'object' || Array.isArray(stParameters)) {
      issues.push(createFiscalIssue(
        'ACCOUNTANT_RULE_VALIDATION_FAILED',
        'stParameters é obrigatório para CSOSN 201/202/203 com ST devida.',
        { blocksEmission: true, overrideAllowed: false, meta: { field: 'stParameters' } },
      ));
      return issues;
    }

    issues.push(...detectUnsupportedStParameterFields(stParameters));

    const modBCST = stParameters.modBCST != null ? String(stParameters.modBCST) : null;
    if (!modBCST) {
      issues.push(createFiscalIssue(
        'ACCOUNTANT_RULE_VALIDATION_FAILED',
        'modBCST é obrigatório em stParameters.',
        { blocksEmission: true, overrideAllowed: false, meta: { field: 'modBCST' } },
      ));
    } else if (!ST_MOD_BCST_SUPPORTED.has(modBCST)) {
      issues.push(createFiscalIssue(
        'ACCOUNTANT_RULE_VALIDATION_FAILED',
        `modBCST ${modBCST} não suportado — apenas ${ST_MOD_BCST_MVA} (MVA) nesta fase.`,
        { blocksEmission: true, overrideAllowed: false, meta: { field: 'modBCST' } },
      ));
    }

    const pIcms = parsePercent(stParameters.pICMSST, 'pICMSST');
    if (pIcms.missing) {
      issues.push(createFiscalIssue(
        'ACCOUNTANT_RULE_VALIDATION_FAILED',
        'pICMSST é obrigatório em stParameters.',
        { blocksEmission: true, overrideAllowed: false, meta: { field: 'pICMSST' } },
      ));
    } else if (pIcms.issue) {
      issues.push(pIcms.issue);
    }

    if (modBCST === ST_MOD_BCST_MVA) {
      const pMva = parsePercent(stParameters.pMVAST, 'pMVAST');
      if (pMva.missing) {
        issues.push(createFiscalIssue(
          'ACCOUNTANT_RULE_VALIDATION_FAILED',
          'pMVAST é obrigatório quando modBCST=4 (MVA).',
          { blocksEmission: true, overrideAllowed: false, meta: { field: 'pMVAST' } },
        ));
      } else if (pMva.issue) {
        issues.push(pMva.issue);
      }
    }

    if (isPresent(stParameters.pRedBCST)) {
      const pRed = parsePercent(stParameters.pRedBCST, 'pRedBCST');
      if (pRed.issue) issues.push(pRed.issue);
    }
  }

  if (currentOperationSt === 'DUE_BY_ISSUER' && stParameters && !requiresStParams) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_VALIDATION_FAILED',
      'stParameters só é permitido com CSOSN 201/202/203.',
      { blocksEmission: true, overrideAllowed: false },
    ));
  }

  return issues;
};

/**
 * @param {object} approvedResult
 */
export const hasCompleteStParametersForExecution = (approvedResult = {}) => {
  const csosn = approvedResult.csosn ? String(approvedResult.csosn) : null;
  if (!csosn || !CSOSN_ST_DUE_BY_ISSUER_CODES.has(csosn)) return true;
  return validateStParametersContract(approvedResult).length === 0;
};
