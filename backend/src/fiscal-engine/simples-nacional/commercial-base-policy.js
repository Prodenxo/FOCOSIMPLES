/**
 * Política canônica de base comercial — FiscalContext.item (Phase 8E.3 audit).
 * build-fiscal-context.js: valorTotal = itemRaw.valorTotal ?? quantidade × valorUnitario.
 * Não compõe frete/seguro/outras despesas/IPI — caller deve pré-compor em valorTotal se necessário.
 */
import { toDecimal } from '../money/decimal.js';
import { formatFieldByPolicy } from '../money/decimal-field-policy.js';

/**
 * @param {object} item
 * @param {string} referenceDate
 */
export const resolveCanonicalCommercialBase = (item = {}, referenceDate) => {
  const qty = item.quantidade ?? '1';
  const vu = item.valorUnitario ?? '0';
  const hasExplicitTotal = item.valorTotal != null && item.valorTotal !== '';

  const vProd = hasExplicitTotal
    ? formatFieldByPolicy(toDecimal(item.valorTotal), 'vProd', referenceDate)
    : formatFieldByPolicy(toDecimal(qty).times(toDecimal(vu)), 'vProd', referenceDate);

  return {
    baseValue: vProd,
    baseSource: hasExplicitTotal ? 'item.valorTotal' : 'item.quantidade×valorUnitario',
    commercialBase: String(vProd),
    qCom: String(qty),
    vUnCom: String(vu),
    composition: {
      derivedFrom: hasExplicitTotal ? 'explicitValorTotal' : 'quantidadeTimesValorUnitario',
      includesFrete: false,
      includesSeguro: false,
      includesOutrasDespesas: false,
      includesIpi: false,
      descontoNetted: hasExplicitTotal
        ? 'unknown-caller-responsibility'
        : 'not-applicable-fallback-is-gross-qty-times-unit',
    },
  };
};
