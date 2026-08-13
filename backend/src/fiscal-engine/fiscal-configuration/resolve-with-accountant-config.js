/**
 * Pipeline Phase 8C — aplica configuração aprovada pelo contador ao FiscalContext.
 * I/O: async load via fiscal-configuration-loader.js
 * Domínio: matcher + capability + resolução — síncrono/puro.
 */
import { createHash } from 'node:crypto';
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { ENGINE_SCHEMA_VERSION } from '../constants.js';
import { resolveFiscalFromContext } from '../resolution/resolve-fiscal-from-context.js';
import { buildFiscalResult } from '../types/fiscal-result.js';
import { APPROVED_RULE_MATCH_STATUS } from './constants.js';
import { FISCAL_ENGINE_CAPABILITY_VERSION } from './constants.js';
import { resolveAccountantApprovedFiscalRule } from './approved-rule-matcher.js';
import { buildFiscalRulesFromApprovedRule } from './approved-rule-to-fiscal-rules.js';
import { loadAccountantApprovedRulesForTenant } from './fiscal-configuration-loader.js';
import { evaluateAccountantRuleEngineCapability } from './fiscal-engine-capability.js';

/**
 * @param {object} rule
 * @param {object} context
 */
const buildConfigurationHash = (rule, context) => {
  const payload = JSON.stringify({
    ruleId: rule.id,
    version: rule.version,
    approvedResult: rule.approvedResult,
    referenceDate: context.operacao?.referenceDate ?? context.dataOperacao,
  });
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
};

/**
 * Resolução pura — requer approvedRules[] já carregadas (sem I/O).
 * @param {object} context
 * @param {object[]} approvedRules
 * @param {object} [options]
 */
export const resolveFiscalFromContextWithAccountantConfigPure = (
  context,
  approvedRules,
  options = {},
) => {
  const match = resolveAccountantApprovedFiscalRule(context, approvedRules, options);

  const configAudit = {
    fiscalConfigurationSource: 'ACCOUNTANT_APPROVED_RULE',
    matchStatus: match.status,
    accountantApprovedRuleId: match.ruleId,
    ruleVersion: match.version,
    matchSpecificity: match.specificity,
    matchReasons: match.matchReasons ?? [],
    matchedConditions: match.matchedConditions ?? [],
    approvedBy: match.approvedBy ?? null,
    approvedAt: match.approvedAt ?? null,
    referenceDate: context.operacao?.referenceDate ?? context.dataOperacao ?? null,
    legalSourceRefs: match.legalSourceRefs ?? [],
    engineSchemaVersion: ENGINE_SCHEMA_VERSION,
    engineCapabilityVersion: FISCAL_ENGINE_CAPABILITY_VERSION,
  };

  if (match.status !== APPROVED_RULE_MATCH_STATUS.MATCHED) {
    const issues = [...(match.issues ?? [])];
    return buildFiscalResult({
      context,
      treatment: null,
      resolutions: { currentSt: null, csosn: null, cst: null, cfop: null, xmlFields: null },
      fiscalNFeItem: null,
      ruleRefs: [],
      issues,
      audit: { pipeline: 'fiscal-engine-v3.1-phase-8c', accountantConfig: configAudit },
    });
  }

  const capability = evaluateAccountantRuleEngineCapability(match.rule);
  if (!capability.executable) {
    return buildFiscalResult({
      context,
      treatment: null,
      resolutions: { currentSt: null, csosn: null, cst: null, cfop: null, xmlFields: null },
      fiscalNFeItem: null,
      ruleRefs: [],
      issues: [
        createFiscalIssue(
          'ACCOUNTANT_RULE_NOT_EXECUTABLE',
          'Regra aprovada pelo contador não possui capability técnica suportada pelo engine.',
          { blocksEmission: true, overrideAllowed: false },
        ),
        ...capability.issues,
      ],
      audit: {
        pipeline: 'fiscal-engine-v3.1-phase-8c',
        accountantConfig: {
          ...configAudit,
          capability,
          configurationHash: buildConfigurationHash(match.rule, context),
        },
      },
    });
  }

  const syntheticRules = buildFiscalRulesFromApprovedRule(match.rule);
  const result = resolveFiscalFromContext(context, {
    ...options,
    rules: syntheticRules,
    allowAccountantApprovedConfiguration: true,
  });

  return buildFiscalResult({
    ...result,
    audit: {
      ...result.audit,
      pipeline: 'fiscal-engine-v3.1-phase-8c',
      accountantConfig: {
        ...configAudit,
        matchedAt: new Date().toISOString(),
        capability,
        configurationHash: buildConfigurationHash(match.rule, context),
      },
    },
  });
};

/**
 * Runtime async — carrega regras via repository abstraction, depois resolve puramente.
 * @param {object} context
 * @param {object} [options]
 * @param {object[]} [options.approvedRules] — skip I/O quando pré-carregadas
 */
export const resolveFiscalFromContextWithAccountantConfig = async (context, options = {}) => {
  const tenantId = context.empresaId;
  const approvedRules = options.approvedRules
    ?? await loadAccountantApprovedRulesForTenant(tenantId);
  return resolveFiscalFromContextWithAccountantConfigPure(context, approvedRules, options);
};

/**
 * Preview puro — sem I/O.
 * @param {object} context
 * @param {object[]} approvedRules
 * @param {object} [options]
 */
export const previewAccountantRuleMatchPure = (context, approvedRules, options = {}) => (
  resolveAccountantApprovedFiscalRule(context, approvedRules, options)
);

/**
 * Preview async — carrega regras se necessário.
 * @param {object} context
 * @param {object} [options]
 */
export const previewAccountantRuleMatch = async (context, options = {}) => {
  const approvedRules = options.approvedRules
    ?? await loadAccountantApprovedRulesForTenant(context.empresaId);
  return previewAccountantRuleMatchPure(context, approvedRules, options);
};
