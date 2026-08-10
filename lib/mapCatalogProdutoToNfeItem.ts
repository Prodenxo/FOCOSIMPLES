import type { NfseCatalogProduto } from '../services/meiNotasService'
import { applySimplesNacionalDefaultsToNfeItem } from './nfeEmissaoLeigo'
import { normalizeEmpresaBusinessType } from './empresaBusinessType'
import {
  getDefaultNfeItem,
  MEI_DEFAULT_NFE_CSOSN,
  type NfeItemForm,
} from './meiNfseForms'
import { nfeCatalogProdutoFormFieldsFromMetadata } from './nfeCatalogProdutoMetadata'

function formatValorUnitario(valor: number | null | undefined): string {
  if (valor == null || Number.isNaN(valor) || valor <= 0) return ''
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

export type MapCatalogProdutoToNfeItemOptions = {
  emitenteUf?: string
  destinatarioUf?: string
  businessType?: string
  destinatarioDoc?: string
  indIEDest?: string
  inscricaoEstadual?: string
  nonTaxpayer?: boolean
}

/**
 * Catálogo produto → linha do formulário NF-e.
 * CSOSN/CFOP/ST vêm do backend (`recalculateNfeItemsTax`); aqui só defaults seguros (102).
 */
export function mapCatalogProdutoToNfeItem(
  produto: NfseCatalogProduto,
  _options: MapCatalogProdutoToNfeItemOptions = {},
): NfeItemForm {
  void normalizeEmpresaBusinessType(_options.businessType)
  const base = getDefaultNfeItem()
  const fields = nfeCatalogProdutoFormFieldsFromMetadata(produto.metadata_json)
  const codigo = String(produto.codigo ?? '').trim()
  const descricao = String(produto.discriminacao ?? '').trim()
  const vu = formatValorUnitario(produto.valor_sugerido ?? null)

  return applySimplesNacionalDefaultsToNfeItem({
    ...base,
    codigo: codigo || 'CAT',
    descricao: descricao || codigo || 'Produto do catálogo',
    ncm: fields.ncm,
    cfop: fields.cfop,
    unidade: fields.unidade.trim() || 'UN',
    quantidade: '1',
    valorUnitario: vu || '',
    cest: '',
    tributos: {
      ...base.tributos,
      icms: {
        ...base.tributos.icms,
        csosn: MEI_DEFAULT_NFE_CSOSN,
        cst: '',
      },
      pis: { ...base.tributos.pis, cst: fields.pisCst },
      cofins: { ...base.tributos.cofins, cst: fields.cofinsCst },
    },
  })
}
