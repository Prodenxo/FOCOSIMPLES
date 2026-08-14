/**
 * Pipeline interno Fases 5+6 — FiscalContext → FiscalResult.
 */
import { resolveCurrentStLiability } from '../resolvers/current-st-liability-resolver.js';
import { resolveCsosn } from '../resolvers/csosn-resolver.js';
import { resolveCfop } from '../resolvers/cfop-resolver.js';
import { resolveXmlFields } from '../resolvers/xml-fields-resolver.js';
import { crossValidateFiscalResolution } from '../validation/cross-validator.js';
import { buildTaxTreatment } from '../types/tax-treatment.js';
import { buildFiscalResult } from '../types/fiscal-result.js';
import { emptyFiscalNFeItem } from '../types/fiscal-nfe-item.js';
import { batchBlockedByIssues } from '../types/fiscal-issue.js';
import { deriveResolutionStatusFromIssues, RESOLUTION_STATUS } from '../types/resolution-status.js';
import {
  bootstrapDefaultTestRules,
  listFiscalRulesForEmpresa,
} from '../rules/fiscal-rule-memory.repository.js';
import { normalizeResolverOptions } from '../rules/fiscal-rule-execution-policy.js';
import { CURRENT_OPERATION_ST } from '../types/st-allocation.js';
import { resolveIssuerStDueCalculation } from '../simples-nacional/issuer-st-due-calculation.js';
import { buildStCalculationAuditMetadata } from '../simples-nacional/issuer-st-due-xml-builder.js';
import { isIssuerStDueCsosn } from '../simples-nacional/issuer-st-due-xml-builder.js';

/**
 * @param {object} context FiscalContext (Fase 4)
 * @param {object} [options]
 * @param {import('../types/fiscal-rule.js').FiscalRule[]} [options.rules]
 * @param {boolean} [options.allowNonProductionRules]
 */
export const resolveFiscalFromContext = (context, options = {}) => {
  const resolverOptions = normalizeResolverOptions(options);
  const baseIssues = [...(context.issues ?? context.contextIssues ?? [])];
  const rules = options.rules ?? listFiscalRulesForEmpresa(context.empresaId);

  /** @type {import('../rules/fiscal-rule-ref.js').FiscalRuleRef[]} */
  const ruleRefs = [];
  /** @type {import('../types/fiscal-rule.js').FiscalRule[]} */
  const appliedRules = [];
  const audit = {
    pipeline: 'fiscal-engine-v3.1-phase-5-6',
    executionPolicy: resolverOptions,
    steps: {},
  };

  if (context.resolutionStatus === RESOLUTION_STATUS.ERROR
    && baseIssues.some((issue) => issue.code === 'CROSS_TENANT_ACCESS')) {
    return buildFiscalResult({
      context,
      treatment: null,
      resolutions: { currentSt: null, csosn: null, cst: null, cfop: null, xmlFields: null },
      fiscalNFeItem: null,
      ruleRefs,
      issues: baseIssues,
      audit,
    });
  }

  const currentStResolution = resolveCurrentStLiability(context, rules, resolverOptions);
  audit.steps.currentSt = currentStResolution.audit;
  if (currentStResolution.ruleRef) {
    ruleRefs.push(currentStResolution.ruleRef);
    if (currentStResolution.audit?.selectedRule) {
      const rule = rules.find((r) => r.id === currentStResolution.audit.selectedRule);
      if (rule) appliedRules.push(rule);
    }
  }

  const treatment = buildTaxTreatment(context, {
    currentOperationSt: currentStResolution.currentOperationSt,
    ruleRefs: currentStResolution.ruleRef ? [currentStResolution.ruleRef] : [],
    issues: currentStResolution.issues,
  });
  audit.steps.taxTreatment = {
    stScenarioKey: treatment.stScenarioKey,
    currentOperationSt: treatment.currentOperationSt,
    priorStStatus: treatment.priorStStatus,
  };

  const csosnResolution = resolveCsosn(context, treatment, rules, resolverOptions);
  audit.steps.csosn = csosnResolution.audit;
  if (csosnResolution.ruleRef) {
    ruleRefs.push(csosnResolution.ruleRef);
    const rule = rules.find((r) => r.id === csosnResolution.audit?.selectedRule);
    if (rule) appliedRules.push(rule);
  }

  const cfopResolution = resolveCfop(context, treatment, rules, resolverOptions);
  audit.steps.cfop = cfopResolution.audit;
  if (cfopResolution.ruleRef) {
    ruleRefs.push(cfopResolution.ruleRef);
    const rule = rules.find((r) => r.id === cfopResolution.audit?.selectedRule);
    if (rule) appliedRules.push(rule);
  }

  let stDueCalculation = null;
  const csosn = csosnResolution?.csosn ?? null;
  if (csosn
    && isIssuerStDueCsosn(csosn)
    && treatment.currentOperationSt === CURRENT_OPERATION_ST.DUE_BY_ISSUER) {
    stDueCalculation = resolveIssuerStDueCalculation(context, {
      stParameters: context.fiscalExtensions?.accountantApprovedStParameters,
    });
    audit.steps.stCalculation = buildStCalculationAuditMetadata(stDueCalculation)
      ?? { reason: stDueCalculation.ok ? 'ok' : 'failed' };
  }

  const xmlResolution = resolveXmlFields({
    context,
    treatment,
    csosnResolution,
    cfopResolution,
    stDueCalculation,
  });
  audit.steps.xmlFields = {
    resolved: xmlResolution.resolved,
    groupCount: xmlResolution.icmsGroups?.length ?? 0,
  };

  const cross = crossValidateFiscalResolution({
    context,
    treatment,
    currentStResolution,
    csosnResolution,
    cfopResolution,
    xmlResolution,
    ruleRefs,
    appliedRules,
  });

  const allIssues = [
    ...baseIssues,
    ...currentStResolution.issues,
    ...csosnResolution.issues,
    ...cfopResolution.issues,
    ...(stDueCalculation?.issues ?? []),
    ...xmlResolution.issues,
    ...cross.issues,
  ];

  const resolutions = {
    currentSt: currentStResolution.currentOperationSt,
    csosn: csosnResolution.csosn,
    cst: csosnResolution.cst,
    cfop: cfopResolution.cfop,
    xmlFields: xmlResolution.xmlFields,
    stCalculation: stDueCalculation?.ok ? stDueCalculation.result : null,
  };

  const fullyResolved = currentStResolution.resolved
    && csosnResolution.resolved
    && cfopResolution.resolved
    && xmlResolution.resolved
    && (stDueCalculation == null || stDueCalculation.ok);

  let fiscalNFeItem = null;
  if (fullyResolved && xmlResolution.icmsGroups?.length === 1) {
    fiscalNFeItem = emptyFiscalNFeItem({
      nfeItemKey: context.allocationId ?? context.decisionId ?? 'item',
      commercialLineId: context.commercialSaleItemId ?? undefined,
      descricao: context.produto?.descricao ?? '',
      ncm: context.produto?.ncm ?? '',
      cest: context.produto?.cest ?? context.produto?.supplierCest ?? null,
      cfop: cfopResolution.cfop,
      quantidade: context.item?.quantidade ?? context.allocation?.quantity ?? '0',
      valorUnitario: context.item?.valorUnitario ?? '0',
      valorTotal: context.item?.valorTotal ?? '0',
      origemMercadoria: context.allocation?.origem ?? context.estoque?.origemMercadoria ?? 'UNKNOWN',
      itemSource: context.item?.itemSource ?? 'UNKNOWN',
      taxes: { icms: xmlResolution.xmlFields?.taxes?.icms?.fields ?? {} },
      status: deriveResolutionStatusFromIssues(allIssues),
      issues: allIssues,
    });
  }

  audit.steps.crossValidation = { issueCount: cross.issues.length };
  audit.ruleRefs = ruleRefs;

  return buildFiscalResult({
    context,
    treatment,
    resolutions,
    fiscalNFeItem,
    ruleRefs,
    issues: allIssues,
    blocked: batchBlockedByIssues(allIssues),
    audit,
  });
};

/**
 * @param {object[]} contexts
 * @param {object} [options]
 */
export const resolveFiscalFromContexts = (contexts, options = {}) => (
  (Array.isArray(contexts) ? contexts : []).map((context) => resolveFiscalFromContext(context, options))
);

/** @internal — injeção explícita de fixtures para testes */
export const __bootstrapFiscalRulesForTests = () => {
  bootstrapDefaultTestRules();
};
