import React, { useMemo, useState } from 'react';
import { View, Text, Platform } from 'react-native';
import { mfRadius, mfSpacing } from '../../lib/theme';
import { getTechTokens, mfTechPanelChrome } from '../../lib/techDesign';
import { findFirstBpoQuarterWithData, buildBpoMonthInsight, type BpoQuarterSlide } from './bpoChartHelpers';
import { BpoCategoryChart } from './BpoCategoryChart';
import { BpoMonthInsight } from './BpoMonthInsight';
import type { createDashboardStyles, DashboardTheme } from './dashboardStyles';

type DashboardStyles = ReturnType<typeof createDashboardStyles>;

export type BpoCategoryRow = {
  id: string;
  name: string;
  budgeted: number[];
  realized: number[];
  totalBudgeted: number;
  totalRealized: number;
  type?: 'entrada' | 'saida';
};

type Props = {
  category: BpoCategoryRow;
  chipLabel: string;
  chipStyle: object;
  chipTextStyle: object;
  bpoLabels: string[];
  bpoTooltip: { categoryId: string; monthIndex: number } | null;
  quarterIndex: number;
  onQuarterChange: (categoryKey: string, index: number) => void;
  onMonthPress: (categoryId: string, monthIndex: number) => void;
  quarters: BpoQuarterSlide[];
  chartWidth: number;
  chartAreaWidth: number;
  chartHeight: number;
  yAxisWidth: number;
  yAxisTicks: number;
  chartPaddingTop: number;
  yAxisPaddingBottom: number;
  chartPaddingRight: number;
  chartConfigBase: Record<string, unknown>;
  barPercentage: number;
  theme: DashboardTheme;
  styles: DashboardStyles;
  isDarkMode: boolean;
  formatCurrency: (value: number) => string;
  formatAxisValue: (value: number) => string;
};

export function BpoCategoryCard({
  category,
  chipLabel,
  chipStyle,
  chipTextStyle,
  bpoLabels,
  bpoTooltip,
  quarterIndex,
  onQuarterChange,
  onMonthPress,
  quarters,
  chartWidth,
  chartAreaWidth,
  chartHeight,
  yAxisWidth,
  yAxisTicks,
  chartPaddingTop,
  yAxisPaddingBottom,
  chartPaddingRight,
  chartConfigBase,
  barPercentage,
  theme,
  styles,
  isDarkMode,
  formatCurrency,
  formatAxisValue,
}: Props) {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  const categoryKey = String(category.id);
  const activeQuarter = quarterIndex ?? findFirstBpoQuarterWithData(category, quarters);
  const tech = getTechTokens(isDarkMode);
  const isIncome = category.type === 'entrada';

  const pinnedMonth =
    bpoTooltip?.categoryId === category.id ? bpoTooltip.monthIndex : null;
  const activeMonthIndex = pinnedMonth ?? hoveredMonth;

  const yearInsight = useMemo(
    () => buildBpoMonthInsight(category.totalBudgeted, category.totalRealized),
    [category.totalBudgeted, category.totalRealized]
  );

  const progressPct =
    category.totalBudgeted > 0
      ? Math.min(100, (category.totalRealized / category.totalBudgeted) * 100)
      : 0;

  const progressColor =
    yearInsight.status === 'over' ? theme.error : yearInsight.status === 'under' && isIncome ? theme.warning : theme.success;

  return (
    <View style={[styles.bpoCategoryCard, mfTechPanelChrome(isDarkMode, 'surface')]}>
      <View style={styles.bpoCategoryHeader}>
        <View style={styles.bpoCategoryHeaderLeft}>
          <Text style={styles.bpoCategoryTitle}>{category.name}</Text>
          <View style={chipStyle}>
            <Text style={chipTextStyle}>{chipLabel}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={[styles.bpoCategoryValue, { fontVariant: ['tabular-nums'] }]}>
            {formatCurrency(category.totalRealized)}
            <Text style={{ color: theme.textTertiary }}> / </Text>
            {formatCurrency(category.totalBudgeted)}
          </Text>
          {category.totalBudgeted > 0 ? (
            <Text style={{ fontSize: 10, fontWeight: '600', color: progressColor, fontVariant: ['tabular-nums'] }}>
              {progressPct.toFixed(0)}% do orçado anual
            </Text>
          ) : null}
        </View>
      </View>

      {category.totalBudgeted > 0 ? (
        <View
          style={{
            height: 4,
            borderRadius: mfRadius.pill,
            backgroundColor: tech.insetFill,
            borderWidth: 1,
            borderColor: tech.insetBorder,
            marginBottom: mfSpacing.sm,
            overflow: 'hidden',
          }}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(progressPct) }}
        >
          <View
            style={{
              width: `${progressPct}%`,
              height: '100%',
              backgroundColor: progressColor,
              borderRadius: mfRadius.pill,
            }}
          />
        </View>
      ) : null}

      {activeMonthIndex !== null ? (
        <BpoMonthInsight
          monthLabel={bpoLabels[activeMonthIndex]}
          budgeted={category.budgeted[activeMonthIndex] || 0}
          realized={category.realized[activeMonthIndex] || 0}
          isIncome={isIncome}
          theme={theme}
          isDarkMode={isDarkMode}
          formatCurrency={formatCurrency}
        />
      ) : Platform.OS !== 'web' ? (
        <Text style={{ fontSize: 11, color: theme.textTertiary, marginBottom: mfSpacing.sm }}>
          Toque em um mês no gráfico para ver o detalhe
        </Text>
      ) : null}

      <BpoCategoryChart
        category={category}
        quarters={quarters}
        chartWidth={chartWidth}
        chartAreaWidth={chartAreaWidth}
        chartHeight={chartHeight}
        yAxisWidth={yAxisWidth}
        yAxisTicks={yAxisTicks}
        chartPaddingTop={chartPaddingTop}
        yAxisPaddingBottom={yAxisPaddingBottom}
        chartPaddingRight={chartPaddingRight}
        chartConfigBase={chartConfigBase}
        barPercentage={barPercentage}
        theme={theme}
        styles={styles}
        isDarkMode={isDarkMode}
        formatAxisValue={formatAxisValue}
        activeMonthIndex={activeMonthIndex}
        onMonthHover={setHoveredMonth}
        onMonthPress={(monthIndex) => onMonthPress(category.id, monthIndex)}
        quarterIndex={activeQuarter}
        onQuarterChange={(index) => onQuarterChange(categoryKey, index)}
      />
    </View>
  );
}
