import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, LayoutChangeEvent, Platform } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle, Text as SvgText } from 'react-native-svg';
import { MfGlassCard } from '../../components/ui';
import { getTechTokens } from '../../lib/techDesign';
import { DashboardSectionHeader } from './DashboardSectionHeader';
import { createDashboardStyles, DESKTOP_MAX_WIDTH, DESKTOP_PADDING_H, type DashboardTheme } from './dashboardStyles';

type DashboardStyles = ReturnType<typeof createDashboardStyles>;

type Props = {
  sortedLabels: string[];
  saldoData: number[];
  screenWidth: number;
  isDarkMode: boolean;
  theme: DashboardTheme;
  styles: DashboardStyles;
  isDesktop?: boolean;
};

const PADDING_TOP = 16;
const PADDING_BOTTOM = 32;
const PADDING_LEFT = 56;
const PADDING_RIGHT = 16;
const GRID_LINES = 4;
const CHART_HEIGHT = 280;
const LABEL_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const formatAxisValue = (value: number) => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(1).replace('.', ',')}k`;
  return `${sign}R$ ${Math.round(abs)}`;
};

function buildSmoothPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpx = (p0.x + p1.x) / 2;
    d += ` C ${cpx.toFixed(2)} ${p0.y.toFixed(2)}, ${cpx.toFixed(2)} ${p1.y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }
  return d;
}

export function DashboardSaldoChart({
  sortedLabels,
  saldoData,
  screenWidth,
  isDarkMode,
  theme,
  styles,
  isDesktop = false,
}: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  const safeScreenWidth = Number.isFinite(screenWidth) && screenWidth > 0 ? screenWidth : 360;
  const desktopInnerWidth = Math.max(
    240,
    Math.min(safeScreenWidth, DESKTOP_MAX_WIDTH) - DESKTOP_PADDING_H * 2 - 48
  );
  const fallbackWidth = Math.max(240, isDesktop ? desktopInnerWidth : safeScreenWidth - 72);
  const chartWidth = Math.max(240, measuredWidth ?? fallbackWidth);

  const innerWidth = Math.max(0, chartWidth - PADDING_LEFT - PADDING_RIGHT);
  const innerHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const { points, areaPath, linePath, minValue, maxValue } = useMemo(() => {
    if (saldoData.length === 0) {
      return { points: [], areaPath: '', linePath: '', minValue: 0, maxValue: 0 };
    }
    const min = Math.min(...saldoData, 0);
    const max = Math.max(...saldoData, 0);
    const range = max - min || 1;
    const step = saldoData.length > 1 ? innerWidth / (saldoData.length - 1) : 0;

    const pts = saldoData.map((value, index) => {
      const x = PADDING_LEFT + index * step;
      const ratio = (value - min) / range;
      const y = PADDING_TOP + innerHeight - ratio * innerHeight;
      return { x, y };
    });

    const line = buildSmoothPath(pts);
    const baseline = PADDING_TOP + innerHeight;
    const area =
      pts.length > 1
        ? `${line} L ${pts[pts.length - 1].x.toFixed(2)} ${baseline} L ${pts[0].x.toFixed(2)} ${baseline} Z`
        : '';

    return { points: pts, areaPath: area, linePath: line, minValue: min, maxValue: max };
  }, [saldoData, innerWidth, innerHeight]);

  if (saldoData.length === 0) return null;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && Math.abs(w - (measuredWidth ?? 0)) > 1) {
      setMeasuredWidth(w);
    }
  };

  const handlePress = (event: any) => {
    const x = event.nativeEvent.locationX - PADDING_LEFT;
    if (x < 0 || points.length === 0) {
      setHoverIndex(null);
      return;
    }
    const step = points.length > 1 ? innerWidth / (points.length - 1) : 0;
    const idx = Math.round(x / step);
    const clamped = Math.max(0, Math.min(points.length - 1, idx));
    setHoverIndex(clamped);
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  const gridYs = Array.from({ length: GRID_LINES }, (_, i) =>
    PADDING_TOP + (innerHeight * i) / (GRID_LINES - 1)
  );

  // Valor correspondente a cada linha de grid (topo = max, base = min)
  const axisRange = maxValue - minValue || 1;
  const axisValues = Array.from({ length: GRID_LINES }, (_, i) =>
    maxValue - (axisRange * i) / (GRID_LINES - 1)
  );

  const labelsToShow = sortedLabels
    .map((label, index) => ({ label, index }))
    .filter((item) => item.label && item.label.length > 0);

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;
  const hoverValue = hoverIndex !== null ? saldoData[hoverIndex] : null;
  const hoverLabel = hoverIndex !== null ? sortedLabels[hoverIndex] : null;
  const techAccent = getTechTokens(isDarkMode).accent;

  const rangeMeta = (
    <View style={styles.saldoChartMeta}>
      <Text style={styles.saldoChartMetaLabel}>Mín</Text>
      <Text style={styles.saldoChartMetaValue}>{formatCurrency(minValue)}</Text>
      <Text style={styles.saldoChartMetaLabel}>Máx</Text>
      <Text style={[styles.saldoChartMetaValue, { color: techAccent }]}>{formatCurrency(maxValue)}</Text>
    </View>
  );

  return (
    <MfGlassCard padding="md" intensity="strong" techVariant="chart" style={styles.chartCardOuter}>
    <View style={styles.chartContainer}>
      <DashboardSectionHeader
        eyebrow="Série temporal"
        title="Evolução do saldo"
        right={rangeMeta}
      />
      {Platform.OS === 'web' ? (
        <Text style={{ fontSize: 11, color: theme.textTertiary, marginTop: -8, marginBottom: 8 }}>
          Passe o mouse sobre o gráfico para ver o saldo de cada dia
        </Text>
      ) : null}

      <Pressable
        onPress={handlePress}
        onLayout={onLayout}
        style={styles.saldoChartPressable}
        {...(Platform.OS === 'web'
          ? {
              onMouseMove: handlePress,
              onMouseLeave: () => setHoverIndex(null),
            }
          : {})}
      >
        <Svg width={chartWidth} height={CHART_HEIGHT}>
          <Defs>
            <LinearGradient id="saldoGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={techAccent} stopOpacity={isDarkMode ? 0.35 : 0.22} />
              <Stop offset="1" stopColor={techAccent} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {gridYs.map((y, i) => (
            <Line
              key={`grid-${i}`}
              x1={PADDING_LEFT}
              x2={chartWidth - PADDING_RIGHT}
              y1={y}
              y2={y}
              stroke={theme.border}
              strokeWidth={1}
              strokeDasharray="4 6"
              opacity={0.6}
            />
          ))}

          {axisValues.map((val, i) => (
            <SvgText
              key={`y-label-${i}`}
              x={PADDING_LEFT - 8}
              y={gridYs[i] + 3}
              fill={theme.textTertiary}
              fontSize={10}
              fontWeight="600"
              fontFamily={LABEL_FONT_FAMILY}
              letterSpacing={0.3}
              textAnchor="end"
            >
              {formatAxisValue(val)}
            </SvgText>
          ))}

          {areaPath ? <Path d={areaPath} fill="url(#saldoGradient)" /> : null}
          {linePath ? (
            <Path
              d={linePath}
              stroke={techAccent}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {points.length > 0 && (
            <>
              <Circle cx={points[0].x} cy={points[0].y} r={3.5} fill={techAccent} />
              <Circle
                cx={points[points.length - 1].x}
                cy={points[points.length - 1].y}
                r={4.5}
                fill={techAccent}
                stroke={isDarkMode ? '#0a1018' : '#ffffff'}
                strokeWidth={2}
              />
            </>
          )}

          {labelsToShow.map((item) => {
            const point = points[item.index];
            if (!point) return null;
            const isFirst = item.index === 0;
            const isLast = item.index === points.length - 1;
            const textAnchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
            return (
              <SvgText
                key={`label-${item.index}`}
                x={point.x}
                y={CHART_HEIGHT - 10}
                fill={theme.textTertiary}
                fontSize={10}
                fontWeight="600"
                fontFamily={LABEL_FONT_FAMILY}
                letterSpacing={0.6}
                textAnchor={textAnchor}
              >
                {item.label.toUpperCase()}
              </SvgText>
            );
          })}

          {hoverPoint && (
            <>
              <Line
                x1={hoverPoint.x}
                x2={hoverPoint.x}
                y1={PADDING_TOP}
                y2={PADDING_TOP + innerHeight}
                stroke={theme.primary}
                strokeWidth={1}
                opacity={0.35}
                strokeDasharray="3 3"
              />
              <Circle
                cx={hoverPoint.x}
                cy={hoverPoint.y}
                r={6}
                fill={theme.card}
                stroke={theme.primary}
                strokeWidth={2.5}
              />
            </>
          )}
        </Svg>

        {hoverPoint && hoverValue !== null && (
          <View
            style={[
              styles.saldoChartTooltip,
              {
                left: Math.max(8, Math.min(chartWidth - 140, hoverPoint.x - 70)),
                top: Math.max(8, hoverPoint.y - 60),
              },
            ]}
          >
            {hoverLabel ? <Text style={styles.saldoChartTooltipLabel}>{hoverLabel}</Text> : null}
            <Text style={styles.saldoChartTooltipValue}>{formatCurrency(hoverValue)}</Text>
          </View>
        )}
      </Pressable>
    </View>
    </MfGlassCard>
  );
}
