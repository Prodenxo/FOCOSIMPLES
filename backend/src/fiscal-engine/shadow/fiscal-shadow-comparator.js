/**
 * Comparador shadow legado × v3 — correlação comercial, split, Decimal.
 */
import { SHADOW_DIFFERENCE_CODE, CORRELATION_CONFIDENCE } from './shadow-constants.js';
import { legacyDecimalEquals } from './legacy-fiscal-snapshot.js';
import { toDecimal } from '../money/decimal.js';

const norm = (value) => (value == null ? null : String(value).trim());

const codesEqual = (a, b) => norm(a) === norm(b);

/**
 * Agrupa snapshots v3 por correlationKey.
 * @param {import('./shadow-types.js').V3FiscalSnapshot[]} v3Snapshots
 */
export const groupV3SnapshotsByCorrelation = (v3Snapshots) => {
  /** @type {Map<string, import('./shadow-types.js').V3FiscalSnapshot[]>} */
  const map = new Map();
  for (const snap of v3Snapshots) {
    const key = snap.correlationKey;
    const bucket = map.get(key) ?? [];
    bucket.push(snap);
    map.set(key, bucket);
  }
  return map;
};

/**
 * Compara legacy vs v3 group e retorna códigos de diferença.
 * @param {import('./shadow-types.js').LegacyFiscalSnapshot | null} legacy
 * @param {import('./shadow-types.js').V3FiscalSnapshot[]} v3Group
 */
export const compareLegacyWithV3Group = (legacy, v3Group) => {
  /** @type {string[]} */
  const differenceCodes = [];
  let ambiguous = false;

  if (!legacy && v3Group.length > 0) {
    differenceCodes.push(SHADOW_DIFFERENCE_CODE.V3_ONLY);
    return { differenceCodes, exactMatch: false, ambiguous: false };
  }

  if (legacy && v3Group.length === 0) {
    differenceCodes.push(SHADOW_DIFFERENCE_CODE.LEGACY_ONLY);
    return { differenceCodes, exactMatch: false, ambiguous: false };
  }

  if (!legacy) {
    return { differenceCodes: [SHADOW_DIFFERENCE_CODE.COMPARISON_AMBIGUOUS], exactMatch: false, ambiguous: true };
  }

  if (v3Group.length > 1) {
    differenceCodes.push(SHADOW_DIFFERENCE_CODE.ITEM_SPLIT_DIFFERENT);
  }

  if (v3Group.length === 0) {
    differenceCodes.push(SHADOW_DIFFERENCE_CODE.V3_UNRESOLVED);
    return { differenceCodes, exactMatch: false, ambiguous: false };
  }

  const v3Primary = v3Group[0];
  const allBlocked = v3Group.every((v) => v.blocked);
  const allUnresolved = v3Group.every((v) => (
    v.resolutionStatus === 'UNSUPPORTED'
    || v.resolutionStatus === 'NEEDS_REVIEW'
    || v.resolutionStatus === 'ERROR'
    || (!v.cfop && !v.csosn)
  ));

  if (allBlocked) {
    differenceCodes.push(SHADOW_DIFFERENCE_CODE.V3_BLOCKED);
  }
  if (allUnresolved) {
    differenceCodes.push(SHADOW_DIFFERENCE_CODE.V3_UNRESOLVED);
  }

  if (v3Group.length > 1) {
    const legacyQty = legacy.values?.quantidade;
    const v3QtySum = sumV3Quantities(v3Group);
    if (legacyQty != null && v3QtySum != null) {
      const qtyCmp = legacyDecimalEquals(legacyQty, v3QtySum, 'qCom');
      if (!qtyCmp.equal && !qtyCmp.roundingOnly) {
        ambiguous = true;
        differenceCodes.push(SHADOW_DIFFERENCE_CODE.COMPARISON_AMBIGUOUS);
      }
    }
  }

  if (!codesEqual(legacy.cfop, v3Primary.cfop)) {
    differenceCodes.push(SHADOW_DIFFERENCE_CODE.CFOP_DIFFERENT);
  }
  if (!codesEqual(legacy.csosn, v3Primary.csosn)) {
    differenceCodes.push(SHADOW_DIFFERENCE_CODE.CSOSN_DIFFERENT);
  }
  if (!codesEqual(legacy.cst, v3Primary.cst) && !codesEqual(legacy.csosn, v3Primary.cst)) {
    differenceCodes.push(SHADOW_DIFFERENCE_CODE.CST_DIFFERENT);
  }
  if (!codesEqual(legacy.origem, v3Primary.origem)) {
    differenceCodes.push(SHADOW_DIFFERENCE_CODE.ORIGEM_DIFFERENT);
  }
  if (!codesEqual(legacy.icmsGroup, v3Primary.icmsGroup)) {
    differenceCodes.push(SHADOW_DIFFERENCE_CODE.ICMS_GROUP_DIFFERENT);
  }

  const legacySt = legacy.taxFields?.vICMS ?? null;
  const v3St = v3Primary.currentOperationSt ?? null;
  if (legacySt != null && v3St != null && legacy.csosn === '500' && v3Primary.csosn !== '500') {
    differenceCodes.push(SHADOW_DIFFERENCE_CODE.ST_DIFFERENT);
  }

  const valueCmp = legacyDecimalEquals(
    legacy.values?.valorTotal,
    v3Group.reduce((acc, v) => acc + Number(v.quantity ?? 0), 0) ? legacy.values?.valorTotal : null,
    'vProd',
  );
  if (legacy.values?.valorTotal && v3Primary.quantity && !valueCmp.equal && valueCmp.roundingOnly) {
    differenceCodes.push(SHADOW_DIFFERENCE_CODE.ROUNDING_ONLY_DIFFERENCE);
  }

  const uniqueCodes = [...new Set(differenceCodes)];
  const fiscalDiffs = uniqueCodes.filter((c) => (
    c !== SHADOW_DIFFERENCE_CODE.EXACT_MATCH
    && c !== SHADOW_DIFFERENCE_CODE.ROUNDING_ONLY_DIFFERENCE
    && c !== SHADOW_DIFFERENCE_CODE.ITEM_SPLIT_DIFFERENT
  ));

  const exactMatch = fiscalDiffs.length === 0
    && !ambiguous
    && v3Group.length === 1
    && !allBlocked
    && !allUnresolved;

  if (exactMatch) {
    return { differenceCodes: [SHADOW_DIFFERENCE_CODE.EXACT_MATCH], exactMatch: true, ambiguous: false };
  }

  return { differenceCodes: uniqueCodes, exactMatch: false, ambiguous };
};

/**
 * @param {import('./shadow-types.js').V3FiscalSnapshot[]} v3Group
 */
const sumV3Quantities = (v3Group) => {
  try {
    let sum = toDecimal(0);
    for (const v of v3Group) {
      if (v.quantity != null) sum = sum.plus(toDecimal(v.quantity));
    }
    return sum.toString();
  } catch {
    return null;
  }
};

/**
 * @param {import('./shadow-types.js').LegacyFiscalSnapshot[]} legacySnapshots
 * @param {import('./shadow-types.js').V3FiscalSnapshot[]} v3Snapshots
 * @returns {import('./shadow-types.js').ShadowItemComparison[]}
 */
export const correlateAndCompareShadowItems = (legacySnapshots, v3Snapshots) => {
  const v3ByKey = groupV3SnapshotsByCorrelation(v3Snapshots);
  const usedV3Keys = new Set();
  /** @type {import('./shadow-types.js').ShadowItemComparison[]} */
  const comparisons = [];

  for (const legacy of legacySnapshots) {
    const key = legacy.correlationKey;
    const v3Group = v3ByKey.get(key) ?? [];
    usedV3Keys.add(key);
    const result = compareLegacyWithV3Group(legacy, v3Group);
    comparisons.push({
      correlationKey: key,
      correlationConfidence: legacy?.correlationConfidence
        ?? v3Group[0]?.correlationConfidence
        ?? CORRELATION_CONFIDENCE.AMBIGUOUS,
      legacy,
      v3Items: v3Group,
      differenceCodes: result.differenceCodes,
      exactMatch: result.exactMatch,
      ambiguous: result.ambiguous,
    });
  }

  for (const [key, v3Group] of v3ByKey.entries()) {
    if (usedV3Keys.has(key)) continue;
    const result = compareLegacyWithV3Group(null, v3Group);
    comparisons.push({
      correlationKey: key,
      correlationConfidence: CORRELATION_CONFIDENCE.AMBIGUOUS,
      legacy: null,
      v3Items: v3Group,
      differenceCodes: result.differenceCodes,
      exactMatch: false,
      ambiguous: result.ambiguous,
    });
  }

  return comparisons;
};

/**
 * @param {import('./shadow-types.js').ShadowItemComparison[]} items
 */
export const buildShadowComparisonSummary = (items) => {
  let exactMatches = 0;
  let differences = 0;
  let legacyOnly = 0;
  let v3Unresolved = 0;
  let v3Blocked = 0;
  let errors = 0;
  let cfopDifference = 0;
  let csosnDifference = 0;
  let stDifference = 0;
  let splitDifference = 0;

  for (const item of items) {
    if (item.exactMatch) exactMatches += 1;
    else differences += 1;

    if (item.differenceCodes.includes(SHADOW_DIFFERENCE_CODE.LEGACY_ONLY)) legacyOnly += 1;
    if (item.differenceCodes.includes(SHADOW_DIFFERENCE_CODE.V3_UNRESOLVED)) v3Unresolved += 1;
    if (item.differenceCodes.includes(SHADOW_DIFFERENCE_CODE.V3_BLOCKED)) v3Blocked += 1;
    if (item.differenceCodes.includes(SHADOW_DIFFERENCE_CODE.CFOP_DIFFERENT)) cfopDifference += 1;
    if (item.differenceCodes.includes(SHADOW_DIFFERENCE_CODE.CSOSN_DIFFERENT)) csosnDifference += 1;
    if (item.differenceCodes.includes(SHADOW_DIFFERENCE_CODE.ST_DIFFERENT)) stDifference += 1;
    if (item.differenceCodes.includes(SHADOW_DIFFERENCE_CODE.ITEM_SPLIT_DIFFERENT)) splitDifference += 1;
    if (item.differenceCodes.includes(SHADOW_DIFFERENCE_CODE.COMPARISON_AMBIGUOUS)) errors += 1;
  }

  return {
    exactMatches,
    differences,
    legacyOnly,
    v3Unresolved,
    v3Blocked,
    errors,
    cfopDifference,
    csosnDifference,
    stDifference,
    splitDifference,
    itemCount: items.length,
  };
};
