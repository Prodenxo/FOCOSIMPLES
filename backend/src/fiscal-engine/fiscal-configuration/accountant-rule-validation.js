/**
 * Validação técnica antes de APPROVED — impede configurações impossíveis/contraditórias.
 * NÃO escolhe tributação correta — apenas bloqueia combinações não suportadas.
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { crtSupportsCsosn } from '../types/crt.js';
import { assertCsosnInvariantForCurrentSt } from '../simples-nacional/csosn-invariants.js';
import { OFFICIAL_CSOSN_CODES_CRT1, getCsosnCatalogEntryCrt1 } from '../simples-nacional/csosn-catalog-crt1.js';
import { sanitizeMatchConditions, getApprovedResultFromRule, detectForbiddenMatchConditions } from './accountant-rule-conditions.js';
import { evaluateAccountantRuleEngineCapability } from './fiscal-engine-capability.js';
import { validateApprovedResultContract } from './accountant-approved-result-contract.js';

const CFOP_PATTERN = /^[1-7]\d{3}$/;

/**
 * @param {object} rule
 * @param {object} [options]
 */
export const validateAccountantRuleForApproval = (rule, options = {}) => {
  /** @type {import('../types/fiscal-issue.js').FiscalIssue[]} */
  const issues = [];
  const conditions = rule.conditions ?? {};
  const approvedResult = getApprovedResultFromRule(rule);
  const crt = conditions.crt?.[0] ?? rule.crt ?? null;

  issues.push(...detectForbiddenMatchConditions(conditions));
  issues.push(...validateApprovedResultContract(approvedResult));

  if ((approvedResult.cfop || approvedResult.csosn) && crt == null) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_VALIDATION_FAILED',
      'CRT é obrigatório em conditions quando CFOP ou CSOSN são configurados.',
      { blocksEmission: true, overrideAllowed: false, meta: { field: 'crt' } },
    ));
  }

  if (crt != null && !crtSupportsCsosn(crt) && approvedResult.csosn) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_VALIDATION_FAILED',
      `CRT ${crt} incompatível com CSOSN.`,
      { blocksEmission: true, overrideAllowed: false },
    ));
  }

  if (approvedResult.csosn && !OFFICIAL_CSOSN_CODES_CRT1.includes(String(approvedResult.csosn))) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_VALIDATION_FAILED',
      `CSOSN ${approvedResult.csosn} inexistente no catálogo CRT1.`,
      { blocksEmission: true, overrideAllowed: false },
    ));
  }

  if (approvedResult.cfop && !CFOP_PATTERN.test(String(approvedResult.cfop))) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_VALIDATION_FAILED',
      `CFOP ${approvedResult.cfop} estruturalmente inválido.`,
      { blocksEmission: true, overrideAllowed: false },
    ));
  }

  const stInvariant = assertCsosnInvariantForCurrentSt(
    approvedResult.currentOperationSt,
    approvedResult.csosn,
  );
  if (!stInvariant.ok) {
    issues.push(createFiscalIssue(
      'ACCOUNTANT_RULE_VALIDATION_FAILED',
      `Combinação proibida: ${stInvariant.reason}`,
      { blocksEmission: true, overrideAllowed: false, meta: { reason: stInvariant.reason } },
    ));
  }

  if (approvedResult.csosn === '500') {
    const catalogEntry = getCsosnCatalogEntryCrt1('500');
    const universalRequired = catalogEntry?.requiredXmlFields ?? [];
    if (universalRequired.length > 0) {
      issues.push(createFiscalIssue(
        'ACCOUNTANT_RULE_VALIDATION_FAILED',
        'CSOSN 500 não pode impor requiredXmlFields universais no catálogo — deve ser rule-driven.',
        { blocksEmission: true, overrideAllowed: false },
      ));
    }
  }

  if (rule.validFrom && rule.validUntil) {
    if (String(rule.validUntil).slice(0, 10) < String(rule.validFrom).slice(0, 10)) {
      issues.push(createFiscalIssue(
        'ACCOUNTANT_RULE_VALIDATION_FAILED',
        'validUntil anterior a validFrom.',
        { blocksEmission: true, overrideAllowed: false },
      ));
    }
  }

  const capability = evaluateAccountantRuleEngineCapability(rule);
  issues.push(...capability.issues);

  if (options.checkConflicts && typeof options.checkConflicts === 'function') {
    const conflictResult = options.checkConflicts(rule);
    if (conflictResult?.conflict) {
      issues.push(createFiscalIssue(
        'ACCOUNTANT_RULE_VALIDATION_FAILED',
        conflictResult.message ?? 'Conflito com regra existente.',
        { blocksEmission: true, overrideAllowed: false },
      ));
    }
  }

  sanitizeMatchConditions(conditions);

  return {
    ok: issues.length === 0,
    issues,
    capability,
  };
};

/**
 * Preview completo antes de aprovar — não altera estado.
 * @param {object} draftRule
 * @param {object} [options]
 */
export const previewAccountantFiscalRule = (draftRule, options = {}) => {
  const forbiddenIssues = detectForbiddenMatchConditions(draftRule.conditions ?? {});
  const validation = validateAccountantRuleForApproval(draftRule, options);
  validation.issues.push(...forbiddenIssues.filter(
    (fi) => !validation.issues.some((vi) => vi.meta?.field === fi.meta?.field),
  ));
  validation.ok = validation.issues.length === 0 && validation.capability.executable;
  const matchConditions = sanitizeMatchConditions(draftRule.conditions ?? {}, options);
  /** @type {string[]} */
  const warnings = [];

  if (Object.keys(matchConditions).length === 0) {
    warnings.push('Regra sem condições de matching — aplicará amplamente.');
  }

  return {
    validation,
    capability: validation.capability,
    matchConditions,
    approvedResult: getApprovedResultFromRule(draftRule),
    warnings,
    supported: validation.ok && validation.capability.executable,
  };
};
