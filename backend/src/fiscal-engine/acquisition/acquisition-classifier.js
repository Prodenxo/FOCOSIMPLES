/**
 * AcquisitionClassifier — classifica ST da aquisição (não decide CSOSN saída).
 */
import { PRIOR_ST_DOCUMENT_CLASSIFICATION } from './constants.js';
import { PRIOR_ST_STATUS } from '../types/st-allocation.js';

const hasNumericValues = (obj) => (
  obj && typeof obj === 'object' && Object.values(obj).some((v) => v != null && v !== '')
);

/**
 * @param {import('./purchase-item-tax-parse.js').ReturnType<typeof import('./purchase-item-tax-parse.js').extractIcmsGroup>[]} icmsGroups
 */
export const classifyPriorStFromIcmsGroups = (icmsGroups) => {
  const groups = Array.isArray(icmsGroups) ? icmsGroups : [];
  let hasPrior = false;
  let hasOperation = false;
  let hasAnyIndicator = false;

  for (const g of groups) {
    if (hasNumericValues(g?.priorRetained)) {
      hasPrior = true;
      hasAnyIndicator = true;
    }
    if (hasNumericValues(g?.operationSt)) {
      hasOperation = true;
      hasAnyIndicator = true;
    }
    const code = String(g?.cstOrCsosn ?? '');
    if (['60', '500'].includes(code) && !hasNumericValues(g?.priorRetained) && !hasNumericValues(g?.operationSt)) {
      hasAnyIndicator = true;
    }
  }

  if (hasPrior && hasOperation) {
    return buildClassification(PRIOR_ST_DOCUMENT_CLASSIFICATION.AMBIGUOUS, PRIOR_ST_STATUS.UNKNOWN, 'HIGH', [
      'Indicadores de ST anterior e ST na operação de compra presentes simultaneamente',
    ]);
  }

  if (hasPrior && !hasOperation) {
    return buildClassification(
      PRIOR_ST_DOCUMENT_CLASSIFICATION.PRIOR_RETAINED,
      PRIOR_ST_STATUS.RETAINED,
      'HIGH',
      ['Campos vBCSTRet/vICMSSTRet ou equivalentes presentes no XML'],
    );
  }

  if (hasOperation) {
    return buildClassification(
      PRIOR_ST_DOCUMENT_CLASSIFICATION.COLLECTED_IN_PURCHASE,
      PRIOR_ST_STATUS.RETAINED,
      'HIGH',
      ['ST cobrada nesta NF de compra (vBCST/vICMSST ou equivalentes)'],
    );
  }

  if (hasAnyIndicator) {
    return buildClassification(
      PRIOR_ST_DOCUMENT_CLASSIFICATION.AMBIGUOUS,
      PRIOR_ST_STATUS.UNKNOWN,
      'LOW',
      ['Indicadores parciais de ST sem valores completos'],
    );
  }

  return buildClassification(
    PRIOR_ST_DOCUMENT_CLASSIFICATION.NO_ST_INDICATORS,
    PRIOR_ST_STATUS.NO_ST_EVIDENCE,
    'MEDIUM',
    ['Nenhum indicador documental de ST encontrado no item'],
  );
};

const buildClassification = (documentClassification, priorStStatus, confidence, reasonParts) => ({
  documentClassification,
  priorStStatus,
  confidence,
  reason: reasonParts.join('; '),
});

/**
 * @param {import('./purchase-item-tax-parse.js').ReturnType<typeof buildPurchaseItemTaxParse>} parsedTax
 * @param {string} parserVersion
 */
export const buildPriorStEvidence = (parsedTax, parserVersion) => {
  const classification = classifyPriorStFromIcmsGroups(parsedTax?.icmsGroups);
  const xmlGroups = (parsedTax?.icmsGroups || []).map((g) => ({
    groupTag: g.groupTag,
    cstOrCsosn: g.cstOrCsosn,
    rawXmlPath: g.rawXmlPath,
    operationSt: g.operationSt,
    priorRetained: g.priorRetained,
  }));

  return {
    source: 'PURCHASE_XML',
    confidence: classification.confidence,
    reason: classification.reason,
    documentClassification: classification.documentClassification,
    priorStStatus: classification.priorStStatus,
    rawXmlPaths: parsedTax?.rawPaths || [],
    xmlGroups,
    parserVersion,
    operationSt: xmlGroups.find((g) => g.operationSt)?.operationSt ?? null,
    priorRetained: xmlGroups.find((g) => g.priorRetained)?.priorRetained ?? null,
  };
};

/**
 * @param {ReturnType<typeof buildPriorStEvidence>} evidence
 */
export const explainPriorStRetained = (evidence) => ({
  question: 'Por que este lote está RETAINED?',
  source: evidence?.source,
  confidence: evidence?.confidence,
  reason: evidence?.reason,
  documentClassification: evidence?.documentClassification,
  parserVersion: evidence?.parserVersion,
  rawXmlPaths: evidence?.rawXmlPaths,
  fieldsFound: {
    priorRetained: evidence?.priorRetained,
    operationSt: evidence?.operationSt,
  },
});
