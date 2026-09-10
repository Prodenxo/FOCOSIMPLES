/**
 * Catálogo produto → linha do formulário NF-e / NFC-e.
 */

import {
  DEFAULT_NFE_CSOSN,
  DEFAULT_NFE_PIS_COFINS_CST,
  getDefaultNfeItem,
} from '@/lib/fiscalEmit';
import {
  nfeCatalogProdutoFormFieldsFromMetadata,
  resolveCatalogProdutoNcm,
} from '@/lib/nfeCatalogProdutoMetadata';

function formatValorUnitario(valor) {
  if (valor == null || Number.isNaN(Number(valor)) || Number(valor) <= 0) return '';
  return Number(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

/** @param {Record<string, unknown>} produto */
export function mapCatalogProdutoToNfeItem(produto) {
  const base = getDefaultNfeItem();
  const fields = nfeCatalogProdutoFormFieldsFromMetadata(produto?.metadata_json);
  const ncm = resolveCatalogProdutoNcm(produto) || fields.ncm;
  const codigo = String(produto?.codigo ?? '').trim();
  const descricao = String(produto?.discriminacao ?? produto?.nome ?? '').trim();
  const vu = formatValorUnitario(produto?.valor_sugerido ?? null);

  return {
    ...base,
    codigo: codigo || 'CAT',
    descricao: descricao || codigo || 'Produto do catálogo',
    ncm,
    cfop: fields.cfop,
    unidade: fields.unidade.trim() || 'UN',
    quantidade: '1',
    valorUnitario: vu || '',
    cest: fields.cest || '',
    tributos: {
      ...base.tributos,
      icms: {
        ...base.tributos.icms,
        csosn: DEFAULT_NFE_CSOSN,
        cst: '',
      },
      pis: { ...base.tributos.pis, cst: fields.pisCst || DEFAULT_NFE_PIS_COFINS_CST },
      cofins: { ...base.tributos.cofins, cst: fields.cofinsCst || DEFAULT_NFE_PIS_COFINS_CST },
    },
  };
}
