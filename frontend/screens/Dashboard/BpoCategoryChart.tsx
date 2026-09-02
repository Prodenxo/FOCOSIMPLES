import React, { useRef, useEffect, useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, Platform, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackedBarChart } from 'react-native-chart-kit';
import { mfSpacing } from '../../lib/theme';
import { getTechTokens, mfTechPanelChrome } from '../../lib/techDesign';
import type { createDashboardStyles, DashboardTheme } from './dashboardStyles';
import { BpoChartLegend } from './BpoChartLegend';
import {
  buildBpoYAxis,
  buildBudgetAwareMonthTotals,
  findFirstBpoQuarterWithData,
  getBpoMaxStack,
  getBpoYearMaxStack,
  sanitizeBpoMonthTotals,
  type BpoCategorySeries,
  type BpoQuarterSlide,
} from './bpoChartHelpers';

type DashboardStyles = ReturnType<typeof createDashboardStyles>;

const BPO_CHART_MIN_AREA = 120;
const SURFACE_PAD = 20;

type Props = {
  category: BpoCategorySeries & { id: string };
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
  formatAxisValue: (value: number) => string;
  onMonthPress: (monthIndex: number) => void;
  onMonthHover: (monthIndex: number | null) => void;
  activeMonthIndex: number | null;
  quarterIndex: number;
  onQuarterChange: (index: number) => void;
};

function BpoQuarterNav({
  quarter,
  quarterIndex,
  total,
  onPrev,
  onNext,
  styles,
  theme,
  isDarkMode,
}: {
  quarter: BpoQuarterSlide;
  quarterIndex: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  styles: DashboardStyles;
  theme: DashboardTheme;
  isDarkMode: boolean;
}) {
  const tech = getTechTokens(isDarkMode);
  const atStart = quarterIndex <= 0;
  const atEnd = quarterIndex >= total - 1;

  return (
    <View style={styles.bpoQuarterNav} accessibilityRole="toolbar">
      <Pressable
        onPress={onPrev}
        disabled={atStart}
        accessibilityRole="button"
        accessibilityLabel="Trimestre anterior"
        style={({ pressed }) => [
          styles.bpoQuarterNavBtn,
          { borderColor: tech.insetBorder, backgroundColor: tech.insetFill },
          atStart && styles.bpoQuarterNavBtnDisabled,
          pressed && !atStart ? { opacity: 0.85 } : null,
        ]}
      >
        <Ionicons name="chevron-back" size={18} color={theme.text} />
      </Pressable>
      <View style={styles.bpoQuarterNavCenter}>
        <Text style={styles.bpoQuarterNavTitle}>{quarter.label}</Text>
        <Text style={styles.bpoQuarterNavMeta}>
          {quarterIndex + 1} de {total}
        </Text>
      </View>
      <Pressable
        onPress={onNext}
        disabled={atEnd}
        accessibilityRole="button"
        accessibilityLabel="Próximo trimestre"
        style={({ pressed }) => [
          styles.bpoQuarterNavBtn,
          { borderColor: tech.insetBorder, backgroundColor: tech.insetFill },
          atEnd && styles.bpoQuarterNavBtnDisabled,
          pressed && !atEnd ? { opacity: 0.85 } : null,
        ]}
      >
        <Ionicons name="chevron-forward" size={18} color={theme.text} />
      </Pressable>
    </View>
  );
}

export function BpoCategoryChart({
  category,
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
  formatAxisValue,
  onMonthPress,
  onMonthHover,
  activeMonthIndex,
  quarterIndex,
  onQuarterChange,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const isWeb = Platform.OS === 'web';
  const tech = getTechTokens(isDarkMode);
  const yearMax = getBpoYearMaxStack(category, quarters);
  const defaultQuarter = findFirstBpoQuarterWithData(category, quarters);
  const activeQuarter = Math.min(Math.max(0, quarterIndex ?? defaultQuarter), quarters.length - 1);

  const handleContainerLayout = (event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    if (next > 0 && next !== containerWidth) setContainerWidth(next);
  };

  const slideWidth =
    containerWidth > 0 ? containerWidth : Math.min(chartWidth, chartAreaWidth + yAxisWidth + SURFACE_PAD);
  const surfaceInnerWidth = Math.max(0, slideWidth - SURFACE_PAD);
  const plotWidth = Math.max(BPO_CHART_MIN_AREA, surfaceInnerWidth - yAxisWidth);

  const scrollToQuarter = useCallback(
    (index: number, animated = true) => {
      scrollRef.current?.scrollTo({ x: slideWidth * index, y: 0, animated });
    },
    [slideWidth]
  );

  useEffect(() => {
    if (!isWeb && slideWidth > 0) scrollToQuarter(activeQuarter, false);
  }, [activeQuarter, isWeb, scrollToQuarter, slideWidth]);

  const goToQuarter = (index: number) => {
    const next = Math.min(Math.max(0, index), quarters.length - 1);
    onQuarterChange(next);
    onMonthHover(null);
    if (!isWeb) scrollToQuarter(next);
  };

  const handleScrollEnd = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
    if (slideWidth <= 0) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    if (next >= 0 && next < quarters.length) onQuarterChange(next);
  };

  const renderQuarterBody = (quarter: BpoQuarterSlide) => {
    const monthTotals = sanitizeBpoMonthTotals(buildBudgetAwareMonthTotals(category, quarter.months));
    const maxStack = getBpoMaxStack(monthTotals);
    const labels = buildBpoYAxis(maxStack, yAxisTicks);
    const barWidth = 32 * barPercentage;
    const labelsAreaWidth = Math.max(0, plotWidth - chartPaddingRight);
    const labelStep = labelsAreaWidth > 0 ? labelsAreaWidth / quarter.labels.length : 0;
    const getLabelLeft = (index: number) => {
      const barCenter = chartPaddingRight + labelStep * index + barWidth / 2;
      return Math.max(0, barCenter - labelStep / 2);
    };
    const canRenderChart = maxStack > 0 && plotWidth >= BPO_CHART_MIN_AREA;

    if (!canRenderChart) {
      return (
        <View style={[styles.bpoChartEmpty, { width: '100%', minHeight: chartHeight + 28 }]}>
          <Text style={styles.bpoChartEmptyTitle}>Sem valores neste trimestre</Text>
          {yearMax > 0 ? (
            <Text style={styles.bpoChartEmptyHint}>
              {isWeb ? 'Use as setas acima para ver outros trimestres' : 'Deslize para ver meses com lançamentos'}
            </Text>
          ) : null}
        </View>
      );
    }

    const chartWellStyle = mfTechPanelChrome(isDarkMode, 'chart');

    return (
      <View style={[styles.bpoChartSurface, chartWellStyle]}>
        <View style={styles.bpoChartRow}>
          <View
            style={[
              styles.bpoYAxis,
              {
                height: chartHeight,
                width: yAxisWidth,
                paddingTop: chartPaddingTop,
                paddingBottom: yAxisPaddingBottom,
              },
            ]}
          >
            {labels.map((value, index) => (
              <Text key={`${quarter.key}-y-${index}`} style={styles.bpoYAxisLabel}>
                {formatAxisValue(value)}
              </Text>
            ))}
          </View>
          <View style={styles.bpoChartPlotArea}>
            <View style={[styles.bpoChartPlotInner, { width: plotWidth }]}>
              <StackedBarChart
                data={{
                  labels: quarter.labels,
                  data: monthTotals,
                  barColors: [theme.success, theme.error],
                  legend: [],
                }}
                width={plotWidth}
                height={chartHeight}
                chartConfig={{
                  ...chartConfigBase,
                  backgroundColor: 'transparent',
                  backgroundGradientFrom: 'transparent',
                  backgroundGradientTo: 'transparent',
                  propsForLabels: {
                    ...((chartConfigBase.propsForLabels as object) ?? {}),
                    opacity: 0,
                    fill: 'transparent',
                  },
                }}
                fromZero
                segments={yAxisTicks - 1}
                style={styles.bpoCategoryChart}
                formatYLabel={() => ''}
                withHorizontalLabels={false}
                withVerticalLabels={false}
                hideLegend
                yAxisLabel=""
                yAxisSuffix=""
                yAxisInterval={1}
                yLabelsOffset={-1000}
              />
              <View style={styles.bpoChartOverlayRow}>
                {quarter.months.map((monthIndex, cellIndex) => {
                  const isActive = activeMonthIndex === monthIndex;
                  return (
                    <Pressable
                      key={`${category.id}-${quarter.key}-${monthIndex}`}
                      style={[
                        styles.bpoChartOverlayCell,
                        isActive && {
                          backgroundColor: tech.accentSoft,
                          borderWidth: 1,
                          borderColor: tech.accentMuted,
                          borderRadius: 6,
                        },
                        isWeb && ({ cursor: 'pointer' } as object),
                      ]}
                      onPress={() => onMonthPress(monthIndex)}
                      onHoverIn={isWeb ? () => onMonthHover(monthIndex) : undefined}
                      onHoverOut={isWeb ? () => onMonthHover(null) : undefined}
                      accessibilityRole="button"
                      accessibilityLabel={`${quarter.labels[cellIndex]}: ver detalhes`}
                    />
                  );
                })}
              </View>
            </View>
          </View>
        </View>
        <View style={styles.bpoChartLabelsRow}>
          <View style={[styles.bpoChartLabelsSpacer, { width: yAxisWidth }]} />
          <View style={styles.bpoChartLabelsContent}>
            {quarter.labels.map((label, labelIndex) => {
              const monthIndex = quarter.months[labelIndex];
              const isActive = activeMonthIndex === monthIndex;
              return (
                <View
                  key={`${category.id}-${quarter.key}-${label}`}
                  style={[
                    styles.bpoChartLabelCell,
                    { width: labelStep, left: getLabelLeft(labelIndex) },
                  ]}
                >
                  <Text
                    style={[
                      styles.bpoChartLabelText,
                      isActive && { color: tech.accent, fontWeight: '700' },
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const body = (quarter: BpoQuarterSlide) => (
    <>
      <BpoChartLegend theme={theme} />
      {slideWidth > 0 ? renderQuarterBody(quarter) : null}
      {isWeb ? (
        <Text style={{ fontSize: 10, color: theme.textTertiary, textAlign: 'center', marginTop: mfSpacing.xs }}>
          Passe o mouse sobre um mês para ver os detalhes
        </Text>
      ) : null}
    </>
  );

  if (isWeb) {
    const quarter = quarters[activeQuarter];
    return (
      <View style={styles.bpoChartCarousel} onLayout={handleContainerLayout}>
        <BpoQuarterNav
          quarter={quarter}
          quarterIndex={activeQuarter}
          total={quarters.length}
          onPrev={() => goToQuarter(activeQuarter - 1)}
          onNext={() => goToQuarter(activeQuarter + 1)}
          styles={styles}
          theme={theme}
          isDarkMode={isDarkMode}
        />
        <View style={styles.bpoQuarterSlide}>{body(quarter)}</View>
      </View>
    );
  }

  return (
    <View style={styles.bpoChartCarousel} onLayout={handleContainerLayout}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={slideWidth > 0 ? slideWidth : undefined}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        contentContainerStyle={styles.bpoChartCarouselContent}
        contentOffset={{ x: slideWidth * activeQuarter, y: 0 }}
        style={{ width: '100%' }}
      >
        {quarters.map((quarter) => (
          <View
            key={quarter.key}
            style={[styles.bpoQuarterSlide, slideWidth > 0 ? { width: slideWidth } : null]}
          >
            <Text style={styles.bpoQuarterLabel}>{quarter.label}</Text>
            {body(quarter)}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
