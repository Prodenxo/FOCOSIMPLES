import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { FiscalConfigSelectField } from '@/components/fiscal-configuration/FiscalConfigSelectField'
import { useMfTheme } from '@/components/ui/useMfTheme'
import { formatCpfCnpjInput } from '@/lib/meiFormatters'
import { mfSpacing, mfTypography } from '@/lib/theme'
import type { AccountantEstablishment } from '@/services/accountantClientsService'

const PLACEHOLDER = '__none__'

type Props = {
  establishments: AccountantEstablishment[]
  selectedEstablishmentId: string | null
  onSelectEstablishment: (establishmentId: string) => void
  disabled?: boolean
  establishmentStatus?: 'OK' | 'NO_FISCAL_ESTABLISHMENT' | null
  clientLabel?: string | null
}

function buildEstablishmentLabel(
  est: AccountantEstablishment,
  clientLabel?: string | null,
): string {
  const cnpjFormatted = formatCpfCnpjInput(est.establishmentId.replace(/\D/g, ''))
  const raw = String(est.label ?? '').trim()
  const labelDigits = raw.replace(/\D/g, '')
  const estDigits = est.establishmentId.replace(/\D/g, '')
  const labelIsBareCnpj = !raw || labelDigits === estDigits

  if (clientLabel && labelIsBareCnpj) {
    return `${clientLabel} — ${cnpjFormatted}`
  }
  if (labelIsBareCnpj) return cnpjFormatted
  return raw
}

export function FiscalEstablishmentSelectField({
  establishments,
  selectedEstablishmentId,
  onSelectEstablishment,
  disabled = false,
  establishmentStatus,
  clientLabel,
}: Props) {
  const { theme } = useMfTheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        alert: { ...mfTypography.caption, color: theme.warning ?? '#b45309' },
      }),
    [theme],
  )

  const options = useMemo(
    () => [
      { value: PLACEHOLDER, label: 'Selecione o CNPJ…', menuHidden: true },
      ...establishments.map((est) => ({
        value: est.establishmentId,
        label: buildEstablishmentLabel(est, clientLabel),
      })),
    ],
    [clientLabel, establishments],
  )

  if (establishmentStatus === 'NO_FISCAL_ESTABLISHMENT') {
    return (
      <View style={{ gap: mfSpacing.xs }}>
        <Text style={{ ...mfTypography.caption, color: theme.textSecondary, fontWeight: '600' }}>
          Estabelecimento fiscal *
        </Text>
        <Text style={styles.alert}>
          Este cliente ainda não tem certificado A1 válido com CNPJ e regime tributário (CRT).
          Peça para importar o certificado digital antes de configurar os impostos do produto.
        </Text>
      </View>
    )
  }

  return (
    <FiscalConfigSelectField
      label="Estabelecimento fiscal *"
      value={selectedEstablishmentId ?? PLACEHOLDER}
      options={options}
      onChange={(value) => {
        if (value !== PLACEHOLDER) onSelectEstablishment(value)
      }}
      disabled={disabled || establishments.length === 0}
      helpText="Cenários fiscais variam por CNPJ. O produto comercial pertence ao cliente."
    />
  )
}
