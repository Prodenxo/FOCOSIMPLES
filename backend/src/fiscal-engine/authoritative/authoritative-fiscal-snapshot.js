/**
 * Snapshot fiscal de itens NF-e authoritative — comparação antes/depois de transforms técnicos.
 */
import assert from 'node:assert/strict';

const onlyDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);

/**
 * @param {object} item
 */
const pickIcmsBlock = (item) => {
  const impostos = item?.impostos && typeof item.impostos === 'object' ? item.impostos : {};
  const tributos = item?.tributos && typeof item.tributos === 'object' ? item.tributos : {};
  const icms = impostos.icms && typeof impostos.icms === 'object'
    ? impostos.icms
    : (tributos.icms && typeof tributos.icms === 'object' ? tributos.icms : {});
  return icms;
};

/**
 * @param {object} icms
 */
const deriveIcmsGroupTag = (icms) => {
  const csosn = icms.CSOSN ?? icms.csosn ?? null;
  const cst = icms.CST ?? icms.cst ?? null;
  if (csosn) return `ICMSSN${csosn}`;
  if (cst) return `ICMS${cst}`;
  return null;
};

/** Campos fiscais comparados entre builder e adapter boundary. */
export const AUTHORITATIVE_FISCAL_COMPARE_FIELDS = Object.freeze([
  'cfop',
  'csosn',
  'cst',
  'origem',
  'icmsGroup',
  'icmsGroupCount',
  'taxFields.orig',
  'taxFields.CSOSN',
  'taxFields.CST',
  'taxFields.vBC',
  'taxFields.vICMS',
  'taxFields.pICMS',
  'taxFields.modBC',
  'taxFields.vBCSTRet',
  'taxFields.vICMSSTRet',
  'taxFields.pST',
  'taxFields.vICMSSubstituto',
]);

/**
 * @param {object} item
 * @param {number} [itemIndex]
 */
export const extractAuthoritativeFiscalSnapshotFromPayloadItem = (item, itemIndex = 0) => {
  const icms = pickIcmsBlock(item);
  const csosn = icms.CSOSN ?? icms.csosn ?? null;
  const cst = icms.CST ?? icms.cst ?? null;
  const origem = item?.origem ?? icms.orig ?? icms.origem ?? null;

  return {
    itemIndex,
    cfop: item?.cfop != null ? String(item.cfop) : null,
    csosn: csosn != null ? String(csosn) : null,
    cst: cst != null ? String(cst) : null,
    origem: origem != null ? String(origem) : null,
    icmsGroup: deriveIcmsGroupTag(icms),
    icmsGroupCount: 1,
    taxFields: {
      orig: icms.orig ?? icms.origem ?? origem,
      CSOSN: csosn != null ? String(csosn) : null,
      CST: cst != null ? String(cst) : null,
      vBC: icms.vBC ?? null,
      vICMS: icms.vICMS ?? null,
      pICMS: icms.pICMS ?? null,
      modBC: icms.modBC ?? null,
      vBCSTRet: icms.vBCSTRet ?? null,
      vICMSSTRet: icms.vICMSSTRet ?? null,
      pST: icms.pST ?? null,
      vICMSSubstituto: icms.vICMSSubstituto ?? null,
      vBCFCPSTRet: icms.vBCFCPSTRet ?? null,
      pFCPSTRet: icms.pFCPSTRet ?? null,
      vFCPSTRet: icms.vFCPSTRet ?? null,
    },
    ncm: onlyDigits(item?.ncm, 8) || null,
  };
};

/**
 * @param {object} payload
 */
export const extractAuthoritativeFiscalSnapshotsFromPayload = (payload) => {
  const itens = Array.isArray(payload?.itens) ? payload.itens : [];
  return itens.map((item, index) => extractAuthoritativeFiscalSnapshotFromPayloadItem(item, index));
};

/**
 * @param {object} snapshot
 * @param {string} path
 */
const readSnapshotPath = (snapshot, path) => {
  const parts = path.split('.');
  let cur = snapshot;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur ?? null;
};

/**
 * @param {object[]} before
 * @param {object[]} after
 * @param {string[]} [fields]
 */
export const assertAuthoritativeFiscalSnapshotsEqual = (before, after, fields = AUTHORITATIVE_FISCAL_COMPARE_FIELDS) => {
  assert.equal(before.length, after.length, 'quantidade de itens fiscal diverge');
  for (let i = 0; i < before.length; i += 1) {
    for (const field of fields) {
      const a = readSnapshotPath(before[i], field);
      const b = readSnapshotPath(after[i], field);
      assert.deepEqual(
        b,
        a,
        `campo fiscal "${field}" item[${i}] alterado por transform técnico (${JSON.stringify(a)} → ${JSON.stringify(b)})`,
      );
    }
  }
};
