import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigationDrawer } from '../lib/navigationContext';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { getTheme, mfSpacing, mfTypography } from '../lib/theme';
import {
  deleteCategoryBudget,
  duplicateMonthlyBudgets,
  fetchCategoryBudgetsSummary,
  fetchUserCategories,
  saveCategoryBudget,
  type CategoryBudgetSummary,
} from '../lib/categoryService';
import { MfAppHeader, MfPeriodNav, MfScrollView } from '../components/ui';
import { MfConfirmDialog } from '../components/ui/MfConfirmDialog';
import { useShellLayout } from '../components/shell';
import { SHELL_CANVAS_DARK, SHELL_CANVAS_LIGHT } from '../components/shell/shellTokens';
import { useMfTheme } from '../components/ui/useMfTheme';
import { mfTechPanelChrome } from '../lib/techDesign';
import { useLayoutProfile, LAYOUT_WIDE_MIN, LAYOUT_INLINE_MIN } from '../lib/useLayoutProfile';
import { BudgetModal } from './Orcamentos/BudgetModal';
import { BudgetCategoryRow } from './Orcamentos/BudgetCategoryRow';
import { OrcamentosMetrics } from './Orcamentos/OrcamentosMetrics';
import { OrcamentosPageChrome } from './Orcamentos/orcamentosPageChrome';

interface Categoria {
  id: number;
  nome: string;
  tipo: string;
  user_id: string | null;
}

type GridColumns = 1 | 2 | 3;

export default function OrcamentosScreen() {
  const { userId } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  const { isDarkMode: mfDark } = useMfTheme();
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

  const shellBg =
    hasGlobalNav || Platform.OS === 'web'
      ? isDarkMode
        ? SHELL_CANVAS_DARK
        : SHELL_CANVAS_LIGHT
      : theme.background;

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [budgetsByCategoryId, setBudgetsByCategoryId] = useState<Record<number, number | null>>({});
  const [summaryByCategoryId, setSummaryByCategoryId] = useState<
    Record<number, CategoryBudgetSummary>
  >({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [budgetCategoria, setBudgetCategoria] = useState<Categoria | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Categoria | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const monthLabel = useMemo(() => {
    const date = new Date(year, month - 1, 1);
    const raw = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [month, year]);

  const fetchCategorias = async () => {
    if (!userId) {
      setCategorias([]);
      return;
    }
    try {
      const data = await fetchUserCategories(userId);
      const normalized = (data || []).map((cat) => ({
        id: Number(cat.id) || 0,
        nome: String(cat.nome || ''),
        tipo: String(cat.tipo || ''),
        user_id: cat.user_id || null,
      }));
      setCategorias(normalized);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      Alert.alert('Erro', `Erro ao carregar categorias: ${message}`);
      setCategorias([]);
    }
  };

  const fetchBudgets = async () => {
    if (!userId) {
      setBudgetsByCategoryId({});
      setSummaryByCategoryId({});
      return;
    }
    const summary = await fetchCategoryBudgetsSummary(userId, { year, month });
    const valuesMap: Record<number, number | null> = {};
    const summaryMap: Record<number, CategoryBudgetSummary> = {};
    summary.forEach((item) => {
      valuesMap[item.categorias_id] = item.valor_orcado ?? null;
      summaryMap[item.categorias_id] = item;
    });
    setBudgetsByCategoryId(valuesMap);
    setSummaryByCategoryId(summaryMap);
  };

  const categoriasComOrcamento = useMemo(
    () =>
      categorias.filter((cat) => {
        const budgetValue = budgetsByCategoryId[cat.id];
        return typeof budgetValue !== 'undefined' && budgetValue !== null;
      }),
    [categorias, budgetsByCategoryId],
  );

  const totals = useMemo(() => {
    let orcado = 0;
    let realizado = 0;
    categoriasComOrcamento.forEach((cat) => {
      const budget = budgetsByCategoryId[cat.id];
      const summary = summaryByCategoryId[cat.id];
      if (typeof budget === 'number') orcado += budget;
      if (summary) {
        realizado +=
          cat.tipo === 'entrada'
            ? Number(summary.valor_recebido ?? 0)
            : Number(summary.valor_gasto ?? 0);
      }
    });
    return { orcado, realizado };
  }, [categoriasComOrcamento, budgetsByCategoryId, summaryByCategoryId]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchCategorias(), fetchBudgets()]);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, [userId, month, year]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setContainerWidth((prev) => (prev === next ? prev : next));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((prev) => prev - 1);
    } else {
      setMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((prev) => prev + 1);
    } else {
      setMonth((prev) => prev + 1);
    }
  };

  const handleDuplicate = async () => {
    if (!userId) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }
    await duplicateMonthlyBudgets(userId, year, month);
    await fetchBudgets();
  };

  const handleSaveBudget = async ({
    categorias_id,
    valor_orcado,
  }: {
    categorias_id: number;
    valor_orcado: number | null;
  }) => {
    if (!userId) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }
    const currentMonthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const { error } = await saveCategoryBudget(
      userId,
      categorias_id,
      valor_orcado,
      currentMonthStart,
    );
    if (error) {
      Alert.alert('Erro', `Não foi possível salvar o orçamento: ${error.message}`);
      return;
    }
    await fetchBudgets();
  };

  const openNewBudget = () => {
    setBudgetCategoria(null);
    setBudgetModalOpen(true);
  };

  const openEditBudget = (cat: Categoria) => {
    setBudgetCategoria(cat);
    setBudgetModalOpen(true);
  };

  const openDeleteBudget = (cat: Categoria) => {
    setDeleteTarget(cat);
  };

  const handleConfirmDeleteBudget = async () => {
    if (!userId || !deleteTarget) return;
    const currentMonthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    setDeleteLoading(true);
    const { error } = await deleteCategoryBudget(
      userId,
      deleteTarget.id,
      currentMonthStart,
    );
    setDeleteLoading(false);
    if (error) {
      Alert.alert('Erro', `Não foi possível remover o orçamento: ${error.message}`);
      return;
    }
    setDeleteTarget(null);
    await fetchBudgets();
  };

  const periodNav = (
    <MfPeriodNav
      label={monthLabel}
      onPrevious={handlePrevMonth}
      onNext={handleNextMonth}
      style={styles.periodNav}
    />
  );

  const listSection =
    categoriasComOrcamento.length === 0 ? (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Ionicons name="wallet-outline" size={36} color={theme.textTertiary} />
        </View>
        <Text style={styles.emptyTitle}>Nenhum orçamento neste mês</Text>
        <Text style={styles.emptyText}>
          Defina limites por categoria para acompanhar gastos e receitas.
        </Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={openNewBudget}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.emptyBtnText}>Criar primeiro orçamento</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <>
        <Text style={styles.sectionLabel}>
          {categoriasComOrcamento.length}{' '}
          {categoriasComOrcamento.length === 1 ? 'categoria' : 'categorias'} com orçamento
        </Text>
        <View style={styles.grid}>
          {categoriasComOrcamento.map((cat) => (
            <BudgetCategoryRow
              key={cat.id}
              cat={cat}
              budgetValue={budgetsByCategoryId[cat.id]}
              summary={summaryByCategoryId[cat.id]}
              onPress={() => openEditBudget(cat)}
              onDelete={() => openDeleteBudget(cat)}
              equalFlex={gridCols > 1}
            />
          ))}
        </View>
      </>
    );

  const panelBody = (
    <>
      {showPanelHeader ? (
        <OrcamentosPageChrome
          bare
          theme={theme}
          budgetCount={categoriasComOrcamento.length}
          monthLabel={monthLabel}
          onNewBudget={openNewBudget}
          onDuplicate={handleDuplicate}
        />
      ) : null}

      {periodNav}

      {categoriasComOrcamento.length > 0 ? (
        <OrcamentosMetrics totalOrcado={totals.orcado} totalRealizado={totals.realizado} />
      ) : null}

      {!showPanelHeader ? (
        <View style={styles.mobileActions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={openNewBudget}
            accessibilityRole="button"
            accessibilityLabel="Novo orçamento"
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Novo orçamento</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleDuplicate}
            accessibilityRole="button"
            accessibilityLabel="Duplicar mês anterior"
          >
            <Ionicons name="copy-outline" size={18} color={theme.primary} />
            <Text style={styles.secondaryBtnText}>Duplicar mês</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && categoriasComOrcamento.length === 0 ? (
        <ActivityIndicator color={theme.primary} style={styles.loader} />
      ) : (
        listSection
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
          <Text style={styles.mobileTitle}>Orçamentos</Text>
          <Text style={styles.mobileSubtitle}>Planeje seu mês por categoria</Text>
        </View>
      ) : null}
      {panelBody}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: shellBg }]} edges={['top', 'bottom']}>
      {!showPanelHeader ? (
        <MfAppHeader
          title="Orçamentos"
          subtitle="Planeje seu mês por categoria"
          onMenuPress={openDrawer}
        />
      ) : null}

      <MfScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
      >
        {scrollContent}
      </MfScrollView>

      <BudgetModal
        visible={budgetModalOpen}
        categorias={categorias}
        currentCategoria={budgetCategoria}
        currentValue={budgetCategoria ? budgetsByCategoryId[budgetCategoria.id] : null}
        onClose={() => {
          setBudgetModalOpen(false);
          setBudgetCategoria(null);
        }}
        onSave={handleSaveBudget}
        useDialogLayout={showPanelHeader}
      />

      <MfConfirmDialog
        visible={deleteTarget != null}
        title="Remover orçamento"
        message={
          deleteTarget
            ? `Remover o planejamento de "${deleteTarget.nome}" em ${monthLabel}?`
            : 'Remover este orçamento?'
        }
        detail="O valor realizado do mês não é apagado. A categoria continua cadastrada."
        confirmLabel="Remover"
        confirmIntent="danger"
        loading={deleteLoading}
        onConfirm={handleConfirmDeleteBudget}
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
    periodNav: {
      marginBottom: mfSpacing.sm,
    },
    mobileActions: {
      flexDirection: 'row',
      gap: mfSpacing.sm,
      marginBottom: mfSpacing.md,
    },
    primaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: mfSpacing.sm,
      backgroundColor: theme.primary,
      paddingVertical: mfSpacing.md,
      borderRadius: 10,
      minHeight: isNative ? 48 : undefined,
    },
    primaryBtnText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 14,
    },
    secondaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: mfSpacing.sm,
      backgroundColor: theme.backgroundMuted,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: mfSpacing.md,
      borderRadius: 10,
      minHeight: isNative ? 48 : undefined,
    },
    secondaryBtnText: {
      color: theme.primary,
      fontWeight: '600',
      fontSize: 12,
    },
    sectionLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textTertiary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: mfSpacing.sm,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: mfSpacing.md,
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      overflow: 'visible',
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
  });
}
