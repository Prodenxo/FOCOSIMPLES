import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  TextInput,
  Pressable,
  useWindowDimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMfTheme } from '@/components/ui/useMfTheme'
import { mfRadius, mfSpacing, mfTypography } from '@/lib/theme'
import {
  getCfopByCode,
  labelCfopScope,
  mapOperationScopeToCfopScope,
  searchCfopOptions,
  validateCfopStructuralCompatibility,
  type CfopEntry,
  type CfopScope,
} from '@/lib/fiscalData/cfop'

type Props = {
  label?: string
  value: string
  onChange: (code: string) => void
  disabled?: boolean
  operationScope?: string
}

function scopeTone(scope: CfopScope, isDarkMode: boolean) {
  switch (scope) {
    case 'INTERNAL':
      return {
        bg: isDarkMode ? 'rgba(56, 189, 248, 0.12)' : 'rgba(14, 116, 144, 0.1)',
        text: isDarkMode ? '#7dd3fc' : '#0e7490',
        border: isDarkMode ? 'rgba(56, 189, 248, 0.28)' : 'rgba(14, 116, 144, 0.22)',
      }
    case 'INTERSTATE':
      return {
        bg: isDarkMode ? 'rgba(167, 139, 250, 0.12)' : 'rgba(109, 40, 217, 0.08)',
        text: isDarkMode ? '#c4b5fd' : '#6d28d9',
        border: isDarkMode ? 'rgba(167, 139, 250, 0.28)' : 'rgba(109, 40, 217, 0.2)',
      }
    default:
      return {
        bg: isDarkMode ? 'rgba(251, 191, 36, 0.12)' : 'rgba(217, 119, 6, 0.08)',
        text: isDarkMode ? '#fcd34d' : '#b45309',
        border: isDarkMode ? 'rgba(251, 191, 36, 0.28)' : 'rgba(217, 119, 6, 0.2)',
      }
  }
}

export function CfopAutocompleteField({
  label = 'CFOP',
  value,
  onChange,
  disabled = false,
  operationScope = '',
}: Props) {
  const { theme, isDarkMode } = useMfTheme()
  const { width, height } = useWindowDimensions()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)

  const selected = getCfopByCode(value)
  const expectedScope = mapOperationScopeToCfopScope(operationScope)
  const validation = useMemo(
    () => (value ? validateCfopStructuralCompatibility(value, operationScope) : null),
    [operationScope, value],
  )

  const options = useMemo(
    () => searchCfopOptions(query, { operationScope, preferMatchingScope: true, limit: 120 }),
    [operationScope, query],
  )

  const modalWidth = Math.min(560, width - 32)
  const modalMaxHeight = Math.min(640, height * 0.78)

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { gap: mfSpacing.xs },
        label: { ...mfTypography.caption, color: theme.textSecondary, fontWeight: '600' },
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
          gap: mfSpacing.sm,
        },
        fieldBody: { flex: 1, gap: 2 },
        value: { ...mfTypography.bodyStrong, color: disabled ? theme.textSecondary : theme.text },
        valueSub: { ...mfTypography.caption, color: theme.textSecondary, lineHeight: 16 },
        placeholder: { ...mfTypography.body, color: theme.textTertiary },
        detailsToggle: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          alignSelf: 'flex-start',
          paddingVertical: 2,
        },
        detailsToggleText: { ...mfTypography.caption, color: theme.primary, fontWeight: '600' },
        detailsBox: {
          borderWidth: 1,
          borderColor: theme.borderLight,
          borderRadius: mfRadius.md,
          padding: mfSpacing.md,
          gap: mfSpacing.xs,
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : theme.backgroundMuted,
        },
        detailsLabel: { ...mfTypography.caption, color: theme.textTertiary, fontWeight: '700' },
        detailsText: { ...mfTypography.caption, color: theme.textSecondary, lineHeight: 18 },
        warn: { ...mfTypography.caption, color: theme.warning ?? '#b45309', lineHeight: 16 },
        error: { ...mfTypography.caption, color: theme.error, lineHeight: 16 },
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
          ...(Platform.OS === 'web'
            ? ({
                boxShadow: isDarkMode
                  ? '0 28px 72px rgba(0,0,0,0.55)'
                  : '0 24px 56px rgba(15, 23, 42, 0.18)',
              } as Record<string, string>)
            : {}),
        },
        header: {
          paddingHorizontal: mfSpacing.lg,
          paddingTop: mfSpacing.lg,
          paddingBottom: mfSpacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
          backgroundColor: isDarkMode ? theme.card : theme.surface,
          gap: mfSpacing.xs,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: mfSpacing.md,
        },
        headerTitle: { ...mfTypography.subtitle, color: theme.text, flex: 1 },
        headerHint: { ...mfTypography.caption, color: theme.textSecondary, lineHeight: 16 },
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
        searchWrap: {
          marginHorizontal: mfSpacing.lg,
          marginTop: mfSpacing.md,
          marginBottom: mfSpacing.sm,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: mfRadius.md,
          paddingHorizontal: mfSpacing.md,
          paddingVertical: mfSpacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: mfSpacing.sm,
          backgroundColor: theme.inputBackground ?? theme.surface,
        },
        searchInput: { flex: 1, ...mfTypography.body, color: theme.text, padding: 0 },
        list: {
          maxHeight: Math.max(220, modalMaxHeight - 180),
        },
        option: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: mfSpacing.sm,
          paddingHorizontal: mfSpacing.lg,
          paddingVertical: mfSpacing.sm + 4,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
        optionActive: {
          backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.08)' : 'rgba(14, 116, 144, 0.06)',
        },
        codePill: {
          minWidth: 52,
          paddingHorizontal: mfSpacing.sm,
          paddingVertical: 6,
          borderRadius: mfRadius.sm,
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : theme.backgroundMuted,
          borderWidth: 1,
          borderColor: theme.borderLight,
          alignItems: 'center',
        },
        codeText: {
          ...mfTypography.bodyStrong,
          color: theme.text,
          fontVariant: ['tabular-nums'],
        },
        optionBody: { flex: 1, gap: 4 },
        optionDesc: { ...mfTypography.body, color: theme.text, lineHeight: 20 },
        scopeChip: {
          alignSelf: 'flex-start',
          paddingHorizontal: mfSpacing.sm,
          paddingVertical: 2,
          borderRadius: mfRadius.pill,
          borderWidth: 1,
        },
        scopeText: { ...mfTypography.caption, fontWeight: '700', fontSize: 10 },
        empty: {
          padding: mfSpacing.xl,
          alignItems: 'center',
          gap: mfSpacing.sm,
        },
        emptyText: { ...mfTypography.body, color: theme.textSecondary, textAlign: 'center' },
        footer: {
          paddingHorizontal: mfSpacing.lg,
          paddingVertical: mfSpacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.border,
          backgroundColor: isDarkMode ? theme.card : theme.surface,
        },
        footerText: { ...mfTypography.caption, color: theme.textTertiary, textAlign: 'center' },
      }),
    [disabled, isDarkMode, modalMaxHeight, modalWidth, theme],
  )

  const closeModal = () => {
    setOpen(false)
    setQuery('')
  }

  const handleSelect = (entry: CfopEntry) => {
    onChange(entry.code)
    closeModal()
    setDetailsOpen(false)
  }

  const scopeHint = expectedScope
    ? `Priorizando CFOPs de ${labelCfopScope(expectedScope)} compatíveis com o cenário.`
    : 'Busque por código (5102) ou descrição da operação.'

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.field}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <View style={styles.fieldBody}>
          {selected ? (
            <>
              <Text style={styles.value}>{selected.code}</Text>
              <Text style={styles.valueSub} numberOfLines={2}>
                {selected.description}
              </Text>
            </>
          ) : (
            <Text style={styles.placeholder}>Selecionar CFOP…</Text>
          )}
        </View>
        {!disabled ? (
          <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
        ) : null}
      </TouchableOpacity>

      {selected ? (
        <>
          <TouchableOpacity
            style={styles.detailsToggle}
            onPress={() => setDetailsOpen((prev) => !prev)}
            accessibilityRole="button"
            accessibilityState={{ expanded: detailsOpen }}
          >
            <Ionicons
              name={detailsOpen ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={theme.primary}
            />
            <Text style={styles.detailsToggleText}>
              {detailsOpen ? 'Ocultar detalhes' : 'Ver aplicação do CFOP'}
            </Text>
          </TouchableOpacity>
          {detailsOpen ? (
            <View style={styles.detailsBox}>
              <Text style={styles.detailsLabel}>Aplicação</Text>
              <Text style={styles.detailsText}>{selected.application}</Text>
            </View>
          ) : null}
        </>
      ) : null}

      {validation && validation.severity !== 'ok' ? (
        <Text style={validation.severity === 'error' ? styles.error : styles.warn}>
          {validation.message}
        </Text>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.backdrop} onPress={closeModal}>
          <Pressable style={styles.dialog} onPress={() => undefined}>
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>Selecionar CFOP</Text>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={closeModal}
                  accessibilityRole="button"
                  accessibilityLabel="Fechar"
                >
                  <Ionicons name="close" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.headerHint}>{scopeHint}</Text>
            </View>

            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Código ou descrição…"
                placeholderTextColor={theme.textTertiary}
                autoFocus
              />
              {query.length > 0 ? (
                <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Limpar busca">
                  <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {options.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="document-text-outline" size={28} color={theme.textTertiary} />
                  <Text style={styles.emptyText}>Nenhum CFOP encontrado para &quot;{query}&quot;.</Text>
                </View>
              ) : (
                options.map((option) => {
                  const isActive = option.code === value
                  const tone = scopeTone(option.scope, isDarkMode)
                  return (
                    <TouchableOpacity
                      key={option.code}
                      style={[styles.option, isActive ? styles.optionActive : null]}
                      onPress={() => handleSelect(option)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      <View style={styles.codePill}>
                        <Text style={styles.codeText}>{option.code}</Text>
                      </View>
                      <View style={styles.optionBody}>
                        <Text style={styles.optionDesc}>{option.description}</Text>
                        <View
                          style={[
                            styles.scopeChip,
                            {
                              backgroundColor: tone.bg,
                              borderColor: tone.border,
                            },
                          ]}
                        >
                          <Text style={[styles.scopeText, { color: tone.text }]}>
                            {labelCfopScope(option.scope).toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      {isActive ? (
                        <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                      ) : null}
                    </TouchableOpacity>
                  )
                })
              )}
            </ScrollView>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {options.length} resultado{options.length === 1 ? '' : 's'}
                {selected ? ` · atual: ${selected.code}` : ''}
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}
