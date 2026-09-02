import React, { useMemo } from 'react';
import {
  View,
  Text,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { MfGlassCard } from '../../components/ui';
import { getFinanceSemanticColor, mfSpacing } from '../../lib/theme';
import { getTechTokens, mfTechInsetSurface } from '../../lib/techDesign';
import { useMfTheme } from '../../components/ui/useMfTheme';
import { DashboardSectionHeader } from './DashboardSectionHeader';
import { createDashboardStyles, type DashboardTheme } from './dashboardStyles';
import type { DailyFlowDay } from './dashboardInsights';

type DashboardStyles = ReturnType<typeof createDashboardStyles>;

type Props = {
  today: DailyFlowDay;
  theme: DashboardTheme;
  styles: DashboardStyles;
  isDesktop?: boolean;
};

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatCell = (value: number) => (value > 0 ? formatCurrency(value) : '—');

function formatNet(value: number) {
  if (value === 0) return '—';
  const prefix = value > 0 ? '+' : '−';
  return `${prefix} ${formatCurrency(Math.abs(value))}`;
}

type LocalStyles = ReturnType<typeof createLocalStyles>;

function FlowDayCard({
  dayLabel,
  income,
  expense,
  net,
  theme,
  incomeColor,
  expenseColor,
  styles,
  compact,
}: {
  dayLabel: string;
  income: number;
  expense: number;
  net: number;
  theme: DashboardTheme;
  incomeColor: string;
  expenseColor: string;
  styles: LocalStyles;
  compact?: boolean;
}) {
  return (
    <View style={styles.mobileCard}>
      <Text style={styles.mobileCardDay}>{dayLabel}</Text>
      <View style={styles.mobileCardGrid}>
        <View style={styles.mobileMetric}>
          <Text style={[styles.mobileMetricLabel, { color: incomeColor }]}>Entrada</Text>
          <Text style={[styles.mobileMetricValue, { color: income > 0 ? incomeColor : theme.textTertiary }]}>
            {formatCell(income)}
          </Text>
        </View>
        <View style={styles.mobileMetric}>
          <Text style={[styles.mobileMetricLabel, { color: expenseColor }]}>Saída</Text>
          <Text style={[styles.mobileMetricValue, { color: expense > 0 ? expenseColor : theme.textTertiary }]}>
            {formatCell(expense)}
          </Text>
        </View>
        <View style={[styles.mobileMetric, compact ? styles.mobileMetricFull : null]}>
          <Text style={styles.mobileMetricLabel}>Resultado</Text>
          <Text
            style={[
              styles.mobileMetricValue,
              { color: net > 0 ? incomeColor : net < 0 ? expenseColor : theme.textTertiary },
            ]}
          >
            {formatNet(net)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function FlowTableRow({
  dayLabel,
  income,
  expense,
  net,
  theme,
  incomeColor,
  expenseColor,
  styles,
}: {
  dayLabel: string;
  income: number;
  expense: number;
  net: number;
  theme: DashboardTheme;
  incomeColor: string;
  expenseColor: string;
  styles: LocalStyles;
}) {
  return (
    <View style={styles.tableRow}>
      <View style={styles.colDay}>
        <Text style={styles.dayText} numberOfLines={1}>{dayLabel}</Text>
      </View>
      <View style={styles.colMoney}>
        <Text style={[styles.moneyText, { color: income > 0 ? incomeColor : theme.textTertiary }]}>
          {formatCell(income)}
        </Text>
      </View>
      <View style={styles.colMoney}>
        <Text style={[styles.moneyText, { color: expense > 0 ? expenseColor : theme.textTertiary }]}>
          {formatCell(expense)}
        </Text>
      </View>
      <View style={styles.colNet}>
        <Text
          style={[
            styles.moneyText,
            { color: net > 0 ? incomeColor : net < 0 ? expenseColor : theme.textTertiary },
          ]}
        >
          {formatNet(net)}
        </Text>
      </View>
    </View>
  );
}

export function DashboardDailyFlow({
  today,
  theme,
  styles: dashboardStyles,
  isDesktop = false,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const compact = windowWidth < 400;
  const { isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const localStyles = useMemo(
    () => createLocalStyles(theme, tokens, isDarkMode, isDesktop, compact),
    [theme, tokens, isDarkMode, isDesktop, compact],
  );
  const incomeColor = getFinanceSemanticColor(theme, 'received');
  const expenseColor = getFinanceSemanticColor(theme, 'overdue');
  const net = today.income - today.expense;
  const hasMovement = today.income > 0 || today.expense > 0;

  const summaryMeta = (
    <View style={[dashboardStyles.saldoChartMeta, localStyles.summaryMeta]}>
      <Text style={dashboardStyles.saldoChartMetaLabel}>Entradas</Text>
      <Text
        style={[
          dashboardStyles.saldoChartMetaValue,
          localStyles.summaryMetaValue,
          { color: incomeColor },
        ]}
      >
        {formatCurrency(today.income)}
      </Text>
      <Text style={dashboardStyles.saldoChartMetaLabel}>Saídas</Text>
      <Text
        style={[
          dashboardStyles.saldoChartMetaValue,
          localStyles.summaryMetaValue,
          { color: expenseColor },
        ]}
      >
        {formatCurrency(today.expense)}
      </Text>
    </View>
  );

  return (
    <MfGlassCard padding="md" intensity="strong" techVariant="surface" style={dashboardStyles.chartCardOuter}>
      <View style={dashboardStyles.chartContainer}>
        <DashboardSectionHeader
          eyebrow="Fluxo"
          title="Movimentação de hoje"
          right={isDesktop ? summaryMeta : undefined}
        />
        {!isDesktop ? summaryMeta : null}
        <Text style={localStyles.hint}>Valores realizados no dia atual.</Text>

        {!hasMovement ? (
          <View style={localStyles.emptyWrap}>
            <Text style={localStyles.emptyText}>Nenhuma movimentação realizada hoje.</Text>
          </View>
        ) : (
          <View style={[mfTechInsetSurface(isDarkMode, false), localStyles.tableShell]}>
            {isDesktop ? (
              <>
                <View style={[localStyles.tableRow, localStyles.headerRow]}>
                  <View style={localStyles.colDay}>
                    <Text style={[localStyles.headerText, localStyles.headerTextLeft]}>Dia</Text>
                  </View>
                  <View style={localStyles.colMoney}>
                    <Text style={[localStyles.headerText, { color: incomeColor }]}>Entrada</Text>
                  </View>
                  <View style={localStyles.colMoney}>
                    <Text style={[localStyles.headerText, { color: expenseColor }]}>Saída</Text>
                  </View>
                  <View style={localStyles.colNet}>
                    <Text style={localStyles.headerText}>Resultado</Text>
                  </View>
                </View>
                <FlowTableRow
                  dayLabel={today.dayLabel}
                  income={today.income}
                  expense={today.expense}
                  net={net}
                  theme={theme}
                  incomeColor={incomeColor}
                  expenseColor={expenseColor}
                  styles={localStyles}
                />
              </>
            ) : (
              <FlowDayCard
                dayLabel={today.dayLabel}
                income={today.income}
                expense={today.expense}
                net={net}
                theme={theme}
                incomeColor={incomeColor}
                expenseColor={expenseColor}
                styles={localStyles}
                compact={compact}
              />
            )}
          </View>
        )}
      </View>
    </MfGlassCard>
  );
}

function createLocalStyles(
  theme: DashboardTheme,
  tokens: ReturnType<typeof getTechTokens>,
  isDarkMode: boolean,
  isDesktop: boolean,
  compact: boolean,
) {
  const mono = Platform.select({
    web: 'ui-monospace, Menlo, Consolas, monospace',
    default: undefined,
  });

  return StyleSheet.create({
    summaryMeta: {
      marginTop: isDesktop ? 2 : -mfSpacing.xs,
      marginBottom: isDesktop ? 0 : mfSpacing.sm,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      alignItems: 'center',
    },
    summaryMetaValue: {
      fontFamily: mono,
      fontVariant: ['tabular-nums'],
    },
    hint: {
      fontSize: 11,
      color: theme.textTertiary,
      marginTop: isDesktop ? -mfSpacing.sm : 0,
      marginBottom: mfSpacing.sm,
    },
    emptyWrap: {
      paddingVertical: mfSpacing.lg,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 13,
      color: theme.textTertiary,
      textAlign: 'center',
    },
    tableShell: {
      overflow: 'hidden',
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: mfSpacing.sm,
    },
    headerRow: {
      borderBottomWidth: 1,
      borderBottomColor: tokens.divider,
      backgroundColor: isDarkMode ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.35)',
    },
    headerText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: theme.textTertiary,
      textAlign: 'right',
      width: '100%',
    },
    headerTextLeft: {
      textAlign: 'left',
    },
    colDay: {
      width: 96,
      flexShrink: 0,
      paddingRight: mfSpacing.xs,
    },
    colMoney: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-end',
      paddingHorizontal: 4,
    },
    colNet: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-end',
      paddingHorizontal: 4,
    },
    dayText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'left',
    },
    moneyText: {
      fontSize: 13,
      fontWeight: '700',
      fontFamily: mono,
      fontVariant: ['tabular-nums'],
      textAlign: 'right',
    },
    mobileCard: {
      paddingVertical: mfSpacing.sm,
      paddingHorizontal: mfSpacing.sm,
      gap: mfSpacing.xs,
    },
    mobileCardDay: {
      fontSize: compact ? 12 : 13,
      fontWeight: '700',
      color: theme.text,
    },
    mobileCardGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: mfSpacing.sm,
    },
    mobileMetric: {
      flexGrow: 1,
      flexBasis: compact ? '100%' : '30%',
      minWidth: compact ? undefined : 96,
      gap: 2,
    },
    mobileMetricFull: {
      flexBasis: '100%',
    },
    mobileMetricLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: theme.textTertiary,
    },
    mobileMetricValue: {
      fontSize: compact ? 12 : 13,
      fontWeight: '700',
      fontFamily: mono,
      fontVariant: ['tabular-nums'],
    },
  });
}
