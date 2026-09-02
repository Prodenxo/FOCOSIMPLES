import type {
  AccountantApprovedRule,
  AccountantRuleStatus,
  ProductFiscalUiStatus,
  RulePreviewResult,
} from './types'

const BLOCKED_RULE_STATUSES: AccountantRuleStatus[] = ['SUSPENDED', 'REVOKED', 'EXPIRED']

export function ruleMatchesEstablishment(
  rule: AccountantApprovedRule,
  establishmentId: string,
): boolean {
  const ruleEst = String(rule.establishmentId ?? '').replace(/\D/g, '')
  const currentEst = String(establishmentId ?? '').replace(/\D/g, '')
  if (!ruleEst) return true
  return ruleEst === currentEst
}

export function ruleMatchesProduct(
  rule: AccountantApprovedRule,
  productId: string,
  fiscalProductGroupId: string | null,
): boolean {
  const conditions = rule.conditions ?? {}
  const productIds = Array.isArray(conditions.productId) ? conditions.productId.map(String) : []
  if (productIds.includes(productId)) return true
  if (!fiscalProductGroupId) return false
  const groupIds = Array.isArray(conditions.fiscalProductGroupId)
    ? conditions.fiscalProductGroupId.map(String)
    : []
  return groupIds.includes(fiscalProductGroupId)
}

export function findRulesForProductAtEstablishment(
  rules: AccountantApprovedRule[],
  productId: string,
  fiscalProductGroupId: string | null,
  establishmentId: string,
): AccountantApprovedRule[] {
  return rules
    .filter((rule) => ruleMatchesEstablishment(rule, establishmentId))
    .filter((rule) => ruleMatchesProduct(rule, productId, fiscalProductGroupId))
    .sort((a, b) => {
      if (a.status === 'APPROVED' && b.status !== 'APPROVED') return -1
      if (b.status === 'APPROVED' && a.status !== 'APPROVED') return 1
      return (b.version ?? 0) - (a.version ?? 0)
    })
}

export function deriveProductFiscalUiStatus(
  rules: AccountantApprovedRule[],
  preview: RulePreviewResult | null | undefined,
): ProductFiscalUiStatus {
  const primary = rules[0]
  if (!primary) return 'PENDENTE'

  if (BLOCKED_RULE_STATUSES.includes(primary.status)) return 'BLOQUEADO'

  if (primary.status === 'APPROVED') return 'READY'

  if (primary.status === 'DRAFT') {
    if (preview?.capability?.executable === false || preview?.validation?.ok === false) {
      return 'BLOQUEADO'
    }
    return 'INCOMPLETO'
  }

  return 'PENDENTE'
}

export function pickPrimaryRule(
  rules: AccountantApprovedRule[],
): AccountantApprovedRule | null {
  return rules[0] ?? null
}

const normalizeEstablishmentDigits = (value: string | null | undefined): string =>
  String(value ?? '').replace(/\D/g, '')

/** Preserva CNPJ válido após reload; senão seleciona o primeiro disponível. */
export function resolveEstablishmentSelection(
  currentEstablishmentId: string,
  establishments: Array<{ establishmentId: string }>,
): string {
  const current = normalizeEstablishmentDigits(currentEstablishmentId)
  if (current) {
    const match = establishments.find(
      (entry) => normalizeEstablishmentDigits(entry.establishmentId) === current,
    )
    if (match) return match.establishmentId
  }
  return establishments[0]?.establishmentId ?? ''
}
