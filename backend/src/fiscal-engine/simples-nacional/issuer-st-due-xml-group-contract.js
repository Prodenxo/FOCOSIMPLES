/**
 * Matriz interna Phase 8E.3 — campos XML por grupo ICMSSN201/202/203 (ST devida).
 * Derivado de purchase-item-tax-parse (ICMS_ST_OPERATION_FIELDS) + builders existentes.
 * Sem campos inventados — pCredSN/vCredICMSSN não existem no repositório.
 */
import { ICMS_ST_OPERATION_FIELDS } from '../acquisition/purchase-item-tax-parse.js';

/** Campos ST operação reconhecidos internamente (parse de compra). */
export const INTERNAL_ICMS_ST_OPERATION_FIELD_NAMES = Object.freeze([...ICMS_ST_OPERATION_FIELDS]);

/**
 * Contrato por grupo — ST devida emitente, modBCST=4 (MVA).
 * Diferença semântica 201/202/203 = CSOSN (seleção contador), não shape XML adicional nesta fase.
 */
export const ISSUER_ST_DUE_XML_GROUP_CONTRACT = Object.freeze({
  ICMSSN201: Object.freeze({
    csosn: '201',
    creditAllowed: true,
    executable: true,
    requiredFields: Object.freeze(['orig', 'CSOSN', 'modBCST', 'pMVAST', 'pICMSST', 'vBCST', 'vICMSST']),
    conditionalFields: Object.freeze({
      pRedBCST: 'emitWhenConfiguredInStParameters',
    }),
    calculatedFields: Object.freeze(['vBCST', 'vICMSST']),
    optionalFields: Object.freeze([]),
    notInRepo: Object.freeze(['pCredSN', 'vCredICMSSN']),
  }),
  ICMSSN202: Object.freeze({
    csosn: '202',
    creditAllowed: false,
    executable: true,
    requiredFields: Object.freeze(['orig', 'CSOSN', 'modBCST', 'pMVAST', 'pICMSST', 'vBCST', 'vICMSST']),
    conditionalFields: Object.freeze({
      pRedBCST: 'emitWhenConfiguredInStParameters',
    }),
    calculatedFields: Object.freeze(['vBCST', 'vICMSST']),
    optionalFields: Object.freeze([]),
    notInRepo: Object.freeze([]),
  }),
  ICMSSN203: Object.freeze({
    csosn: '203',
    revenueExemption: true,
    executable: true,
    requiredFields: Object.freeze(['orig', 'CSOSN', 'modBCST', 'pMVAST', 'pICMSST', 'vBCST', 'vICMSST']),
    conditionalFields: Object.freeze({
      pRedBCST: 'emitWhenConfiguredInStParameters',
    }),
    calculatedFields: Object.freeze(['vBCST', 'vICMSST']),
    optionalFields: Object.freeze([]),
    notInRepo: Object.freeze([]),
  }),
});

/** CSOSN ST devida com builder XML certificado nesta fase. */
export const EXECUTABLE_ST_DUE_CSOSN_CODES = Object.freeze(
  Object.values(ISSUER_ST_DUE_XML_GROUP_CONTRACT)
    .filter((entry) => entry.executable)
    .map((entry) => entry.csosn),
);

/**
 * @param {string} csosn
 */
export const getIssuerStDueXmlGroupContract = (csosn) => {
  const group = `ICMSSN${csosn}`;
  return ISSUER_ST_DUE_XML_GROUP_CONTRACT[group] ?? null;
};

/**
 * @param {string} csosn
 * @param {Record<string, string>} fields
 * @param {object} [options]
 * @param {boolean} [options.pRedBCSTConfigured]
 */
export const assertIssuerStDueXmlFieldsComplete = (csosn, fields = {}, options = {}) => {
  const contract = getIssuerStDueXmlGroupContract(csosn);
  if (!contract?.executable) {
    return { ok: false, reason: 'GROUP_NOT_EXECUTABLE', missing: [], unexpected: [] };
  }

  /** @type {string[]} */
  const missing = [];
  for (const field of contract.requiredFields) {
    if (fields[field] == null || fields[field] === '') missing.push(field);
  }

  if (String(fields.modBCST) === '4' && (fields.pMVAST == null || fields.pMVAST === '')) {
    if (!missing.includes('pMVAST')) missing.push('pMVAST');
  }

  if (options.pRedBCSTConfigured && (fields.pRedBCST == null || fields.pRedBCST === '')) {
    missing.push('pRedBCST');
  }

  return {
    ok: missing.length === 0,
    contract,
    missing,
    group: `ICMSSN${csosn}`,
  };
};
