/**
 * Builder de payload NF-e authoritative a partir de FiscalResults v3.
 * Preserva campos comerciais/técnicos; substitui apenas campos fiscais.
 */
import { toDecimal, formatDecimal, sumDecimals } from '../money/decimal.js';
import { formatFieldByPolicy } from '../money/decimal-field-policy.js';
import { clonePayloadForShadow } from '../shadow/clone-payload-for-shadow.js';

const QTY_SCALE = 10;

/**
 * Rateio determinístico com fechamento por residual Decimal.
 * @param {string} totalValue
 * @param {string[]} quantities
 * @param {number} index
 */
export const allocateCommercialValueByQuantityShare = (totalValue, quantities, index) => {
  const total = toDecimal(totalValue);
  const qtyDecimals = quantities.map((q) => toDecimal(q));
  const sumQty = qtyDecimals.reduce((acc, q) => acc.plus(q), toDecimal(0));
  if (sumQty.lte(0)) return formatFieldByPolicy('0', 'vProd');

  if (index === quantities.length - 1) {
    const prior = qtyDecimals.slice(0, index).map((q) => {
      const share = total.times(q).dividedBy(sumQty);
      return share;
    });
    const priorSum = prior.reduce((acc, v) => acc.plus(v), toDecimal(0));
    return formatFieldByPolicy(total.minus(priorSum), 'vProd');
  }

  const share = total.times(qtyDecimals[index]).dividedBy(sumQty);
  return formatFieldByPolicy(share, 'vProd');
};

/**
 * @param {object} legacyItem
 * @param {import('../types/fiscal-result.js').FiscalResult} fiscalResult
 * @param {object} allocation
 * @param {object} splitMeta
 */
const buildSplitNfeItem = (legacyItem, fiscalResult, allocation, splitMeta) => {
  const qty = formatFieldByPolicy(allocation.quantidade ?? allocation.quantidade_solicitada ?? '0', 'qCom');
  const vProd = splitMeta.vProd ?? allocateCommercialValueByQuantityShare(
    String(legacyItem.valorTotal ?? legacyItem.vProd ?? '0'),
    splitMeta.allQuantities,
    splitMeta.index,
  );
  const qtyDec = toDecimal(qty);
  const vProdDec = toDecimal(vProd);
  const vUnCom = qtyDec.gt(0)
    ? formatFieldByPolicy(vProdDec.dividedBy(qtyDec), 'vUnCom')
    : formatFieldByPolicy(legacyItem.valorUnitario ?? legacyItem.vUnCom ?? '0', 'vUnCom');

  const xmlFields = fiscalResult.resolutions?.xmlFields ?? {};
  const icmsBlock = xmlFields.taxes?.icms ?? fiscalResult.resolutions?.xmlFields?.icms ?? null;
  const icmsFields = icmsBlock?.fields ?? {};
  const resolvedOrigem = icmsFields.orig
    ?? fiscalResult.context?.estoque?.origemMercadoria
    ?? fiscalResult.context?.origemMercadoria?.code
    ?? allocation.origem_mercadoria
    ?? allocation.origemMercadoria
    ?? legacyItem.origem;

  return {
    ...legacyItem,
    quantidade: qty,
    qCom: qty,
    valorUnitario: vUnCom,
    vUnCom,
    valorTotal: vProd,
    vProd,
    cfop: fiscalResult.resolutions?.cfop ?? legacyItem.cfop,
    origem: resolvedOrigem,
    impostos: {
      ...(legacyItem.impostos ?? {}),
      icms: icmsFields ?? legacyItem.impostos?.icms,
    },
    _fiscalEngine: {
      nfeItemKey: fiscalResult.fiscalNFeItem?.nfeItemKey ?? null,
      allocationId: allocation.id ?? allocation.stockLotId,
      splitIndex: splitMeta.index,
      splitTotal: splitMeta.allQuantities.length,
    },
  };
};

/**
 * @param {object} params
 */
export const buildAuthoritativeNfePayloadFromFiscalResults = (params) => {
  const legacyPayloadSnapshot = clonePayloadForShadow(params.legacyPayloadSnapshot ?? params.legacyPayload ?? {});
  const payload = clonePayloadForShadow(legacyPayloadSnapshot);
  const legacyItens = Array.isArray(payload.itens) ? payload.itens : [];

  /** @type {object[]} */
  const authoritativeItens = [];

  for (const group of params.itemGroups ?? []) {
    const legacyItem = legacyItens[group.commercialItemIndex ?? 0] ?? {};
    const allocations = group.allocations ?? [];
    const fiscalResults = group.fiscalResults ?? [];
    const quantities = allocations.map((a) => String(a.quantidade ?? a.quantidade_solicitada ?? '0'));

    if (allocations.length <= 1) {
      const fiscalResult = fiscalResults[0] ?? group.fiscalResult;
      const allocation = allocations[0] ?? {};
      authoritativeItens.push(buildSplitNfeItem(legacyItem, fiscalResult, allocation, {
        allQuantities: quantities.length ? quantities : [String(legacyItem.quantidade ?? '0')],
        index: 0,
        vProd: formatFieldByPolicy(legacyItem.valorTotal ?? legacyItem.vProd ?? '0', 'vProd'),
      }));
      continue;
    }

    for (let i = 0; i < allocations.length; i += 1) {
      authoritativeItens.push(buildSplitNfeItem(
        legacyItem,
        fiscalResults[i] ?? fiscalResults[0],
        allocations[i],
        { allQuantities: quantities, index: i },
      ));
    }
  }

  payload.itens = authoritativeItens;

  const sumQCom = sumDecimals(authoritativeItens.map((it) => it.qCom ?? it.quantidade ?? '0'));
  const sumVProd = sumDecimals(authoritativeItens.map((it) => it.vProd ?? it.valorTotal ?? '0'));

  return {
    payload,
    audit: {
      itemCount: authoritativeItens.length,
      sumQCom: formatDecimal(toDecimal(sumQCom), QTY_SCALE),
      sumVProd,
      splitGroups: (params.itemGroups ?? []).filter((g) => (g.allocations ?? []).length > 1).length,
    },
  };
};

/**
 * Valida invariantes de split authoritative.
 * @param {object} legacyItem
 * @param {object[]} splitItens
 */
export const validateAuthoritativeSplitInvariants = (legacyItem, splitItens) => {
  const expectedQty = formatFieldByPolicy(legacyItem.quantidade ?? legacyItem.qCom ?? '0', 'qCom');
  const expectedVProd = formatFieldByPolicy(legacyItem.valorTotal ?? legacyItem.vProd ?? '0', 'vProd');
  const sumQ = sumDecimals(splitItens.map((it) => it.qCom ?? it.quantidade ?? '0'));
  const sumV = sumDecimals(splitItens.map((it) => it.vProd ?? it.valorTotal ?? '0'));

  return {
    qtyMatch: toDecimal(sumQ).eq(toDecimal(expectedQty)),
    vProdMatch: toDecimal(sumV).eq(toDecimal(expectedVProd)),
    sumQCom: formatDecimal(toDecimal(sumQ), QTY_SCALE),
    sumVProd: sumV,
    expectedQty,
    expectedVProd,
  };
};
