/**
 * XmlFieldsResolver — product + taxes.icms (1 grupo ICMS por item).
 * Phase 8E.3 — ST devida CSOSN 201/202/203 via cálculo pré-computado.
 * Phase 8E.4 — PIS/COFINS via cálculo pré-computado.
 */
import { createFiscalIssue } from '../types/fiscal-issue.js';
import { formatFieldByPolicy } from '../money/decimal-field-policy.js';
import { toDecimal } from '../money/decimal.js';
import { CURRENT_OPERATION_ST } from '../types/st-allocation.js';
import {
  buildIssuerStDueIcmsFields,
  isIssuerStDueCsosn,
} from '../simples-nacional/issuer-st-due-xml-builder.js';
import { buildPisCofinsXmlEntry } from '../simples-nacional/pis-cofins-xml-builder.js';

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
  stDueCalculation = null,
  pisCofinsCalculation = null,
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
  const currentOperationSt = treatment?.currentOperationSt ?? CURRENT_OPERATION_ST.UNKNOWN;
  const stCalculation = stDueCalculation ?? context.fiscalExtensions?.stCalculation ?? null;

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

  if (isIssuerStDueCsosn(csosn) && currentOperationSt === CURRENT_OPERATION_ST.DUE_BY_ISSUER) {
    const stParameters = context.fiscalExtensions?.accountantApprovedStParameters
      ?? csosnResolution?.stParameters
      ?? null;

    if (!stCalculation?.ok) {
      issues.push(createFiscalIssue(
        'REQUIRED_FIELD_MISSING',
        'Cálculo ST devida ausente ou inválido para CSOSN 201/202/203.',
        { blocksEmission: true, overrideAllowed: false },
      ));
      return { xmlFields: null, icmsGroups: [], resolved: false, issues };
    }

    const stDueFields = buildIssuerStDueIcmsFields({
      csosn,
      stParameters,
      stCalculation,
      referenceDate,
    });

    if (!stDueFields) {
      issues.push(createFiscalIssue(
        'UNSUPPORTED_SCENARIO',
        'Builder ST devida não produziu campos XML.',
        { blocksEmission: true, overrideAllowed: false },
      ));
      return { xmlFields: null, icmsGroups: [], resolved: false, issues };
    }

    Object.assign(icmsFields, stDueFields);
  }

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

  /** @type {Record<string, object>} */
  const taxes = { icms: icmsGroupEntry };

  if (context.fiscalExtensions?.accountantApprovedPis != null) {
    if (!pisCofinsCalculation?.pis?.ok) {
      issues.push(createFiscalIssue(
        'REQUIRED_FIELD_MISSING',
        'Cálculo PIS ausente ou inválido.',
        { blocksEmission: true, overrideAllowed: false },
      ));
      return { xmlFields: null, icmsGroups: [], resolved: false, issues };
    }
    const pisEntry = buildPisCofinsXmlEntry(pisCofinsCalculation.pis);
    if (!pisEntry) {
      issues.push(createFiscalIssue(
        'UNSUPPORTED_SCENARIO',
        'Builder PIS não produziu campos XML.',
        { blocksEmission: true, overrideAllowed: false },
      ));
      return { xmlFields: null, icmsGroups: [], resolved: false, issues };
    }
    taxes.pis = pisEntry;
  }

  if (context.fiscalExtensions?.accountantApprovedCofins != null) {
    if (!pisCofinsCalculation?.cofins?.ok) {
      issues.push(createFiscalIssue(
        'REQUIRED_FIELD_MISSING',
        'Cálculo COFINS ausente ou inválido.',
        { blocksEmission: true, overrideAllowed: false },
      ));
      return { xmlFields: null, icmsGroups: [], resolved: false, issues };
    }
    const cofinsEntry = buildPisCofinsXmlEntry(pisCofinsCalculation.cofins);
    if (!cofinsEntry) {
      issues.push(createFiscalIssue(
        'UNSUPPORTED_SCENARIO',
        'Builder COFINS não produziu campos XML.',
        { blocksEmission: true, overrideAllowed: false },
      ));
      return { xmlFields: null, icmsGroups: [], resolved: false, issues };
    }
    taxes.cofins = cofinsEntry;
  }

  const xmlFields = {
    product: {
      cfop,
      qCom: qty,
      vUnCom: vu,
      vProd: vt,
    },
    taxes,
  };

  return {
    xmlFields,
    icmsGroups: [icmsGroupEntry],
    resolved: true,
    issues,
  };
};
