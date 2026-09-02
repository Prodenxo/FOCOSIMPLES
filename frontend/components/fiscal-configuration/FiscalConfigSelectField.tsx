import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  Pressable,
  type LayoutRectangle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMfTheme } from '@/components/ui/useMfTheme'
import { mfRadius, mfSpacing, mfTypography } from '@/lib/theme'

export type FiscalSelectOption = {
  value: string
  label: string
  subtitle?: string
  /** Oculta do menu (ex.: placeholder do campo). */
  menuHidden?: boolean
}

type Props = {
  label: string
  value: string
  options: readonly FiscalSelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  helpText?: string
}

type AnchorRect = Pick<LayoutRectangle, 'x' | 'y' | 'width' | 'height'>

const MENU_MAX_HEIGHT = 320
const MENU_GAP = 6

export function FiscalConfigSelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  helpText,
}: Props) {
  const { theme, isDarkMode } = useMfTheme()
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<AnchorRect | null>(null)
  const fieldRef = useRef<View>(null)

  const selected = options.find((o) => o.value === value)
  const menuOptions = useMemo(
    () => options.filter((o) => !o.menuHidden),
    [options],
  )

  const openMenu = useCallback(() => {
    if (disabled) return
    fieldRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height })
      setOpen(true)
    })
  }, [disabled])

  const closeMenu = useCallback(() => {
    setOpen(false)
  }, [])

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { gap: mfSpacing.xs, zIndex: open ? 40 : undefined },
        label: { ...mfTypography.caption, color: theme.textSecondary, fontWeight: '600' },
        field: {
          borderWidth: 1,
          borderColor: open ? theme.primary : theme.border,
          borderRadius: mfRadius.md,
          paddingHorizontal: mfSpacing.md,
          paddingVertical: mfSpacing.sm + 2,
          backgroundColor: disabled ? theme.backgroundMuted : theme.surface,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: mfSpacing.sm,
          ...(Platform.OS === 'web' && open
            ? {
                boxShadow: isDarkMode
                  ? '0 0 0 1px rgba(56, 189, 248, 0.35)'
                  : '0 0 0 1px rgba(14, 116, 144, 0.25)',
              }
            : {}),
        },
        fieldText: { flex: 1, gap: 2 },
        value: { ...mfTypography.bodyStrong, color: disabled ? theme.textSecondary : theme.text },
        valueSub: { ...mfTypography.caption, color: theme.textSecondary, marginTop: 2 },
        help: { ...mfTypography.caption, color: theme.textSecondary, lineHeight: 18 },
        backdrop: {
          flex: 1,
          backgroundColor: Platform.OS === 'web' ? 'transparent' : 'rgba(0,0,0,0.45)',
        },
        webMenu: {
          position: 'absolute',
          left: anchor?.x ?? 0,
          top: (anchor?.y ?? 0) + (anchor?.height ?? 0) + MENU_GAP,
          width: anchor?.width ?? 280,
          maxHeight: MENU_MAX_HEIGHT,
          backgroundColor: theme.surface,
          borderRadius: mfRadius.lg,
          borderWidth: 1,
          borderColor: theme.border,
          overflow: 'hidden',
          ...(Platform.OS === 'web'
            ? {
                boxShadow: isDarkMode
                  ? '0 16px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)'
                  : '0 16px 40px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.06)',
              }
            : {}),
        },
        menuHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: mfSpacing.md,
          paddingVertical: mfSpacing.sm + 2,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
          backgroundColor: theme.backgroundMuted,
        },
        menuHeaderText: { ...mfTypography.caption, color: theme.textSecondary, fontWeight: '600' },
        sheet: {
          backgroundColor: theme.surface,
          borderTopLeftRadius: mfRadius.xl,
          borderTopRightRadius: mfRadius.xl,
          maxHeight: '72%',
          paddingBottom: Platform.OS === 'ios' ? 28 : mfSpacing.lg,
        },
        sheetHandle: {
          alignSelf: 'center',
          width: 40,
          height: 4,
          borderRadius: mfRadius.pill,
          backgroundColor: theme.border,
          marginTop: mfSpacing.sm,
          marginBottom: mfSpacing.xs,
        },
        option: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: mfSpacing.sm,
          paddingHorizontal: mfSpacing.md,
          paddingVertical: mfSpacing.sm + 4,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
        optionActive: {
          backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.08)' : 'rgba(14, 116, 144, 0.06)',
        },
        optionIcon: {
          width: 36,
          height: 36,
          borderRadius: mfRadius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.backgroundMuted,
          borderWidth: 1,
          borderColor: theme.border,
        },
        optionBody: { flex: 1, gap: 2 },
        optionTitle: { ...mfTypography.bodyStrong, color: theme.text },
        optionSub: { ...mfTypography.caption, color: theme.textSecondary },
        empty: {
          padding: mfSpacing.lg,
          alignItems: 'center',
        },
        emptyText: { ...mfTypography.body, color: theme.textSecondary, textAlign: 'center' },
      }),
    [anchor, isDarkMode, open, theme, disabled],
  )

  const renderOptions = () => {
    if (menuOptions.length === 0) {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nenhuma opção disponível.</Text>
        </View>
      )
    }

    return menuOptions.map((option) => {
      const isActive = option.value === value
      return (
        <TouchableOpacity
          key={option.value}
          style={[styles.option, isActive && styles.optionActive]}
          onPress={() => {
            onChange(option.value)
            closeMenu()
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: isActive }}
        >
          <View style={styles.optionIcon}>
            <Ionicons
              name="business-outline"
              size={18}
              color={isActive ? theme.primary : theme.textSecondary}
            />
          </View>
          <View style={styles.optionBody}>
            <Text style={styles.optionTitle} numberOfLines={2}>
              {option.label}
            </Text>
            {option.subtitle ? (
              <Text style={styles.optionSub} numberOfLines={1}>
                {option.subtitle}
              </Text>
            ) : null}
          </View>
          {isActive ? (
            <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
          ) : (
            <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
          )}
        </TouchableOpacity>
      )
    })
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View ref={fieldRef} collapsable={false}>
        <TouchableOpacity
          style={styles.field}
          onPress={openMenu}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ expanded: open }}
        >
          <View style={styles.fieldText}>
            <Text style={styles.value} numberOfLines={2}>
              {selected?.label ?? 'Selecione…'}
            </Text>
            {selected?.subtitle ? (
              <Text style={styles.valueSub} numberOfLines={1}>
                {selected.subtitle}
              </Text>
            ) : null}
          </View>
          {!disabled ? (
            <Ionicons
              name={open ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.textSecondary}
            />
          ) : null}
        </TouchableOpacity>
      </View>
      {helpText ? <Text style={styles.help}>{helpText}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.backdrop} onPress={closeMenu}>
          {Platform.OS === 'web' && anchor ? (
            <Pressable style={styles.webMenu} onPress={(e) => e.stopPropagation()}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuHeaderText}>{label}</Text>
                <TouchableOpacity onPress={closeMenu} accessibilityLabel="Fechar">
                  <Ionicons name="close" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                {renderOptions()}
              </ScrollView>
            </Pressable>
          ) : (
            <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
              <View style={styles.sheet} onStartShouldSetResponder={() => true}>
                <View style={styles.sheetHandle} />
                <View style={styles.menuHeader}>
                  <Text style={[styles.menuHeaderText, { flex: 1, fontSize: 15, color: theme.text }]}>
                    {label}
                  </Text>
                  <TouchableOpacity onPress={closeMenu} accessibilityLabel="Fechar">
                    <Ionicons name="close" size={22} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
                <ScrollView keyboardShouldPersistTaps="handled">{renderOptions()}</ScrollView>
              </View>
            </View>
          )}
        </Pressable>
      </Modal>
    </View>
  )
}
