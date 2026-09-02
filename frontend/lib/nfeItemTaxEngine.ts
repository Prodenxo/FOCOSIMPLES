/**
 * Motor de regras tributárias NF-e (CSOSN / CFOP) — Simples Nacional / MEI.
 * 100% dinâmico: qualquer par originUf × destinationUf consulta tax_rules_state.
 * Estadual: regra ST na tabela (NCM + UF origem) → 500/5405; senão 102/5102.
 * Interestadual contribuinte: protocolo ST → 500/6105|6403; senão 102/6102.
 * Interestadual não contribuinte (CPF): ST → 500/6108|6404; senão 102/6108.
 */

import { type NfeVendaLocalizacao, detectNfeVendaLocalizacao } from './nfeEmissaoLeigo'
import { nfeItemRequiresCestFromApi, nfeItemFormRequiresCest } from './stRulesEngine'
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
/** ST interestadual (protocolo) — contribuinte */
export const CFOP_VENDA_INTERESTADUAL_ST = '6105'
export const CFOP_VENDA_INTERESTADUAL_ST_ALT = '6403'
/** Venda interestadual para não contribuinte / consumidor final */
export const CFOP_VENDA_INTERESTADUAL_CONSUMIDOR_RESELLER = '6108'
export const CFOP_VENDA_INTERESTADUAL_CONSUMIDOR_MANUFACTURER = '6107'
/** ST interestadual para não contribuinte com convênio */
export const CFOP_VENDA_INTERESTADUAL_ST_CONSUMIDOR_CONVENIO = '6404'

/** @deprecated use CFOP_VENDA_ESTADUAL_RESELLER */
export const CFOP_VENDA_ESTADUAL = CFOP_VENDA_ESTADUAL_RESELLER
/** @deprecated use CFOP_VENDA_INTERESTADUAL_RESELLER */
export const CFOP_VENDA_INTERESTADUAL = CFOP_VENDA_INTERESTADUAL_RESELLER
/** @deprecated use CFOP_VENDA_ESTADUAL_ST_RESELLER */
export const CFOP_VENDA_ESTADUAL_ST = CFOP_VENDA_ESTADUAL_ST_RESELLER

export type NfeTaxProductInput = {
  ncm?: string | null
  cest?: string | null
  /** CSOSN cadastrado no produto (ex.: 500 = ST). */
  icmsCsosn?: string | null
  csosn?: string | null
  hasSt?: boolean | null
}

/** Regra da tabela tax_rules_state para o par originUf → destinationUf + NCM. */
export type NfeTaxStateRule = {
  hasSt: boolean
  /** CFOP com ST (interestadual: 6105 ou 6403). */
  cfopSt?: string | null
}

/** Contexto fiscal do destinatário para CFOP interestadual. */
export type NfeTaxDestinatarioContext = {
  nonTaxpayer?: boolean | null
  destinatarioDoc?: string | null
  cpfCnpj?: string | null
  indIEDest?: string | null
  inscricaoEstadual?: string | null
}

export type NfeItemTaxResult = {
  cfop: string | null
  csosn: string | null
  hasSt: boolean
  /** Resposta da API (`POST /tax/calculate-items`). */
  has_st?: boolean
  cest?: string | null
  scope: NfeVendaLocalizacao
  reason:
    | 'estadual_st'
    | 'estadual_normal'
    | 'interestadual_st'
    | 'interestadual_normal'
    | 'interestadual_st_consumidor'
    | 'interestadual_normal_consumidor'
    | 'unknown_uf'
}

export { nfeItemRequiresCestFromApi, nfeItemFormRequiresCest } from './stRulesEngine'

const onlyDigits = (value: string | null | undefined, max: number) =>
  String(value ?? '').replace(/\D/g, '').slice(0, max)

export function normalizeNcm(value: string | null | undefined): string {
  return onlyDigits(value, 8)
}

/** ST em venda interna: incidência na tabela tax_rules_state (NCM + UF origem). */
export function productHasCest(product: NfeTaxProductInput): boolean {
  return onlyDigits(product?.cest, 7).length === 7
}

/** @deprecated Não usar na determinação tributária — ST vem só de tax_rules_state. */
export function productHasStTaxation(product: NfeTaxProductInput): boolean {
  if (product?.hasSt === true) return true
  const csosn = onlyDigits(product?.icmsCsosn ?? product?.csosn, 3)
  if (csosn === CSOSN_ST) return true
  return productHasCest(product)
}

/** ST somente quando o NCM consta na tabela explícita (tax_rules_state) da UF emitente. */
export function resolveItemHasSt(
  _product: NfeTaxProductInput,
  stateRule?: NfeTaxStateRule | null,
): boolean {
  return Boolean(stateRule?.hasSt === true)
}

export function resolveEstadualHasSt(
  product: NfeTaxProductInput,
  stateRule?: NfeTaxStateRule | null,
): boolean {
  return resolveItemHasSt(product, stateRule)
}

/** CPF, indIEDest 9/2 ou CNPJ sem IE de contribuinte. */
export function resolveDestinatarioNonTaxpayer(
  context: NfeTaxDestinatarioContext | null | undefined = {},
): boolean {
  const ctx = context ?? {}
  if (ctx.nonTaxpayer === true) return true
  if (ctx.nonTaxpayer === false) return false

  const doc = onlyDigits(ctx.destinatarioDoc ?? ctx.cpfCnpj, 14)
  const ind = String(ctx.indIEDest ?? '').trim()
  const ie = onlyDigits(ctx.inscricaoEstadual, 14)

  if (doc.length === 11) return true
  if (ind === '9' || ind === '2') return true
  if (doc.length === 14 && ind !== '1') return true
  if (doc.length === 14 && ind === '1' && !ie) return true
  return false
}

const resolveInterestadualStCfop = (rule?: NfeTaxStateRule | null): string => {
  const cfop = onlyDigits(rule?.cfopSt, 4)
  if (cfop === CFOP_VENDA_INTERESTADUAL_ST_ALT) return CFOP_VENDA_INTERESTADUAL_ST_ALT
  if (cfop === CFOP_VENDA_INTERESTADUAL_ST) return CFOP_VENDA_INTERESTADUAL_ST
  return CFOP_VENDA_INTERESTADUAL_ST
}

const hasInterestadualStConvenio = (rule?: NfeTaxStateRule | null): boolean => {
  const cfop = onlyDigits(rule?.cfopSt, 4)
  return cfop === CFOP_VENDA_INTERESTADUAL_ST_ALT
    || cfop === CFOP_VENDA_INTERESTADUAL_ST_CONSUMIDOR_CONVENIO
}

const resolveInterestadualNonTaxpayerCfop = (
  hasSt: boolean,
  rule: NfeTaxStateRule | null | undefined,
  businessType: EmpresaBusinessType,
): string => {
  if (hasSt) {
    if (hasInterestadualStConvenio(rule)) {
      return CFOP_VENDA_INTERESTADUAL_ST_CONSUMIDOR_CONVENIO
    }
    return CFOP_VENDA_INTERESTADUAL_CONSUMIDOR_RESELLER
  }
  return businessType === 'MANUFACTURER'
    ? CFOP_VENDA_INTERESTADUAL_CONSUMIDOR_MANUFACTURER
    : CFOP_VENDA_INTERESTADUAL_CONSUMIDOR_RESELLER
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
 * @param destinatarioContext CPF/não contribuinte → CFOP 6108 interestadual.
 */
export function calculateItemTax(
  product: NfeTaxProductInput,
  originUf: string | null | undefined,
  destinationUf: string | null | undefined,
  stateRule?: NfeTaxStateRule | null,
  businessType: EmpresaBusinessType | string | null | undefined = DEFAULT_EMPRESA_BUSINESS_TYPE,
  destinatarioContext?: NfeTaxDestinatarioContext | null,
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
    const hasSt = resolveItemHasSt(product, stateRule)
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

  const hasSt = resolveItemHasSt(product, stateRule)
  const nonTaxpayer = resolveDestinatarioNonTaxpayer(destinatarioContext)

  if (hasSt) {
    const cfop = nonTaxpayer
      ? resolveInterestadualNonTaxpayerCfop(true, stateRule, empresaType)
      : resolveInterestadualStCfop(stateRule)
    return {
      cfop,
      csosn: CSOSN_ST,
      hasSt: true,
      scope,
      reason: nonTaxpayer ? 'interestadual_st_consumidor' : 'interestadual_st',
    }
  }

  if (nonTaxpayer) {
    return {
      cfop: resolveInterestadualNonTaxpayerCfop(false, stateRule, empresaType),
      csosn: CSOSN_TRIBUTADO_SN,
      hasSt: false,
      scope,
      reason: 'interestadual_normal_consumidor',
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

/** Sanitiza retorno de `/tax/calculate-items`: sem ST → 102, has_st false, cest null. */
export function sanitizeItemTaxApiResult(
  tax: NfeItemTaxResult,
  product?: Pick<NfeTaxProductInput, 'cest'> | null,
): NfeItemTaxResult & { has_st: boolean; cest: string | null } {
  const csosn = onlyDigits(tax?.csosn, 3)
  const isSt = nfeItemRequiresCestFromApi({ has_st: tax?.hasSt ?? tax?.has_st, csosn })

  if (!isSt) {
    return {
      cfop: tax?.cfop ?? null,
      csosn: CSOSN_TRIBUTADO_SN,
      hasSt: false,
      has_st: false,
      cest: null,
      scope: tax?.scope ?? 'unknown',
      reason: tax?.reason ?? 'estadual_normal',
    }
  }

  const cestDigits = onlyDigits(product?.cest, 7)
  return {
    cfop: tax?.cfop ?? null,
    csosn: CSOSN_ST,
    hasSt: true,
    has_st: true,
    cest: cestDigits.length === 7 ? cestDigits : null,
    scope: tax?.scope ?? 'unknown',
    reason: tax?.reason ?? 'estadual_st',
  }
}

export type NfeItemTaxFormSlice = {
  cfop: string
  cest?: string
  tributos: {
    icms: { csosn: string; cst: string }
  }
}

const formIcmsCsosn = (icms: { csosn?: string; cst?: string }) =>
  onlyDigits(icms?.csosn, 3)

/** CSOSN efetivo do item no formulário — ST somente quando API confirmou has_st + csosn 500. */
export function nfeItemFormCsosnIsSt(
  item: Pick<NfeItemTaxFormSlice, 'tributos'> & { fiscalHasSt?: boolean },
): boolean {
  if (typeof item.fiscalHasSt === 'boolean') {
    return nfeItemFormRequiresCest(item)
  }
  const icms = item.tributos?.icms ?? { csosn: '', cst: '' }
  return formIcmsCsosn(icms) === CSOSN_ST
}

/** Limpa CEST e flags de ST legadas antes de emitir ou mapear para PlugNotas. */
export function sanitizeNfeItemFormForEmit<T extends NfeItemTaxFormSlice & { cest?: string }>(
  item: T,
): T {
  const icms = item.tributos?.icms ?? { csosn: '', cst: '' }
  const csosn = formIcmsCsosn(icms)
  const isSt = csosn === CSOSN_ST
  const nextCsosn = isSt ? CSOSN_ST : (csosn || CSOSN_TRIBUTADO_SN)
  return {
    ...item,
    cest: isSt ? (item.cest ?? '') : '',
    tributos: {
      ...item.tributos,
      icms: {
        ...icms,
        csosn: nextCsosn,
        cst: '',
      },
    },
  }
}

/** Aplica resultado do motor no item do formulário (preserva edições manuais de outros campos). */
export function applyItemTaxResultToNfeItem<T extends NfeItemTaxFormSlice & { cest?: string; fiscalHasSt?: boolean }>(
  item: T,
  tax: NfeItemTaxResult,
): T {
  if (!tax.cfop || !tax.csosn) return item
  const isSt = nfeItemRequiresCestFromApi({
    has_st: tax.has_st ?? tax.hasSt,
    csosn: tax.csosn,
  })
  const next: T = {
    ...item,
    cfop: tax.cfop,
    fiscalHasSt: isSt,
    cest: isSt ? (tax.cest?.trim() || item.cest || '') : '',
    tributos: {
      ...item.tributos,
      icms: {
        ...item.tributos.icms,
        csosn: isSt ? CSOSN_ST : CSOSN_TRIBUTADO_SN,
        cst: '',
      },
    },
  }
  return next
}

/** Chave estável para reavaliar tributação (contagem + NCM por linha). */
export function buildNfeTaxItemsKey(
  items: Array<Pick<NfeTaxProductInput, 'ncm'>>,
): string {
  const body = items.map((it) => normalizeNcm(it.ncm)).join(';')
  return `${items.length}:${body}`
}
