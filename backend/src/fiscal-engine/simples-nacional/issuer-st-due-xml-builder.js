/**
 * Builder XML — ST devida pelo emitente (ICMSSN201/202/203).
 * Serializa resultado já calculado — NÃO recalcula.
 */
import { formatFieldByPolicy } from '../money/decimal-field-policy.js';
import { CSOSN_ST_DUE_BY_ISSUER_CODES } from '../fiscal-configuration/accountant-st-parameters-contract.js';

/**
 * Campos intrínsecos ao builder ST devida — não via requiredXmlFields.
 * @param {string} csosn
 */
export const isIssuerStDueCsosn = (csosn) => (
  CSOSN_ST_DUE_BY_ISSUER_CODES.has(String(csosn ?? ''))
);

/**
 * @param {object} params
 * @param {string} params.csosn
 * @param {object} params.stParameters
 * @param {object} params.stCalculation — resultado de resolveIssuerStDueCalculation
 * @param {string} params.referenceDate
 */
export const buildIssuerStDueIcmsFields = ({
  csosn,
  stParameters,
  stCalculation,
  referenceDate,
}) => {
  if (!isIssuerStDueCsosn(csosn) || !stCalculation?.ok) return null;

  const calc = stCalculation.result;
  /** @type {Record<string, string>} */
  const fields = {
    modBCST: String(stParameters.modBCST),
    pICMSST: formatFieldByPolicy(stParameters.pICMSST, 'pICMS', referenceDate),
    vBCST: calc.bcSt,
    vICMSST: calc.icmsSt,
  };

  if (String(stParameters.modBCST) === '4' && stParameters.pMVAST != null && stParameters.pMVAST !== '') {
    fields.pMVAST = formatFieldByPolicy(stParameters.pMVAST, 'pMVAST', referenceDate);
  }

  if (stParameters.pRedBCST != null && stParameters.pRedBCST !== '') {
    fields.pRedBCST = formatFieldByPolicy(stParameters.pRedBCST, 'pMVAST', referenceDate);
  }

  return fields;
};

/**
 * @param {object} stCalculation
 */
export const buildStCalculationAuditMetadata = (stCalculation) => {
  if (!stCalculation?.ok) return null;
  return {
    baseSource: stCalculation.result.baseSource,
    commercialBase: stCalculation.result.commercialBase,
    baseComposition: stCalculation.result.baseComposition ?? null,
    bcSt: stCalculation.result.bcSt,
    icmsSt: stCalculation.result.icmsSt,
    modBCST: stCalculation.result.parameters?.modBCST ?? null,
    calculationMethod: stCalculation.result.calculationMethod ?? null,
    ownIcmsPolicy: stCalculation.result.ownIcmsPolicy ?? null,
    ownIcms: stCalculation.result.ownIcms ?? null,
  };
};
