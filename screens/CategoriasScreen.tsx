import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { getTheme, mfRadius, mfSpacing, mfTypography } from '../lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigationDrawer } from '../lib/navigationContext';
import { MfAppHeader, MfScrollView, MfSegmented } from '../components/ui';
import {
  useCategoryMonthSpending,
  formatMonthLabel,
  shiftMonth,
  type MonthRef,
  type CategorySpendingRow,
} from '../hooks/useCategoryMonthSpending';
import { formatCurrencyBR } from '../lib/numberFormat';
import { normalizarTipo } from '../lib/dashboardUtils';
import {
  getCategorySliceColorForId,
  getDonutOutflowColor,
  getDonutRemainderColor,
} from '../lib/categoryColors';
import type { MfDonutSegment } from '../components/ui';
import { useShellLayout } from '../components/shell';
import { SHELL_CANVAS_DARK, SHELL_CANVAS_LIGHT } from '../components/shell/shellTokens';
import { useMfTheme } from '../components/ui/useMfTheme';
import { mfTechInsetSurface, mfTechPanelChrome } from '../lib/techDesign';
import { CategoriaModal } from './Categorias/CategoriaModal';
import { CategoriasPageChrome } from './Categorias/categoriasPageChrome';
import { CategoriasSummary } from './Categorias/CategoriasSummary';
import { CategoryDashboardRow } from './Categorias/CategoryDashboardRow';
import { fetchUserCategories } from '../lib/categoryService';

interface Categoria {
  id: number;
  nome: string;
  tipo: string;
  user_id: string | null;
}

/** Globais + do usuário; se houver duplicata por nome/tipo, prioriza a do usuário. */
function mergeCategoriesByName(list: Categoria[]): Categoria[] {
  const byKey = new Map<string, Categoria>();
  for (const cat of list) {
    const tipo = cat.tipo === 'entrada' ? 'entrada' : 'saida';
    const key = `${String(cat.nome || '').trim().toLowerCase()}:${tipo}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, cat);
      continue;
    }
    if (existing.user_id == null && cat.user_id != null) {
      byKey.set(key, cat);
    }
  }
  return Array.from(byKey.values()).sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }),
  );
}

export default function CategoriasScreen() {
  const { isDarkMode } = useThemeStore();
  const { isDarkMode: mfDark } = useMfTheme();
  const { openDrawer, hasGlobalNav } = useNavigationDrawer();
  const { isWebDesktop } = useShellLayout();

  const showPanelHeader = isWebDesktop && hasGlobalNav;
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const unifiedPanelChrome = useMemo(
    () => mfTechPanelChrome(mfDark, 'surface'),
    [mfDark],
  );
  const searchInset = useMemo(() => mfTechInsetSurface(mfDark, false), [mfDark]);
  const styles = useMemo(() => createStyles(theme, showPanelHeader), [theme, showPanelHeader]);

  const shellBg =
    hasGlobalNav || Platform.OS === 'web'
      ? isDarkMode
        ? SHELL_CANVAS_DARK
        : SHELL_CANVAS_LIGHT
      : theme.background;

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewTipo, setViewTipo] = useState<'entrada' | 'saida'>('saida');
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});
  const [monthRef, setMonthRef] = useState<MonthRef>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });

  const { userId } = useAuthStore();
  const {
    loading: loadingSpend,
    refreshing,
    refresh,
    buildRows,
    monthTransactions,
  } = useCategoryMonthSpending(userId, monthRef);

  const fetchCategorias = useCallback(async () => {
    setLoadingCats(true);
    if (!userId) {
      setCategorias([]);
      setLoadingCats(false);
      return;
    }

    try {
      const data = await fetchUserCategories(userId);
      const mapped = data.map((cat) => ({
        id: Number(cat.id) || 0,
        nome: String(cat.nome || ''),
        tipo: String(cat.tipo || ''),
        user_id: cat.user_id ?? null,
      }));
      setCategorias(mergeCategoriesByName(mapped));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar categorias';
      Alert.alert('Erro', message);
      setCategorias([]);
    }
    setLoadingCats(false);
  }, [userId]);

  useEffect(() => {
    fetchCategorias();
  }, [fetchCategorias]);

  useEffect(() => {
    setExpandedIds({});
  }, [monthRef.year, monthRef.month, viewTipo]);

  const onRefresh = async () => {
    await Promise.all([fetchCategorias(), refresh()]);
  };

  const normalizeCategoryKey = (nome: string) => String(nome || '').trim().toLowerCase();

  const orphanRow = useMemo((): CategorySpendingRow | null => {
    const catKeys = new Set(
      categorias
        .filter((c) => (c.tipo === 'entrada' ? 'entrada' : 'saida') === viewTipo)
        .map((c) => normalizeCategoryKey(c.nome)),
    );
    const orphanTxs = monthTransactions.filter((tx) => {
      if (normalizarTipo(tx.tipo) !== viewTipo) return false;
      const key = normalizeCategoryKey(tx.classificacao);
      return !key || !catKeys.has(key);
    });
    if (orphanTxs.length === 0) return null;
    const amount = orphanTxs.reduce((sum, tx) => sum + tx.valor, 0);
    return {
      id: -1,
      nome: 'Sem categoria',
      tipo: viewTipo,
      amount,
      transactions: orphanTxs,
    };
  }, [categorias, monthTransactions, viewTipo]);

  const allRows = useMemo(() => {
    const rows = buildRows(categorias, viewTipo);
    const merged = orphanRow ? [...rows, orphanRow] : rows;
    const term = searchTerm.trim().toLowerCase();
    const filtered = term
      ? merged.filter((r) => normalizeCategoryKey(r.nome).includes(term))
      : merged;
    return filtered.sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
    });
  }, [buildRows, categorias, viewTipo, searchTerm, orphanRow]);

  const monthFlow = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    monthTransactions.forEach((tx) => {
      const valor = tx.valor;
      if (normalizarTipo(tx.tipo) === 'entrada') entradas += valor;
      else saidas += valor;
    });
    return { entradas, saidas };
  }, [monthTransactions]);

  const totalMonth = useMemo(
    () =>
      monthTransactions
        .filter((tx) => normalizarTipo(tx.tipo) === viewTipo)
        .reduce((sum, tx) => sum + tx.valor, 0),
    [monthTransactions, viewTipo],
  );

  const activeRows = useMemo(
    () => allRows.filter((row) => row.amount > 0.009),
    [allRows],
  );

  const rowsForTipoCount = useMemo(
    () =>
      categorias.filter((c) => (c.tipo === 'entrada' ? 'entrada' : 'saida') === viewTipo).length,
    [categorias, viewTipo],
  );

  const donutSegments = useMemo((): MfDonutSegment[] => {
    const { entradas, saidas } = monthFlow;
    const disponivel = entradas;
    const ringBase =
      disponivel > 0
        ? disponivel
        : viewTipo === 'saida'
          ? Math.max(saidas, 1)
          : Math.max(totalMonth, 1);

    const remainderColor = getDonutRemainderColor(theme, isDarkMode);
    const outflowColor = getDonutOutflowColor(theme);
    const rowsWithAmount = activeRows.filter((row) => row.amount > 0.009);

    if (viewTipo === 'saida') {
      if (saidas <= 0 && disponivel <= 0) return [];
      const slices = rowsWithAmount.slice(0, 8).map((row) => ({
        ratio: row.amount / ringBase,
        color: getCategorySliceColorForId(row.id, isDarkMode),
      }));
      const gastoNoAnel = slices.reduce((sum, s) => sum + s.ratio, 0);
      if (disponivel > saidas && disponivel > 0) {
        slices.push({ ratio: (disponivel - saidas) / ringBase, color: remainderColor });
      } else if (slices.length === 0 && saidas > 0) {
        slices.push({
          ratio: Math.min(1, saidas / ringBase),
          color: getCategorySliceColorForId('fallback', isDarkMode),
        });
      }
      return gastoNoAnel > 0 || slices.length > 0 ? slices : [];
    }

    if (disponivel <= 0) {
      if (totalMonth <= 0) return [];
      return [
        {
          ratio: 1,
          color: getCategorySliceColorForId(activeRows[0]?.id ?? 'empty', isDarkMode),
        },
      ];
    }
    const slices = rowsWithAmount.slice(0, 8).map((row) => ({
      ratio: row.amount / disponivel,
      color: getCategorySliceColorForId(row.id, isDarkMode),
    }));
    const usedRatio = slices.reduce((sum, s) => sum + s.ratio, 0);
    if (usedRatio < 1) {
      slices.push({ ratio: 1 - usedRatio, color: remainderColor });
    }
    if (saidas > 0 && slices.length === 0) {
      slices.push({
        ratio: Math.min(1, saidas / disponivel),
        color: outflowColor,
      });
    }
    return slices;
  }, [activeRows, monthFlow, viewTipo, totalMonth, isDarkMode, theme]);

  const topActiveId = activeRows[0]?.id;
  useEffect(() => {
    if (topActiveId == null) return;
    setExpandedIds({ [topActiveId]: true });
  }, [monthRef.year, monthRef.month, viewTipo, topActiveId]);

  const monthLabel = formatMonthLabel(monthRef);
  const monthLabelLower = monthLabel.toLowerCase();
  const loading = loadingCats || loadingSpend;

  const openCreateModal = () => {
    setEditingCategoria(null);
    setModalOpen(true);
  };

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  async function handleSaveCategoria({ nome, tipo }: { nome: string; tipo: string }) {
    if (!userId) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }
    const { error } = await supabase
      .from('categorias_id')
      .insert({ nome, tipo, user_id: userId });
    if (error) {
      Alert.alert('Erro', `Não foi possível criar a categoria: ${error.message}`);
      return;
    }
    await fetchCategorias();
    await refresh();
  }

  async function handleUpdateCategoria({ id, nome, tipo }: { id?: number; nome: string; tipo: string }) {
    if (!id || !userId) return;
    const categoria = categorias.find((cat) => cat.id === id);
    if (!categoria?.user_id || categoria.user_id !== userId) {
      Alert.alert('Erro', 'Você não tem permissão para editar esta categoria');
      return;
    }
    await supabase
      .from('categorias_id')
      .update({ nome, tipo })
      .eq('id', id)
      .eq('user_id', userId);
    await fetchCategorias();
    await refresh();
  }

  async function buscarNomeCategoriaPorId(id: number): Promise<string | null> {
    const { data, error } = await supabase
      .from('categorias_id')
      .select('nome')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return data.nome;
  }

  async function handleDeleteCategoria(categoria: Categoria) {
    if (!userId) return;

    const performDelete = async () => {
      const tipoNormalizado =
        categoria.tipo === 'saida' || categoria.tipo === 'saída' ? 'saida' : 'entrada';
      const categoriaPadraoId = tipoNormalizado === 'saida' ? 62 : 228;
      const nomeCategoriaPadrao = await buscarNomeCategoriaPorId(categoriaPadraoId);
      if (!nomeCategoriaPadrao) {
        Alert.alert('Erro', 'Não foi possível encontrar a categoria padrão');
        return;
      }

      const { error: updateError } = await supabase
        .from('lancamentos_id')
        .update({ classificacao: nomeCategoriaPadrao })
        .eq('classificacao', categoria.nome)
        .eq('user_id', userId);

      if (updateError) {
        Alert.alert('Erro', 'Não foi possível atualizar as transações relacionadas');
        return;
      }

      const { error: deleteError } = await supabase
        .from('categorias_id')
        .delete()
        .eq('id', categoria.id)
        .eq('user_id', userId);

      if (deleteError) {
        Alert.alert('Erro', 'Não foi possível excluir a categoria');
        return;
      }

      await fetchCategorias();
      await refresh();
    };

    const confirmMessage = `Excluir "${categoria.nome}"? Os lançamentos passam para a categoria padrão.`;
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) await performDelete();
      return;
    }
    Alert.alert('Confirmar exclusão', confirmMessage, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: performDelete },
    ]);
  }

  const summarySubtitle = useMemo(() => {
    const { entradas, saidas } = monthFlow;
    if (viewTipo === 'saida') {
      const base = `gasto em ${monthLabelLower}`;
      if (entradas > 0) {
        const pct = Math.min(100, (saidas / entradas) * 100);
        return `${base} · ${formatCurrencyBR(entradas)} disponíveis (${pct.toFixed(0)}% usado)`;
      }
      return base;
    }
    const base = `recebido em ${monthLabelLower}`;
    if (saidas > 0 && entradas > 0) {
      const pct = Math.min(100, (saidas / entradas) * 100);
      return `${base} · ${formatCurrencyBR(saidas)} em saídas (${pct.toFixed(0)}%)`;
    }
    if (saidas > 0) return `${base} · ${formatCurrencyBR(saidas)} em saídas`;
    return base;
  }, [viewTipo, monthLabelLower, monthFlow]);

  const mobileToolbar = !showPanelHeader ? (
    <View style={styles.mobileToolbar}>
      <View style={styles.mobileSearchRow}>
        <View style={[styles.searchRow, searchInset]}>
          <Ionicons name="search" size={18} color={theme.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar categoria"
            placeholderTextColor={theme.placeholder}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={openCreateModal}
          accessibilityLabel="Adicionar categoria"
          accessibilityRole="button"
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <MfSegmented
        options={[
          { key: 'saida', label: 'Saídas', tone: 'expense' },
          { key: 'entrada', label: 'Entradas', tone: 'income' },
        ]}
        value={viewTipo}
        onChange={setViewTipo}
        style={styles.segmented}
      />
    </View>
  ) : null;

  const listSection =
    allRows.length === 0 ? (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Ionicons name="pricetags-outline" size={36} color={theme.textTertiary} />
        </View>
        <Text style={styles.emptyTitle}>
          {searchTerm.trim()
            ? 'Nenhuma categoria encontrada'
            : 'Nenhuma categoria para este tipo'}
        </Text>
        <Text style={styles.emptyText}>
          Crie categorias personalizadas para organizar seus lançamentos.
        </Text>
        {!searchTerm.trim() ? (
          <TouchableOpacity style={styles.emptyBtn} onPress={openCreateModal}>
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.emptyBtnText}>Nova categoria</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    ) : (
      <>
        <Text style={styles.sectionLabel}>
          {rowsForTipoCount} {rowsForTipoCount === 1 ? 'categoria' : 'categorias'}
          {activeRows.length > 0 ? ` · ${activeRows.length} com movimento` : ''}
        </Text>
        <View style={styles.list}>
          {allRows.map((row) => {
            const cat = categorias.find((c) => c.id === row.id);
            const canManage = row.id >= 0 && cat?.user_id === userId;
            return (
              <CategoryDashboardRow
                key={row.id}
                row={row}
                total={totalMonth}
                expanded={!!expandedIds[row.id]}
                onToggle={() => toggleExpanded(row.id)}
                onEdit={() => {
                  if (!canManage) return;
                  setEditingCategoria(cat!);
                  setModalOpen(true);
                }}
                onDelete={() => {
                  if (!canManage || !cat) return;
                  handleDeleteCategoria(cat);
                }}
                hideActions={row.id < 0 || !canManage}
                dimmed={row.amount <= 0.009}
                barColor={getCategorySliceColorForId(row.id, isDarkMode)}
              />
            );
          })}
        </View>
      </>
    );

  const panelBody = (
    <>
      {showPanelHeader ? (
        <CategoriasPageChrome
          bare
          theme={theme}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          viewTipo={viewTipo}
          onViewTipoChange={setViewTipo}
          categoryCount={rowsForTipoCount}
          activeCount={activeRows.length}
          onAddCategory={openCreateModal}
        />
      ) : null}

      {!showPanelHeader ? (
        <View style={styles.mobileHeader}>
          <Text style={styles.mobileTitle}>Categorias</Text>
          <Text style={styles.mobileSubtitle}>Visão do mês por categoria</Text>
        </View>
      ) : null}

      {mobileToolbar}

      <CategoriasSummary
        totalMonth={totalMonth}
        subtitle={summarySubtitle}
        monthLabel={monthLabel}
        segments={donutSegments}
        onPrevious={() => setMonthRef((m) => shiftMonth(m, -1))}
        onNext={() => setMonthRef((m) => shiftMonth(m, 1))}
      />

      {loading ? (
        <ActivityIndicator color={theme.primary} style={styles.loader} />
      ) : (
        listSection
      )}
    </>
  );

  const scrollContent = showPanelHeader ? (
    <View style={styles.shellColumn}>
      <View style={[styles.unifiedPanel, unifiedPanelChrome]}>{panelBody}</View>
    </View>
  ) : (
    <View style={styles.mobilePad}>
      {panelBody}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: shellBg }]} edges={['top', 'bottom']}>
      {!showPanelHeader ? (
        <MfAppHeader title="Categorias" onMenuPress={openDrawer} />
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

      <CategoriaModal
        visible={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingCategoria(null);
        }}
        onSave={editingCategoria ? handleUpdateCategoria : handleSaveCategoria}
        categoria={editingCategoria}
        useDialogLayout={showPanelHeader}
      />
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof getTheme>, shell: boolean) {
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
    mobileToolbar: {
      gap: mfSpacing.md,
      marginBottom: mfSpacing.sm,
    },
    mobileSearchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
    },
    searchRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      paddingHorizontal: 14,
      paddingVertical: isNative ? 12 : 10,
      minHeight: isNative ? 48 : 44,
      minWidth: 0,
    },
    searchInput: {
      flex: 1,
      color: theme.text,
      fontSize: 14,
      minWidth: 0,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
    },
    addBtn: {
      width: isNative ? 48 : 44,
      height: isNative ? 48 : 44,
      borderRadius: mfRadius.sm,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    segmented: {
      alignSelf: 'stretch',
    },
    sectionLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textTertiary,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: mfSpacing.sm,
    },
    list: {
      gap: 0,
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
      textAlign: 'center',
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
