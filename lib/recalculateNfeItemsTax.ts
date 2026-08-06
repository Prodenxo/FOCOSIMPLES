import type { NfeItemForm } from './meiNfseForms'
import {
  applyItemTaxResultToNfeItem,
  calculateItemTax,
  type NfeItemTaxResult,
} from './nfeItemTaxEngine'
import { calcularTributacaoItensNfe } from '../services/meiNotasService'

const taxItemsPayload = (items: NfeItemForm[]) =>
  items.map((it) => ({
    ncm: it.ncm,
    cest: it.cest,
  }))

const applyTaxesToItems = (
  items: NfeItemForm[],
  taxes: NfeItemTaxResult[],
): NfeItemForm[] =>
  items.map((item, index) => {
    const tax = taxes[index]
    if (!tax) return item
    return applyItemTaxResultToNfeItem(item, tax)
  })

/** Recalcula CSOSN/CFOP de todos os itens via API (com fallback local). */
export async function recalculateNfeItemsTax(
  items: NfeItemForm[],
  originUf: string,
  destinationUf: string,
): Promise<NfeItemForm[]> {
  if (!originUf || !destinationUf || items.length === 0) return items

  const payload = taxItemsPayload(items)
  const fallbackTaxes = payload.map((product) =>
    calculateItemTax(product, originUf, destinationUf),
  )

  try {
    const data = await calcularTributacaoItensNfe({
      originUf,
      destinationUf,
      items: payload,
    })
    const taxes = (data.items ?? []).map((tax, index) => tax ?? fallbackTaxes[index])
    return applyTaxesToItems(items, taxes)
  } catch {
    return applyTaxesToItems(items, fallbackTaxes)
  }
}

export function recalculateNfeItemsTaxLocal(
  items: NfeItemForm[],
  originUf: string,
  destinationUf: string,
): NfeItemForm[] {
  if (!originUf || !destinationUf || items.length === 0) return items
  const payload = taxItemsPayload(items)
  const taxes = payload.map((product) => calculateItemTax(product, originUf, destinationUf))
  return applyTaxesToItems(items, taxes)
}
