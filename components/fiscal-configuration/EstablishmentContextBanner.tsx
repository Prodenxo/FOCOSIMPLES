import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { formatCpfCnpjInput } from '@/lib/meiFormatters'
import { useMfTheme } from '@/components/ui/useMfTheme'
import { mfRadius, mfSpacing, mfTypography } from '@/lib/theme'

type Props = {
  establishmentId?: string | null
  establishmentLabel?: string | null
  issuerUf?: string | null
  clientLabel?: string | null
}

export function EstablishmentContextBanner({
  establishmentId,
  establishmentLabel,
  issuerUf,
  clientLabel,
}: Props) {
  const { theme } = useMfTheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: mfRadius.md,
          padding: mfSpacing.md,
          gap: mfSpacing.xs,
          backgroundColor: theme.backgroundMuted ?? theme.surface,
        },
        title: { ...mfTypography.caption, color: theme.textSecondary, fontWeight: '700' },
        line: { ...mfTypography.body, color: theme.text },
        hint: { ...mfTypography.caption, color: theme.textSecondary },
      }),
    [theme],
  )

  if (!establishmentId) return null

  const cnpj = formatCpfCnpjInput(String(establishmentId).replace(/\D/g, ''))
  const uf = String(issuerUf ?? '').trim().toUpperCase()
  const label = establishmentLabel && establishmentLabel !== establishmentId
    ? establishmentLabel
    : clientLabel ?? null

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Contexto do estabelecimento emissor</Text>
      <Text style={styles.line}>
        {label ? `${label} — ` : ''}{cnpj}{uf ? ` — ${uf}` : ''}
      </Text>
      <Text style={styles.hint}>
        A UF emitente vem do perfil fiscal do estabelecimento e é definida automaticamente na emissão.
        Não é necessário repetir RJ/RJ em cada cenário.
      </Text>
    </View>
  )
}
