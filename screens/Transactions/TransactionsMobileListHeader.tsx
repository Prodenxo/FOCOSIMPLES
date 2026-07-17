import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MfPeriodNav } from '../../components/ui';
import { useMfTheme } from '../../components/ui/useMfTheme';
import type { Theme } from '../../lib/theme';
import { mfRadius, mfSpacing } from '../../lib/theme';
import { getTechTokens, mfTechInsetSurface } from '../../lib/techDesign';
import type { ContaFinanceira } from '../../lib/contaFinanceiraTypes';
import type { ContaFilterValue } from '../../lib/contaFinanceiraIntegration';
import type { TransactionDateRange, TransactionPeriodPreset } from '../../lib/transactionPeriodFilter';
import { TransactionsPeriodToolbar } from './TransactionsPeriodToolbar';
import { TransactionsMonthMetrics } from './TransactionsMonthMetrics';
import { TransactionsFilterPills } from './TransactionsFilterPills';

type PillStyles = React.ComponentProps<typeof TransactionsFilterPills>['styles'];

type Props = {
  theme: Theme;
  pillStyles: PillStyles;
  monthLabel: string;
  periodLabel: string;
  periodPreset: TransactionPeriodPreset;
  useCustomRange: boolean;
  dateRange: TransactionDateRange;
  monthsAhead: number;
  search: string;
  typeFilter: 'all' | 'entrada' | 'saida';
  statusFilter: 'all' | 'pago' | 'pendente';
  contaFilter: ContaFilterValue;
  contasAtivas: ContaFinanceira[];
  entradas: number;
  saidas: number;
  saldo: number;
  countEntradas: number;
  countSaidas: number;
  onSearchChange: (v: string) => void;
  onPeriodChange: (p: TransactionPeriodPreset) => void;
  onDateRangeChange: (range: TransactionDateRange) => void;
  onClearRange: () => void;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onGoToCurrentMonth: () => void;
  onTypeChange: (v: 'all' | 'entrada' | 'saida') => void;
  onStatusChange: (v: 'all' | 'pago' | 'pendente') => void;
  onContaChange: (v: ContaFilterValue) => void;
  onClearAllFilters: () => void;
};

function countAdvancedFilters(
  typeFilter: Props['typeFilter'],
  statusFilter: Props['statusFilter'],
  contaFilter: ContaFilterValue,
  useCustomRange: boolean,
): number {
  let n = 0;
  if (typeFilter !== 'all') n += 1;
  if (statusFilter !== 'all') n += 1;
  if (contaFilter !== 'all') n += 1;
  if (useCustomRange) n += 1;
  return n;
}

export function TransactionsMobileListHeader({
  theme,
  pillStyles,
  monthLabel,
  periodLabel,
  periodPreset,
  useCustomRange,
  dateRange,
  monthsAhead,
  search,
  typeFilter,
  statusFilter,
  contaFilter,
  contasAtivas,
  entradas,
  saidas,
  saldo,
  countEntradas,
  countSaidas,
  onSearchChange,
  onPeriodChange,
  onDateRangeChange,
  onClearRange,
  onPrevMonth,
  onNextMonth,
  onGoToCurrentMonth,
  onTypeChange,
  onStatusChange,
  onContaChange,
  onClearAllFilters,
}: Props) {
  const { isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme, tokens, isDarkMode), [theme, tokens, isDarkMode]);
  const insetSurface = useMemo(() => mfTechInsetSurface(isDarkMode, false), [isDarkMode]);

  const advancedCount = countAdvancedFilters(typeFilter, statusFilter, contaFilter, useCustomRange);
  const hasAdvancedFilters = advancedCount > 0;

  const [filtersExpanded, setFiltersExpanded] = useState(hasAdvancedFilters);
  const [metricsExpanded, setMetricsExpanded] = useState(false);

  useEffect(() => {
    if (hasAdvancedFilters) setFiltersExpanded(true);
  }, [hasAdvancedFilters]);

  const periodNavLabel =
    periodPreset === 'Esse mês' && !useCustomRange ? monthLabel : periodLabel;

  return (
    <View style={styles.root}>
      <View style={styles.periodBlock}>
        <MfPeriodNav
          label={periodNavLabel}
          onPrevious={onPrevMonth}
          onNext={onNextMonth}
          variant="tech"
        />
        {periodPreset === 'Esse mês' && !useCustomRange && monthsAhead !== 0 ? (
          <TouchableOpacity
            onPress={onGoToCurrentMonth}
            style={styles.todayChip}
            accessibilityRole="button"
            accessibilityLabel="Voltar para o mês atual"
          >
            <Ionicons name="return-up-back-outline" size={14} color={tokens.accent} />
            <Text style={styles.todayChipText}>Mês atual</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={[styles.searchRow, insetSurface]}>
        <Ionicons name="search-outline" size={18} color={theme.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome ou valor"
          placeholderTextColor={theme.placeholder}
          value={search}
          onChangeText={onSearchChange}
        />
      </View>

      <TouchableOpacity
        onPress={() => setMetricsExpanded((v) => !v)}
        style={[styles.filtersToggle, insetSurface]}
        accessibilityRole="button"
        accessibilityState={{ expanded: metricsExpanded }}
        accessibilityLabel={metricsExpanded ? 'Esconder totais do mês' : 'Ver totais do mês'}
      >
        <View style={styles.filtersToggleLeft}>
          <Ionicons name="stats-chart-outline" size={16} color={theme.textSecondary} />
          <Text style={styles.filtersToggleText}>Ver totais do mês</Text>
        </View>
        <Ionicons
          name={metricsExpanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.textSecondary}
        />
      </TouchableOpacity>

      {metricsExpanded ? (
        <TransactionsMonthMetrics
          entradas={entradas}
          saidas={saidas}
          saldo={saldo}
          countEntradas={countEntradas}
          countSaidas={countSaidas}
        />
      ) : null}

      <TouchableOpacity
        onPress={() => setFiltersExpanded((v) => !v)}
        style={[styles.filtersToggle, insetSurface]}
        accessibilityRole="button"
        accessibilityState={{ expanded: filtersExpanded }}
        accessibilityLabel={filtersExpanded ? 'Recolher filtros' : 'Expandir filtros'}
      >
        <View style={styles.filtersToggleLeft}>
          <Ionicons
            name="options-outline"
            size={16}
            color={hasAdvancedFilters ? tokens.accent : theme.textSecondary}
          />
          <Text style={[styles.filtersToggleText, hasAdvancedFilters && styles.filtersToggleTextActive]}>
            Filtrar lista
          </Text>
          {advancedCount > 0 ? (
            <View style={styles.filtersBadge}>
              <Text style={styles.filtersBadgeText}>{advancedCount}</Text>
            </View>
          ) : null}
        </View>
        <Ionicons
          name={filtersExpanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.textSecondary}
        />
      </TouchableOpacity>

      {filtersExpanded ? (
        <View style={[styles.filtersPanel, insetSurface]}>
          <TransactionsPeriodToolbar
            theme={theme}
            period={periodPreset}
            dateRange={dateRange}
            useCustomRange={useCustomRange}
            compact
            showDateRange={useCustomRange}
            onPeriodChange={onPeriodChange}
            onDateRangeChange={onDateRangeChange}
            onClearRange={onClearRange}
          />
          <TransactionsFilterPills
            theme={theme}
            styles={pillStyles}
            typeFilter={typeFilter}
            statusFilter={statusFilter}
            contaFilter={contaFilter}
            contasAtivas={contasAtivas}
            onTypeChange={onTypeChange}
            onStatusChange={onStatusChange}
            onContaChange={onContaChange}
          />
          {hasAdvancedFilters ? (
            <TouchableOpacity
              onPress={onClearAllFilters}
              style={styles.clearFiltersBtn}
              accessibilityRole="button"
              accessibilityLabel="Limpar todos os filtros"
            >
              <Text style={styles.clearFiltersText}>Limpar filtros</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(
  theme: Theme,
  tokens: ReturnType<typeof getTechTokens>,
  isDarkMode: boolean,
) {
  return StyleSheet.create({
    root: {
      gap: mfSpacing.sm,
      paddingHorizontal: mfSpacing.md,
      paddingTop: mfSpacing.sm,
      paddingBottom: mfSpacing.xs,
    },
    periodBlock: {
      alignItems: 'center',
      gap: mfSpacing.xs,
    },
    todayChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: mfRadius.pill,
      backgroundColor: tokens.accentSoft,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
    },
    todayChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: tokens.accent,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: mfSpacing.sm,
      borderRadius: mfRadius.sm,
    },
    searchIcon: {
      marginRight: mfSpacing.xs,
    },
    searchInput: {
      flex: 1,
      paddingVertical: mfSpacing.md,
      paddingRight: mfSpacing.sm,
      fontSize: 16,
      color: theme.text,
    },
    filtersToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: mfSpacing.sm,
      paddingHorizontal: mfSpacing.md,
      borderRadius: mfRadius.sm,
    },
    filtersToggleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.xs,
    },
    filtersToggleText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    filtersToggleTextActive: {
      color: tokens.accent,
    },
    filtersBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.accentSoft,
      borderWidth: 1,
      borderColor: tokens.accent,
    },
    filtersBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: tokens.accent,
    },
    filtersPanel: {
      gap: mfSpacing.xs,
      padding: mfSpacing.sm,
      borderRadius: mfRadius.sm,
      marginBottom: mfSpacing.xs,
    },
    clearFiltersBtn: {
      alignSelf: 'center',
      paddingVertical: mfSpacing.xs,
      paddingHorizontal: mfSpacing.md,
      marginTop: mfSpacing.xs,
    },
    clearFiltersText: {
      fontSize: 13,
      fontWeight: '600',
      color: tokens.accent,
    },
  });
}
