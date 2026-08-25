import type { ProductFiscalUiStatus } from './types'

export const PRIOR_ST_STATUS_OPTIONS = [
  { value: 'RETAINED', label: 'ICMS-ST já retido anteriormente' },
  { value: 'NO_ST_EVIDENCE', label: 'Sem evidência de ST anterior' },
  { value: 'UNKNOWN', label: 'Não confirmado' },
] as const

export const ITEM_SOURCE_OPTIONS = [
  { value: 'THIRD_PARTY', label: 'Mercadoria de terceiros (revenda)' },
  { value: 'OWN_PRODUCTION', label: 'Produção própria' },
  { value: 'UNKNOWN', label: 'Não confirmado' },
] as const

export const ORIGEM_MERCADORIA_OPTIONS = [
  { value: '0', label: '0 — Nacional' },
  { value: '1', label: '1 — Estrangeira (importação direta)' },
  { value: '2', label: '2 — Estrangeira (mercado interno)' },
  { value: '3', label: '3 — Nacional (> 40% conteúdo importado)' },
  { value: '4', label: '4 — Nacional (processos produtivos básicos)' },
  { value: '5', label: '5 — Nacional (< 40% conteúdo importado)' },
  { value: '6', label: '6 — Estrangeira (importação direta, sem similar)' },
  { value: '7', label: '7 — Estrangeira (mercado interno, sem similar)' },
  { value: '8', label: '8 — Nacional (> 70% conteúdo importado)' },
] as const

export const OPERATION_TYPE_OPTIONS = [{ value: 'VENDA', label: 'Venda' }] as const

export const SCENARIO_APPLIES_OPTIONS = [
  { value: 'INTERNAL', label: 'Venda interna' },
  { value: 'INTERSTATE_ANY', label: 'Venda interestadual (qualquer UF)' },
  { value: 'INTERSTATE_UF', label: 'Venda interestadual — UF específica' },
  { value: 'FOREIGN', label: 'Exportação / exterior' },
] as const

export const OPERATION_SCOPE_OPTIONS = [
  { value: 'INTERNAL', label: 'Interna (mesma UF)' },
  { value: 'INTERSTATE', label: 'Interestadual' },
  { value: 'FOREIGN', label: 'Exterior' },
] as const

export const RECIPIENT_TAXPAYER_OPTIONS = [
  { value: 'NON_TAXPAYER', label: 'Não contribuinte ICMS' },
  { value: 'TAXPAYER', label: 'Contribuinte ICMS' },
  { value: 'EXEMPT', label: 'Isento' },
  { value: 'UNKNOWN', label: 'Não confirmado' },
] as const

export const RECIPIENT_TAXPAYER_CONDITION_OPTIONS = [
  { value: 'ANY', label: 'Qualquer destinatário' },
  ...RECIPIENT_TAXPAYER_OPTIONS.filter((o) => o.value !== 'UNKNOWN'),
] as const

export const FINAL_CONSUMER_OPTIONS = [
  { value: 'YES', label: 'Consumidor final' },
  { value: 'NO', label: 'Não consumidor final' },
  { value: 'UNKNOWN', label: 'Não confirmado' },
] as const

export const FINAL_CONSUMER_CONDITION_OPTIONS = [
  { value: 'ANY', label: 'Qualquer' },
  { value: 'YES', label: 'Somente consumidor final' },
  { value: 'NO', label: 'Somente não consumidor final' },
] as const

export const PIS_COFINS_MODE_OPTIONS = [
  { value: 'OUTR_ZERO', label: 'Outras — zero explícito' },
  { value: 'NT', label: 'Não tributado' },
  { value: 'ALIQ_PERCENT', label: 'Alíquota percentual' },
  { value: 'QTDE', label: 'Por quantidade' },
] as const

export const CURRENT_OPERATION_ST_OPTIONS = [
  { value: 'NOT_DUE', label: 'ST não devida nesta operação' },
  { value: 'DUE_BY_ISSUER', label: 'ST devida pelo emitente' },
  { value: 'RETAINED', label: 'ST retida' },
  { value: 'UNKNOWN', label: 'Não confirmado' },
] as const

export const FISCAL_STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Todos os status' },
  { value: 'READY', label: 'Prontos' },
  { value: 'PENDENTE', label: 'Pendentes' },
  { value: 'INCOMPLETO', label: 'Incompletos' },
  { value: 'BLOQUEADO', label: 'Bloqueados' },
] as const

export function labelPriorStStatus(value: string | null | undefined): string {
  return PRIOR_ST_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value ?? '—'
}

export function labelItemSource(value: string | null | undefined): string {
  return ITEM_SOURCE_OPTIONS.find((o) => o.value === value)?.label ?? value ?? '—'
}

export function labelFiscalUiStatus(status: ProductFiscalUiStatus): string {
  switch (status) {
    case 'READY':
      return 'Pronto'
    case 'PENDENTE':
      return 'Pendente'
    case 'INCOMPLETO':
      return 'Incompleto'
    case 'BLOQUEADO':
      return 'Bloqueado'
    default:
      return status
  }
}

export function fiscalStatusTone(status: ProductFiscalUiStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'READY':
      return 'success'
    case 'PENDENTE':
      return 'warning'
    case 'INCOMPLETO':
      return 'neutral'
    case 'BLOQUEADO':
      return 'danger'
    default:
      return 'neutral'
  }
}

export function labelRuleStatus(status: string | null | undefined): string {
  switch (status) {
    case 'DRAFT':
      return 'Rascunho'
    case 'APPROVED':
      return 'Aprovada'
    case 'SUSPENDED':
      return 'Suspensa'
    case 'REVOKED':
      return 'Revogada'
    case 'EXPIRED':
      return 'Expirada'
    default:
      return status ?? '—'
  }
}

export function formatCapabilityMessage(
  capability?: { executable?: boolean; issues?: Array<{ message?: string }> } | null,
): string | null {
  if (!capability || capability.executable !== false) return null
  const first = capability.issues?.[0]?.message
  return first ?? 'Esta combinação fiscal ainda não é executável pelo motor de NF-e.'
}
