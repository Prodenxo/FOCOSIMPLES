import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useMfTheme } from '@/components/ui/useMfTheme'
import {
  findGroupRulesAtEstablishment,
  findProductSpecificRulesAtEstablishment,
} from '@/lib/fiscalConfiguration/fiscalGroupUi'
import { labelRuleStatus } from '@/lib/fiscalConfiguration/labels'
import type { AccountantApprovedRule } from '@/lib/fiscalConfiguration/types'
import { mfRadius, mfSpacing, mfTypography } from '@/lib/theme'

type Props = {
  productId: string | null
  fiscalProductGroupId: string | null
  fiscalProductGroupName: string | null
  establishmentId: string | null
  rules: AccountantApprovedRule[]
}

export function FiscalGroupInheritanceBanner({
  productId,
  fiscalProductGroupId,
  fiscalProductGroupName,
  establishmentId,
  rules,
}: Props) {
  const { theme } = useMfTheme()

  const productRules = productId && establishmentId
    ? findProductSpecificRulesAtEstablishment(rules, productId, establishmentId)
    : []
  const groupRules = fiscalProductGroupId && establishmentId
    ? findGroupRulesAtEstablishment(rules, fiscalProductGroupId, establishmentId)
    : []

  const hasProductSpecific = productRules.length > 0
  const hasGroupRules = groupRules.length > 0

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: mfRadius.md,
          padding: mfSpacing.md,
          backgroundColor: theme.backgroundMuted,
          gap: mfSpacing.sm,
        },
        title: { ...mfTypography.caption, color: theme.text, fontWeight: '700' },
        line: { ...mfTypography.caption, color: theme.textSecondary },
        highlight: { color: theme.text, fontWeight: '600' },
      }),
    [theme],
  )

  if (!fiscalProductGroupId && !hasProductSpecific) return null

  return (
    <View style={styles.wrap}>
      {fiscalProductGroupId ? (
        <>
          <Text style={styles.title}>Grupo fiscal: {fiscalProductGroupName ?? '—'}</Text>
          {hasGroupRules ? (
            <>
              <Text style={styles.line}>
                Tratamento fiscal: <Text style={styles.highlight}>Configurado pelo grupo</Text>
              </Text>
              <Text style={styles.line}>Cenários do grupo:</Text>
              {groupRules.map((rule) => (
                <Text key={rule.id} style={styles.line}>
                  • {rule.name ?? 'Sem nome'} — {labelRuleStatus(rule.status)}
                </Text>
              ))}
            </>
          ) : (
            <Text style={styles.line}>
              Nenhum cenário fiscal cadastrado para este grupo neste estabelecimento.
            </Text>
          )}
        </>
      ) : null}

      {hasProductSpecific ? (
        <Text style={styles.line}>
          <Text style={styles.highlight}>Este produto possui configuração fiscal específica</Text>
          {' '}({productRules.length} cenário{productRules.length === 1 ? '' : 's'}).
          {hasGroupRules ? ' Regras do produto têm precedência sobre o grupo quando ambas se aplicam.' : ''}
        </Text>
      ) : null}
    </View>
  )
}
