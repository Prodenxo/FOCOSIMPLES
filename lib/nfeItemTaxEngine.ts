/**
 * Motor de regras tributárias NF-e (CSOSN / CFOP) — Simples Nacional / MEI.
 * 100% dinâmico: qualquer par originUf × destinationUf consulta tax_rules_state.
 * Estadual: CEST ou regra na tabela (mesmo par UF→UF) → 500/5405; senão 102/5102.
 * Interestadual: protocolo ST na tabela → 500/6105|6403; senão 102/6102.
 */

import { type NfeVendaLocalizacao, detectNfeVendaLocalizacao } from './nfeEmissaoLeigo'

export const CSOSN_TRIBUTADO_SN = '102'
export const CSOSN_ST = '500'

export const CFOP_VENDA_ESTADUAL = '5102'
export const CFOP_VENDA_ESTADUAL_ST = '5405'
export const CFOP_VENDA_INTERESTADUAL = '6102'
export const CFOP_VENDA_INTERESTADUAL_ST = '6105'
export const CFOP_VENDA_INTERESTADUAL_ST_ALT = '6403'

export type NfeTaxProductInput = {
  ncm?: string | null
  cest?: string | null
}

/** Regra da tabela tax_rules_state para o par originUf → destinationUf + NCM. */
export type NfeTaxStateRule = {
  hasSt: boolean
  /** CFOP com ST (interestadual: 6105 ou 6403). */
  cfopSt?: string | null
}

export type NfeItemTaxResult = {
  cfop: string | null
  csosn: string | null
  hasSt: boolean
  scope: NfeVendaLocalizacao
  reason: 'estadual_st' | 'estadual_normal' | 'interestadual_st' | 'interestadual_normal' | 'unknown_uf'
}

const onlyDigits = (value: string | null | undefined, max: number) =>
  String(value ?? '').replace(/\D/g, '').slice(0, max)

export function normalizeNcm(value: string | null | undefined): string {
  return onlyDigits(value, 8)
}

export function productHasCest(product: NfeTaxProductInput): boolean {
  return onlyDigits(product.cest, 7).length === 7
}

/** ST em venda interna: CEST do produto OU incidência na tabela para o NCM na originUf. */
export function resolveEstadualHasSt(
  product: NfeTaxProductInput,
  stateRule?: NfeTaxStateRule | null,
): boolean {
  return productHasCest(product) || Boolean(stateRule?.hasSt)
}

const resolveInterestadualStCfop = (rule?: NfeTaxStateRule | null): string => {
  const cfop = onlyDigits(rule?.cfopSt, 4)
  if (cfop === CFOP_VENDA_INTERESTADUAL_ST_ALT) return CFOP_VENDA_INTERESTADUAL_ST_ALT
  if (cfop === CFOP_VENDA_INTERESTADUAL_ST) return CFOP_VENDA_INTERESTADUAL_ST
  return CFOP_VENDA_INTERESTADUAL_ST
}

/**
 * Calcula CSOSN e CFOP para um item da NF-e.
 * @param stateRule Regra de tax_rules_state (ncm + originUf + destinationUf).
 */
export function calculateItemTax(
  product: NfeTaxProductInput,
  originUf: string | null | undefined,
  destinationUf: string | null | undefined,
  stateRule?: NfeTaxStateRule | null,
): NfeItemTaxResult {
  const scope = detectNfeVendaLocalizacao(originUf, destinationUf)
  if (scope === 'unknown') {
    return {
      cfop: null,
      csosn: null,
      hasSt: false,
      scope,
      reason: 'unknown_uf',
    }
  }

  if (scope === 'estadual') {
    const hasSt = resolveEstadualHasSt(product, stateRule)
    if (hasSt) {
      return {
        cfop: CFOP_VENDA_ESTADUAL_ST,
        csosn: CSOSN_ST,
        hasSt: true,
        scope,
        reason: 'estadual_st',
      }
    }
    return {
      cfop: CFOP_VENDA_ESTADUAL,
      csosn: CSOSN_TRIBUTADO_SN,
      hasSt: false,
      scope,
      reason: 'estadual_normal',
    }
  }

  const hasSt = Boolean(stateRule?.hasSt)
  if (hasSt) {
    return {
      cfop: resolveInterestadualStCfop(stateRule),
      csosn: CSOSN_ST,
      hasSt: true,
      scope,
      reason: 'interestadual_st',
    }
  }

  return {
    cfop: CFOP_VENDA_INTERESTADUAL,
    csosn: CSOSN_TRIBUTADO_SN,
    hasSt: false,
    scope,
    reason: 'interestadual_normal',
  }
}

export type NfeItemTaxFormSlice = {
  cfop: string
  cest?: string
  tributos: {
    icms: { csosn: string; cst: string }
  }
}

/** Aplica resultado do motor no item do formulário (preserva edições manuais de outros campos). */
export function applyItemTaxResultToNfeItem<T extends NfeItemTaxFormSlice>(
  item: T,
  tax: NfeItemTaxResult,
): T {
  if (!tax.cfop || !tax.csosn) return item
  return {
    ...item,
    cfop: tax.cfop,
    tributos: {
      ...item.tributos,
      icms: {
        ...item.tributos.icms,
        csosn: tax.csosn,
        cst: '',
      },
    },
  }
}

/** Chave estável para reavaliar tributação (contagem + NCM/CEST por linha). */
export function buildNfeTaxItemsKey(
  items: Array<Pick<NfeTaxProductInput, 'ncm' | 'cest'>>,
): string {
  const body = items
    .map((it) => `${normalizeNcm(it.ncm)}|${onlyDigits(it.cest, 7)}`)
    .join(';')
  return `${items.length}:${body}`
}
