/**
 * Matriz de cobertura consultável — Phase 8B (corrigida).
 */
import { CFOP_DECISION_MATRIX_CRT1 } from './cfop-decision-matrix.js';
import { resolveCfopNatureFromFacts } from './cfop-nature-resolver.js';
import { resolveCsosnCatalogSourceRefs } from './csosn-catalog-provenance.js';
import {
  assertCoverageMatrixHasNoForbiddenCsosnCombo,
} from './csosn-invariants.js';
import { getFiscalLegalSource } from './legal-source-registry.js';
import {
  bootstrapDefaultTestRules,
  registerFiscalRules,
  resetFiscalRulesRepository,
  listFiscalRulesForEmpresa,
} from '../rules/fiscal-rule-memory.repository.js';
import { createSimplesNacionalPhase8bRules } from './simples-nacional-rules-phase8b.js';
import { extractFactsFromContext } from '../resolution/fiscal-context-facts.js';
import { resolveFiscalFromContext } from '../resolution/resolve-fiscal-from-context.js';

/** @typedef {'SUPPORTED' | 'PARTIAL' | 'NOT_READY' | 'CONFLICT' | 'OUT_OF_SCOPE'} CoverageCellStatus */

/**
 * @typedef {object} CoverageMatrixRow
 * @property {string} scenario
 * @property {string} uf
 * @property {string} st
 * @property {string} cfop
 * @property {string} csosn
 * @property {string} [currentOperationSt]
 * @property {CoverageCellStatus} status
 * @property {string} reason
 * @property {string} source
 */

/**
 * @param {import('./cfop-decision-matrix.js').CfopDecisionScenario} scenario
 */
const buildCoverageRowFromScenario = (scenario) => {
  const cfopNature = resolveCfopNatureFromFacts({
    location: scenario.location,
    itemSource: scenario.itemSource,
    operationType: scenario.operationType,
    priorStStatus: scenario.priorStStatus,
    currentOperationSt: scenario.currentOperationSt,
    recipientTaxpayerStatus: scenario.recipientTaxpayerStatus,
    issuerStLiability: scenario.issuerStLiability,
    stApplicabilityStatus: scenario.stApplicabilityStatus,
    interstatePriorRetainedEligible: scenario.interstatePriorRetainedEligible,
  });

  const cfop = cfopNature.cfop ?? scenario.expectedCfop;
  const sourceLabel = resolveCsosnCatalogSourceRefs(scenario.referenceDate ?? '2026-06-15')
    .map((id) => getFiscalLegalSource(id)?.documentNumber ?? id)
    .join(', ');

  return {
    scenario: scenario.description,
    uf: scenario.location === 'INTERESTADUAL' ? 'INTER' : 'INTRA',
    st: `${scenario.priorStStatus ?? '?'}+${scenario.currentOperationSt ?? '?'}`,
    cfop: cfop === '—' ? '—' : (cfop ?? '—'),
    csosn: scenario.expectedCsosnHint ?? '—',
    currentOperationSt: scenario.currentOperationSt ?? null,
    status: scenario.status,
    reason: scenario.reason,
    source: sourceLabel,
  };
};

/**
 * @param {object} [options]
 */
export const buildSimplesNacionalCoverageMatrix = ({
  usePhase8bRules = true,
  useTestFixtures = true,
} = {}) => {
  resetFiscalRulesRepository();
  if (useTestFixtures) bootstrapDefaultTestRules();
  if (usePhase8bRules) registerFiscalRules(createSimplesNacionalPhase8bRules());

  const rows = CFOP_DECISION_MATRIX_CRT1.map(buildCoverageRowFromScenario);
  assertCoverageMatrixHasNoForbiddenCsosnCombo(rows);
  return rows;
};

/**
 * @param {CoverageMatrixRow[]} rows
 */
export const formatCoverageMatrixReport = (rows) => {
  const header = 'CENÁRIO | UF | ST | CFOP | CSOSN | STATUS | MOTIVO';
  const lines = rows.map((r) => (
    `${r.scenario} | ${r.uf} | ${r.st} | ${r.cfop} | ${r.csosn} | ${r.status} | ${r.reason}`
  ));
  return [header, ...lines].join('\n');
};

/**
 * @param {object} context FiscalContext
 */
export const evaluateScenarioResolutionStatus = (context) => {
  const result = resolveFiscalFromContext(context, { allowNonProductionRules: true });
  return {
    cfop: result.resolutions?.cfop ?? null,
    csosn: result.resolutions?.csosn ?? null,
    status: result.resolutionStatus ?? result.status,
    blocked: result.blocked ?? false,
    issues: result.issues ?? [],
  };
};

/**
 * @param {object} context
 */
export const evaluateCfopNatureForContext = (context, treatmentPartial = {}) => {
  const facts = extractFactsFromContext(context, treatmentPartial);
  return resolveCfopNatureFromFacts(facts);
};

export const countRulesByProductionReady = () => {
  const rules = listFiscalRulesForEmpresa();
  return {
    total: rules.length,
    productionReady: rules.filter((r) => r.productionReady).length,
    notProductionReady: rules.filter((r) => !r.productionReady).length,
  };
};
