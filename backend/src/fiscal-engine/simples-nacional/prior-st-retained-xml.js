/**
 * Campos XML ST retida — usa evidência real do lote/aquisição (Fase 8B).
 */
import { allocateStRetainedValues } from '../acquisition/st-retained-allocator.js';
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { toDecimal } from '../money/decimal.js';

/**
 * @param {object} params
 * @param {object} params.allocation
 * @param {object} [params.lotEvidence]
 */
export const buildPriorStRetainedXmlFields = ({ allocation, lotEvidence }) => {
  const issues = [];

  if (!lotEvidence?.vBCSTRet && !lotEvidence?.vICMSSTRet) {
    issues.push(createFiscalIssue(
      'REQUIRED_FIELD_MISSING',
      'ST retida exige vBCSTRet/vICMSSTRet comprovados — não inventar zero.',
      { severity: 'REVIEW', blocksEmission: true, overrideAllowed: false, meta: { priorStCode: 'PRIOR_ST_XML_NO_EVIDENCE' } },
    ));
    return { xmlFields: null, issues };
  }

  const qty = toDecimal(allocation?.quantity ?? allocation?.qty ?? 1);
  const totalQty = toDecimal(lotEvidence.totalQty ?? qty);
  const remaining = totalQty.minus(qty);
  const remainingQty = remaining.lessThan(0) ? toDecimal(0) : remaining;

  const allocated = allocateStRetainedValues({
    purchaseValues: {
      vBCSTRet: lotEvidence.vBCSTRet,
      vICMSSTRet: lotEvidence.vICMSSTRet,
      vICMSSubstituto: lotEvidence.vICMSSubstituto,
      pST: lotEvidence.pST,
    },
    purchaseTotalQty: String(totalQty),
    allocatedQty: String(qty),
    remainingQty: String(remainingQty),
  });

  const values = allocated.allocatedValues ?? {};
  const xmlFields = {};
  if (values.vBCSTRet != null) xmlFields.vBCSTRet = String(values.vBCSTRet);
  if (values.vICMSSTRet != null) xmlFields.vICMSSTRet = String(values.vICMSSTRet);
  if (values.vICMSSubstituto != null) xmlFields.vICMSSubstituto = String(values.vICMSSubstituto);
  if (values.pST != null) xmlFields.pST = String(values.pST);

  for (const required of ['vBCSTRet', 'vICMSSTRet']) {
    if (!xmlFields[required]) {
      issues.push(createFiscalIssue(
        'REQUIRED_FIELD_MISSING',
        `Campo ${required} obrigatório sem evidência derivável.`,
        { severity: 'ERROR', blocksEmission: true, overrideAllowed: false },
      ));
    }
  }

  return { xmlFields: issues.some((i) => i.blocksEmission) ? null : xmlFields, issues };
};
