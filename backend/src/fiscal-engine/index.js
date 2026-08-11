/**
 * Fiscal Engine v3.1 — ponto de entrada (Fase 0/1).
 * Motor legado permanece ativo quando FISCAL_ENGINE_V3=false.
 */
export { ENGINE_SCHEMA_VERSION, FISCAL_ENGINE_SCHEMA_VERSION } from './constants.js';
export { isFiscalEngineV3Enabled, __withFiscalEngineV3FlagForTests } from './feature-flag.js';

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
