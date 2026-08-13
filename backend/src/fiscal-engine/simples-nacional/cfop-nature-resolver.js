/**
 * Resolução de natureza CFOP — decisão independente de CSOSN (Phase 8B).
 * Não infere CFOP a partir de priorStStatus ou CSOSN isolados.
 */

/** @typedef {'SUPPORTED' | 'PARTIAL' | 'NOT_READY' | 'CONFLICT' | 'OUT_OF_SCOPE'} CfopNatureStatus */

/**
 * @typedef {object} CfopNatureFacts
 * @property {string | null} [location]
 * @property {string | null} [itemSource]
 * @property {string | null} [operationType]
 * @property {string | null} [priorStStatus]
 * @property {string | null} [currentOperationSt]
 * @property {string | null} [recipientTaxpayerStatus]
 * @property {string | null} [issuerStLiability]
 * @property {string | null} [stApplicabilityStatus]
 * @property {boolean} [interstatePriorRetainedEligible]
 */

/**
 * @typedef {object} CfopNatureResult
 * @property {string | null} cfop
 * @property {CfopNatureStatus} status
 * @property {string} reason
 */

/**
 * @param {CfopNatureFacts} facts
 * @returns {CfopNatureResult}
 */
export const resolveCfopNatureFromFacts = (facts) => {
  const {
    location,
    itemSource,
    operationType = 'VENDA',
    priorStStatus,
    currentOperationSt,
    recipientTaxpayerStatus,
    issuerStLiability = 'UNKNOWN',
    stApplicabilityStatus = 'UNKNOWN',
    interstatePriorRetainedEligible = false,
  } = facts;

  if (operationType !== 'VENDA') {
    return { cfop: null, status: 'OUT_OF_SCOPE', reason: 'Operação fora do escopo CFOP Phase 8B' };
  }

  if (location === 'INTERNA' && itemSource === 'THIRD_PARTY') {
    if (issuerStLiability === 'SUBSTITUTED'
      && stApplicabilityStatus === 'APPLICABLE'
      && currentOperationSt === 'NOT_DUE') {
      return {
        cfop: '5405',
        status: 'PARTIAL',
        reason: 'Mercadoria sujeita à ST, emitente substituído, ST aplicável juridicamente',
      };
    }

    if (priorStStatus === 'RETAINED' && issuerStLiability !== 'SUBSTITUTED') {
      return {
        cfop: null,
        status: 'NOT_READY',
        reason: 'priorSt RETAINED sozinho não determina CFOP 5405 — exige condição substituído + ST aplicável',
      };
    }

    if (currentOperationSt === 'DUE_BY_ISSUER' && issuerStLiability === 'SUBSTITUTE') {
      return {
        cfop: '5403',
        status: 'NOT_READY',
        reason: 'ST devida na operação — CFOP 5403 aguarda dataset estadual',
      };
    }

    if (priorStStatus === 'NO_ST_EVIDENCE'
      && currentOperationSt === 'NOT_DUE'
      && issuerStLiability !== 'SUBSTITUTE') {
      return {
        cfop: '5102',
        status: 'PARTIAL',
        reason: 'Revenda interna mercadoria comum adquirida de terceiros',
      };
    }

    return { cfop: null, status: 'NOT_READY', reason: 'Natureza interna não modelada completamente' };
  }

  if (location === 'INTERESTADUAL' && itemSource === 'THIRD_PARTY') {
    if (issuerStLiability === 'SUBSTITUTE' && currentOperationSt === 'DUE_BY_ISSUER') {
      return {
        cfop: '6403',
        status: 'NOT_READY',
        reason: 'Interestadual emitente substituto — CFOP 6403 aguarda validação estadual',
      };
    }

    if (interstatePriorRetainedEligible
      && priorStStatus === 'RETAINED'
      && issuerStLiability === 'SUBSTITUTED'
      && stApplicabilityStatus === 'APPLICABLE') {
      return {
        cfop: '6404',
        status: 'NOT_READY',
        reason: 'CFOP 6404 somente com condições oficiais interestaduais completas',
      };
    }

    if (priorStStatus === 'RETAINED' && !interstatePriorRetainedEligible) {
      return {
        cfop: null,
        status: 'NOT_READY',
        reason: 'priorSt RETAINED sozinho não determina CFOP 6404',
      };
    }

    if (recipientTaxpayerStatus === 'TAXPAYER'
      && currentOperationSt === 'NOT_DUE'
      && issuerStLiability !== 'SUBSTITUTE') {
      return {
        cfop: '6102',
        status: 'PARTIAL',
        reason: 'Interestadual revenda contribuinte sem ST específica na operação',
      };
    }

    if (recipientTaxpayerStatus === 'NON_TAXPAYER'
      && currentOperationSt === 'NOT_DUE') {
      return {
        cfop: '6108',
        status: 'PARTIAL',
        reason: 'Interestadual revenda destinatário não contribuinte',
      };
    }

    return { cfop: null, status: 'NOT_READY', reason: 'Natureza interestadual não modelada completamente' };
  }

  return { cfop: null, status: 'NOT_READY', reason: 'Localização/itemSource insuficientes' };
};

/**
 * CFOP e CSOSN são independentes — valida que um não foi inferido do outro.
 * @param {object} params
 */
export const assertCfopCsosnIndependence = ({ cfop, csosn, facts }) => {
  const violations = [];

  if (csosn === '500' && cfop === '5405' && facts?.issuerStLiability !== 'SUBSTITUTED') {
    violations.push('CSOSN 500 não implica CFOP 5405 sem emitente substituído');
  }
  if (cfop === '5405' && csosn === '102' && facts?.priorStStatus === 'RETAINED') {
    violations.push('CFOP 5405 não implica CSOSN 102 com ST retida');
  }
  if (cfop === '6404' && facts?.priorStStatus === 'RETAINED' && !facts?.interstatePriorRetainedEligible) {
    violations.push('CFOP 6404 inferido apenas por priorSt RETAINED');
  }
  if (csosn === '500' && cfop === '6404' && !facts?.interstatePriorRetainedEligible) {
    violations.push('CSOSN 500 não determina CFOP 6404 automaticamente');
  }

  return violations.length
    ? { ok: false, violations }
    : { ok: true };
};
