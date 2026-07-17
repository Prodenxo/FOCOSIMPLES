import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { useTransactionStore } from '../store/transactionStore';
import { useContaFinanceiraStore } from '../store/contaFinanceiraStore';
import { getTheme, mfSpacing, mfTypography } from '../lib/theme';
import { useNavigationDrawer } from '../lib/navigationContext';
import { useShellLayout } from '../components/shell';
import { SHELL_CANVAS_DARK, SHELL_CANVAS_LIGHT } from '../components/shell/shellTokens';
import { MfAppHeader, MfScrollView } from '../components/ui';
import { MfConfirmDialog } from '../components/ui/MfConfirmDialog';
import { useMfTheme } from '../components/ui/useMfTheme';
import { computeContaSaldoAtual } from '../lib/contaSaldo';
import { mfTechPanelChrome } from '../lib/techDesign';
import { useLayoutProfile, LAYOUT_WIDE_MIN, LAYOUT_INLINE_MIN } from '../lib/useLayoutProfile';
import type { ContaFinanceira, ContaFinanceiraInput } from '../lib/contaFinanceiraTypes';
import {
  isDefaultContaFinanceira,
  sortContasWithDefaultFirst,
} from '../lib/contaFinanceiraDefault';
import { ContasPageChrome } from './Contas/contasPageChrome';
import { ContasMetrics } from './Contas/ContasMetrics';
import { ContaCard } from './Contas/ContaCard';
import { ContaModal } from './Contas/ContaModal';

type GridColumns = 1 | 2 | 3;

export default function ContasScreen() {
  const { userId } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  const { isDarkMode: mfDark } = useMfTheme();
  const { transactions, fetchTransactions } = useTransactionStore();
  const { contas, loading, fetchContas, addConta, updateConta, deleteConta } =
    useContaFinanceiraStore();
  const { openDrawer, hasGlobalNav } = useNavigationDrawer();
  const { isWebDesktop } = useShellLayout();

  const [containerWidth, setContainerWidth] = useState(0);
  const layout = useLayoutProfile(containerWidth);

  const showPanelHeader = isWebDesktop && hasGlobalNav;
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const unifiedPanelChrome = useMemo(
    () => mfTechPanelChrome(mfDark, 'surface'),
    [mfDark],
  );

  const gridCols: GridColumns = useMemo(() => {
    if (layout.isNative) {
      return layout.width >= LAYOUT_WIDE_MIN ? 2 : 1;
    }
    if (containerWidth === 0) return 1;
    if (layout.width >= LAYOUT_WIDE_MIN) return 3;
    if (layout.width >= LAYOUT_INLINE_MIN) return 2;
    return 1;
  }, [layout.isNative, layout.width, containerWidth]);

  const styles = useMemo(
    () => createStyles(theme, showPanelHeader, gridCols),
    [theme, showPanelHeader, gridCols],
  );

  const shellBg = hasGlobalNav || Platform.OS === 'web'
    ? isDarkMode
      ? SHELL_CANVAS_DARK
      : SHELL_CANVAS_LIGHT
    : theme.background;

  const [modalVisible, setModalVisible] = useState(false);
  const [editingConta, setEditingConta] = useState<ContaFinanceira | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContaFinanceira | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const contasAtivas = useMemo(
    () => sortContasWithDefaultFirst(contas.filter((c) => c.ativo)),
    [contas],
  );

  const saldosPorConta = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of contasAtivas) {
      map[c.id] = computeContaSaldoAtual(c.saldo_inicial, transactions, c.id);
    }
    return map;
  }, [contasAtivas, transactions]);

  const totalConsolidado = useMemo(
    () => Object.values(saldosPorConta).reduce((a, b) => a + b, 0),
    [saldosPorConta],
  );

  useEffect(() => {
    if (!userId) return;
    fetchContas();
    fetchTransactions();
  }, [userId]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setContainerWidth((prev) => (prev === next ? prev : next));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchContas(), fetchTransactions()]);
    setRefreshing(false);
  }, [fetchContas, fetchTransactions]);

  const openCreate = () => {
    setEditingConta(null);
    setModalVisible(true);
  };

  const openEdit = (conta: ContaFinanceira) => {
    setEditingConta(conta);
    setModalVisible(true);
  };

  const handleSave = async (input: ContaFinanceiraInput, id?: string) => {
    if (id) {
      const { error } = await updateConta(id, input);
      if (error) Alert.alert('Erro', error);
    } else {
      const created = await addConta(input);
      if (!created) {
        const msg =
          useContaFinanceiraStore.getState().error ||
          'Não foi possível criar a conta.';
        Alert.alert('Erro', msg);
      }
    }
  };

  const confirmDelete = (conta: ContaFinanceira) => {
    setDeleteTarget(conta);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const { error } = await deleteConta(deleteTarget.id);
    setDeleteLoading(false);
    if (error) {
      Alert.alert('Erro', error);
      return;
    }
    setDeleteTarget(null);
  };

  const accountsGrid = (
    <View style={styles.grid}>
      {contasAtivas.length === 0 && !loading ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="wallet-outline" size={36} color={theme.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>Nenhuma conta ainda</Text>
          <Text style={styles.emptyText}>
            Cadastre contas e cartões para acompanhar saldos por instituição.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={openCreate}>
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.emptyBtnText}>Cadastrar primeira conta</Text>
          </TouchableOpacity>
        </View>
      ) : (
        contasAtivas.map((conta) => (
          <ContaCard
            key={conta.id}
            conta={conta}
            isDefault={isDefaultContaFinanceira(conta, contasAtivas)}
            saldo={saldosPorConta[conta.id] ?? conta.saldo_inicial}
            onPress={() => openEdit(conta)}
            onEdit={() => openEdit(conta)}
            onDelete={() => confirmDelete(conta)}
            equalFlex={gridCols > 1}
          />
        ))
      )}
    </View>
  );

  const panelBody = (
    <>
      {showPanelHeader ? (
        <ContasPageChrome
          bare
          theme={theme}
          accountCount={contasAtivas.length}
          onAddAccount={openCreate}
        />
      ) : null}

      {contasAtivas.length > 0 ? (
        <ContasMetrics
          totalConsolidado={totalConsolidado}
          accountCount={contasAtivas.length}
        />
      ) : null}

      {loading && contasAtivas.length === 0 ? (
        <ActivityIndicator color={theme.primary} style={styles.loader} />
      ) : (
        accountsGrid
      )}
    </>
  );

  const scrollContent = showPanelHeader ? (
    <View style={styles.shellColumn} onLayout={onLayout}>
      <View style={[styles.unifiedPanel, unifiedPanelChrome]}>{panelBody}</View>
    </View>
  ) : (
    <View style={styles.mobilePad} onLayout={onLayout}>
      {!showPanelHeader ? (
        <View style={styles.mobileHeader}>
          <View>
            <Text style={styles.mobileTitle}>Contas e cartões</Text>
            <Text style={styles.mobileSubtitle}>
              {contasAtivas.length === 1
                ? '1 conta cadastrada'
                : `${contasAtivas.length} contas cadastradas`}
            </Text>
          </View>
        </View>
      ) : null}
      {panelBody}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: shellBg }]} edges={['top', 'bottom']}>
      {!showPanelHeader ? (
        <MfAppHeader
          title="Contas"
          onMenuPress={openDrawer}
          right={
            <TouchableOpacity onPress={openCreate} accessibilityLabel="Nova conta">
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

      <ContaModal
        visible={modalVisible}
        conta={editingConta}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        useDialogLayout={showPanelHeader}
      />

      <MfConfirmDialog
        visible={deleteTarget != null}
        title="Excluir conta"
        message={
          deleteTarget
            ? `Remover "${deleteTarget.nome}"?`
            : 'Remover esta conta?'
        }
        detail="Lançamentos vinculados ficarão sem conta."
        confirmLabel="Excluir"
        confirmIntent="danger"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!deleteLoading) setDeleteTarget(null);
        }}
      />
    </SafeAreaView>
  );
}

function createStyles(
  theme: ReturnType<typeof getTheme>,
  shell: boolean,
  gridCols: GridColumns,
) {
  const isNative = Platform.OS !== 'web';

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
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: mfSpacing.md,
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      overflow: 'visible',
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
  });
}
