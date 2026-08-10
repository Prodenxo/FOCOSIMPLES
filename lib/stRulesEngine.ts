/**
 * Matriz ST — espelho frontend de backend/src/lib/st-rules-engine.js
 */

export const CSOSN_ST = '500'

const onlyDigits = (value: string | null | undefined, max: number) =>
  String(value ?? '').replace(/\D/g, '').slice(0, max)

/** CEST obrigatório na UI somente quando a API confirmou ST (has_st + CSOSN 500). */
export function nfeItemRequiresCestFromApi(
  tax: { has_st?: boolean; csosn?: string | null } | null | undefined,
): boolean {
  return tax?.has_st === true && onlyDigits(tax?.csosn, 3) === CSOSN_ST
}

/** Mesma regra no item do formulário após aplicar tributação da API. */
export function nfeItemFormRequiresCest(
  item: {
    fiscalHasSt?: boolean | null
    tributos?: { icms?: { csosn?: string } }
  },
): boolean {
  const csosn = onlyDigits(item.tributos?.icms?.csosn, 3)
  return item.fiscalHasSt === true && csosn === CSOSN_ST
}
