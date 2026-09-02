import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Theme } from '../../lib/theme'
import { mfSpacing } from '../../lib/theme'
import type { ContaFinanceira } from '../../lib/contaFinanceiraTypes'
import { BankIcon } from './BankIcon'

type Props = {
  theme: Theme
  label?: string
  contas: ContaFinanceira[]
  value: string | null
  onChange: (contaId: string | null) => void
  optional?: boolean
  compact?: boolean
}

export function ContaPickerField({
  theme,
  label = 'Conta',
  contas,
  value,
  onChange,
  optional = true,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const styles = createStyles(theme, compact)

  if (contas.length === 0) return null

  const selected = contas.find((c) => c.id === value)

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {optional ? ' (opcional)' : ''}
      </Text>
      <TouchableOpacity
        style={styles.field}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
      >
        {selected ? (
          <BankIcon
            instituicaoId={selected.instituicao_id}
            nome={selected.nome}
            cor={selected.cor}
            size={22}
          />
        ) : (
          <Ionicons name="card-outline" size={16} color={theme.primary} />
        )}
        <Text style={[styles.fieldText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected?.nome || (optional ? 'Sem conta vinculada' : 'Selecione a conta')}
        </Text>
        <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Vincular à conta</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Ionicons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetList}>
              {optional ? (
                <TouchableOpacity
                  style={[styles.item, !value && styles.itemSelected]}
                  onPress={() => {
                    onChange(null)
                    setOpen(false)
                  }}
                >
                  <Text style={styles.itemText}>Sem conta</Text>
                </TouchableOpacity>
              ) : null}
              {contas.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.item, value === c.id && styles.itemSelected]}
                  onPress={() => {
                    onChange(c.id)
                    setOpen(false)
                  }}
                >
                  <BankIcon
                    instituicaoId={c.instituicao_id}
                    nome={c.nome}
                    cor={c.cor}
                    size={28}
                  />
                  <Text style={styles.itemText}>{c.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

function createStyles(theme: Theme, compact: boolean) {
  return StyleSheet.create({
    wrap: { gap: 6, marginBottom: compact ? mfSpacing.sm : mfSpacing.md },
    label: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: compact ? 10 : 12,
      backgroundColor: theme.inputBackground ?? theme.background,
    },
    fieldText: { flex: 1, fontSize: 15, color: theme.text },
    placeholder: { color: theme.placeholder },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      padding: mfSpacing.lg,
    },
    sheet: {
      backgroundColor: theme.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      maxHeight: '70%',
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: mfSpacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    sheetTitle: { fontSize: 16, fontWeight: '600', color: theme.text },
    sheetList: { maxHeight: 360 },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: mfSpacing.lg,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    itemSelected: { backgroundColor: theme.primaryLight },
    itemText: { fontSize: 15, color: theme.text },
    dot: { width: 10, height: 10, borderRadius: 5 },
  })
}
