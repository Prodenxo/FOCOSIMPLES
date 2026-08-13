/**
 * Matriz de decisão CFOP — natureza real da operação (Fase 8B corrigida).
 * CFOP e CSOSN são dimensões independentes.
 */

/** @typedef {'SUPPORTED' | 'PARTIAL' | 'NOT_READY' | 'CONFLICT' | 'OUT_OF_SCOPE'} CoverageStatus */

/**
 * @typedef {object} CfopDecisionScenario
 * @property {string} id
 * @property {string} description
 * @property {string} location
 * @property {string} itemSource
 * @property {string} operationType
 * @property {string} [priorStStatus]
 * @property {string} [currentOperationSt]
 * @property {string} [recipientTaxpayerStatus]
 * @property {string} [issuerStLiability]
 * @property {string} [stApplicabilityStatus]
 * @property {boolean} [interstatePriorRetainedEligible]
 * @property {string} expectedCfop
 * @property {string} [expectedCsosnHint]
 * @property {CoverageStatus} status
 * @property {string} reason
 */

export const CFOP_DECISION_MATRIX_CRT1 = Object.freeze([
  {
    id: 'venda-interna-revenda-comum',
    description: 'Venda interna revenda comum (sem ST na operação)',
    location: 'INTERNA',
    itemSource: 'THIRD_PARTY',
    operationType: 'VENDA',
    priorStStatus: 'NO_ST_EVIDENCE',
    currentOperationSt: 'NOT_DUE',
    recipientTaxpayerStatus: 'NON_TAXPAYER',
    issuerStLiability: 'NOT_RESPONSIBLE',
    stApplicabilityStatus: 'NOT_APPLICABLE',
    expectedCfop: '5102',
    expectedCsosnHint: '102',
    status: 'PARTIAL',
    reason: 'Natureza comum adquirida de terceiros — regra nacional modelada, productionReady=false',
  },
  {
    id: 'venda-interna-substituto-st',
    description: 'Venda interna emitente substituído + ST aplicável',
    location: 'INTERNA',
    itemSource: 'THIRD_PARTY',
    operationType: 'VENDA',
    priorStStatus: 'RETAINED',
    currentOperationSt: 'NOT_DUE',
    recipientTaxpayerStatus: 'NON_TAXPAYER',
    issuerStLiability: 'SUBSTITUTED',
    stApplicabilityStatus: 'APPLICABLE',
    expectedCfop: '5405',
    expectedCsosnHint: '500',
    status: 'PARTIAL',
    reason: '5405 exige substituído + ST jurídica — não apenas priorSt RETAINED',
  },
  {
    id: 'venda-interna-retained-sem-substituto',
    description: 'RETAINED sem condição substituído',
    location: 'INTERNA',
    itemSource: 'THIRD_PARTY',
    operationType: 'VENDA',
    priorStStatus: 'RETAINED',
    currentOperationSt: 'NOT_DUE',
    issuerStLiability: 'UNKNOWN',
    stApplicabilityStatus: 'UNKNOWN',
    expectedCfop: '—',
    expectedCsosnHint: '500|NOT_READY',
    status: 'NOT_READY',
    reason: 'RETAINED sozinho não gera CFOP 5405',
  },
  {
    id: 'venda-interestadual-contribuinte-comum',
    description: 'Interestadual revenda contribuinte sem ST específica',
    location: 'INTERESTADUAL',
    itemSource: 'THIRD_PARTY',
    operationType: 'VENDA',
    priorStStatus: 'NO_ST_EVIDENCE',
    currentOperationSt: 'NOT_DUE',
    recipientTaxpayerStatus: 'TAXPAYER',
    issuerStLiability: 'NOT_RESPONSIBLE',
    expectedCfop: '6102',
    expectedCsosnHint: '102',
    status: 'PARTIAL',
    reason: '6102 apenas contribuinte + natureza comum',
  },
  {
    id: 'venda-interestadual-nao-contribuinte',
    description: 'Interestadual revenda não contribuinte',
    location: 'INTERESTADUAL',
    itemSource: 'THIRD_PARTY',
    operationType: 'VENDA',
    priorStStatus: 'NO_ST_EVIDENCE',
    currentOperationSt: 'NOT_DUE',
    recipientTaxpayerStatus: 'NON_TAXPAYER',
    issuerStLiability: 'NOT_RESPONSIBLE',
    expectedCfop: '6108',
    expectedCsosnHint: '102',
    status: 'PARTIAL',
    reason: '6108 para destinatário não contribuinte',
  },
  {
    id: 'venda-interestadual-substituto-st',
    description: 'Interestadual emitente substituto ST na operação',
    location: 'INTERESTADUAL',
    itemSource: 'THIRD_PARTY',
    operationType: 'VENDA',
    priorStStatus: 'NO_ST_EVIDENCE',
    currentOperationSt: 'DUE_BY_ISSUER',
    recipientTaxpayerStatus: 'TAXPAYER',
    issuerStLiability: 'SUBSTITUTE',
    stApplicabilityStatus: 'APPLICABLE',
    expectedCfop: '6403',
    expectedCsosnHint: '201|202|203',
    status: 'NOT_READY',
    reason: '6403 aguarda dataset/regra estadual ST',
  },
  {
    id: 'venda-interestadual-retained-oficial',
    description: 'Interestadual ST retida — condições oficiais completas',
    location: 'INTERESTADUAL',
    itemSource: 'THIRD_PARTY',
    operationType: 'VENDA',
    priorStStatus: 'RETAINED',
    currentOperationSt: 'NOT_DUE',
    recipientTaxpayerStatus: 'TAXPAYER',
    issuerStLiability: 'SUBSTITUTED',
    stApplicabilityStatus: 'APPLICABLE',
    interstatePriorRetainedEligible: true,
    expectedCfop: '6404',
    expectedCsosnHint: '500',
    status: 'NOT_READY',
    reason: '6404 somente com hipótese oficial interestadual validada',
  },
  {
    id: 'venda-interestadual-retained-sozinho',
    description: 'RETAINED interestadual sem condições 6404',
    location: 'INTERESTADUAL',
    itemSource: 'THIRD_PARTY',
    operationType: 'VENDA',
    priorStStatus: 'RETAINED',
    currentOperationSt: 'NOT_DUE',
    recipientTaxpayerStatus: 'TAXPAYER',
    issuerStLiability: 'UNKNOWN',
    interstatePriorRetainedEligible: false,
    expectedCfop: '—',
    expectedCsosnHint: '500|NOT_READY',
    status: 'NOT_READY',
    reason: 'priorSt RETAINED sozinho não gera 6404',
  },
  {
    id: 'st-atual-due-by-issuer-interna',
    description: 'ST devida na operação atual (interna)',
    location: 'INTERNA',
    itemSource: 'THIRD_PARTY',
    operationType: 'VENDA',
    priorStStatus: 'NO_ST_EVIDENCE',
    currentOperationSt: 'DUE_BY_ISSUER',
    recipientTaxpayerStatus: 'NON_TAXPAYER',
    issuerStLiability: 'SUBSTITUTE',
    stApplicabilityStatus: 'APPLICABLE',
    expectedCfop: '5403',
    expectedCsosnHint: '201|202|203',
    status: 'NOT_READY',
    reason: 'CSOSN 102 proibido — resolver 201/202/203; dataset ST vazio',
  },
  {
    id: 'producao-propria-interna',
    description: 'Venda interna produção própria',
    location: 'INTERNA',
    itemSource: 'OWN_PRODUCTION',
    operationType: 'VENDA',
    priorStStatus: 'NO_ST_EVIDENCE',
    currentOperationSt: 'NOT_DUE',
    expectedCfop: '5101',
    expectedCsosnHint: '102',
    status: 'NOT_READY',
    reason: 'Produção própria aguarda regra productionReady',
  },
  {
    id: 'devolucao',
    description: 'Devolução de mercadoria',
    location: 'INTERNA',
    itemSource: 'THIRD_PARTY',
    operationType: 'DEVOLUCAO',
    expectedCfop: '1202',
    expectedCsosnHint: '—',
    status: 'OUT_OF_SCOPE',
    reason: 'Fora do escopo prioritário Phase 8B',
  },
]);

/** Evita troca cega 5xxx → 6xxx sem natureza. */
export const assertCfopNotBlindInterstateConversion = (internalCfop, interstateCfop, scenario) => {
  if (!internalCfop || !interstateCfop) return true;
  const i = String(internalCfop);
  const x = String(interstateCfop);
  if (i.startsWith('5') && x.startsWith('6') && i.slice(1) === x.slice(1)) {
    if (!scenario?.location || scenario.location !== 'INTERESTADUAL') {
      throw new Error('CFOP interestadual convertido cegamente de interno sem natureza INTERESTADUAL');
    }
  }
  return true;
};
