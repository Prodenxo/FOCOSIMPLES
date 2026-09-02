import React, { useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMfTheme } from '@/components/ui/useMfTheme'
import { formatCpfCnpjInput } from '@/lib/meiFormatters'
import { mfRadius, mfSpacing, mfTypography } from '@/lib/theme'

type ClientOption = {
  empresaId: string
  label: string
}

type EstablishmentOption = {
  establishmentId: string
  label?: string
}

type Props = {
  clientLabel: string | null
  clients?: ClientOption[]
  selectedClientId?: string | null
  onSelectClient?: (empresaId: string) => void
  showClientPicker?: boolean
  establishments?: EstablishmentOption[]
  selectedEstablishmentId?: string | null
  onSelectEstablishment?: (establishmentId: string) => void
  showEstablishmentPicker?: boolean
}

export function EstablishmentContextBar({
  clientLabel,
  clients = [],
  selectedClientId,
  onSelectClient,
  showClientPicker = false,
  establishments = [],
  selectedEstablishmentId,
  onSelectEstablishment,
  showEstablishmentPicker = false,
}: Props) {
  const { theme } = useMfTheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: mfRadius.lg,
          padding: mfSpacing.lg,
          backgroundColor: theme.surface,
          gap: mfSpacing.md,
        },
        block: { gap: mfSpacing.sm },
        label: { ...mfTypography.caption, color: theme.textSecondary, fontWeight: '600' },
        title: { ...mfTypography.subtitle, color: theme.text },
        meta: { ...mfTypography.body, color: theme.textSecondary },
        pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: mfSpacing.sm },
        chip: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: mfRadius.pill,
          paddingHorizontal: mfSpacing.md,
          paddingVertical: mfSpacing.xs,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        chipActive: { borderColor: theme.primary, backgroundColor: theme.backgroundMuted },
        chipText: { ...mfTypography.caption, color: theme.text },
      }),
    [theme],
  )

  const establishmentLabel = selectedEstablishmentId
    ? formatCpfCnpjInput(selectedEstablishmentId.replace(/\D/g, ''))
    : null

  return (
    <View style={styles.card}>
      <View style={styles.block}>
        <Text style={styles.label}>Cliente</Text>
        <Text style={styles.title}>{clientLabel ?? 'Selecione um cliente'}</Text>
        {showClientPicker && clients.length > 0 ? (
          <View style={styles.pickerRow}>
            {clients.map((client) => {
              const active = client.empresaId === selectedClientId
              return (
                <TouchableOpacity
                  key={client.empresaId}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => onSelectClient?.(client.empresaId)}
                  accessibilityRole="button"
                >
                  {active ? <Ionicons name="checkmark-circle" size={14} color={theme.primary} /> : null}
                  <Text style={styles.chipText}>{client.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        ) : null}
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>Estabelecimento fiscal</Text>
        <Text style={styles.meta}>
          {establishmentLabel ?? 'Selecione um CNPJ para visualizar a configuração fiscal.'}
        </Text>
        {showEstablishmentPicker && establishments.length > 0 ? (
          <View style={styles.pickerRow}>
            {establishments.map((est) => {
              const active = est.establishmentId === selectedEstablishmentId
              const label = formatCpfCnpjInput(est.establishmentId.replace(/\D/g, ''))
              return (
                <TouchableOpacity
                  key={est.establishmentId}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => onSelectEstablishment?.(est.establishmentId)}
                  accessibilityRole="button"
                >
                  {active ? <Ionicons name="checkmark-circle" size={14} color={theme.primary} /> : null}
                  <Text style={styles.chipText}>{label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        ) : null}
      </View>
    </View>
  )
}
