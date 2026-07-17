import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Pressable,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { MoedaFlag } from './MoedaFlag'
import { useMfTheme } from '../ui/useMfTheme'
import { mfRadius, mfSpacing } from '../../lib/theme'
import { getMoedaAccent } from '../../lib/moedaAccent'
import { filterCurrencyOptions } from '../../lib/frankfurterCurrenciesFallback'
import { getTechTokens, mfTechInsetSurface } from '../../lib/techDesign'
import { POPULAR_MOEDAS } from '../../lib/contaMoedaGlobalTypes'
import { getWebScrollbarStyle, WEB_SCROLL_Y_CLASS } from '../../lib/webScrollbar'

type Props = {
  value: string
  onChange: (code: string) => void
  catalog: Record<string, string>
  loading?: boolean
  label?: string
}

const SHEET_MAX_WIDTH = 400
const LIST_MAX_HEIGHT = 220

export function MoedaPickerField({
  value,
  onChange,
  catalog,
  loading = false,
  label = 'Moeda',
}: Props) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode])
  const fieldInset = useMemo(() => mfTechInsetSurface(isDarkMode, false), [isDarkMode])
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const isWeb = Platform.OS === 'web'
  const styles = useMemo(() => createStyles(theme, tokens, isWeb), [theme, tokens, isWeb])

  const code = value.trim().toUpperCase() || 'USD'
  const accent = getMoedaAccent(code, tokens.accent)
  const options = useMemo(() => filterCurrencyOptions(catalog, search), [catalog, search])

  const popularOptions = useMemo(
    () => POPULAR_MOEDAS.filter((c) => catalog[c]).map((c) => ({ code: c, name: catalog[c] || c })),
    [catalog],
  )

  const close = () => {
    setOpen(false)
    setSearch('')
  }

  const toggle = () => {
    if (loading) return
    setOpen((v) => !v)
    if (open) setSearch('')
  }

  const selectCode = (next: string) => {
    onChange(next.toUpperCase())
    close()
  }

  const pickerBody = (
    <>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={15} color={theme.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar moeda…"
          placeholderTextColor={theme.placeholder}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus={open && isWeb}
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={theme.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {!search.trim() && popularOptions.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          keyboardShouldPersistTaps="handled"
        >
          {popularOptions.map((item) => {
            const active = code === item.code
            const chipAccent = getMoedaAccent(item.code, tokens.accent)
            return (
              <TouchableOpacity
                key={item.code}
                style={[
                  styles.chip,
                  active && { borderColor: chipAccent, backgroundColor: `${chipAccent}14` },
                ]}
                onPress={() => selectCode(item.code)}
              >
                <MoedaFlag moeda={item.code} size={18} label={item.name} />
                <Text style={[styles.chipCode, active && { color: chipAccent }]}>{item.code}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      ) : null}

      <ScrollView
        style={[styles.list, isWeb ? getWebScrollbarStyle(theme) : null]}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator
        {...(isWeb ? { className: WEB_SCROLL_Y_CLASS } : {})}
      >
        {options.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma moeda encontrada.</Text>
        ) : (
          options.map((item) => {
            const active = code === item.code
            const rowAccent = getMoedaAccent(item.code, tokens.accent)
            return (
              <TouchableOpacity
                key={item.code}
                style={[styles.item, active && styles.itemSelected]}
                onPress={() => selectCode(item.code)}
              >
                <MoedaFlag moeda={item.code} size={22} label={item.name} />
                <View style={styles.itemTextCol}>
                  <Text style={[styles.itemCode, active && { color: rowAccent }]}>{item.code}</Text>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                </View>
                {active ? <Ionicons name="checkmark" size={16} color={rowAccent} /> : null}
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>
    </>
  )

  return (
    <View style={[styles.wrap, open && isWeb && styles.wrapOpen]}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.anchor}>
        <TouchableOpacity
          style={[styles.trigger, fieldInset, open && styles.triggerOpen]}
          onPress={toggle}
          disabled={loading}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`Moeda: ${code}, ${catalog[code] || ''}`}
        >
          <View style={styles.triggerLeading}>
            <MoedaFlag moeda={code} size={24} label={catalog[code] || code} />
            <View style={styles.triggerTextCol}>
              <Text style={styles.triggerCode}>{code}</Text>
              <Text style={styles.triggerText} numberOfLines={1}>
                {loading ? 'Carregando…' : catalog[code] || 'Selecione'}
              </Text>
            </View>
          </View>
          {loading ? (
            <ActivityIndicator size="small" color={tokens.accent} />
          ) : (
            <Ionicons
              name={open ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={theme.textTertiary}
            />
          )}
        </TouchableOpacity>

        {open && isWeb ? (
          <View
            style={[
              styles.inlinePanel,
              { backgroundColor: theme.card, borderColor: tokens.insetBorder },
            ]}
          >
            {pickerBody}
          </View>
        ) : null}
      </View>

      {open && !isWeb ? (
        <Modal visible transparent animationType="fade" onRequestClose={close}>
          <View style={styles.nativeOverlay}>
            <Pressable style={styles.nativeBackdrop} onPress={close} accessibilityLabel="Fechar" />
            <View style={styles.nativeSheetShell} pointerEvents="box-none">
              <View
                style={[
                  styles.nativeSheet,
                  { backgroundColor: theme.card, borderColor: tokens.insetBorder },
                ]}
                pointerEvents="auto"
              >
                <View style={styles.nativeSheetHeader}>
                  <Text style={styles.nativeSheetTitle}>Selecionar moeda</Text>
                  <TouchableOpacity onPress={close} hitSlop={8}>
                    <Ionicons name="close" size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.nativeSheetBody}>{pickerBody}</View>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  )
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  tokens: ReturnType<typeof getTechTokens>,
  isWeb: boolean,
) {
  const isNative = !isWeb

  return StyleSheet.create({
    wrap: { gap: 6 },
    wrapOpen: isWeb ? ({ zIndex: 40, position: 'relative' } as object) : {},
    label: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    anchor: {
      position: 'relative',
      zIndex: 2,
    },
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: isNative ? 12 : 10,
      minHeight: isNative ? 48 : 42,
      borderRadius: mfRadius.sm,
    },
    triggerOpen: {
      borderColor: tokens.accentMuted,
    },
    triggerLeading: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minWidth: 0,
    },
    triggerTextCol: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    triggerCode: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.textSecondary,
      letterSpacing: 0.6,
    },
    triggerText: {
      fontSize: isNative ? 15 : 14,
      color: theme.text,
    },
    inlinePanel: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: 4,
      zIndex: 50,
      borderRadius: mfRadius.md,
      borderWidth: 1,
      padding: mfSpacing.sm,
      gap: mfSpacing.xs,
      ...(isWeb
        ? ({
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
          } as object)
        : {}),
    },
    nativeOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: mfSpacing.lg,
    },
    nativeBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    nativeSheetShell: {
      width: '100%',
      maxWidth: SHEET_MAX_WIDTH,
      zIndex: 1,
    },
    nativeSheet: {
      width: '100%',
      borderRadius: mfRadius.lg,
      borderWidth: 1,
      overflow: 'hidden',
      maxHeight: '75%',
    },
    nativeSheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: mfSpacing.md,
      paddingVertical: mfSpacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.insetBorder,
    },
    nativeSheetTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    nativeSheetBody: {
      padding: mfSpacing.md,
      gap: mfSpacing.sm,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: isNative ? 10 : 8,
      borderRadius: mfRadius.sm,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: tokens.insetFill,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
      padding: 0,
      ...(isWeb ? ({ outlineStyle: 'none' } as object) : {}),
    },
    chipRow: { gap: 6, paddingVertical: 2 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: mfRadius.pill,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: tokens.insetFill,
    },
    chipCode: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
      letterSpacing: 0.4,
    },
    list: {
      maxHeight: LIST_MAX_HEIGHT,
    },
    listContent: {
      paddingBottom: 2,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 8,
      paddingVertical: isNative ? 11 : 8,
      borderRadius: mfRadius.sm,
    },
    itemSelected: {
      backgroundColor: tokens.accentSoft,
    },
    itemTextCol: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    itemCode: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.4,
      color: theme.text,
    },
    itemName: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    emptyText: {
      fontSize: 13,
      color: theme.textTertiary,
      textAlign: 'center',
      paddingVertical: mfSpacing.md,
    },
  })
}
