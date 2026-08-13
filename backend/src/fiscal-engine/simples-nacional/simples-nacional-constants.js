/**
 * Constantes nacionais Simples Nacional — Phase 8B.
 */

/** Introdução efetiva CSOSN na NF-e — Ajuste SINIEF 3/2010 (efeitos 01/10/2010). */
export const CSOSN_NFE_EFFECTIVE_FROM = '2010-10-01';

/** Demais dispositivos Ajuste SINIEF 39/2023 — 1º dia do 2º mês após DOU 04/10/2023. */
export const SINIEF_AJUSTE_39_2023_EFFECTIVE_FROM = '2023-12-01';

/**
 * Semântica operacional de priorStStatus=RETAINED para CSOSN 500.
 * RETAINED agrega evidência documental de imposto cobrado anteriormente:
 * - ST substituída retida (PRIOR_RETAINED / vBCSTRet…)
 * - ST cobrada na compra (COLLECTED_IN_PURCHASE)
 * Antecipação tributária sem campos ST explícitos permanece NOT_READY até
 * classificação documental dedicada — não ampliar enum nesta fase.
 */
export const PRIOR_ST_RETAINED_SEMANTICS = Object.freeze({
  domainValue: 'RETAINED',
  officialCsosn500Scope: 'ST anterior ou antecipação (definição oficial CSOSN 500)',
  documentClassifications: ['PRIOR_RETAINED', 'COLLECTED_IN_PURCHASE'],
  antecipationExplicitEnum: 'NOT_READY',
  auditNote: 'priorStEvidence.documentClassification distingue ST retida vs cobrada na compra',
});

/** Códigos CSOSN oficiais CRT 1 conforme tabela vigente. */
export const OFFICIAL_CSOSN_CODES_CRT1 = Object.freeze([
  '101', '102', '103', '201', '202', '203', '300', '400', '500', '900',
]);

/** CSOSN permitidos quando currentOperationSt = DUE_BY_ISSUER. */
export const CSOSN_ALLOWED_WHEN_DUE_BY_ISSUER = Object.freeze(['201', '202', '203']);

/** CSOSN proibidos quando currentOperationSt = DUE_BY_ISSUER. */
export const CSOSN_FORBIDDEN_WHEN_DUE_BY_ISSUER = Object.freeze([
  '101', '102', '103', '300', '400', '500', '900',
]);

export const CONSUMPTION_TAX_PROFILE = Object.freeze({
  SIMPLES_2026: 'SIMPLES_2026',
  SIMPLES_2027_DAS: 'SIMPLES_2027_DAS',
  SIMPLES_2027_REGULAR_IBS_CBS: 'SIMPLES_2027_REGULAR_IBS_CBS',
  REGULAR: 'REGULAR',
});
