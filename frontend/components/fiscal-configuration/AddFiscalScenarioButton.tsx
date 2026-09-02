import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMfTheme } from '@/components/ui/useMfTheme'
import { SCENARIO_APPLIES_OPTIONS } from '@/lib/fiscalConfiguration/labels'
import type { ScenarioAppliesKind } from '@/lib/fiscalConfiguration/scenarioApplicationUi'
import { mfRadius, mfSpacing, mfTypography } from '@/lib/theme'

type Props = {
  disabled?: boolean
  onAdd: (scenarioApplies: ScenarioAppliesKind) => void
}

export function AddFiscalScenarioButton({ disabled = false, onAdd }: Props) {
  const { theme, isDarkMode } = useMfTheme()
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  const styles = useMemo(
    () =>
      StyleSheet.create({
        addBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: mfSpacing.xs,
          alignSelf: 'flex-start',
          paddingVertical: mfSpacing.xs,
        },
        addText: { ...mfTypography.body, color: theme.primary, fontWeight: '600' },
        backdrop: {
          flex: 1,
          backgroundColor: Platform.OS === 'web' ? 'rgba(15, 23, 42, 0.35)' : 'rgba(0,0,0,0.45)',
          justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
          alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
          padding: Platform.OS === 'web' ? mfSpacing.lg : 0,
        },
        dialog: {
          width: Platform.OS === 'web' ? 420 : undefined,
          maxWidth: '100%',
          backgroundColor: theme.surface,
          borderRadius: Platform.OS === 'web' ? mfRadius.lg : mfRadius.xl,
          borderTopLeftRadius: mfRadius.xl,
          borderTopRightRadius: mfRadius.xl,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
          overflow: 'hidden',
          ...(Platform.OS === 'web'
            ? {
                boxShadow: isDarkMode
                  ? '0 24px 64px rgba(0,0,0,0.5)'
                  : '0 24px 48px rgba(15, 23, 42, 0.16)',
              }
            : {}),
        },
        header: {
          paddingHorizontal: mfSpacing.lg,
          paddingTop: mfSpacing.lg,
          paddingBottom: mfSpacing.sm,
          gap: mfSpacing.xs,
        },
        title: { ...mfTypography.bodyStrong, color: theme.text, fontSize: 17 },
        subtitle: { ...mfTypography.caption, color: theme.textSecondary, lineHeight: 18 },
        option: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: mfSpacing.sm,
          paddingHorizontal: mfSpacing.lg,
          paddingVertical: mfSpacing.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.border,
        },
        optionBody: { flex: 1, gap: 2 },
        optionTitle: { ...mfTypography.bodyStrong, color: theme.text },
        optionHint: { ...mfTypography.caption, color: theme.textSecondary },
        cancelBtn: {
          margin: mfSpacing.lg,
          marginTop: mfSpacing.sm,
          paddingVertical: mfSpacing.sm + 2,
          alignItems: 'center',
          borderRadius: mfRadius.md,
          backgroundColor: theme.backgroundMuted,
        },
        cancelText: { ...mfTypography.body, color: theme.textSecondary, fontWeight: '600' },
      }),
    [isDarkMode, theme],
  )

  const optionHints: Record<ScenarioAppliesKind, string> = {
    INTERNAL: 'Mesma UF do emitente — ex.: CFOP 5102',
    INTERSTATE_ANY: 'Qualquer UF destino diferente da emitente',
    INTERSTATE_UF: 'Somente para uma UF destino específica',
    FOREIGN: 'Exportação ou operação com exterior',
  }

  return (
    <>
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Adicionar cenário fiscal"
      >
        <Ionicons name="add" size={18} color={theme.primary} />
        <Text style={styles.addText}>Adicionar cenário fiscal</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Text style={styles.title}>Qual cenário adicionar?</Text>
              <Text style={styles.subtitle}>
                Cada cenário define um tratamento fiscal para uma situação de venda diferente.
              </Text>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {SCENARIO_APPLIES_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.option}
                  onPress={() => {
                    onAdd(option.value as ScenarioAppliesKind)
                    close()
                  }}
                  accessibilityRole="button"
                >
                  <Ionicons name="git-branch-outline" size={20} color={theme.primary} />
                  <View style={styles.optionBody}>
                    <Text style={styles.optionTitle}>{option.label}</Text>
                    <Text style={styles.optionHint}>
                      {optionHints[option.value as ScenarioAppliesKind]}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.cancelBtn} onPress={close} accessibilityRole="button">
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}
