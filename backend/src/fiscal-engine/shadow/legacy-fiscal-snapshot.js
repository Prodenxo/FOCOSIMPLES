/**
 * Normaliza resultado legado (payload pós-tax) para comparação shadow.
 * Captura o que foi produzido — sem reinterpretar.
 */
import { toDecimal, formatDecimal } from '../money/decimal.js';
import { getDecimalFieldPolicy } from '../money/decimal-field-policy.js';
import { CORRELATION_CONFIDENCE } from './shadow-constants.js';

const onlyDigits = (value, max) => String(value ?? '').replace(/\D/g, '').slice(0, max);

const pickIcms = (item) => {
  const tributos = item?.tributos && typeof item.tributos === 'object' ? item.tributos : {};
  const icms = tributos.icms && typeof tributos.icms === 'object' ? tributos.icms : {};
  return icms;
};

/**
 * @param {object} item
 * @param {number} itemIndex
 * @returns {{ key: string, confidence: string }}
 */
export const resolveLegacyCorrelation = (item, itemIndex) => {
  const commercialId = item?.commercialSaleItemId ?? item?.metadata?.commercialSaleItemId;
  if (commercialId) {
    return { key: `csi:${commercialId}`, confidence: CORRELATION_CONFIDENCE.EXACT };
  }
  const catalogId = item?.produtoCatalogoId ?? item?.metadata?.catalogoProdutoId ?? item?.codigo;
  if (catalogId) {
    return { key: `prod:${catalogId}`, confidence: CORRELATION_CONFIDENCE.STRONG };
  }
  const ncm = onlyDigits(item?.ncm, 8);
  const desc = String(item?.descricao ?? '').trim().slice(0, 40);
  if (ncm || desc) {
    return { key: `ncm:${ncm || '?'}:${desc || '?'}`, confidence: CORRELATION_CONFIDENCE.STRONG };
  }
  return { key: `idx:${itemIndex}`, confidence: CORRELATION_CONFIDENCE.WEAK };
};

/**
 * @param {object} item
 * @param {number} itemIndex
 * @returns {import('./shadow-types.js').LegacyFiscalSnapshot}
 */
export const buildLegacyFiscalSnapshotFromPayloadItem = (item, itemIndex = 0) => {
  const icms = pickIcms(item);
  const csosn = icms.csosn ?? icms.CSOSN ?? null;
  const cst = icms.cst ?? icms.CST ?? csosn ?? null;
  const qty = item?.quantidade ?? item?.qCom ?? null;
  const vu = item?.valorUnitario ?? item?.vUnCom ?? null;
  const vt = item?.valorTotal ?? item?.vProd ?? null;
  const correlation = resolveLegacyCorrelation(item, itemIndex);

  return {
    itemIndex,
    correlationKey: correlation.key,
    correlationConfidence: correlation.confidence,
    commercialSaleItemId: item?.commercialSaleItemId ?? item?.metadata?.commercialSaleItemId ?? null,
    productId: item?.codigo ?? item?.produtoCatalogoId ?? item?.metadata?.catalogoProdutoId ?? null,
    ncm: onlyDigits(item?.ncm, 8) || null,
    cest: onlyDigits(item?.cest, 7) || null,
    cfop: item?.cfop != null ? String(item.cfop) : null,
    csosn: csosn != null ? String(csosn) : null,
    cst: cst != null ? String(cst) : null,
    origem: icms.origem ?? icms.orig ?? item?.origem ?? null,
    icmsGroup: csosn ? `ICMSSN${csosn}` : (cst ? `ICMS${cst}` : null),
    taxFields: {
      vBC: icms.vBC ?? null,
      vICMS: icms.vICMS ?? null,
      pICMS: icms.pICMS ?? null,
      modBC: icms.modBC ?? null,
    },
    values: {
      quantidade: qty != null ? String(qty) : null,
      valorUnitario: vu != null ? String(vu) : null,
      valorTotal: vt != null ? String(vt) : null,
    },
  };
};

/**
 * @param {object} legacyPayload
 * @returns {import('./shadow-types.js').LegacyFiscalSnapshot[]}
 */
export const buildLegacyFiscalSnapshotsFromPayload = (legacyPayload) => {
  const itens = Array.isArray(legacyPayload?.itens) ? legacyPayload.itens : [];
  return itens.map((item, index) => buildLegacyFiscalSnapshotFromPayloadItem(item, index));
};

/**
 * @param {object} item
 * @param {number} itemIndex
 */
export const buildLegacyCorrelationKey = (item, itemIndex) => (
  resolveLegacyCorrelation(item, itemIndex).key
);

/**
 * Compara dois valores monetários/decimais com política de campo.
 * @param {string | null | undefined} a
 * @param {string | null | undefined} b
 * @param {string} [fieldName]
 */
export const legacyDecimalEquals = (a, b, fieldName = 'vProd') => {
  if (a == null && b == null) return { equal: true, roundingOnly: false };
  if (a == null || b == null) return { equal: false, roundingOnly: false };
  try {
    const da = toDecimal(a);
    const db = toDecimal(b);
    if (da.equals(db)) return { equal: true, roundingOnly: false };
    const policy = getDecimalFieldPolicy(fieldName);
    const scale = policy?.scale ?? 2;
    const fa = formatDecimal(da, scale);
    const fb = formatDecimal(db, scale);
    if (fa === fb) return { equal: true, roundingOnly: true };
    return { equal: false, roundingOnly: false };
  } catch {
    return { equal: String(a) === String(b), roundingOnly: false };
  }
};
