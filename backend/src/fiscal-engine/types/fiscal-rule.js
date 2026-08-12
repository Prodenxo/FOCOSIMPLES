/**
 * Tipos de regra fiscal versionada (Fases 5+6).
 */

/** @typedef {'CURRENT_ST' | 'CSOSN' | 'CFOP' | 'ICMS_XML'} FiscalRuleType */

export const FISCAL_RULE_TYPE = Object.freeze({
  CURRENT_ST: 'CURRENT_ST',
  CSOSN: 'CSOSN',
  CFOP: 'CFOP',
  ICMS_XML: 'ICMS_XML',
});

/**
 * @typedef {object} FiscalRuleConditions
 * @property {import('./crt.js').Crt[]} [crt]
 * @property {string[]} [location]
 * @property {string[]} [itemSource]
 * @property {string[]} [priorStStatus]
 * @property {string[]} [currentOperationSt]
 * @property {string[]} [stScenarioKey]
 * @property {string[]} [operationType]
 * @property {string[]} [recipientTaxpayerStatus]
 * @property {string[]} [issuerUf]
 * @property {string[]} [ncm]
 * @property {boolean} [consumerFinal]
 */

/**
 * @typedef {object} FiscalRuleResult
 * @property {import('./st-allocation.js').CURRENT_OPERATION_ST[keyof import('./st-allocation.js').CURRENT_OPERATION_ST]} [currentOperationSt]
 * @property {string} [csosn]
 * @property {string} [cst]
 * @property {string} [cfop]
 * @property {string} [icmsGroup]
 * @property {Record<string, string>} [xmlFields]
 * @property {string[]} [requiredFields]
 * @property {Record<string, string>} [cfopConstraints]
 * @property {Record<string, string>} [csosnConstraints]
 */

/**
 * @typedef {object} FiscalRule
 * @property {string} id
 * @property {FiscalRuleType} ruleType
 * @property {string} schemaVersion
 * @property {string} [rulePackageId]
 * @property {number} [priority]
 * @property {number} [specificity]
 * @property {import('./crt.js').Crt[]} applicableCrt
 * @property {string} effectiveFrom
 * @property {string} [effectiveTo]
 * @property {FiscalRuleConditions} conditions
 * @property {FiscalRuleResult} result
 * @property {string} sourceLegalReference
 * @property {string[]} [sourceRefs]
 * @property {boolean} productionReady
 * @property {boolean} [enabled]
 * @property {string | null} [empresaId] null/undefined = GLOBAL
 */

/**
 * @typedef {object} RuleResolutionAudit
 * @property {string[]} candidateRules
 * @property {string[]} matchedRules
 * @property {string | null} selectedRule
 * @property {number | null} priority
 * @property {number | null} specificity
 * @property {string | null} reason
 */
