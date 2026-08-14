/**
 * Tipos e builders — PurchaseItemTaxParse (extração XML, sem decisão de saída).
 */
import { ICMS_GROUP_TAGS } from './constants.js';
import { decimalFieldOf, textOf } from './purchase-xml-parse-utils.js';

const ICMS_ST_OPERATION_FIELDS = ['vBCST', 'pICMSST', 'vICMSST', 'pMVAST', 'pRedBCST', 'vBCFCPST', 'pFCPST', 'vFCPST'];
export { ICMS_ST_OPERATION_FIELDS };
const ICMS_PRIOR_RETAINED_FIELDS = ['vBCSTRet', 'pST', 'vICMSSTRet', 'vICMSSubstituto', 'vBCFCPSTRet', 'pFCPSTRet', 'vFCPSTRet'];
const ICMS_EFETIVO_FIELDS = ['pRedBCEfet', 'vBCEfet', 'pICMSEfet', 'vICMSEfet'];

/**
 * @param {import('@xmldom/xmldom').Element} icmsGroupEl
 * @param {string} groupTag
 * @param {string} basePath
 * @param {string} effectiveDate
 */
export const extractIcmsGroup = (icmsGroupEl, groupTag, basePath, effectiveDate) => {
  const pick = (fields, policyMap = {}) => {
    const out = {};
    for (const field of fields) {
      const policy = policyMap[field] || (field.startsWith('p') ? 'pICMS' : 'vBC');
      const val = decimalFieldOf(icmsGroupEl, field, policy, effectiveDate)
        ?? textOf(icmsGroupEl, field);
      if (val != null && val !== '') out[field] = val;
    }
    return Object.keys(out).length ? out : null;
  };

  return {
    groupTag,
    cstOrCsosn: textOf(icmsGroupEl, 'CST') ?? textOf(icmsGroupEl, 'CSOSN'),
    orig: textOf(icmsGroupEl, 'orig'),
    rawXmlPath: `${basePath}/imposto/ICMS/${groupTag}`,
    operationSt: pick(ICMS_ST_OPERATION_FIELDS),
    priorRetained: pick(ICMS_PRIOR_RETAINED_FIELDS),
    efetivo: pick(ICMS_EFETIVO_FIELDS),
    baseCalculo: pick(['vBC', 'pICMS', 'vICMS'], { vBC: 'vBC', pICMS: 'pICMS', vICMS: 'vICMS' }),
  };
};

/**
 * @param {import('@xmldom/xmldom').Element} det
 * @param {string} detPath
 * @param {string} effectiveDate
 */
export const extractIcmsGroupsFromDet = (det, detPath, effectiveDate) => {
  const icmsContainers = det.getElementsByTagName('ICMS');
  if (!icmsContainers?.length) return [];
  const icmsRoot = icmsContainers.item(0);
  if (!icmsRoot) return [];

  const groups = [];
  for (const tag of ICMS_GROUP_TAGS) {
    const els = icmsRoot.getElementsByTagName(tag);
    if (!els?.length) continue;
    const el = els.item(0);
    if (el) groups.push(extractIcmsGroup(el, tag, detPath, effectiveDate));
  }
  return groups;
};

/**
 * @param {object} params
 */
export const buildPurchaseItemTaxParse = ({
  itemIndex,
  ncm,
  cest,
  origem,
  cfop,
  icmsGroups,
  rawPaths,
  parserVersion,
  parseWarnings = [],
}) => ({
  itemIndex,
  ncm,
  cest: cest ?? null,
  origem,
  cfop: cfop ?? null,
  icmsGroups: icmsGroups || [],
  rawPaths: rawPaths || [],
  parserVersion,
  parseWarnings,
});
