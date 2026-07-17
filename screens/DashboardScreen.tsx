import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTransactionStore } from '../store/transactionStore';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { getTheme, mfRadius, mfSpacing } from '../lib/theme';
import { MfScrollView } from '../components/ui/MfScrollView';
import {
  normalizarTipo,
  normalizarValor,
  parsearData,
  normalizeCategoryKey,
} from '../lib/dashboardUtils';
import { isInSelectedMonth } from '../lib/transactionPeriodFilter';
import { useDashboardCategories } from '../hooks/useDashboardCategories';
import { useDashboardBudgetSummary } from '../hooks/useDashboardBudgetSummary';
import { useDashboardBpo } from '../hooks/useDashboardBpo';
import { createDashboardStyles } from './Dashboard/dashboardStyles';
import { DashboardMissionControl } from './Dashboard/DashboardMissionControl';
import { DashboardBudgetCard } from './Dashboard/DashboardBudgetCard';
import { DashboardSaldoChart } from './Dashboard/DashboardSaldoChart';
import { DashboardDailyFlow } from './Dashboard/DashboardDailyFlow';
import { DashboardExpenseSection } from './Dashboard/DashboardExpenseSection';
import { DashboardRecentActivity } from './Dashboard/DashboardRecentActivity';
import { buildDashboardInsights, buildRecentActivity, buildTodayFlow } from './Dashboard/dashboardInsights';
import { useNavigationDrawer } from '../lib/navigationContext';
import { useShellLayout } from '../components/shell';
import { SHELL_CANVAS_DARK, SHELL_CANVAS_LIGHT } from '../components/shell/shellTokens';
import { MfAppHeader, MfContentPanel, MfPeriodNav } from '../components/ui';
import { DashboardPageHeader } from './Dashboard/DashboardPageHeader';
import { findFirstBpoQuarterWithData } from './Dashboard/bpoChartHelpers';
import { BpoCategoryCard } from './Dashboard/BpoCategoryCard';
import { BpoBudgetMatrixPanel } from './Dashboard/BpoBudgetMatrixPanel';
import { useBpoMatrix } from '../hooks/useBpoMatrix';
import { DashboardContasResumo } from './Dashboard/DashboardContasResumo';
import { DashboardContaGlobalLink } from './Dashboard/DashboardContaGlobalLink';
import { DashboardAccessRequests } from './Dashboard/DashboardAccessRequests';
import { DashboardCanvasBackground } from './Dashboard/DashboardCanvasBackground';
import { getDashboardCanvasStyle } from '../lib/glassStyles';
import { getTechTokens } from '../lib/techDesign';
import { useUserContasFinanceiras } from '../hooks/useUserContasFinanceiras';
import {
  filterTransactionsByConta,
  resolveDashboardBalance,
  type ContaFilterValue,
} from '../lib/contaFinanceiraIntegration';
import { isRealizedLancamentoStatus } from '../lib/contaSaldo';

const BPO_CHART_MIN_WIDTH = 280;
const BPO_YEAR_MIN = 2020;

export default function DashboardScreen() {
  const { transactions, fetchTransactions, loading } = useTransactionStore();
  const { userId, displayName } = useAuthStore();
  const {
    contasAtivas,
    contasComSaldo,
    contaNameById,
    refetch: refetchContas,
  } = useUserContasFinanceiras(userId, transactions);
  const [dashboardContaFilter, setDashboardContaFilter] = useState<ContaFilterValue>('all');
  const { isDarkMode } = useThemeStore();
  const { openDrawer, hasGlobalNav, navigateTo } = useNavigationDrawer();
  const { isWebDesktop } = useShellLayout();
  const { width: winWidth } = useWindowDimensions();
  const isDesktop = winWidth >= 900;
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const useShellCanvas = hasGlobalNav || Platform.OS === 'web';
  const showPanelHeader = isWebDesktop && hasGlobalNav;
  const styles = useMemo(
    () =>
      createDashboardStyles(theme, isDesktop, {
        isDarkMode,
        insidePanel: true,
        shellCanvas: useShellCanvas,
      }),
    [theme, isDesktop, isDarkMode, useShellCanvas]
  );
  const shellBg = useShellCanvas
    ? getDashboardCanvasStyle(isDarkMode).backgroundColor ?? (isDarkMode ? SHELL_CANVAS_DARK : SHELL_CANVAS_LIGHT)
    : theme.background;

  const { categoriasMap, categoriasTipoMap, fetchCategories } = useDashboardCategories(userId);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const { budgetSummary, fetchCategoryBudgetsSummary } = useDashboardBudgetSummary(
    userId,
    categoriasMap,
    selectedMonth
  );
  const [bpoYear, setBpoYear] = useState(now.getFullYear());
  const { bpoBudgetRows, bpoLoading } = useDashboardBpo(userId, bpoYear);

  const [refreshing, setRefreshing] = useState(false);

  const goToPrevMonth = () => setSelectedMonth(({ year, month }) => {
    const prev = new Date(year, month - 2, 1);
    return { year: prev.getFullYear(), month: prev.getMonth() + 1 };
  });
  const goToNextMonth = () => setSelectedMonth(({ year, month }) => {
    const next = new Date(year, month, 1);
    return { year: next.getFullYear(), month: next.getMonth() + 1 };
  });

  const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const [expenseTab, setExpenseTab] = useState<'pagos' | 'a_pagar'>('pagos');
  const [budgetTab, setBudgetTab] = useState<'entrada' | 'saida'>('saida');
  const [isBpoView, setIsBpoView] = useState(false);
  const [bpoViewMode, setBpoViewMode] = useState<'matriz' | 'graficos'>('matriz');
  const { cells: bpoMatrixCells, categories: bpoMatrixCategories, loading: bpoMatrixLoading, error: bpoMatrixError, refetch: refetchBpoMatrix } = useBpoMatrix(userId, bpoYear);
  const [bpoTooltip, setBpoTooltip] = useState<{ categoryId: string; monthIndex: number } | null>(null);
  const [bpoQuarterIndexByCategory, setBpoQuarterIndexByCategory] = useState<Record<string, number>>({});
  const currentCalendarYear = now.getFullYear();

  const goToPrevBpoYear = () => {
    setBpoYear((year) => Math.max(BPO_YEAR_MIN, year - 1));
  };
  const goToNextBpoYear = () => {
    setBpoYear((year) => Math.min(currentCalendarYear, year + 1));
  };

  useEffect(() => {
    setBpoQuarterIndexByCategory({});
    setBpoTooltip(null);
  }, [bpoYear]);

  useEffect(() => {
    if (userId) fetchTransactions();
  }, [userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchTransactions(),
      fetchCategories(),
      fetchCategoryBudgetsSummary(),
      refetchContas(),
    ]);
    setRefreshing(false);
  };

  const transactionsScoped = useMemo(
    () => filterTransactionsByConta(transactions, dashboardContaFilter),
    [transactions, dashboardContaFilter],
  );

  const legacyBalance = useMemo(() => {
    let sum = 0;
    for (const t of transactions) {
      if (!isRealizedLancamentoStatus(t.status)) continue;
      const val = normalizarValor(t.valor);
      sum += normalizarTipo(t.tipo) === 'entrada' ? val : -val;
    }
    return sum;
  }, [transactions]);

  const balanceMeta = useMemo(
    () =>
      resolveDashboardBalance(
        contasAtivas,
        transactions,
        legacyBalance,
        dashboardContaFilter,
      ),
    [contasAtivas, transactions, legacyBalance, dashboardContaFilter],
  );

  const balance = balanceMeta.value;

  const balanceLabel =
    dashboardContaFilter === 'all'
      ? balanceMeta.mode === 'contas'
        ? 'Saldo nas contas'
        : 'Saldo geral'
      : dashboardContaFilter === 'unassigned'
        ? 'Meu financeiro'
        : contaNameById[dashboardContaFilter] || 'Conta';

  const balanceHint =
    dashboardContaFilter === 'all'
      ? balanceMeta.mode === 'contas'
        ? 'Soma dos saldos cadastrados'
        : 'Acumulado'
      : dashboardContaFilter === 'unassigned'
        ? 'Sem vínculo com conta bancária'
        : 'Filtrado nesta visão';

  const monthTransactions = useMemo(() => {
    return transactionsScoped.filter((t) => isInSelectedMonth(t, selectedMonth));
  }, [transactionsScoped, selectedMonth]);

  const totalIncome = monthTransactions
    .filter((t) => normalizarTipo(t.tipo) === 'entrada' && isRealizedLancamentoStatus(t.status))
    .reduce((sum, t) => sum + normalizarValor(t.valor), 0);

  const totalExpenses = monthTransactions
    .filter((t) => normalizarTipo(t.tipo) === 'saida' && isRealizedLancamentoStatus(t.status))
    .reduce((sum, t) => sum + normalizarValor(t.valor), 0);

  // Dados para gráfico de linha (evolução do saldo no mês) — 1 ponto por dia
  const sortedByDate = [...monthTransactions].sort((a, b) => {
    const dateA = parsearData(a.data, a.criado_em);
    const dateB = parsearData(b.data, b.criado_em);
    return dateA.getTime() - dateB.getTime();
  });

  const toDayKey = (t: typeof sortedByDate[number]) => {
    const d = parsearData(t.data, t.criado_em);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const daySaldoMap = new Map<string, number>();
  let saldoAcumulado = 0;
  for (const t of sortedByDate) {
    if (!isRealizedLancamentoStatus(t.status)) continue;
    const valor = normalizarValor(t.valor);
    const tipoNormalizado = normalizarTipo(t.tipo);
    saldoAcumulado += tipoNormalizado === 'entrada' ? valor : -valor;
    daySaldoMap.set(toDayKey(t), saldoAcumulado);
  }

  const dayKeys = Array.from(daySaldoMap.keys()).sort();
  const saldoData = dayKeys.map((k) => daySaldoMap.get(k) as number);

  const despesasPeriodo = monthTransactions.filter(t => normalizarTipo(t.tipo) === 'saida');

  // Despesas por categoria (filtradas por status)
  const reduceByCategory = (list: typeof despesasPeriodo) =>
    list.reduce((acc, curr) => {
      const valor = typeof curr.valor === 'number'
        ? curr.valor
        : typeof curr.valor === 'string'
        ? parseFloat(curr.valor) || 0
        : 0;
      let catKey = curr.categoria ? String(curr.categoria) : String(curr.classificacao || '');
      if (!catKey || catKey === 'NaN' || catKey === 'undefined' || catKey === 'null') {
        catKey = 'sem-categoria';
      }
      acc[catKey] = (acc[catKey] || 0) + valor;
      return acc;
    }, {} as Record<string, number>);

  const despesasPagos = despesasPeriodo.filter((t) => t.status === 'pago');
  const despesasAPagar = despesasPeriodo.filter((t) => t.status === 'a_pagar');
  const expensesByCategoryPagos = reduceByCategory(despesasPagos);
  const expensesByCategoryAPagar = reduceByCategory(despesasAPagar);
  const totalPagos = Object.values(expensesByCategoryPagos).reduce((s, v) => s + v, 0);
  const totalAPagar = Object.values(expensesByCategoryAPagar).reduce((s, v) => s + v, 0);

  const expensesByCategoryFiltered =
    expenseTab === 'pagos' ? expensesByCategoryPagos : expensesByCategoryAPagar;
  const totalFiltrado = expenseTab === 'pagos' ? totalPagos : totalAPagar;

  const categorizedBudgets = useMemo(() => {
    return budgetSummary
      .filter((item) => item.valor_orcado !== null && Number(item.valor_orcado) > 0)
      .map((item) => {
        const orcado = normalizarValor(item.valor_orcado);
        const gasto = normalizarValor(item.valor_gasto);
        const recebido = normalizarValor(item.valor_recebido);
        const tipo = categoriasTipoMap[String(item.categorias_id)] || 'saida';
        const realizado = tipo === 'entrada' ? recebido : gasto;
        const percentual = orcado > 0 ? (realizado / orcado) * 100 : 0;
        return {
          categorias_id: item.categorias_id,
          nome: categoriasMap[String(item.categorias_id)] || 'Sem categoria',
          tipo,
          orcado,
          realizado,
          percentual,
        };
      });
  }, [budgetSummary, categoriasMap, categoriasTipoMap]);

  const bucketedBudgets = useMemo(() => {
    const filtered = categorizedBudgets.filter((item) => item.tipo === budgetTab);
    if (budgetTab === 'entrada') {
      return {
        verde: filtered.filter((item) => item.percentual >= 75),
        amarelo: filtered.filter((item) => item.percentual > 50 && item.percentual < 75),
        laranja: filtered.filter((item) => item.percentual > 25 && item.percentual <= 50),
        vermelho: filtered.filter((item) => item.percentual <= 25),
      };
    }
    return {
      verde: filtered.filter((item) => item.percentual <= 25),
      amarelo: filtered.filter((item) => item.percentual > 25 && item.percentual <= 50),
      laranja: filtered.filter((item) => item.percentual > 50 && item.percentual <= 75),
      vermelho: filtered.filter((item) => item.percentual > 75),
    };
  }, [categorizedBudgets, budgetTab]);

  const hasAnyBudgetInTab = useMemo(() => {
    const b = bucketedBudgets;
    return (
      b.verde.length + b.amarelo.length + b.laranja.length + b.vermelho.length
    ) > 0;
  }, [bucketedBudgets]);

  const dashboardInsights = useMemo(
    () =>
      buildDashboardInsights(
        transactionsScoped,
        selectedMonth.year,
        selectedMonth.month,
        categoriasMap,
      ),
    [transactionsScoped, selectedMonth.year, selectedMonth.month, categoriasMap],
  );

  const recentActivity = useMemo(
    () =>
      buildRecentActivity(
        transactionsScoped,
        selectedMonth.year,
        selectedMonth.month,
        categoriasMap,
        6,
      ),
    [transactionsScoped, selectedMonth.year, selectedMonth.month, categoriasMap],
  );

  const todayFlow = useMemo(
    () => buildTodayFlow(transactionsScoped),
    [transactionsScoped],
  );

  const bpoLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const bpoQuarterSlides = [
    { key: 'T1', label: '1° Trimestre', labels: ['Jan', 'Fev', 'Mar'], months: [0, 1, 2] },
    { key: 'T2', label: '2° Trimestre', labels: ['Abr', 'Mai', 'Jun'], months: [3, 4, 5] },
    { key: 'T3', label: '3° Trimestre', labels: ['Jul', 'Ago', 'Set'], months: [6, 7, 8] },
    { key: 'T4', label: '4° Trimestre', labels: ['Out', 'Nov', 'Dez'], months: [9, 10, 11] },
  ];
  const bpoCategorySeries = useMemo(() => {
    const budgetedByCategory: Record<string, number[]> = {};
    const realizedByCategory: Record<string, number[]> = {};
    const typeByCategory: Record<string, 'entrada' | 'saida'> = {};

    const ensureCategory = (catId: string) => {
      if (!budgetedByCategory[catId]) {
        budgetedByCategory[catId] = Array(12).fill(0);
      }
      if (!realizedByCategory[catId]) {
        realizedByCategory[catId] = Array(12).fill(0);
      }
    };

    (bpoBudgetRows || []).forEach((row: any) => {
      const catId = String(row?.categorias_id || '');
      if (!catId) return;
      const tipo = categoriasTipoMap[catId] || 'saida';
      const valor = typeof row?.valor_orçado === 'number' ? row.valor_orçado : Number(row?.valor_orçado || 0);
      if (!row?.date) return;
      const monthIndex = Number(String(row.date).split('-')[1]) - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        ensureCategory(catId);
        budgetedByCategory[catId][monthIndex] += Number.isNaN(valor) ? 0 : valor;
        typeByCategory[catId] = tipo;
      }
    });

    const nameToId: Record<string, string> = {};
    Object.entries(categoriasMap).forEach(([id, nome]) => {
      if (nome) {
        nameToId[normalizeCategoryKey(nome)] = id;
      }
    });

    transactionsScoped.forEach((transaction) => {
      const date = parsearData(transaction.data, transaction.criado_em);
      if (date.getFullYear() !== bpoYear) return;
      const tipo = normalizarTipo(transaction.tipo);
      let catId = '';
      if (transaction.categoria && categoriasMap[String(transaction.categoria)]) {
        catId = String(transaction.categoria);
      } else {
        const key = normalizeCategoryKey(String(transaction.classificacao || transaction.categoria || ''));
        catId = nameToId[key] || '';
      }
      if (!catId) {
        catId = 'sem-categoria';
      }
      ensureCategory(catId);
      realizedByCategory[catId][date.getMonth()] += normalizarValor(transaction.valor);
      if (!typeByCategory[catId]) {
        typeByCategory[catId] = tipo;
      }
    });

    const categoryIds = Array.from(
      new Set([...Object.keys(budgetedByCategory), ...Object.keys(realizedByCategory)])
    );

    return categoryIds
      .map((catId) => {
        const budgeted = budgetedByCategory[catId] || Array(12).fill(0);
        const realized = realizedByCategory[catId] || Array(12).fill(0);
        const totalBudgeted = budgeted.reduce((sum, val) => sum + val, 0);
        const totalRealized = realized.reduce((sum, val) => sum + val, 0);
        return {
          id: catId,
          name: categoriasMap[catId] || (catId === 'sem-categoria' ? 'Sem categoria' : catId),
          type: typeByCategory[catId] || categoriasTipoMap[catId] || 'saida',
          budgeted,
          realized,
          totalBudgeted,
          totalRealized,
        };
      })
      .filter((item) => item.totalBudgeted > 0)
      .sort((a, b) => b.totalRealized - a.totalRealized);
  }, [bpoBudgetRows, transactionsScoped, bpoYear, categoriasTipoMap, categoriasMap]);

  const bpoCategoryByType = useMemo(() => {
    const entrada = bpoCategorySeries.filter((item) => item.type === 'entrada');
    const saida = bpoCategorySeries.filter((item) => item.type !== 'entrada');
    return { entrada, saida };
  }, [bpoCategorySeries]);

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatAxisValue = (rawValue: number) => {
    const value = Number.isFinite(rawValue) ? rawValue : 0;
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };
  const yAxisTicks = 6;
  const yAxisWidth = 72;
  const chartWidth = isWebDesktop
    ? Math.min(520, Math.max(BPO_CHART_MIN_WIDTH, Math.round(winWidth * 0.38)))
    : Math.max(BPO_CHART_MIN_WIDTH, Math.round(winWidth - 88));
  const chartAreaWidthBase = Math.max(120, chartWidth - yAxisWidth - 20);
  const handleBpoQuarterChange = (categoryKey: string, index: number) => {
    setBpoQuarterIndexByCategory((prev) =>
      prev[categoryKey] === index ? prev : { ...prev, [categoryKey]: index }
    );
  };
  const handleBpoMonthPress = (categoryId: string, monthIndex: number) => {
    setBpoTooltip((prev) =>
      prev?.categoryId === categoryId && prev.monthIndex === monthIndex
        ? null
        : { categoryId, monthIndex }
    );
  };
  const chartHeight = 200;
  const chartPaddingTop = 15;
  const verticalLabelsHeightPercentage = 0.75;
  const yAxisPaddingBottom = chartHeight - chartPaddingTop - chartHeight * verticalLabelsHeightPercentage;
  const chartPaddingRight = 50;
  const chartConfigBase = {
    backgroundColor: 'transparent',
    backgroundGradientFrom: 'transparent',
    backgroundGradientTo: 'transparent',
    decimalPlaces: 0,
    barPercentage: 0.85,
    color: (opacity = 1) => `rgba(${isDarkMode ? '255, 255, 255' : '0, 0, 0'}, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(${isDarkMode ? '255, 255, 255' : '0, 0, 0'}, ${opacity})`,
    propsForBackgroundLines: {
      strokeDasharray: '4 6',
      stroke: theme.border,
    },
    propsForLabels: {
      fontSize: 11,
    },
    propsForHorizontalLabels: {
      opacity: 0,
      fill: 'transparent',
    },
  };
  const techTokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const bpoToggle = (
    <Pressable
      onPress={() => setIsBpoView((prev) => !prev)}
      accessibilityRole="button"
      accessibilityLabel={isBpoView ? 'Sair da visão BPO' : 'Abrir visão BPO'}
      style={({ pressed }) => [
        {
          paddingVertical: 6,
          paddingHorizontal: 14,
          borderRadius: mfRadius.sm,
          borderWidth: 1,
          borderColor: isBpoView ? techTokens.accent : techTokens.insetBorder,
          backgroundColor: isBpoView ? techTokens.accentSoft : techTokens.insetFill,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: isBpoView ? techTokens.accent : theme.textSecondary,
        }}
      >
        BPO
      </Text>
    </Pressable>
  );

  if (loading && transactions.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: shellBg }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const showContaChips = contasComSaldo.length > 0

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: shellBg }]} edges={['top', 'bottom']}>
      {useShellCanvas && !hasGlobalNav ? (
        <DashboardCanvasBackground isDarkMode={isDarkMode} />
      ) : null}
      {!showPanelHeader ? (
        <MfAppHeader
          title="Visão Geral"
          subtitle={`Olá, ${displayName || 'Usuário'}`}
          onMenuPress={openDrawer}
          right={bpoToggle}
        />
      ) : null}
      {!showPanelHeader && showContaChips && isBpoView ? (
        <View style={styles.contaChipsBelowHeader}>
          <DashboardContasResumo
            contas={contasComSaldo}
            selectedFilter={dashboardContaFilter}
            onSelectFilter={setDashboardContaFilter}
            variant="minimal"
          />
        </View>
      ) : null}

      <MfScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isBpoView ? (
          <MfContentPanel padding={isDesktop ? 'lg' : 'md'} variant="transparent">
            <DashboardPageHeader
              title="Visão BPO"
              subtitle={
                dashboardContaFilter === 'all'
                  ? 'Orçamento x realizado por categoria'
                  : dashboardContaFilter === 'unassigned'
                    ? 'Meu financeiro · lançamentos sem conta bancária'
                    : `${contaNameById[dashboardContaFilter] || 'Conta'} · orçamento x realizado`
              }
              right={bpoToggle}
            />
            <View
              style={{
                marginBottom: mfSpacing.md,
                flexDirection: isDesktop ? 'row' : 'column',
                alignItems: isDesktop ? 'center' : 'stretch',
                justifyContent: 'space-between',
                gap: mfSpacing.sm,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  borderWidth: 1,
                  borderColor: techTokens.insetBorder,
                  borderRadius: mfRadius.sm,
                  overflow: 'hidden',
                  alignSelf: isDesktop ? 'flex-start' : 'stretch',
                }}
              >
                <Pressable
                  onPress={() => setBpoViewMode('matriz')}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: bpoViewMode === 'matriz' }}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    backgroundColor: bpoViewMode === 'matriz' ? techTokens.accentSoft : techTokens.insetFill,
                  }}
                >
                  <Text
                    style={{
                      textAlign: 'center',
                      fontSize: 12,
                      fontWeight: '700',
                      color: bpoViewMode === 'matriz' ? techTokens.accent : theme.textSecondary,
                    }}
                  >
                    Matriz
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setBpoViewMode('graficos')}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: bpoViewMode === 'graficos' }}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    backgroundColor: bpoViewMode === 'graficos' ? techTokens.accentSoft : techTokens.insetFill,
                    borderLeftWidth: 1,
                    borderLeftColor: techTokens.insetBorder,
                  }}
                >
                  <Text
                    style={{
                      textAlign: 'center',
                      fontSize: 12,
                      fontWeight: '700',
                      color: bpoViewMode === 'graficos' ? techTokens.accent : theme.textSecondary,
                    }}
                  >
                    Gráficos
                  </Text>
                </Pressable>
              </View>
              <MfPeriodNav
                label={String(bpoYear)}
                onPrevious={goToPrevBpoYear}
                onNext={goToNextBpoYear}
                disablePrevious={bpoYear <= BPO_YEAR_MIN}
                disableNext={bpoYear >= currentCalendarYear}
              />
            </View>
            {bpoViewMode === 'matriz' ? (
              <BpoBudgetMatrixPanel
                year={bpoYear}
                categories={bpoMatrixCategories}
                cells={bpoMatrixCells}
                transactions={transactionsScoped}
                loading={bpoMatrixLoading}
                error={bpoMatrixError}
                onRetry={() => void refetchBpoMatrix()}
                theme={theme}
                styles={styles}
                isDarkMode={isDarkMode}
              />
            ) : null}
            {bpoViewMode === 'graficos' && bpoLoading ? (
              <View style={[styles.loadingContainer, { minHeight: 160, paddingVertical: 32 }]}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={styles.loadingText}>Carregando orçamentos de {bpoYear}...</Text>
              </View>
            ) : bpoViewMode === 'graficos' && bpoCategorySeries.length > 0 ? (
              <>
                <View style={styles.bpoSection}>
                  <View style={styles.bpoSectionHeader}>
                    <View style={styles.bpoSectionTitleGroup}>
                      <Text style={styles.bpoSectionTitle}>Entradas</Text>
                      <View style={[styles.bpoSectionChip, styles.bpoSectionChipIncome]}>
                        <Text style={[styles.bpoSectionChipText, styles.bpoSectionChipTextIncome]}>Entrada</Text>
                      </View>
                    </View>
                    <Text style={styles.bpoSectionCount}>{bpoCategoryByType.entrada.length} categorias</Text>
                  </View>
                  {bpoCategoryByType.entrada.length > 0 ? (
                    bpoCategoryByType.entrada.map((category) => (
                      <BpoCategoryCard
                        key={category.id}
                        category={category}
                        chipLabel="Entrada"
                        chipStyle={[styles.bpoCategoryChip, styles.bpoCategoryChipIncome]}
                        chipTextStyle={[styles.bpoCategoryChipText, styles.bpoCategoryChipTextIncome]}
                        bpoLabels={bpoLabels}
                        bpoTooltip={bpoTooltip}
                        quarterIndex={
                          bpoQuarterIndexByCategory[String(category.id)] ??
                          findFirstBpoQuarterWithData(category, bpoQuarterSlides)
                        }
                        onQuarterChange={handleBpoQuarterChange}
                        onMonthPress={handleBpoMonthPress}
                        quarters={bpoQuarterSlides}
                        chartWidth={chartWidth}
                        chartAreaWidth={chartAreaWidthBase}
                        chartHeight={chartHeight}
                        yAxisWidth={yAxisWidth}
                        yAxisTicks={yAxisTicks}
                        chartPaddingTop={chartPaddingTop}
                        yAxisPaddingBottom={yAxisPaddingBottom}
                        chartPaddingRight={chartPaddingRight}
                        chartConfigBase={chartConfigBase}
                        barPercentage={chartConfigBase.barPercentage ?? 0.85}
                        theme={theme}
                        styles={styles}
                        isDarkMode={isDarkMode}
                        formatCurrency={formatCurrency}
                        formatAxisValue={formatAxisValue}
                      />
                    ))
                  ) : (
                    <View style={styles.emptyCategoryContainer}>
                      <Text style={styles.emptyCategoryText}>Nenhuma categoria de entrada com orçamento.</Text>
                    </View>
                  )}
                </View>

                <View style={styles.bpoSection}>
                  <View style={styles.bpoSectionHeader}>
                    <View style={styles.bpoSectionTitleGroup}>
                      <Text style={styles.bpoSectionTitle}>Saídas</Text>
                      <View style={[styles.bpoSectionChip, styles.bpoSectionChipExpense]}>
                        <Text style={[styles.bpoSectionChipText, styles.bpoSectionChipTextExpense]}>Saída</Text>
                      </View>
                    </View>
                    <Text style={styles.bpoSectionCount}>{bpoCategoryByType.saida.length} categorias</Text>
                  </View>
                  {bpoCategoryByType.saida.length > 0 ? (
                    bpoCategoryByType.saida.map((category) => (
                      <BpoCategoryCard
                        key={category.id}
                        category={category}
                        chipLabel="Saída"
                        chipStyle={[styles.bpoCategoryChip, styles.bpoCategoryChipExpense]}
                        chipTextStyle={[styles.bpoCategoryChipText, styles.bpoCategoryChipTextExpense]}
                        bpoLabels={bpoLabels}
                        bpoTooltip={bpoTooltip}
                        quarterIndex={
                          bpoQuarterIndexByCategory[String(category.id)] ??
                          findFirstBpoQuarterWithData(category, bpoQuarterSlides)
                        }
                        onQuarterChange={handleBpoQuarterChange}
                        onMonthPress={handleBpoMonthPress}
                        quarters={bpoQuarterSlides}
                        chartWidth={chartWidth}
                        chartAreaWidth={chartAreaWidthBase}
                        chartHeight={chartHeight}
                        yAxisWidth={yAxisWidth}
                        yAxisTicks={yAxisTicks}
                        chartPaddingTop={chartPaddingTop}
                        yAxisPaddingBottom={yAxisPaddingBottom}
                        chartPaddingRight={chartPaddingRight}
                        chartConfigBase={chartConfigBase}
                        barPercentage={chartConfigBase.barPercentage ?? 0.85}
                        theme={theme}
                        styles={styles}
                        isDarkMode={isDarkMode}
                        formatCurrency={formatCurrency}
                        formatAxisValue={formatAxisValue}
                      />
                    ))
                  ) : (
                    <View style={styles.emptyCategoryContainer}>
                      <Text style={styles.emptyCategoryText}>Nenhuma categoria de saída com orçamento.</Text>
                    </View>
                  )}
                </View>
              </>
            ) : bpoViewMode === 'graficos' ? (
              <View style={styles.emptyCategoryContainer}>
                <Text style={styles.emptyCategoryText}>
                  Nenhuma categoria com orçamento em {bpoYear}.
                </Text>
              </View>
            ) : null}
          </MfContentPanel>
        ) : (
          <View style={isDesktop ? { flexDirection: 'row', gap: mfSpacing.lg, alignItems: 'flex-start' } : styles.techPage}>
            <View style={isDesktop ? { flex: 1, minWidth: 0 } : styles.techPage}>
              <DashboardMissionControl
                title="Visão Geral"
                subtitle={`Olá, ${displayName || 'Usuário'}`}
                monthLabel={`${MONTH_NAMES[selectedMonth.month - 1]} ${selectedMonth.year}`}
                onPrevMonth={goToPrevMonth}
                onNextMonth={goToNextMonth}
                right={bpoToggle}
                showCommandTitle={showPanelHeader}
                balance={balance}
                totalIncome={totalIncome}
                totalExpenses={totalExpenses}
                balanceLabel={balanceLabel}
                balanceHint={balanceHint}
                insights={dashboardInsights}
                isDesktop={isDesktop}
                compactHeader={showPanelHeader}
                chipsSlot={
                  showContaChips ? (
                    <DashboardContasResumo
                      contas={contasComSaldo}
                      selectedFilter={dashboardContaFilter}
                      onSelectFilter={setDashboardContaFilter}
                      variant="minimal"
                    />
                  ) : undefined
                }
              />

              <DashboardContaGlobalLink />

              {isDesktop ? (
                <>
                  <View style={styles.techMainGrid}>
                    <View style={styles.techGridPrimary}>
                      <DashboardDailyFlow
                        today={todayFlow}
                        theme={theme}
                        styles={styles}
                        isDesktop={isDesktop}
                      />
                      {saldoData.length > 1 ? (
                        <DashboardSaldoChart
                          sortedLabels={dayKeys.map((k, i) => {
                            if (i === 0 || i === dayKeys.length - 1 || i % Math.ceil(dayKeys.length / 4) === 0) {
                              const [yyyy, mm, dd] = k.split('-');
                              const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                              const day = String(date.getDate()).padStart(2, '0');
                              const monthShort = MONTH_NAMES[date.getMonth()].slice(0, 3).toLowerCase();
                              return `${day} ${monthShort}`;
                            }
                            return '';
                          })}
                          saldoData={saldoData}
                          screenWidth={winWidth}
                          isDarkMode={isDarkMode}
                          theme={theme}
                          styles={styles}
                          isDesktop={isDesktop}
                        />
                      ) : null}
                    </View>
                    <View style={styles.techGridSecondary}>
                      <DashboardExpenseSection
                        expenseTab={expenseTab}
                        onExpenseTabChange={setExpenseTab}
                        expensesByCategory={expensesByCategoryFiltered}
                        categoriasMap={categoriasMap}
                        totalFiltrado={totalFiltrado}
                        styles={styles}
                        isDesktop
                        theme={theme}
                        expensesPagos={expensesByCategoryPagos}
                        expensesAPagar={expensesByCategoryAPagar}
                        totalPagos={totalPagos}
                        totalAPagar={totalAPagar}
                      />
                      <DashboardRecentActivity items={recentActivity} />
                    </View>
                  </View>
                  <View style={styles.techFullRow}>
                    <DashboardBudgetCard
                      budgetTab={budgetTab}
                      onBudgetTabChange={setBudgetTab}
                      bucketedBudgets={bucketedBudgets}
                      theme={theme}
                      styles={styles}
                      isDesktop
                      hasAnyBudget={hasAnyBudgetInTab}
                      onOpenBudgets={() => navigateTo('Orcamentos')}
                    />
                  </View>
                </>
              ) : (
                <View style={styles.bento}>
                  <DashboardBudgetCard
                    budgetTab={budgetTab}
                    onBudgetTabChange={setBudgetTab}
                    bucketedBudgets={bucketedBudgets}
                    theme={theme}
                    styles={styles}
                    hasAnyBudget={hasAnyBudgetInTab}
                    onOpenBudgets={() => navigateTo('Orcamentos')}
                  />
                  <DashboardDailyFlow
                    today={todayFlow}
                    theme={theme}
                    styles={styles}
                    isDesktop={isDesktop}
                  />
                  {saldoData.length > 1 ? (
                    <DashboardSaldoChart
                      sortedLabels={dayKeys.map((k, i) => {
                        if (i === 0 || i === dayKeys.length - 1 || i % Math.ceil(dayKeys.length / 4) === 0) {
                          const [yyyy, mm, dd] = k.split('-');
                          const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                          const day = String(date.getDate()).padStart(2, '0');
                          const monthShort = MONTH_NAMES[date.getMonth()].slice(0, 3).toLowerCase();
                          return `${day} ${monthShort}`;
                        }
                        return '';
                      })}
                      saldoData={saldoData}
                      screenWidth={winWidth}
                      isDarkMode={isDarkMode}
                      theme={theme}
                      styles={styles}
                      isDesktop={isDesktop}
                    />
                  ) : null}
                  <DashboardExpenseSection
                    expenseTab={expenseTab}
                    onExpenseTabChange={setExpenseTab}
                    expensesByCategory={expensesByCategoryFiltered}
                    categoriasMap={categoriasMap}
                    totalFiltrado={totalFiltrado}
                    styles={styles}
                    theme={theme}
                    expensesPagos={expensesByCategoryPagos}
                    expensesAPagar={expensesByCategoryAPagar}
                    totalPagos={totalPagos}
                    totalAPagar={totalAPagar}
                  />
                  <DashboardRecentActivity items={recentActivity} />
                </View>
              )}
            </View>
            <DashboardAccessRequests theme={theme} isDesktop={isDesktop} />
          </View>
        )}
      </MfScrollView>
    </SafeAreaView>
  );
}
