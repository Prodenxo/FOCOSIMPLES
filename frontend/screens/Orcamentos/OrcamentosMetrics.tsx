import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import { MfTechKpiCard } from '../../components/ui';
import { useMfTheme } from '../../components/ui/useMfTheme';
import { formatCurrencyBR } from '../../lib/numberFormat';
import { getFinanceSemanticColor, mfSpacing, type Theme } from '../../lib/theme';
import { getTechTokens } from '../../lib/techDesign';
import { useLayoutProfile } from '../../lib/useLayoutProfile';

type Props = {
  totalOrcado: number;
  totalRealizado: number;
};

const monoFont = Platform.select({
  web: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  ios: 'Menlo',
  android: 'monospace',
  default: undefined,
}) as ViewStyle['fontFamily'];

const KPI_ROW_MIN_HEIGHT = 112;

type MetricsLayout = 'stack' | 'pair';

export function OrcamentosMetrics({ totalOrcado, totalRealizado }: Props) {
  const { theme, isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const [containerWidth, setContainerWidth] = useState(0);
  const layout = useLayoutProfile(containerWidth);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setContainerWidth((prev) => (prev === next ? prev : next));
  }, []);

  const metricsLayout: MetricsLayout = useMemo(() => {
    if (containerWidth === 0) return 'stack';
    if (layout.isWide) return 'pair';
    if (layout.isNative) return 'stack';
    return 'pair';
  }, [containerWidth, layout.isWide, layout.isNative]);

  const balanced = metricsLayout === 'pair';
  const styles = useMemo(
    () => createStyles(theme, tokens, balanced),
    [theme, tokens, balanced],
  );

  const pct =
    totalOrcado > 0 ? Math.min(100, (totalRealizado / totalOrcado) * 100) : 0;
  const realizadoColor = getFinanceSemanticColor(
    theme,
    totalOrcado > 0 && totalRealizado > totalOrcado ? 'overdue' : 'received',
  );

  const orcadoCard = (
    <MfTechKpiCard
      level="metric"
      style={[styles.kpiShell, balanced ? styles.kpiAccent : styles.kpiFeaturedStack]}
      innerStyle={balanced ? styles.kpiInner : styles.kpiInnerFeatured}
    >
      <Text style={styles.metricEyebrow}>Total orçado</Text>
      <Text
        style={[balanced ? styles.kpiValue : styles.kpiValueLarge, { color: theme.financeForecast }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
      >
        {formatCurrencyBR(totalOrcado)}
      </Text>
      <Text style={styles.metricHint}>Soma dos limites do mês</Text>
    </MfTechKpiCard>
  );

  const realizadoCard = (
    <MfTechKpiCard level="metric" style={styles.kpiShell} innerStyle={styles.kpiInner}>
      <Text style={styles.metricEyebrow}>Total realizado</Text>
      <Text
        style={[styles.kpiValue, { color: realizadoColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
      >
        {formatCurrencyBR(totalRealizado)}
      </Text>
      <Text style={styles.metricHint}>
        {totalOrcado > 0 ? `${pct.toFixed(0)}% do orçado` : 'Sem orçamento definido'}
      </Text>
    </MfTechKpiCard>
  );

  return (
    <View style={styles.root} onLayout={onLayout}>
      {metricsLayout === 'stack' ? (
        <View style={styles.stack}>
          {orcadoCard}
          {realizadoCard}
        </View>
      ) : (
        <View style={styles.pairRow}>
          <View style={styles.pairCol}>{orcadoCard}</View>
          <View style={styles.pairCol}>{realizadoCard}</View>
        </View>
      )}
    </View>
  );
}

function createStyles(
  theme: Theme,
  tokens: ReturnType<typeof getTechTokens>,
  balanced: boolean,
) {
  const isNative = Platform.OS !== 'web';

  return StyleSheet.create({
    root: {
      width: '100%',
      marginBottom: mfSpacing.md,
      overflow: 'visible',
    },
    stack: {
      gap: isNative ? mfSpacing.md : mfSpacing.sm,
      overflow: 'visible',
    },
    pairRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: mfSpacing.md,
      minHeight: KPI_ROW_MIN_HEIGHT,
      overflow: 'visible',
    },
    pairCol: {
      flex: 1,
      minWidth: 0,
      minHeight: KPI_ROW_MIN_HEIGHT,
      flexDirection: 'column',
      overflow: 'visible',
    },
    kpiShell: {
      flex: 1,
      alignSelf: 'stretch',
      width: '100%',
      minHeight: balanced ? KPI_ROW_MIN_HEIGHT : undefined,
      overflow: 'visible',
    },
    kpiAccent: {
      borderLeftWidth: 3,
      borderLeftColor: tokens.accent,
    },
    kpiFeaturedStack: {
      borderLeftWidth: 3,
      borderLeftColor: tokens.accent,
    },
    kpiInner: {
      flex: 1,
      padding: mfSpacing.md,
      gap: mfSpacing.sm,
      justifyContent: 'center',
      minHeight: balanced ? KPI_ROW_MIN_HEIGHT - 2 : undefined,
    },
    kpiInnerFeatured: {
      padding: mfSpacing.md,
      gap: mfSpacing.sm,
    },
    metricEyebrow: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: theme.textSecondary,
    },
    kpiValue: {
      fontSize: 28,
      fontWeight: '800',
      lineHeight: 34,
      letterSpacing: -0.8,
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
    },
    kpiValueLarge: {
      fontSize: isNative ? 28 : 32,
      fontWeight: '800',
      lineHeight: isNative ? 34 : 38,
      letterSpacing: -1,
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
    },
    metricHint: {
      fontSize: 10,
      color: theme.textTertiary,
    },
  });
}
