/**
 * Recalcula CSOSN/CFOP/CEST dos itens via API (com fallback silencioso).
 */

import { calcularTributacaoItensNfe } from '@/lib/fiscalApi';
import { onlyDigits } from '@/lib/fiscalEmit';

function taxItemsPayload(items) {
  return (items || []).map((it) => ({
    codigo: it.codigo,
    ncm: onlyDigits(it.ncm),
    cest: it.cest ? onlyDigits(it.cest) : undefined,
  }));
}

function applyTaxToItem(item, tax) {
  if (!tax?.cfop || !tax?.csosn) return item;
  const isSt = tax.has_st === true && tax.csosn === '500';
  return {
    ...item,
    cfop: tax.cfop,
    cest: isSt ? (tax.cest?.trim() || item.cest || '') : '',
    tributos: {
      ...item.tributos,
      icms: {
        ...item.tributos?.icms,
        origem: item.tributos?.icms?.origem || '0',
        csosn: isSt ? '500' : (tax.csosn || '102'),
        cst: '',
      },
    },
  };
}

/**
 * @param {Array<Record<string, unknown>>} items
 * @param {string} originUf
 * @param {string} destinationUf
 * @param {{ businessType?: string, destinatario?: Record<string, unknown> }} [options]
 */
export async function recalculateNfeItemsTax(items, originUf, destinationUf, options = {}) {
  if (!originUf || !destinationUf || !items?.length) return items;

  const dest = options.destinatario || {};
  const payload = {
    originUf: String(originUf).trim().toUpperCase().slice(0, 2),
    destinationUf: String(destinationUf).trim().toUpperCase().slice(0, 2),
    businessType: options.businessType || 'COMERCIO',
    items: taxItemsPayload(items),
    destinatarioDoc: dest.destinatarioDoc ?? dest.cpfCnpj,
    indIEDest: dest.indIEDest,
    inscricaoEstadual: dest.inscricaoEstadual,
    nonTaxpayer: dest.nonTaxpayer,
  };

  try {
    const data = await calcularTributacaoItensNfe(payload);
    const taxes = data?.items ?? [];
    return items.map((item, index) => applyTaxToItem(item, taxes[index]));
  } catch {
    return items;
  }
}
