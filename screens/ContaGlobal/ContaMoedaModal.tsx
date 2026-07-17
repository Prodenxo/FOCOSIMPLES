import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MoedaPickerField } from '../../components/conta-global/MoedaPickerField'
import { useMfTheme } from '../../components/ui/useMfTheme'
import { mfRadius, mfSpacing, mfTypography } from '../../lib/theme'
import {
  formatMoedaValorForInput,
  formatMoedaValorInput,
  parseMoedaValorInput,
} from '../../lib/moedaFormat'
import { getTechTokens, mfTechInsetSurface, mfTechPanelChrome } from '../../lib/techDesign'
import { getWebScrollbarStyle, WEB_SCROLL_Y_CLASS } from '../../lib/webScrollbar'
import type { ContaMoedaGlobal, ContaMoedaGlobalInput } from '../../lib/contaMoedaGlobalTypes'
import { mergeCurrencyCatalog } from '../../lib/frankfurterCurrenciesFallback'
import { prefetchMoedaCotacao } from '../../services/moedasGlobaisService'

type Props = {
  visible: boolean
  conta?: ContaMoedaGlobal | null
  currencyCatalog: Record<string, string>
  catalogLoading?: boolean
  onClose: () => void
  onSave: (input: ContaMoedaGlobalInput, id?: string) => Promise<void>
  useDialogLayout?: boolean
}

export function ContaMoedaModal({
  visible,
  conta,
  currencyCatalog,
  catalogLoading = false,
  onClose,
  onSave,
  useDialogLayout = false,
}: Props) {
  const insets = useSafeAreaInsets()
  const { theme, isDarkMode } = useMfTheme()
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode])
  const { width } = useWindowDimensions()
  const isNative = Platform.OS !== 'web'
  const isWebDialog = useDialogLayout && Platform.OS === 'web'
  const styles = useMemo(
    () => createStyles(theme, tokens, isDarkMode, isNative, width),
    [theme, tokens, isDarkMode, isNative, width],
  )
  const fieldInset = useMemo(() => mfTechInsetSurface(isDarkMode, false), [isDarkMode])
  const panelChrome = useMemo(() => mfTechPanelChrome(isDarkMode, 'surface'), [isDarkMode])

  const [moeda, setMoeda] = useState('USD')
  const [nome, setNome] = useState('')
  const [valorStr, setValorStr] = useState('')
  const [saving, setSaving] = useState(false)

  const catalog = useMemo(() => mergeCurrencyCatalog(currencyCatalog), [currencyCatalog])

  useEffect(() => {
    if (!visible) return
    if (conta) {
      setMoeda(conta.moeda)
      setNome(conta.nome || '')
      setValorStr(formatMoedaValorForInput(conta.valor))
    } else {
      setMoeda('USD')
      setNome('')
      setValorStr('')
    }
  }, [visible, conta])

  useEffect(() => {
    if (!visible || !moeda) return
    prefetchMoedaCotacao(moeda)
  }, [visible, moeda])

  const title = conta ? 'Editar moeda' : 'Adicionar moeda'
  const eyebrow = conta ? 'Conta global' : 'Cadastro'

  const handleSave = async () => {
    const code = moeda.trim().toUpperCase()
    if (code.length !== 3) {
      Alert.alert('Moeda', 'Selecione uma moeda válida (código de 3 letras).')
      return
    }
    const valor = parseMoedaValorInput(valorStr)
    if (!Number.isFinite(valor) || valor < 0) {
      Alert.alert('Valor', 'Informe um valor válido.')
      return
    }
    const payload: ContaMoedaGlobalInput = {
      moeda: code,
      nome: nome.trim() || null,
      valor,
    }
    setSaving(true)
    try {
      await onSave(payload, conta?.id)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const saveButton = (
    <TouchableOpacity
      style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
      onPress={handleSave}
      disabled={saving}
      accessibilityRole="button"
      accessibilityLabel="Salvar moeda"
    >
      <Text style={styles.saveBtnText}>{saving ? 'Salvando…' : 'Salvar'}</Text>
    </TouchableOpacity>
  )

  const body = (
    <>
      <MoedaPickerField
        value={moeda}
        onChange={setMoeda}
        catalog={catalog}
        loading={catalogLoading}
      />

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Apelido (opcional)</Text>
        <TextInput
          style={[styles.fieldInput, fieldInset]}
          value={nome}
          onChangeText={setNome}
          placeholder="Ex.: Wise, PayPal, conta EUA…"
          placeholderTextColor={theme.placeholder}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Quanto você tem hoje</Text>
        <TextInput
          style={[styles.fieldInput, styles.valorInput, fieldInset]}
          value={valorStr}
          onChangeText={(t) => setValorStr(formatMoedaValorInput(t))}
          placeholder="0,00"
          placeholderTextColor={theme.placeholder}
          keyboardType="decimal-pad"
          inputMode="decimal"
        />
        <Text style={styles.hint}>
          Informe o valor na moeda escolhida acima. O equivalente em reais é só referência.
        </Text>
      </View>
    </>
  )

  const header = (
    <View style={styles.header}>
      <View style={styles.headerTextCol}>
        <View style={styles.eyebrowRow}>
          <View style={[styles.dot, { backgroundColor: tokens.accent }]} />
          <Text style={[styles.eyebrow, { color: tokens.accent }]}>{eyebrow}</Text>
        </View>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      <TouchableOpacity
        onPress={onClose}
        style={styles.closeBtn}
        accessibilityLabel="Fechar"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={22} color={theme.textSecondary} />
      </TouchableOpacity>
    </View>
  )

  const scrollBody = (
    <ScrollView
      style={[styles.scroll, Platform.OS === 'web' ? getWebScrollbarStyle(theme) : null]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={!isWebDialog}
      nestedScrollEnabled
      {...(Platform.OS === 'web' ? { className: WEB_SCROLL_Y_CLASS } : {})}
    >
      {body}
    </ScrollView>
  )

  if (isWebDialog) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.dialogOverlay}>
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
          <View style={styles.dialogShell} pointerEvents="box-none">
            <View style={[styles.dialogCard, panelChrome]} pointerEvents="auto">
              {header}
              {scrollBody}
              <View style={styles.dialogFooter}>{saveButton}</View>
            </View>
          </View>
        </View>
      </Modal>
    )
  }

  return (
    <Modal
      visible={visible}
      animationType={isNative ? 'slide' : 'fade'}
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.fullRoot, { paddingTop: insets.top }]}>
        {header}
        {scrollBody}
        <View style={[styles.fullFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {saveButton}
        </View>
      </View>
    </Modal>
  )
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  tokens: ReturnType<typeof getTechTokens>,
  isDarkMode: boolean,
  isNative: boolean,
  windowWidth: number,
) {
  const dialogMaxWidth = windowWidth >= 640 ? 520 : '100%'

  return StyleSheet.create({
    dialogOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: mfSpacing.lg,
      paddingTop: 72,
      paddingBottom: mfSpacing.xl,
      ...(Platform.OS === 'web'
        ? ({ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000 } as object)
        : {}),
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.55)',
    },
    dialogShell: {
      width: '100%',
      maxWidth: dialogMaxWidth,
      maxHeight: '85vh' as unknown as number,
      zIndex: 1,
    },
    dialogCard: {
      width: '100%',
      maxHeight: '85vh' as unknown as number,
      overflow: Platform.OS === 'web' ? 'visible' : 'hidden',
      flexDirection: 'column',
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 24px 48px rgba(0, 0, 0, 0.45)' } as object)
        : {}),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: mfSpacing.md,
      paddingHorizontal: mfSpacing.lg,
      paddingTop: mfSpacing.md,
      paddingBottom: mfSpacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.insetBorder,
    },
    headerTextCol: { flex: 1, minWidth: 0 },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    dot: { width: 5, height: 5, borderRadius: 3 },
    eyebrow: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
    },
    headerTitle: {
      ...mfTypography.subtitle,
      fontSize: isNative ? 20 : 18,
      color: theme.text,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    closeBtn: {
      width: isNative ? 40 : 36,
      height: isNative ? 40 : 36,
      borderRadius: mfRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.insetFill,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      flexShrink: 0,
    },
    fullRoot: {
      flex: 1,
      backgroundColor: isDarkMode ? '#0a0f16' : theme.background,
    },
    scroll: { flexGrow: 1, flexShrink: 1, minHeight: 0, overflow: Platform.OS === 'web' ? 'visible' : 'hidden' },
    scrollContent: {
      padding: mfSpacing.lg,
      gap: mfSpacing.md,
      paddingBottom: mfSpacing.xl,
      overflow: Platform.OS === 'web' ? 'visible' : 'hidden',
    },
    dialogFooter: {
      paddingHorizontal: mfSpacing.lg,
      paddingTop: mfSpacing.md,
      paddingBottom: mfSpacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tokens.insetBorder,
    },
    fullFooter: {
      padding: mfSpacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tokens.insetBorder,
      backgroundColor: isDarkMode ? '#0a0f16' : theme.surface,
    },
    inputGroup: { gap: 6 },
    label: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    hint: { fontSize: 12, color: theme.textTertiary, marginTop: 4 },
    fieldInput: {
      paddingHorizontal: 14,
      paddingVertical: isNative ? 13 : 11,
      fontSize: isNative ? 16 : 15,
      color: theme.text,
      minHeight: isNative ? 48 : undefined,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
    },
    valorInput: {
      fontVariant: ['tabular-nums'],
    },
    saveBtn: {
      backgroundColor: tokens.accent,
      paddingVertical: isNative ? 15 : 14,
      borderRadius: mfRadius.sm,
      alignItems: 'center',
      minHeight: isNative ? 50 : 48,
      justifyContent: 'center',
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    saveBtnDisabled: { opacity: 0.55 },
    saveBtnText: {
      color: isDarkMode ? '#041018' : '#FFFFFF',
      fontWeight: '700',
      fontSize: isNative ? 16 : 15,
    },
  })
}
