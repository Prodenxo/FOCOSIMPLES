import type { AccountantApprovedRule } from './types'
import { ruleMatchesEstablishment } from './productFiscalStatus'

export const FISCAL_GROUP_CREATE_OPTION = '__CREATE_FISCAL_GROUP__'

export function isGroupScopedRule(rule: AccountantApprovedRule): boolean {
  const groupIds = Array.isArray(rule.conditions?.fiscalProductGroupId)
    ? rule.conditions!.fiscalProductGroupId!.map(String)
    : []
  const productIds = Array.isArray(rule.conditions?.productId)
    ? rule.conditions!.productId!.map(String)
    : []
  return groupIds.length > 0 && productIds.length === 0
}

export function isProductSpecificRule(rule: AccountantApprovedRule, productId: string): boolean {
  const productIds = Array.isArray(rule.conditions?.productId)
    ? rule.conditions!.productId!.map(String)
    : []
  return productIds.includes(productId)
}

export function findGroupRulesAtEstablishment(
  rules: AccountantApprovedRule[],
  fiscalProductGroupId: string,
  establishmentId: string,
): AccountantApprovedRule[] {
  return rules
    .filter((rule) => ruleMatchesEstablishment(rule, establishmentId))
    .filter((rule) => isGroupScopedRule(rule))
    .filter((rule) => {
      const groupIds = Array.isArray(rule.conditions?.fiscalProductGroupId)
        ? rule.conditions!.fiscalProductGroupId!.map(String)
        : []
      return groupIds.includes(fiscalProductGroupId)
    })
}

export function findProductSpecificRulesAtEstablishment(
  rules: AccountantApprovedRule[],
  productId: string,
  establishmentId: string,
): AccountantApprovedRule[] {
  return rules
    .filter((rule) => ruleMatchesEstablishment(rule, establishmentId))
    .filter((rule) => isProductSpecificRule(rule, productId))
}

export function formatProductCount(count: number): string {
  if (count === 1) return '1 produto'
  return `${count} produtos`
}
