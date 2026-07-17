import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  type LayoutChangeEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useThemeStore } from '../store/themeStore'
import { useContaMoedaGlobalStore } from '../store/contaMoedaGlobalStore'
import { getTheme, mfSpacing, mfTypography } from '../lib/theme'
import { useNavigationDrawer } from '../lib/navigationContext'
import { useShellLayout } from '../components/shell'
import { SHELL_CANVAS_DARK, SHELL_CANVAS_LIGHT } from '../components/shell/shellTokens'
import { MfAppHeader, MfScrollView } from '../components/ui'
import { MfConfirmDialog } from '../components/ui/MfConfirmDialog'
import { useMfTheme } from '../components/ui/useMfTheme'
import { mfTechPanelChrome } from '../lib/techDesign'
import type { ContaMoedaGlobal, ContaMoedaGlobalInput } from '../lib/contaMoedaGlobalTypes'
import {
  fetchMoedasGlobaisCotacoes,
  fetchMoedasGlobaisCurrencies,
} from '../services/moedasGlobaisService'
import { ContaGlobalPageChrome } from './ContaGlobal/contaGlobalPageChrome'
import { ContaGlobalMetrics } from './ContaGlobal/ContaGlobalMetrics'
import { ContaMoedaCarousel } from './ContaGlobal/ContaMoedaCarousel'
import { ContaMoedaModal } from './ContaGlobal/ContaMoedaModal'
import { ContaGlobalErrorBanner } from './ContaGlobal/ContaGlobalErrorBanner'

export default function ContaGlobalScreen() {
  const { isDarkMode } = useThemeStore()
  const { isDarkMode: mfDark } = useMfTheme()
  const { openDrawer, hasGlobalNav } = useNavigationDrawer()
  const { isWebDesktop } = useShellLayout()

  const [containerWidth, setContainerWidth] = useState(0)
  const showPanelHeader = isWebDesktop && hasGlobalNav

  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode])
  const unifiedPanelChrome = useMemo(
    () => mfTechPanelChrome(mfDark, 'surface'),
    [mfDark],
  )

  const styles = useMemo(
    () => createStyles(theme, showPanelHeader),
    [theme, showPanelHeader],
  )

  const { contas, loading, error, fetchContas, addConta, updateConta, deleteConta } =
    useContaMoedaGlobalStore()

  const [rates, setRates] = useState<Record<string, number>>({})
  const ratesRef = useRef(rates)
  ratesRef.current = rates
  const [ratesLoading, setRatesLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<ContaMoedaGlobal | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ContaMoedaGlobal | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [currencyCatalog, setCurrencyCatalog] = useState<Record<string, string>>({})
  const [catalogLoading, setCatalogLoading] = useState(true)

  const shellBg = hasGlobalNav || Platform.OS === 'web'
    ? isDarkMode ? SHELL_CANVAS_DARK : SHELL_CANVAS_LIGHT
    : theme.background

  const loadRates = useCallback(async (codes: string[]) => {
    if (!codes.length) {
      setRates({})
      ratesRef.current = {}
      setRatesLoading(false)
      return
    }

    const needLoad = codes.some((c) => c !== 'BRL' && ratesRef.current[c] == null)
    if (needLoad) setRatesLoading(true)

    try {
      const next = await fetchMoedasGlobaisCotacoes(codes)
      setRates((prev) => {
        const merged = { ...prev, ...next }
        ratesRef.current = merged
        return merged
      })
    } catch {
      // mantém cotações anteriores se houver
    } finally {
      setRatesLoading(false)
    }
  }, [])

  const refreshAll = useCallback(async () => {
    await fetchContas()
  }, [fetchContas])

  useEffect(() => {
    void refreshAll()
    setCatalogLoading(true)
    void fetchMoedasGlobaisCurrencies()
      .then(setCurrencyCatalog)
      .finally(() => setCatalogLoading(false))
  }, [refreshAll])

  useEffect(() => {
    const codes = contas.map((c) => c.moeda)
    void loadRates(codes)
  }, [contas, loadRates])

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width)
    setContainerWidth((prev) => (prev === next ? prev : next))
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refreshAll()
    const codes = useContaMoedaGlobalStore.getState().contas.map((c) => c.moeda)
    await loadRates(codes)
    setRefreshing(false)
  }, [refreshAll, loadRates])

  const totalBrl = useMemo(() => {
    return contas.reduce((sum, c) => {
      const rate = rates[c.moeda] ?? 0
      return sum + c.valor * rate
    }, 0)
  }, [contas, rates])

  const ratesReady = useMemo(
    () => contas.every((c) => c.moeda === 'BRL' || rates[c.moeda] != null),
    [contas, rates],
  )

  const openCreate = () => {
    setEditing(null)
    setModalVisible(true)
  }

  const openEdit = (conta: ContaMoedaGlobal) => {
    setEditing(conta)
    setModalVisible(true)
  }

  const handleSave = async (input: ContaMoedaGlobalInput, id?: string) => {
    if (id) {
      const { error: err } = await updateConta(id, input)
      if (err) Alert.alert('Erro', err)
      return
    }
    const created = await addConta(input)
    if (!created) {
      const msg = useContaMoedaGlobalStore.getState().error || 'Não foi possível salvar.'
      Alert.alert('Erro', msg)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    const { error: err } = await deleteConta(deleteTarget.id)
    setDeleteLoading(false)
    if (err) {
      Alert.alert('Erro', err)
      return
    }
    setDeleteTarget(null)
  }

  const moedasSection =
    !loading && contas.length === 0 ? (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Ionicons name="globe-outline" size={36} color={theme.textTertiary} />
        </View>
        <Text style={styles.emptyTitle}>Nenhuma moeda cadastrada</Text>
        <Text style={styles.emptyText}>
          Registre quanto você tem em dólar, euro e outras moedas — separado do saldo em reais.
        </Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={openCreate} accessibilityRole="button">
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.emptyBtnText}>Adicionar primeira moeda</Text>
        </TouchableOpacity>
      </View>
    ) : contas.length > 0 ? (
      <ContaMoedaCarousel
        contas={contas}
        rates={rates}
        ratesLoading={ratesLoading}
        onPressConta={openEdit}
        onEditConta={openEdit}
        onDeleteConta={setDeleteTarget}
        onAddMoeda={openCreate}
      />
    ) : null

  const panelBody = (
    <>
      {showPanelHeader ? (
        <ContaGlobalPageChrome
          bare
          theme={theme}
          moedaCount={contas.length}
          onAddMoeda={openCreate}
        />
      ) : null}

      {error ? <ContaGlobalErrorBanner message={error} /> : null}

      {contas.length > 0 ? (
        <ContaGlobalMetrics
          totalBrl={totalBrl}
          moedaCount={contas.length}
          ratesLoading={ratesLoading}
          ratesReady={ratesReady}
        />
      ) : null}

      {loading && contas.length === 0 ? (
        <ActivityIndicator color={theme.primary} style={styles.loader} />
      ) : (
        moedasSection
      )}
    </>
  )

  const scrollContent = showPanelHeader ? (
    <View style={styles.shellColumn} onLayout={onLayout}>
      <View style={[styles.unifiedPanel, unifiedPanelChrome]}>{panelBody}</View>
    </View>
  ) : (
    <View style={styles.mobilePad} onLayout={onLayout}>
      {!showPanelHeader ? (
        <View style={styles.mobileHeader}>
          <View>
            <Text style={styles.mobileTitle}>Conta global</Text>
            <Text style={styles.mobileSubtitle}>
              {contas.length === 1
                ? '1 moeda cadastrada'
                : `${contas.length} moedas cadastradas`}
            </Text>
          </View>
        </View>
      ) : null}
      {panelBody}
    </View>
  )

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: shellBg }]} edges={['top', 'bottom']}>
      {!showPanelHeader ? (
        <MfAppHeader
          title="Conta global"
          subtitle="Moedas internacionais"
          onMenuPress={openDrawer}
          right={
            <TouchableOpacity onPress={openCreate} accessibilityLabel="Adicionar moeda">
              <Ionicons name="add-circle-outline" size={28} color={theme.primary} />
            </TouchableOpacity>
          }
        />
      ) : null}

      <MfScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {scrollContent}
      </MfScrollView>

      <ContaMoedaModal
        visible={modalVisible}
        conta={editing}
        currencyCatalog={currencyCatalog}
        catalogLoading={catalogLoading}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        useDialogLayout={showPanelHeader}
      />

      <MfConfirmDialog
        visible={deleteTarget != null}
        title="Remover moeda?"
        message={
          deleteTarget
            ? `Excluir ${deleteTarget.moeda}${deleteTarget.nome ? ` (${deleteTarget.nome})` : ''}?`
            : ''
        }
        confirmLabel="Excluir"
        confirmIntent="danger"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!deleteLoading) setDeleteTarget(null)
        }}
      />
    </SafeAreaView>
  )
}

function createStyles(
  theme: ReturnType<typeof getTheme>,
  shell: boolean,
) {
  const isNative = Platform.OS !== 'web'

  return StyleSheet.create({
    safe: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: mfSpacing.xl,
    },
    shellColumn: {
      maxWidth: 1200,
      width: '100%',
      alignSelf: 'center',
      paddingHorizontal: shell ? 20 : mfSpacing.md,
      paddingTop: mfSpacing.md,
    },
    unifiedPanel: {
      flex: 1,
      minHeight: 0,
      padding: mfSpacing.md,
      gap: mfSpacing.sm,
      overflow: 'visible',
    },
    mobilePad: {
      padding: isNative ? mfSpacing.md : mfSpacing.lg,
      gap: mfSpacing.md,
    },
    mobileHeader: {
      marginBottom: mfSpacing.xs,
    },
    mobileTitle: {
      ...mfTypography.titleLarge,
      color: theme.text,
      letterSpacing: -0.4,
    },
    mobileSubtitle: {
      ...mfTypography.body,
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 4,
    },
    loader: {
      marginTop: mfSpacing.lg,
    },
    empty: {
      width: '100%',
      alignItems: 'center',
      paddingVertical: isNative ? 40 : 48,
      gap: mfSpacing.sm,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.backgroundMuted,
      marginBottom: mfSpacing.xs,
    },
    emptyTitle: {
      ...mfTypography.subtitle,
      color: theme.text,
      fontWeight: '700',
    },
    emptyText: {
      ...mfTypography.body,
      color: theme.textSecondary,
      textAlign: 'center',
      maxWidth: 320,
      paddingHorizontal: mfSpacing.md,
    },
    emptyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: mfSpacing.md,
      paddingHorizontal: 20,
      paddingVertical: isNative ? 14 : 12,
      borderRadius: 10,
      backgroundColor: theme.primary,
      minHeight: isNative ? 48 : undefined,
    },
    emptyBtnText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: isNative ? 15 : 14,
    },
  })
}
