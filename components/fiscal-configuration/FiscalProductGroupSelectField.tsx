import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMfTheme } from '@/components/ui/useMfTheme'
import {
  FISCAL_GROUP_CREATE_OPTION,
  formatProductCount,
} from '@/lib/fiscalConfiguration/fiscalGroupUi'
import type { FiscalProductGroup } from '@/lib/fiscalConfiguration/types'
import { mfRadius, mfSpacing, mfTypography } from '@/lib/theme'

type Props = {
  label?: string
  value: string
  groups: FiscalProductGroup[]
  groupProductCounts?: Record<string, number>
  onChange: (value: string) => void
  disabled?: boolean
  helpText?: string
  onManageGroups?: () => void
  showEmptyHint?: boolean
  onCreateFirstGroup?: () => void
}

export function FiscalProductGroupSelectField({
  label = 'Grupo fiscal',
  value,
  groups,
  groupProductCounts,
  onChange,
  disabled = false,
  helpText,
  onManageGroups,
  showEmptyHint = false,
  onCreateFirstGroup,
}: Props) {
  const { theme, isDarkMode } = useMfTheme()
  const { width, height } = useWindowDimensions()
  const [open, setOpen] = useState(false)
  const activeGroups = groups.filter((g) => g.status === 'ACTIVE')

  const modalWidth = Math.min(440, width - 32)
  const modalMaxHeight = Math.min(480, height * 0.72)

  const options = useMemo(() => {
    const base = [{ value: '', label: 'Sem grupo fiscal' }]
    const groupOpts = activeGroups.map((g) => ({ value: g.id, label: g.name }))
    return [...base, ...groupOpts, { value: FISCAL_GROUP_CREATE_OPTION, label: 'Criar novo grupo fiscal' }]
  }, [activeGroups])

  const selected = options.find((o) => o.value === value)

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { gap: mfSpacing.xs },
        labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: mfSpacing.sm },
        label: { ...mfTypography.caption, color: theme.textSecondary, fontWeight: '600' },
        manageBtn: { paddingVertical: 2, paddingHorizontal: mfSpacing.xs },
        manageText: { ...mfTypography.caption, color: theme.primary, fontWeight: '600' },
        field: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: mfRadius.md,
          paddingHorizontal: mfSpacing.md,
          paddingVertical: mfSpacing.sm + 2,
          backgroundColor: disabled ? theme.backgroundMuted : theme.inputBackground ?? theme.surface,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        value: { ...mfTypography.body, color: disabled ? theme.textSecondary : theme.text, flex: 1 },
        help: { ...mfTypography.caption, color: theme.textSecondary, lineHeight: 18 },
        emptyBox: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: mfRadius.md,
          padding: mfSpacing.md,
          backgroundColor: theme.backgroundMuted,
          gap: mfSpacing.sm,
        },
        emptyText: { ...mfTypography.caption, color: theme.textSecondary },
        emptyBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: mfSpacing.xs,
          alignSelf: 'flex-start',
        },
        emptyBtnText: { ...mfTypography.caption, color: theme.primary, fontWeight: '600' },
        backdrop: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: mfSpacing.md,
          backgroundColor: isDarkMode ? 'rgba(0,0,0,0.65)' : 'rgba(15, 23, 42, 0.4)',
          ...(Platform.OS === 'web'
            ? ({ backdropFilter: 'blur(8px)' } as Record<string, string>)
            : {}),
        },
        dialog: {
          width: modalWidth,
          maxHeight: modalMaxHeight,
          backgroundColor: theme.background,
          borderRadius: mfRadius.xl,
          borderWidth: 1,
          borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : theme.border,
          overflow: 'hidden',
          zIndex: 2,
          ...(Platform.OS === 'web'
            ? ({
                boxShadow: isDarkMode
                  ? '0 28px 72px rgba(0,0,0,0.55)'
                  : '0 24px 56px rgba(15, 23, 42, 0.18)',
              } as Record<string, string>)
            : {}),
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: mfSpacing.lg,
          paddingVertical: mfSpacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
          backgroundColor: isDarkMode ? theme.card : theme.surface,
        },
        sheetTitle: { ...mfTypography.subtitle, color: theme.text, flex: 1 },
        closeBtn: {
          width: 32,
          height: 32,
          borderRadius: mfRadius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : theme.backgroundMuted,
          borderWidth: 1,
          borderColor: theme.borderLight,
        },
        list: { maxHeight: Math.max(180, modalMaxHeight - 120) },
        option: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: mfSpacing.sm,
          paddingHorizontal: mfSpacing.lg,
          paddingVertical: mfSpacing.sm + 4,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
        optionCreate: {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.border,
          backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.06)' : 'rgba(14, 116, 144, 0.04)',
        },
        optionActive: { backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.08)' : 'rgba(14, 116, 144, 0.06)' },
        optionBody: { flex: 1, gap: 2 },
        optionText: { ...mfTypography.body, color: theme.text },
        optionCreateText: { ...mfTypography.bodyStrong, color: theme.primary },
        optionMeta: { ...mfTypography.caption, color: theme.textSecondary },
      }),
    [disabled, isDarkMode, modalMaxHeight, modalWidth, theme],
  )

  const closeMenu = () => setOpen(false)

  const handleSelect = (next: string) => {
    closeMenu()
    if (next === FISCAL_GROUP_CREATE_OPTION) {
      onChange(FISCAL_GROUP_CREATE_OPTION)
      return
    }
    onChange(next)
  }

  if (showEmptyHint && activeGroups.length === 0) {
    return (
      <View style={styles.wrap}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {onManageGroups ? (
            <TouchableOpacity style={styles.manageBtn} onPress={onManageGroups} accessibilityRole="button">
              <Text style={styles.manageText}>Gerenciar grupos</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Este cliente ainda não possui grupos fiscais.</Text>
          {onCreateFirstGroup ? (
            <TouchableOpacity style={styles.emptyBtn} onPress={onCreateFirstGroup} accessibilityRole="button">
              <Ionicons name="add-circle-outline" size={16} color={theme.primary} />
              <Text style={styles.emptyBtnText}>Criar primeiro grupo fiscal</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.field}
          onPress={() => !disabled && onChange('')}
          disabled={disabled}
          accessibilityRole="button"
        >
          <Text style={styles.value}>Sem grupo fiscal</Text>
        </TouchableOpacity>
        {helpText ? <Text style={styles.help}>{helpText}</Text> : null}
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {onManageGroups ? (
          <TouchableOpacity style={styles.manageBtn} onPress={onManageGroups} accessibilityRole="button">
            <Text style={styles.manageText}>Gerenciar grupos</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.field}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={styles.value} numberOfLines={2}>
          {selected?.label ?? 'Selecione…'}
        </Text>
        {!disabled ? <Ionicons name="chevron-down" size={18} color={theme.textSecondary} /> : null}
      </TouchableOpacity>
      {helpText ? <Text style={styles.help}>{helpText}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeMenu}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeMenu} accessibilityLabel="Fechar" />
          <View style={styles.dialog}>
            <View style={styles.header}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={closeMenu} accessibilityRole="button">
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {options.map((option) => {
                const isCreate = option.value === FISCAL_GROUP_CREATE_OPTION
                const count = !isCreate && option.value ? groupProductCounts?.[option.value] : undefined
                const isActive = option.value === value
                return (
                  <TouchableOpacity
                    key={option.value || '__none__'}
                    style={[
                      styles.option,
                      isActive && styles.optionActive,
                      isCreate && styles.optionCreate,
                    ]}
                    onPress={() => handleSelect(option.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    {isCreate ? (
                      <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
                    ) : (
                      <Ionicons
                        name={option.value ? 'folder-outline' : 'remove-circle-outline'}
                        size={18}
                        color={theme.textSecondary}
                      />
                    )}
                    <View style={styles.optionBody}>
                      <Text style={isCreate ? styles.optionCreateText : styles.optionText}>
                        {isCreate ? option.label : option.label}
                      </Text>
                      {count != null ? (
                        <Text style={styles.optionMeta}>{formatProductCount(count)}</Text>
                      ) : null}
                    </View>
                    {isActive ? (
                      <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                    ) : null}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}
