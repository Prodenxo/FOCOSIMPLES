/**
 * Helpers de parse — valores fiscais como string decimal canônica.
 */
import { formatFieldByPolicy } from '../money/decimal-field-policy.js';
import { toDecimal } from '../money/decimal.js';

/**
 * @param {string | null | undefined} tagName
 * @param {import('@xmldom/xmldom').Element | Document} parent
 */
export const textOf = (parent, tagName) => {
  if (!parent || !tagName) return null;
  const nodes = parent.getElementsByTagName(tagName);
  if (!nodes || nodes.length === 0) return null;
  const value = nodes.item(0)?.textContent;
  return value != null ? String(value).trim() : null;
};

/**
 * @param {import('@xmldom/xmldom').Element | Document} parent
 * @param {string} tagName
 * @param {string} fieldPolicy
 * @param {string} [effectiveDate]
 */
export const decimalFieldOf = (parent, tagName, fieldPolicy, effectiveDate) => {
  const raw = textOf(parent, tagName);
  if (raw == null || raw === '') return null;
  try {
    return formatFieldByPolicy(raw, fieldPolicy, effectiveDate);
  } catch {
    return toDecimal(raw).toFixed(10);
  }
};

/**
 * @param {string | null | undefined} origRaw
 */
export const parseOrigemFromXml = (origRaw) => {
  const digit = String(origRaw ?? '').trim().slice(0, 1);
  if (/^[0-8]$/.test(digit)) return digit;
  return 'UNKNOWN';
};

/**
 * @param {import('@xmldom/xmldom').Element} det
 */
export const buildDetXmlPath = (det) => {
  const nItem = textOf(det, 'nItem') || '?';
  return `/NFe/infNFe/det[@nItem='${nItem}']`;
};
