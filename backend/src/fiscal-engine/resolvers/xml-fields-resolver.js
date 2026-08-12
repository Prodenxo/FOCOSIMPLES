/**
 * XmlFieldsResolver — product + taxes.icms (1 grupo ICMS por item).
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { formatFieldByPolicy } from '../money/decimal-field-policy.js';
import { toDecimal } from '../money/decimal.js';

/** @type {Record<string, (context: object) => string | null | undefined>} */
const RULE_DRIVEN_FIELD_RESOLVERS = {
  vBCSTRet: (context) => context.allocation?.stRetainedAllocation?.allocatedValues?.vBCSTRet ?? null,
  vICMSSTRet: (context) => context.allocation?.stRetainedAllocation?.allocatedValues?.vICMSSTRet ?? null,
  pST: (context) => context.allocation?.stRetainedAllocation?.allocatedValues?.pST ?? null,
  vICMSSubstituto: (context) => context.allocation?.stRetainedAllocation?.allocatedValues?.vICMSSubstituto ?? null,
  vBCFCPSTRet: (context) => context.allocation?.stRetainedAllocation?.allocatedValues?.vBCFCPSTRet ?? null,
  pFCPSTRet: (context) => context.allocation?.stRetainedAllocation?.allocatedValues?.pFCPSTRet ?? null,
  vFCPSTRet: (context) => context.allocation?.stRetainedAllocation?.allocatedValues?.vFCPSTRet ?? null,
  vBCEfet: (context) => context.allocation?.stRetainedAllocation?.allocatedValues?.vBCEfet ?? null,
  pICMSEfet: (context) => context.allocation?.stRetainedAllocation?.allocatedValues?.pICMSEfet ?? null,
  vICMSEfet: (context) => context.allocation?.stRetainedAllocation?.allocatedValues?.vICMSEfet ?? null,
};

/**
 * @param {string} fieldName
 * @param {object} context
 */
const resolveRuleDrivenField = (fieldName, context) => {
  const resolver = RULE_DRIVEN_FIELD_RESOLVERS[fieldName];
  if (!resolver) return null;
  const value = resolver(context);
  if (value == null || value === '') return null;
  return String(value);
};

/**
 * @param {object} params
 */
export const resolveXmlFields = ({
  context,
  treatment,
  csosnResolution,
  cfopResolution,
}) => {
  const issues = [];
  const csosn = csosnResolution?.csosn ?? null;
  const cst = csosnResolution?.cst ?? null;
  const cfop = cfopResolution?.cfop ?? null;
  const icmsGroup = csosnResolution?.icmsGroup ?? null;
  const origem = context.allocation?.origem ?? context.estoque?.origemMercadoria ?? 'UNKNOWN';
  const requiredFields = Array.isArray(csosnResolution?.requiredXmlFields)
    ? csosnResolution.requiredXmlFields
    : [];

  if (!csosn && !cst) {
    return {
      xmlFields: null,
      icmsGroups: [],
      resolved: false,
      issues: csosnResolution?.issues ?? [],
    };
  }

  if (!cfop) {
    return {
      xmlFields: null,
      icmsGroups: [],
      resolved: false,
      issues: cfopResolution?.issues ?? [],
    };
  }

  if (origem === 'UNKNOWN') {
    issues.push(createFiscalIssue(
      'ORIGIN_UNKNOWN',
      'Origem obrigatória para montagem do grupo ICMS.',
      { blocksEmission: true, overrideAllowed: true, severity: 'REVIEW' },
    ));
    return { xmlFields: null, icmsGroups: [], resolved: false, issues };
  }

  const referenceDate = context.operacao?.referenceDate ?? context.dataOperacao;
  const qty = context.item?.quantidade ?? context.allocation?.quantity ?? '1';
  const vu = context.item?.valorUnitario ?? '0';
  const vt = context.item?.valorTotal
    ?? formatFieldByPolicy(toDecimal(qty).times(toDecimal(vu)), 'vProd', referenceDate);

  const groupTag = icmsGroup || (csosn ? `ICMSSN${csosn}` : 'ICMS');

  /** @type {Record<string, string>} */
  const icmsFields = { orig: origem };
  if (csosn) icmsFields.CSOSN = csosn;
  if (cst) icmsFields.CST = cst;

  for (const fieldName of requiredFields) {
    const value = resolveRuleDrivenField(fieldName, context);
    if (value == null) {
      issues.push(createFiscalIssue(
        'REQUIRED_FIELD_MISSING',
        `Campo ICMS obrigatório "${fieldName}" ausente — exigido pela regra selecionada.`,
        { blocksEmission: true, overrideAllowed: true, severity: 'REVIEW', meta: { field: fieldName } },
      ));
      return { xmlFields: null, icmsGroups: [], resolved: false, issues };
    }
    icmsFields[fieldName] = value;
  }

  const icmsGroupEntry = {
    group: groupTag,
    fields: icmsFields,
  };

  const xmlFields = {
    product: {
      cfop,
      qCom: qty,
      vUnCom: vu,
      vProd: vt,
    },
    taxes: {
      icms: icmsGroupEntry,
    },
  };

  return {
    xmlFields,
    icmsGroups: [icmsGroupEntry],
    resolved: true,
    issues,
  };
};
