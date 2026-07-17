import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MfGlassCard, MfMetricTile, MfPeriodNav } from '../../components/ui';
import { getFinanceSemanticColor, mfSpacing } from '../../lib/theme';
import { getTechAccent, mfTechKpiSurface } from '../../lib/glassStyles';
import { createDashboardStyles, type DashboardTheme } from './dashboardStyles';
import { useMfTheme } from '../../components/ui/useMfTheme';

type DashboardStyles = ReturnType<typeof createDashboardStyles>;

type Props = {
  balance: number;
  totalIncome: number;
  totalExpenses: number;
  styles: DashboardStyles;
  isDesktop?: boolean;
  theme?: DashboardTheme;
  monthLabel?: string;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  balanceLabel?: string;
  balanceHint?: string;
};

export function DashboardSummaryCards({
  balance,
  totalIncome,
  totalExpenses,
  styles,
  isDesktop = false,
  theme,
  monthLabel,
  onPrevMonth,
  onNextMonth,
  balanceLabel = 'Saldo geral',
  balanceHint = 'Acumulado',
}: Props) {
  const { isDarkMode } = useMfTheme();
  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (!theme) {
    return null;
  }

  const accent = getTechAccent(isDarkMode);

  const periodNav =
    monthLabel && onPrevMonth && onNextMonth ? (
      <View style={localStyles.periodRow}>
        <MfPeriodNav label={monthLabel} onPrevious={onPrevMonth} onNext={onNextMonth} />
        {isDesktop ? (
          <View style={localStyles.periodMeta}>
            <View style={[localStyles.livePill, { borderColor: accent }]}>
              <View style={[localStyles.liveDot, { backgroundColor: accent }]} />
              <Text style={[localStyles.liveText, { color: accent }]}>Período ativo</Text>
            </View>
          </View>
        ) : null}
      </View>
    ) : null;

  const metrics = (
    <View style={isDesktop ? localStyles.heroGrid : localStyles.mobileStack}>
      <MfMetricTile
        label={balanceLabel}
        value={formatCurrency(balance)}
        semantic="forecast"
        hint={balanceHint}
        variant="tech"
        featured={isDesktop}
        shrinkValue
        icon={
          <Ionicons
            name="wallet-outline"
            size={16}
            color={getFinanceSemanticColor(theme, 'forecast')}
          />
        }
        style={mfTechKpiSurface(isDarkMode, isDesktop)}
      />
      <MfMetricTile
        label="Entradas"
        value={formatCurrency(totalIncome)}
        semantic="received"
        hint="Receitas do mês"
        variant="tech"
        icon={
          <Ionicons
            name="trending-up-outline"
            size={16}
            color={getFinanceSemanticColor(theme, 'received')}
          />
        }
        style={mfTechKpiSurface(isDarkMode, false)}
      />
      <MfMetricTile
        label="Saídas"
        value={formatCurrency(totalExpenses)}
        semantic="overdue"
        hint="Despesas do mês"
        variant="tech"
        icon={
          <Ionicons
            name="trending-down-outline"
            size={16}
            color={getFinanceSemanticColor(theme, 'overdue')}
          />
        }
        style={mfTechKpiSurface(isDarkMode, false)}
      />
    </View>
  );

  if (isDesktop) {
    return (
      <MfGlassCard padding="none" intensity="strong" tech style={styles.heroCard}>
        {periodNav ? (
          <View style={[styles.heroMonthBar, localStyles.heroMonthBarTech]}>
            {periodNav}
          </View>
        ) : null}
        <View style={localStyles.heroMetricsPad}>{metrics}</View>
      </MfGlassCard>
    );
  }

  return (
    <View style={styles.cardsContainer}>
      {periodNav}
      <MfGlassCard padding="md" intensity="strong" tech>
        {metrics}
      </MfGlassCard>
    </View>
  );
}

const localStyles = StyleSheet.create({
  periodRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: mfSpacing.md,
  },
  periodMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroMonthBarTech: {
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
  },
  heroMetricsPad: {
    padding: mfSpacing.lg,
  },
  heroGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: mfSpacing.md,
  },
  mobileStack: {
    gap: mfSpacing.md,
    alignItems: 'stretch',
  },
});
