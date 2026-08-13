/**
 * Fiscal Engine v3.1 — ponto de entrada (Fase 0/1).
 * Motor legado permanece ativo quando FISCAL_ENGINE_V3=false.
 */
export { ENGINE_SCHEMA_VERSION, FISCAL_ENGINE_SCHEMA_VERSION } from './constants.js';
export {
  isFiscalEngineV3Enabled,
  isFiscalEngineV3ShadowEnabled,
  assertShadowDoesNotAuthorizeEmission,
  canFiscalEngineV3AndShadowCoexist,
  __withFiscalEngineV3FlagForTests,
  __withFiscalEngineV3ShadowFlagForTests,
  __withFiscalEngineFlagsForTests,
} from './feature-flag.js';

export {
  RESOLUTION_STATUS,
  deriveResolutionStatusFromIssues,
  isResolutionStatus,
} from './types/resolution-status.js';

export {
  createFiscalIssue,
  batchBlockedByIssues,
  FISCAL_ISSUE_PRESETS,
} from './types/fiscal-issue.js';

export {
  buildNFeTechnicalProfile,
  buildFiscalEngineMetadata,
  DEFAULT_NFE_TECHNICAL_PROFILE,
} from './types/nfe-technical-profile.js';

export {
  CRT,
  ALL_CRT,
  CSOSN_COMPATIBLE_CRT,
  CRT_MEI_PROFILE,
  normalizeCrt,
  crtMatchesRule,
  getCrtProfile,
  crtSupportsCsosn,
} from './types/crt.js';

export {
  ORIGEM_FISCAL_SOURCE,
  ORIGEM_FISCAL_SOURCE_PRECEDENCE,
  normalizeOrigemMercadoriaCode,
  resolveOrigemByPrecedence,
} from './types/origem-mercadoria.js';

export {
  ITEM_SOURCE,
  PERSON_TYPE,
  ICMS_TAXPAYER_STATUS,
  normalizeItemSource,
  parseItemSourceHint,
  deriveIndIeDest,
} from './types/item-source.js';

export {
  ST_ALLOCATION_METHOD,
  PRIOR_ST_STATUS,
  CURRENT_OPERATION_ST,
  buildStScenarioKey,
} from './types/st-allocation.js';

export {
  emptyFiscalNFeItem,
  computeFiscalBatchBlocked,
} from './types/fiscal-nfe-item.js';

export {
  Decimal,
  toDecimal,
  formatDecimal,
  sumDecimals,
  proportionalAllocate,
  roundDecimal,
} from './money/decimal.js';

export {
  DEFAULT_DECIMAL_FIELD_POLICIES,
  getDecimalFieldPolicy,
  formatFieldByPolicy,
  ROUNDING_MODES,
} from './money/decimal-field-policy.js';

export {
  validateFiscalIssueShape,
  validateNFeTechnicalProfileShape,
  validateFiscalEngineMetadataShape,
  validateFiscalRuleShape,
} from './schemas/validate-shapes.js';

export { buildFiscalBatchResult } from './batch/compute-batch-blocked.js';

export { buildFiscalContextV31 } from './context/build-fiscal-context.js';
export {
  buildFiscalContextFromAllocation,
  buildFiscalContextsFromAllocations,
  prepareTaxTreatmentInput,
  resolveOrigemProvenanceFromAllocation,
  resolveCanonicalDestinationUf,
  resolveOperationLocation,
} from './context/build-allocation-fiscal-context.js';
export { resolveOrigemFiscal } from './resolvers/origem-resolver.js';

export {
  createFiscalDecisionLogEntry,
  serializeFiscalDecision,
} from './audit/fiscal-decision-log.js';

export {
  canOverrideFiscalResult,
  validateEmissionOverride,
  EMISSION_OVERRIDE_PERMISSION,
} from './audit/emission-override-policy.js';

export { importPurchaseNfeXml, __resetPurchaseRepoForTests } from './acquisition/purchase-import.service.js';
export { parsePurchaseNfeXml } from './acquisition/purchase-xml-parser.js';
export {
  classifyPriorStFromIcmsGroups,
  buildPriorStEvidence,
  explainPriorStRetained,
} from './acquisition/acquisition-classifier.js';
export { allocateStRetainedValues } from './acquisition/st-retained-allocator.js';
export { buildUnitConversionEvidence } from './acquisition/unit-conversion.js';
export { detectXxePatterns, assertSecurePurchaseXmlInput } from './acquisition/purchase-xml-security.js';
export { buildPurchaseItemTaxParse } from './acquisition/purchase-item-tax-parse.js';
export {
  allocateFiscalStockForSaleItem,
  releaseFiscalStockAllocation,
  consumeFiscalStockAllocation,
  __setStockAllocationRepoForTests,
  __resetStockAllocationRepoForTests,
} from './allocation/stock-allocation.service.js';
export { planFifoAllocation, evaluateLotEligibility, sortLotsFifo } from './allocation/stock-allocation-eligibility.js';
export { buildPreResolutionAllocationContext } from './allocation/stock-allocation-builder.js';
export { ALLOCATION_STATUS } from './allocation/allocation-constants.js';

export { FISCAL_RULE_TYPE } from './types/fiscal-rule.js';
export { buildTaxTreatment } from './types/tax-treatment.js';
export { buildFiscalResult } from './types/fiscal-result.js';

export {
  computeRuleSpecificity,
  isRuleEffectiveOn,
  ruleMatchesFacts,
  resolveFiscalRule,
  filterRulesByEffectiveDate,
} from './rules/fiscal-rule-engine.js';
export {
  registerFiscalRules,
  listFiscalRulesForEmpresa,
  resetFiscalRulesRepository,
  bootstrapDefaultTestRules,
  __getFiscalRulesStoreForTests,
} from './rules/fiscal-rule-memory.repository.js';
export {
  createDefaultTestRules,
  createNcmFixtureRule,
  createValidatedProductionReadyCurrentStRule,
} from './rules/fixtures/default-test-rules.js';
export {
  normalizeResolverOptions,
  DEFAULT_RESOLVER_OPTIONS,
} from './rules/fiscal-rule-execution-policy.js';
export {
  validateRuleDependencies,
  CURRENT_ST_FORBIDDEN_CONDITION_KEYS,
} from './rules/fiscal-rule-validation.js';

export { extractFactsFromContext } from './resolution/fiscal-context-facts.js';
export {
  resolveFiscalFromContext,
  resolveFiscalFromContexts,
  __bootstrapFiscalRulesForTests,
} from './resolution/resolve-fiscal-from-context.js';

export { resolveCurrentStLiability } from './resolvers/current-st-liability-resolver.js';
export { resolveCsosn } from './resolvers/csosn-resolver.js';
export { resolveCfop } from './resolvers/cfop-resolver.js';
export { resolveXmlFields } from './resolvers/xml-fields-resolver.js';
export { crossValidateFiscalResolution } from './validation/cross-validator.js';

export { buildFiscalV3ShadowInput } from './shadow/build-fiscal-v3-shadow-input.js';
export {
  buildLegacyFiscalSnapshotFromPayloadItem,
  buildLegacyFiscalSnapshotsFromPayload,
  resolveLegacyCorrelation,
  buildLegacyCorrelationKey,
  legacyDecimalEquals,
} from './shadow/legacy-fiscal-snapshot.js';
export {
  buildV3FiscalSnapshotFromResult,
  buildV3FiscalSnapshotsFromResults,
} from './shadow/v3-fiscal-snapshot.js';
export {
  correlateAndCompareShadowItems,
  buildShadowComparisonSummary,
} from './shadow/fiscal-shadow-comparator.js';
export {
  runFiscalV3ShadowComparison,
  runFiscalV3ShadowComparisonWithTimeout,
  assertShadowCrossTenantSafe,
} from './shadow/run-fiscal-v3-shadow-comparison.js';
export {
  triggerNfeEmissionShadowComparison,
  triggerNfeEmissionShadowComparisonAfterSuccess,
  clonePayloadForShadow,
} from './shadow/nfe-emission-shadow-hook.js';
export {
  persistShadowComparison,
  getShadowComparisonById,
  buildShadowIdempotencyKey,
  __resetShadowPersistenceForTests,
  __listShadowComparisonsForTests,
} from './shadow/fiscal-shadow-persistence.js';
export {
  recordShadowComparisonMetrics,
  getShadowMetricsSnapshot,
  __resetShadowMetricsForTests,
} from './shadow/fiscal-shadow-metrics.js';
export { planFiscalStockAllocationForShadow, lotBalancesUnchanged, buildPlannedAllocationRowsForShadow } from './shadow/plan-fiscal-stock-allocation-shadow.js';
export { SHADOW_DIFFERENCE_CODE, SHADOW_EXECUTION_STATUS, CORRELATION_CONFIDENCE, SHADOW_LEDGER_STATUS, SHADOW_LEDGER_CANCELLATION_NOTE, SHADOW_LEDGER_ISSUE_CODE, SHADOW_LEDGER_LIFECYCLE_NOTE } from './shadow/shadow-constants.js';
export {
  insertShadowComparisonToPg,
  findShadowComparisonByIdempotencyKey,
  findShadowComparisonByComparisonId,
  __ensureShadowComparisonSchemaForTests,
  __deleteShadowComparisonForTests,
} from './shadow/shadow-postgres.repository.js';
export {
  __resetShadowExecutionRegistryForTests,
  getShadowTerminalState,
} from './shadow/shadow-execution-registry.js';
export {
  __setShadowPostgresPersistenceEnabledForTests,
  __hasShadowIdempotencyKeyForTests,
} from './shadow/fiscal-shadow-persistence.js';
export {
  getShadowVirtualConsumedByLotIds,
  applyShadowVirtualAvailabilityToLots,
  computeShadowVirtualRemainingByLot,
  confirmShadowStockLedgerFromComparison,
  persistShadowStockLedgerFromPlans,
  aggregatePlannedQuantitiesByLot,
  assertPlannedMatchesConfirmedLedger,
  mergeShadowQuantityMaps,
  getShadowVirtualPendingCommitmentsByLotIds,
  getShadowVirtualPlanningDeductionByLotIds,
  promotePendingShadowLedgerToConfirmed,
  voidPendingShadowLedgerCommitments,
  hasPendingShadowEmission,
  hasConfirmedShadowEmission,
  withShadowTenantPlanningLock,
  __resetShadowStockLedgerForTests,
  __setShadowStockLedgerPostgresEnabledForTests,
  __getInMemoryShadowLedgerSnapshotForTests,
  __listInMemoryShadowLedgerByEmissionForTests,
  __getShadowTenantLockKeyForTests,
} from './shadow/shadow-stock-ledger.service.js';
export {
  normalizeShadowEmissionStatus,
  isEmissionEligibleForShadowObservation,
  isEmissionConfirmedForShadow,
  isEmissionRejectedForShadow,
  SHADOW_TERMINAL_EMISSION_STATUSES,
} from './shadow/shadow-emission-confirmation-policy.js';
export {
  resolveShadowEmissionIdentity,
  buildShadowLedgerIdempotencyKey,
} from './shadow/shadow-emission-identity.js';
export {
  __ensureShadowStockLedgerSchemaForTests,
  __deleteShadowStockLedgerForTests,
  __deleteShadowStockLedgerByEmpresaForTests,
  fetchShadowStockAllocationsByEmission,
  withShadowTenantPgPlanningLock,
} from './shadow/shadow-stock-ledger.repository.js';
export { reconcileShadowLedgerOnMeiNotaStatusChange } from './shadow/shadow-ledger-reconciliation.js';

export {
  ROLLOUT_MODE,
  AUTHORITY_ENGINE,
  AUTHORITY_DECISION_REASON,
  EMISSION_ATTEMPT_STATUS,
  RESERVATION_LIFECYCLE,
  REQUEST_OUTCOME,
  DEFAULT_ROLLOUT_POLICY,
  AUTHORITATIVE_ELIGIBLE_DOCUMENT_TYPES,
} from './rollout/rollout-constants.js';
export {
  computeDeterministicCanaryBucket,
  isCanarySelected,
  resolveEmissionStableId,
} from './rollout/rollout-canary.js';
export {
  getRolloutPolicyForEmpresa,
  __setRolloutPolicyPostgresEnabledForTests,
  __resetRolloutPolicyServiceForTests,
} from './rollout/rollout-policy.service.js';
export {
  upsertInMemoryRolloutPolicy,
  __resetRolloutPolicyMemoryForTests,
  normalizeRolloutMode,
} from './rollout/rollout-policy-memory.repository.js';
export {
  evaluateFiscalV3RolloutReadiness,
  assessReadinessGate,
  __seedShadowComparisonsForReadinessTests,
  __resetReadinessDataForTests,
} from './rollout/rollout-readiness.js';
export {
  hasProductionReadyFiscalRules,
  countProductionReadyFiscalRules,
} from './rollout/rollout-production-rules-gate.js';
export {
  evaluateAuthorityDecision,
  markAuthorityNotEligibleAfterPreflight,
  assumeV3Authority,
} from './rollout/authority-decision.js';
export {
  runAuthoritativePreflightReadOnly,
  runAuthoritativePreflightPostReservation,
  assertLegacyPayloadUnmutated,
} from './authoritative/authoritative-preflight.js';
export {
  buildAuthoritativeNfePayloadFromFiscalResults,
  validateAuthoritativeSplitInvariants,
  allocateCommercialValueByQuantityShare,
} from './authoritative/authoritative-payload-builder.js';
export {
  evaluateAuthoritativeEmissionRouting,
  prepareAuthoritativeEmissionCandidate,
  reconcileAuthoritativeReservationAfterEmit,
  isAuthoritativeEmissionEnabled,
} from './authoritative/authoritative-emission-orchestrator.js';
export { evaluateAuthorityRoutingForEmit } from './authoritative/authority-routing.js';
export {
  prepareFiscalAuthorityRouting,
  resolveNfeEmitPayloadForPlugnotas,
  handleAuthoritativeEmitOutcome,
  reconcileAuthoritativeAttemptOnMeiNotaStatusChange,
  bindAuthoritativeAttemptIdIntegracao,
  NFE_EMIT_TRANSFORM_CLASS,
  NFE_EMIT_PIPELINE_ORDER,
} from './authoritative/nfe-emit-authority-integration.js';
export {
  findEmissionAttemptById,
  findEmissionAttemptsByMeiNotaRecordId,
} from './authoritative/emission-attempt.service.js';
export {
  persistAuthorityRoutingAttempt,
  updateEmissionAttempt,
  findEmissionAttempt,
  hashPayloadForAudit,
  __setEmissionAttemptPostgresEnabledForTests,
  __resetEmissionAttemptServiceForTests,
} from './authoritative/emission-attempt.service.js';
export {
  classifyEmitRequestOutcome,
  resolveReservationTransition,
  applyReservationLifecycle,
} from './authoritative/reservation-lifecycle.js';
export { __resetEmissionAttemptsMemoryForTests } from './authoritative/emission-attempt-memory.repository.js';

export {
  PHASE8B_OFFICIAL_LEGAL_SOURCES,
  validateFiscalLegalSource,
  registerFiscalLegalSources,
  getFiscalLegalSource,
  isLegalSourceEffectiveOn,
  listFiscalLegalSources,
  __resetLegalSourceRegistryForTests,
} from './simples-nacional/legal-source-registry.js';

export {
  CSOSN_CATALOG_CRT1,
  getCsosnCatalogEntryCrt1,
  getCsosnCatalogEntryForDate,
  validateCsosnCatalogCompatibility,
  isCsosnCatalogEffectiveOn,
  OFFICIAL_CSOSN_CODES_CRT1,
} from './simples-nacional/csosn-catalog-crt1.js';

export {
  CSOSN_NFE_EFFECTIVE_FROM,
  SINIEF_AJUSTE_39_2023_EFFECTIVE_FROM,
  PRIOR_ST_RETAINED_SEMANTICS,
  CONSUMPTION_TAX_PROFILE,
} from './simples-nacional/simples-nacional-constants.js';

export {
  CSOSN_CATALOG_PROVENANCE_VERSIONS,
  resolveCsosnCatalogProvenanceVersion,
  resolveCsosnCatalogSourceRefs,
  assertCsosnProvenanceNotAnachronistic,
  buildCsosnCatalogProvenanceAudit,
} from './simples-nacional/csosn-catalog-provenance.js';

export {
  FISCAL_ENGINE_TEST_COUNT_REGRESSION_MATRIX,
  FISCAL_ENGINE_TEST_COUNT_AUDIT,
} from './simples-nacional/test-count-regression-matrix.js';

export {
  assertCsosnInvariantForCurrentSt,
  assertCsosnEffectiveForReferenceDate,
  resolveCsosnCandidatesForDueByIssuer,
  resolveCsosnResolutionStatusForDueByIssuer,
  assertCoverageMatrixHasNoForbiddenCsosnCombo,
} from './simples-nacional/csosn-invariants.js';

export {
  resolveCfopNatureFromFacts,
  assertCfopCsosnIndependence,
} from './simples-nacional/cfop-nature-resolver.js';

export {
  buildStApplicabilityContext,
  evaluateStApplicability,
  assertStApplicabilityNotSilentlyDowngraded,
} from './simples-nacional/st-applicability.js';

export {
  ST_PARAMETER_DATASET_PHASE8B,
  ST_PARAMETER_TEST_FIXTURES,
  getStParameterEntriesForDate,
} from './simples-nacional/st-parameter-dataset.js';

export { resolveDifalFromContext } from './simples-nacional/difal-resolver.js';

export {
  normalizeRecipientFinalConsumer,
  recipientFinalConsumerToBoolean,
} from './simples-nacional/recipient-final-consumer.js';

export {
  buildConsumptionTaxContext,
  resolveConsumptionTaxLayer,
} from './simples-nacional/consumption-tax-context.js';

export {
  validateProductionReadyPromotion,
  assertAllProductionReadyRulesValid,
} from './simples-nacional/production-rule-promotion-gate.js';

export {
  CFOP_DECISION_MATRIX_CRT1,
  assertCfopNotBlindInterstateConversion,
} from './simples-nacional/cfop-decision-matrix.js';

export {
  createSimplesNacionalPhase8bRules,
  SIMPLES_NACIONAL_PHASE8B_PACKAGE_ID,
} from './simples-nacional/simples-nacional-rules-phase8b.js';

export {
  buildSimplesNacionalCoverageMatrix,
  formatCoverageMatrixReport,
  evaluateScenarioResolutionStatus,
  evaluateCfopNatureForContext,
  countRulesByProductionReady,
} from './simples-nacional/coverage-matrix.js';

export { calculateIcmsStByMethod } from './simples-nacional/st-calculation.js';
export { buildPriorStRetainedXmlFields } from './simples-nacional/prior-st-retained-xml.js';
export { resolvePisCofinsSimplesNacional } from './simples-nacional/pis-cofins-layer.js';
export { resolveIpiFromContext } from './simples-nacional/ipi-layer.js';
export { resolveFcpFromStateRule } from './simples-nacional/fcp-resolver.js';

export {
  FISCAL_PROFILE_STATUS,
  ACCOUNTANT_RULE_STATUS,
  APPROVED_RULE_MATCH_STATUS,
  FISCAL_CONFIGURATION_READINESS,
  FISCAL_TRAFFIC_LIGHT,
  PRODUCT_ITEM_SOURCE,
  OPERATION_SCOPE,
  PIS_COFINS_CLASSIFICATION,
  APPROVED_RULE_SPECIFICITY_WEIGHTS,
  FISCAL_CONFIG_PERMISSIONS,
  FISCAL_RULE_SOURCE_TYPE,
  FISCAL_ENGINE_CAPABILITY,
  FISCAL_ENGINE_CAPABILITY_VERSION,
  FORBIDDEN_MATCH_CONDITION_KEYS,
} from './fiscal-configuration/constants.js';

export { sanitizeMatchConditions, getMatchConditionsFromRule, detectForbiddenMatchConditions } from './fiscal-configuration/accountant-rule-conditions.js';

export {
  evaluateAccountantRuleEngineCapability,
  resolveRequiredCapabilities,
  getSupportedEngineCapabilities,
} from './fiscal-configuration/fiscal-engine-capability.js';

export {
  validateAccountantRuleForApproval,
  previewAccountantFiscalRule,
} from './fiscal-configuration/accountant-rule-validation.js';

export {
  buildFiscalRulesFromApprovedRule,
  translateApprovedConditionsToFiscalRuleConditions,
  isAccountantApprovedConfigurationRule,
} from './fiscal-configuration/approved-rule-to-fiscal-rules.js';

export {
  normalizeTestOnlyResolverOptions,
  isRuleEligibleForExecution,
} from './rules/fiscal-rule-execution-policy.js';

export {
  __setFiscalConfigurationPostgresEnabledForTests,
  __isFiscalConfigurationPostgresEnabledForTests,
  __resetFiscalConfigurationRepositoryServiceForTests,
  listAccountantApprovedRulesForTenantSync,
} from './fiscal-configuration/fiscal-configuration-repository.service.js';

export {
  __ensureFiscalConfigurationSchemaForTests,
  __deleteFiscalConfigurationForTenantTests,
} from './fiscal-configuration/fiscal-configuration.repository.js';

export { extractMatchingFactsFromContext, REQUIRED_FACT_FIELDS } from './fiscal-configuration/matching-facts.js';

export {
  resolveAccountantApprovedFiscalRule,
  isApprovedRuleEffectiveOn,
  computeApprovedRuleSpecificity,
  approvedRuleMatchesFacts,
} from './fiscal-configuration/approved-rule-matcher.js';

export {
  resolveFiscalFromContextWithAccountantConfig,
  resolveFiscalFromContextWithAccountantConfigPure,
  previewAccountantRuleMatch,
  previewAccountantRuleMatchPure,
} from './fiscal-configuration/resolve-with-accountant-config.js';

export {
  evaluateFiscalConfigurationReadiness,
  evaluateFiscalConfigurationReadinessForTenant,
  evaluateFiscalConfigurationReadinessFromData,
  mapMatchStatusToTrafficLight,
} from './fiscal-configuration/configuration-readiness.js';

export {
  loadAccountantApprovedRulesForTenant,
  loadFiscalConfigurationSnapshotForTenant,
} from './fiscal-configuration/fiscal-configuration-loader.js';

export {
  upsertCompanyFiscalProfile,
  fetchCompanyFiscalProfile,
  fetchCompanyFiscalProfiles,
  upsertProductFiscalProfile,
  fetchProductFiscalProfile,
  fetchProductFiscalProfiles,
  upsertCustomerTaxProfile,
  fetchCustomerTaxProfile,
  fetchCustomerTaxProfiles,
  createAccountantApprovedRuleDraft,
  approveAccountantFiscalRule,
  suspendAccountantFiscalRule,
  revokeAccountantFiscalRule,
  createAccountantRuleNewVersion,
  listTenantAccountantRules,
  previewRuleMatchForContext,
  getFiscalConfigurationReadiness,
  registerFiscalRuleTemplate,
  getFiscalRuleTemplates,
  getFiscalRuleTemplateById,
  registerTaxCatalogEntry,
  getTaxCatalog,
  validateAccountantRuleForAuthoritativeUse,
  assertActorPermission,
  previewAccountantFiscalRuleForDraft,
  updateAccountantApprovedRuleDraft,
} from './fiscal-configuration/fiscal-configuration.service.js';

export {
  saveCompanyFiscalProfile,
  getCompanyFiscalProfile,
  listCompanyFiscalProfiles,
  saveProductFiscalProfile,
  getProductFiscalProfile,
  listProductFiscalProfiles,
  saveCustomerTaxProfile,
  getCustomerTaxProfile,
  listCustomerTaxProfiles,
  saveAccountantApprovedRule,
  insertApprovedRuleForFixture,
  listAccountantApprovedRulesForTenant,
  getAccountantApprovedRule,
  saveFiscalRuleTemplate,
  listFiscalRuleTemplates,
  getFiscalRuleTemplate,
  saveTaxCatalogEntry,
  listTaxCatalogEntries,
  resetFiscalConfigurationRepository,
  __getFiscalConfigurationStoreForTests,
} from './fiscal-configuration/fiscal-configuration-memory.repository.js';

/**
 * Stub — resolução fiscal completa nas Fases 2+.
 * @returns {{ status: 'UNSUPPORTED_SCENARIO', issues: import('./types/fiscal-issue.js').FiscalIssue[] }}
 */
export const resolveFiscalV31Stub = () => ({
  status: 'UNSUPPORTED_SCENARIO',
  issues: [
    /** @type {import('./types/fiscal-issue.js').FiscalIssue} */ ({
      code: 'UNSUPPORTED_SCENARIO',
      severity: 'ERROR',
      blocksEmission: true,
      overrideAllowed: false,
      message: 'Fiscal Engine v3.1 ainda não substitui o motor legado (Fase 2+).',
      ruleRefs: [],
    }),
  ],
});
