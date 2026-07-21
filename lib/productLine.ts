import { isMeiSlotUser } from './meiUserSlot'
import { isEmpresaMeiModuleActive } from './focomeiAdminFilters'

export type ProductLine = 'focomei' | 'financeiro' | 'both'

const PRODUCT_LINES = new Set<ProductLine>(['focomei', 'financeiro', 'both'])

export function normalizeProductLine (value?: string | null): ProductLine | null {
  const text = String(value || '').trim().toLowerCase()
  return PRODUCT_LINES.has(text as ProductLine) ? (text as ProductLine) : null
}

/** Tag calculada — sem migration SQL: vaga MEI = FocoMEI. */
export function deriveUserProductLine (mei?: boolean | null): ProductLine {
  return isMeiSlotUser(mei) ? 'focomei' : 'financeiro'
}

/** Tag calculada — sem migration SQL: módulo MEI ativo = FocoMEI. */
export function deriveEmpresaProductLine (maxMei?: number | null): ProductLine {
  return isEmpresaMeiModuleActive({ max_mei: maxMei }) ? 'focomei' : 'financeiro'
}

export function resolveUserProductLine (
  mei?: boolean | null,
  productLine?: string | null,
  appOrigin?: string | null,
): ProductLine {
  return (
    normalizeProductLine(productLine)
    || normalizeProductLine(appOrigin)
    || deriveUserProductLine(mei)
  )
}

export function resolveEmpresaProductLine (
  maxMei?: number | null,
  productLine?: string | null,
): ProductLine {
  return normalizeProductLine(productLine) || deriveEmpresaProductLine(maxMei)
}

export function isFocoMeiProductLine (value?: string | null): boolean {
  const line = normalizeProductLine(value)
  return line === 'focomei' || line === 'both'
}

export function productLineLabel (value?: string | null): string {
  const line = normalizeProductLine(value)
  if (line === 'focomei') return 'FocoMEI'
  if (line === 'both') return 'FocoMEI + Foco Simples'
  if (line === 'financeiro') return 'Foco Simples'
  return '—'
}
