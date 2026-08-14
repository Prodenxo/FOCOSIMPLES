/**
 * Constantes Phase 8C — configuração fiscal aprovada pelo contador.
 */

export const FISCAL_PROFILE_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  EXPIRED: 'EXPIRED',
});

/** Status MVP de FiscalProductGroup — subset operacional. */
export const FISCAL_PRODUCT_GROUP_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
});

/** Metadata de autoria em AccountantApprovedFiscalRule — cenário vs regra direta. */
export const ACCOUNTANT_RULE_AUTHORING_TYPE = Object.freeze({
  DIRECT_RULE: 'DIRECT_RULE',
  FISCAL_SCENARIO: 'FISCAL_SCENARIO',
});

export const ACCOUNTANT_RULE_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  SUSPENDED: 'SUSPENDED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
});

export const APPROVED_RULE_MATCH_STATUS = Object.freeze({
  MATCHED: 'MATCHED',
  NO_MATCH: 'NO_MATCH',
  CONFLICT: 'CONFLICT',
  INCOMPLETE_CONTEXT: 'INCOMPLETE_CONTEXT',
});

export const FISCAL_CONFIGURATION_READINESS = Object.freeze({
  READY: 'READY',
  PARTIAL: 'PARTIAL',
  INCOMPLETE: 'INCOMPLETE',
  CONFLICT: 'CONFLICT',
});

export const FISCAL_TRAFFIC_LIGHT = Object.freeze({
  FISCAL_VALIDATED: 'FISCAL_VALIDATED',
  REQUIRES_ACCOUNTANT_REVIEW: 'REQUIRES_ACCOUNTANT_REVIEW',
  FISCAL_CONFIGURATION_INCOMPLETE: 'FISCAL_CONFIGURATION_INCOMPLETE',
  FISCAL_RULE_CONFLICT: 'FISCAL_RULE_CONFLICT',
});

export const PRODUCT_ITEM_SOURCE = Object.freeze({
  RESALE: 'RESALE',
  OWN_PRODUCTION: 'OWN_PRODUCTION',
  RAW_MATERIAL: 'RAW_MATERIAL',
  USE_AND_CONSUMPTION: 'USE_AND_CONSUMPTION',
  FIXED_ASSET: 'FIXED_ASSET',
  OTHER: 'OTHER',
  UNKNOWN: 'UNKNOWN',
});

export const PERSON_TYPE = Object.freeze({
  PF: 'PF',
  PJ: 'PJ',
  UNKNOWN: 'UNKNOWN',
});

export const FINAL_CONSUMER_VALUE = Object.freeze({
  YES: 'YES',
  NO: 'NO',
  UNKNOWN: 'UNKNOWN',
});

export const OPERATION_SCOPE = Object.freeze({
  INTERNAL: 'INTERNAL',
  INTERSTATE: 'INTERSTATE',
  FOREIGN: 'FOREIGN',
});

export const PIS_COFINS_CLASSIFICATION = Object.freeze({
  COMMON: 'COMMON',
  MONOPHASIC: 'MONOPHASIC',
  ZERO_RATE: 'ZERO_RATE',
  EXEMPT: 'EXEMPT',
  SUSPENDED: 'SUSPENDED',
  OTHER: 'OTHER',
  UNKNOWN: 'UNKNOWN',
});

/** Pesos de especificidade — determinísticos, auditáveis. */
export const APPROVED_RULE_SPECIFICITY_WEIGHTS = Object.freeze({
  customerId: 50,
  productId: 45,
  fiscalProductGroupId: 40,
  ncm: 35,
  cest: 30,
  establishmentId: 25,
  destinationUf: 20,
  issuerUf: 15,
  recipientTaxpayerStatus: 15,
  recipientFinalConsumer: 12,
  operationType: 10,
  itemSource: 10,
  priorStStatus: 10,
  operationScope: 8,
  recipientPersonType: 8,
});

export const FISCAL_CONFIG_PERMISSIONS = Object.freeze({
  VIEW: 'fiscal.configuration.view',
  EDIT_DRAFT: 'fiscal.configuration.edit_draft',
  APPROVE: 'fiscal.configuration.approve',
  SUSPEND: 'fiscal.configuration.suspend',
  REVOKE: 'fiscal.configuration.revoke',
});

/** Identidade de regras efêmeras geradas a partir de configuração aprovada — NÃO é productionReady. */
export const FISCAL_RULE_SOURCE_TYPE = Object.freeze({
  ACCOUNTANT_APPROVED_CONFIGURATION: 'ACCOUNTANT_APPROVED_CONFIGURATION',
  TAX_RULE: 'TAX_RULE',
});

/** Capabilities técnicas do engine para execução de configuração aprovada. */
export const FISCAL_ENGINE_CAPABILITY = Object.freeze({
  CFOP_RESOLUTION: 'CFOP_RESOLUTION',
  CSOSN_RESOLUTION: 'CSOSN_RESOLUTION',
  CURRENT_ST_RESOLUTION: 'CURRENT_ST_RESOLUTION',
  ICMSSN102_BUILDER: 'ICMSSN102_BUILDER',
  ICMSSN500_BUILDER: 'ICMSSN500_BUILDER',
  ICMSSN201_BUILDER: 'ICMSSN201_BUILDER',
  ICMSSN202_BUILDER: 'ICMSSN202_BUILDER',
  ICMSSN203_BUILDER: 'ICMSSN203_BUILDER',
  ST_DUE_CALCULATION: 'ST_DUE_CALCULATION',
  XML_FIELDS_BUILDER: 'XML_FIELDS_BUILDER',
  CROSS_VALIDATOR: 'CROSS_VALIDATOR',
});

export const FISCAL_ENGINE_CAPABILITY_VERSION = '8e3-st-due-1';

/**
 * Condições proibidas no matching — são RESULTADOS da resolução, não fatos observáveis.
 * priorStStatus é exceção: fato da aquisição/lote.
 */
export const FORBIDDEN_MATCH_CONDITION_KEYS = Object.freeze([
  'currentOperationSt',
  'stApplicabilityStatus',
  'issuerStLiability',
  'stScenarioKey',
]);

/** Campos de auditoria derivados exclusivamente do actor autenticado. */
export const ACTOR_DERIVED_AUDIT_FIELDS = Object.freeze([
  'configuredBy',
  'approvedBy',
  'suspendedBy',
  'revokedBy',
]);
