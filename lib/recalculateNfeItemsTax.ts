import type { NfeItemForm } from './meiNfseForms'
import {
  applyItemTaxResultToNfeItem,
  calculateItemTax,
  sanitizeItemTaxApiResult,
  type NfeItemTaxResult,
  type NfeTaxDestinatarioContext,
} from './nfeItemTaxEngine'
import {
  DEFAULT_EMPRESA_BUSINESS_TYPE,
  normalizeEmpresaBusinessType,
  type EmpresaBusinessType,
} from './empresaBusinessType'
import { calcularTributacaoItensNfe } from '../services/meiNotasService'

export type RecalculateNfeItemsTaxOptions = {
  businessType?: EmpresaBusinessType | string
  destinatario?: NfeTaxDestinatarioContext
}

const taxItemsPayload = (items: NfeItemForm[]) =>
  items.map((it) => ({
    ncm: it.ncm,
    cest: it.cest,
  }))

const normalizeApiTaxResult = (raw: NfeItemTaxResult): NfeItemTaxResult => {
  const isSt = raw.has_st === true && raw.csosn === '500'
  return {
    cfop: raw.cfop,
    csosn: isSt ? '500' : (raw.csosn ?? '102'),
    has_st: isSt,
    hasSt: isSt,
    cest: isSt ? (raw.cest ?? null) : null,
    scope: raw.scope,
    reason: raw.reason,
  }
}

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
  options: RecalculateNfeItemsTaxOptions | EmpresaBusinessType | string = DEFAULT_EMPRESA_BUSINESS_TYPE,
): Promise<NfeItemForm[]> {
  if (!originUf || !destinationUf || items.length === 0) return items

  const opts = typeof options === 'string'
    ? { businessType: options }
    : (options ?? {})
  const empresaType = normalizeEmpresaBusinessType(opts.businessType)
  const destinatarioContext = opts.destinatario ?? null
  const payload = taxItemsPayload(items)
  const fallbackTaxes = payload.map((product) =>
    sanitizeItemTaxApiResult(
      calculateItemTax(product, originUf, destinationUf, null, empresaType, destinatarioContext),
      product,
    ),
  )

  try {
    const data = await calcularTributacaoItensNfe({
      originUf,
      destinationUf,
      businessType: empresaType,
      items: payload,
      destinatarioDoc: destinatarioContext?.destinatarioDoc ?? destinatarioContext?.cpfCnpj,
      indIEDest: destinatarioContext?.indIEDest,
      inscricaoEstadual: destinatarioContext?.inscricaoEstadual,
      nonTaxpayer: destinatarioContext?.nonTaxpayer,
    })
    const taxes = (data.items ?? []).map((tax, index) =>
      normalizeApiTaxResult(tax ?? fallbackTaxes[index]),
    )
    return applyTaxesToItems(items, taxes)
  } catch {
    return applyTaxesToItems(items, fallbackTaxes)
  }
}

export function recalculateNfeItemsTaxLocal(
  items: NfeItemForm[],
  originUf: string,
  destinationUf: string,
  options: RecalculateNfeItemsTaxOptions | EmpresaBusinessType | string = DEFAULT_EMPRESA_BUSINESS_TYPE,
): NfeItemForm[] {
  if (!originUf || !destinationUf || items.length === 0) return items
  const opts = typeof options === 'string'
    ? { businessType: options }
    : (options ?? {})
  const empresaType = normalizeEmpresaBusinessType(opts.businessType)
  const destinatarioContext = opts.destinatario ?? null
  const payload = taxItemsPayload(items)
  const taxes = payload.map((product) =>
    sanitizeItemTaxApiResult(
      calculateItemTax(product, originUf, destinationUf, null, empresaType, destinatarioContext),
      product,
    ),
  )
  return applyTaxesToItems(items, taxes)
}
