/**
 * Tipos JSDoc do shadow mode (Fase 7A).
 */

/**
 * @typedef {object} LegacyFiscalSnapshot
 * @property {number} itemIndex
 * @property {string} correlationKey
 * @property {string} [correlationConfidence]
 * @property {string | null} [commercialSaleItemId]
 * @property {string | null} [productId]
 * @property {string | null} [ncm]
 * @property {string | null} [cest]
 * @property {string | null} [cfop]
 * @property {string | null} [csosn]
 * @property {string | null} [cst]
 * @property {string | null} [origem]
 * @property {string | null} [icmsGroup]
 * @property {Record<string, unknown>} [taxFields]
 * @property {{ quantidade?: string | null, valorUnitario?: string | null, valorTotal?: string | null }} [values]
 */

/**
 * @typedef {object} V3FiscalSnapshot
 * @property {string | null} [allocationId]
 * @property {string | null} [commercialSaleItemId]
 * @property {string | null} [productId]
 * @property {string} correlationKey
 * @property {string} [correlationConfidence]
 * @property {string | null} [quantity]
 * @property {string | null} [cfop]
 * @property {string | null} [csosn]
 * @property {string | null} [cst]
 * @property {string | null} [origem]
 * @property {string | null} [currentOperationSt]
 * @property {string | null} [priorStStatus]
 * @property {string | null} [icmsGroup]
 * @property {string | null} [pisGroup]
 * @property {Record<string, string> | null} [pisFields]
 * @property {string | null} [cofinsGroup]
 * @property {Record<string, string> | null} [cofinsFields]
 * @property {import('../types/fiscal-issue.js').FiscalIssue[]} issues
 * @property {string} resolutionStatus
 * @property {boolean} blocked
 * @property {import('../rules/fiscal-rule-ref.js').FiscalRuleRef[]} ruleRefs
 */

/**
 * @typedef {object} ShadowItemComparison
 * @property {string} correlationKey
 * @property {string} [correlationConfidence]
 * @property {LegacyFiscalSnapshot | null} legacy
 * @property {V3FiscalSnapshot[]} v3Items
 * @property {string[]} differenceCodes
 * @property {boolean} exactMatch
 * @property {boolean} ambiguous
 */

/**
 * @typedef {object} FiscalShadowComparison
 * @property {string} comparisonId
 * @property {string | null} empresaId
 * @property {string | null} userId
 * @property {string} timestamp
 * @property {string} engineSchemaVersion
 * @property {string | null} [legacyVersion]
 * @property {string} v3Version
 * @property {string} [correlationId]
 * @property {string} [emissionAttemptId]
 * @property {string} executionStatus
 * @property {ShadowItemComparison[]} items
 * @property {object} summary
 * @property {import('../types/fiscal-issue.js').FiscalIssue[]} [executionIssues]
 */

export {};
