import type { NfseCatalogProduto } from '../services/meiNotasService'
import {
  applySimplesNacionalDefaultsToNfeItem,
} from './nfeEmissaoLeigo'
import {
  calculateItemTax,
} from './nfeItemTaxEngine'
import {
  getDefaultNfeItem,
  type NfeItemForm,
} from './meiNfseForms'
import {
  nfeCatalogProdutoFormFieldsFromMetadata,
  readNfeCatalogProdutoMetadata,
} from './nfeCatalogProdutoMetadata'

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
}

/** Catálogo produto (NFE/NFCE) → linha do formulário NF-e / NFC-e no App. */
export function mapCatalogProdutoToNfeItem(
  produto: NfseCatalogProduto,
  options: MapCatalogProdutoToNfeItemOptions = {},
): NfeItemForm {
  const base = getDefaultNfeItem()
  const meta = readNfeCatalogProdutoMetadata(produto.metadata_json)
  const fields = nfeCatalogProdutoFormFieldsFromMetadata(produto.metadata_json)
  const codigo = String(produto.codigo ?? '').trim()
  const descricao = String(produto.discriminacao ?? '').trim()
  const vu = formatValorUnitario(produto.valor_sugerido ?? null)
  const tax = calculateItemTax(
    { ncm: fields.ncm, cest: meta.cest },
    options.emitenteUf,
    options.destinatarioUf,
  )

  const row = applySimplesNacionalDefaultsToNfeItem({
    ...base,
    codigo: codigo || 'CAT',
    descricao: descricao || codigo || 'Produto do catálogo',
    ncm: fields.ncm,
    cfop: tax.cfop ?? fields.cfop,
    unidade: (meta.unidade ?? fields.unidade).trim() || 'UN',
    quantidade: '1',
    valorUnitario: vu || '',
    ...(meta.cest?.trim() ? { cest: meta.cest.replace(/\D/g, '').slice(0, 7) } : {}),
    tributos: {
      ...base.tributos,
      icms: {
        ...base.tributos.icms,
        csosn: tax.csosn ?? fields.icmsCsosn,
        cst: '',
      },
      pis: { ...base.tributos.pis, cst: fields.pisCst },
      cofins: { ...base.tributos.cofins, cst: fields.cofinsCst },
    },
  })

  return row
}
