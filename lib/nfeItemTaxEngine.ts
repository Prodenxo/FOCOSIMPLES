/**
 * Motor de regras tributárias NF-e (CSOSN / CFOP) — Simples Nacional / MEI.
 * 100% dinâmico: qualquer par originUf × destinationUf consulta tax_rules_state.
 * Estadual: regra ST na tabela (NCM + UF origem) → 500/5405; senão 102/5102.
 * Interestadual: protocolo ST na tabela → 500/6105|6403; senão 102/6102.
 */

import { type NfeVendaLocalizacao, detectNfeVendaLocalizacao } from './nfeEmissaoLeigo'
import {
  DEFAULT_EMPRESA_BUSINESS_TYPE,
  normalizeEmpresaBusinessType,
  type EmpresaBusinessType,
} from './empresaBusinessType'

export const CSOSN_TRIBUTADO_SN = '102'
export const CSOSN_ST = '500'

/** Comércio / revenda — sem ST */
export const CFOP_VENDA_ESTADUAL_RESELLER = '5102'
export const CFOP_VENDA_INTERESTADUAL_RESELLER = '6102'
/** Indústria / produção própria — sem ST */
export const CFOP_VENDA_ESTADUAL_MANUFACTURER = '5101'
export const CFOP_VENDA_INTERESTADUAL_MANUFACTURER = '6101'
/** ST estadual */
export const CFOP_VENDA_ESTADUAL_ST_RESELLER = '5405'
export const CFOP_VENDA_ESTADUAL_ST_MANUFACTURER = '5401'
/** ST interestadual (protocolo) */
export const CFOP_VENDA_INTERESTADUAL_ST = '6105'
export const CFOP_VENDA_INTERESTADUAL_ST_ALT = '6403'

/** @deprecated use CFOP_VENDA_ESTADUAL_RESELLER */
export const CFOP_VENDA_ESTADUAL = CFOP_VENDA_ESTADUAL_RESELLER
/** @deprecated use CFOP_VENDA_INTERESTADUAL_RESELLER */
export const CFOP_VENDA_INTERESTADUAL = CFOP_VENDA_INTERESTADUAL_RESELLER
/** @deprecated use CFOP_VENDA_ESTADUAL_ST_RESELLER */
export const CFOP_VENDA_ESTADUAL_ST = CFOP_VENDA_ESTADUAL_ST_RESELLER

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

/** ST em venda interna: incidência na tabela tax_rules_state (NCM + UF origem). */
export function resolveEstadualHasSt(
  _product: NfeTaxProductInput,
  stateRule?: NfeTaxStateRule | null,
): boolean {
  return Boolean(stateRule?.hasSt)
}

const resolveInterestadualStCfop = (rule?: NfeTaxStateRule | null): string => {
  const cfop = onlyDigits(rule?.cfopSt, 4)
  if (cfop === CFOP_VENDA_INTERESTADUAL_ST_ALT) return CFOP_VENDA_INTERESTADUAL_ST_ALT
  if (cfop === CFOP_VENDA_INTERESTADUAL_ST) return CFOP_VENDA_INTERESTADUAL_ST
  return CFOP_VENDA_INTERESTADUAL_ST
}

const resolveCfopWithoutSt = (
  scope: Exclude<NfeVendaLocalizacao, 'unknown'>,
  businessType: EmpresaBusinessType,
): string => {
  if (scope === 'estadual') {
    return businessType === 'MANUFACTURER'
      ? CFOP_VENDA_ESTADUAL_MANUFACTURER
      : CFOP_VENDA_ESTADUAL_RESELLER
  }
  return businessType === 'MANUFACTURER'
    ? CFOP_VENDA_INTERESTADUAL_MANUFACTURER
    : CFOP_VENDA_INTERESTADUAL_RESELLER
}

const resolveCfopEstadualSt = (businessType: EmpresaBusinessType): string =>
  businessType === 'MANUFACTURER'
    ? CFOP_VENDA_ESTADUAL_ST_MANUFACTURER
    : CFOP_VENDA_ESTADUAL_ST_RESELLER

/**
 * Calcula CSOSN e CFOP para um item da NF-e.
 * @param stateRule Regra de tax_rules_state (ncm + originUf + destinationUf).
 * @param businessType Comércio (5102/6102) ou indústria (5101/6101) quando sem ST.
 */
export function calculateItemTax(
  product: NfeTaxProductInput,
  originUf: string | null | undefined,
  destinationUf: string | null | undefined,
  stateRule?: NfeTaxStateRule | null,
  businessType: EmpresaBusinessType | string | null | undefined = DEFAULT_EMPRESA_BUSINESS_TYPE,
): NfeItemTaxResult {
  const empresaType = normalizeEmpresaBusinessType(businessType)
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
        cfop: resolveCfopEstadualSt(empresaType),
        csosn: CSOSN_ST,
        hasSt: true,
        scope,
        reason: 'estadual_st',
      }
    }
    return {
      cfop: resolveCfopWithoutSt(scope, empresaType),
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
    cfop: resolveCfopWithoutSt(scope, empresaType),
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

/** Chave estável para reavaliar tributação (contagem + NCM por linha). */
export function buildNfeTaxItemsKey(
  items: Array<Pick<NfeTaxProductInput, 'ncm'>>,
): string {
  const body = items.map((it) => normalizeNcm(it.ncm)).join(';')
  return `${items.length}:${body}`
}
