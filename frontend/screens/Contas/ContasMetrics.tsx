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
  totalConsolidado: number;
  accountCount: number;
};

const monoFont = Platform.select({
  web: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  ios: 'Menlo',
  android: 'monospace',
  default: undefined,
}) as ViewStyle['fontFamily'];

const KPI_ROW_MIN_HEIGHT = 112;

type MetricsLayout = 'stack' | 'row' | 'pair';

export function ContasMetrics({ totalConsolidado, accountCount }: Props) {
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
    return 'row';
  }, [containerWidth, layout.isWide, layout.isNative]);

  const balanced = metricsLayout === 'pair' || metricsLayout === 'row';
  const styles = useMemo(
    () => createStyles(theme, tokens, balanced),
    [theme, tokens, balanced],
  );

  const saldoColor = getFinanceSemanticColor(
    theme,
    totalConsolidado >= 0 ? 'received' : 'overdue',
  );
  const countHint =
    accountCount === 1 ? '1 conta ativa' : `${accountCount} contas ativas`;

  const totalCard = (
    <MfTechKpiCard
      level="metric"
      style={[styles.kpiShell, balanced ? styles.kpiAccent : styles.kpiFeaturedStack]}
      innerStyle={balanced ? styles.kpiInner : styles.kpiInnerFeatured}
    >
      <Text style={styles.metricEyebrow}>Total nas contas</Text>
      <Text
        style={[balanced ? styles.kpiValue : styles.kpiValueLarge, { color: saldoColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.55}
      >
        {formatCurrencyBR(totalConsolidado)}
      </Text>
      <Text style={styles.metricHint}>Soma dos saldos atuais</Text>
    </MfTechKpiCard>
  );

  const countCard = (
    <MfTechKpiCard level="metric" style={styles.kpiShell} innerStyle={styles.kpiInner}>
      <Text style={styles.metricEyebrow}>Contas ativas</Text>
      <Text style={[styles.kpiValue, { color: theme.financeOpen }]} numberOfLines={1}>
        {String(accountCount)}
      </Text>
      <Text style={styles.metricHint}>{countHint}</Text>
    </MfTechKpiCard>
  );

  return (
    <View style={styles.root} onLayout={onLayout}>
      {metricsLayout === 'stack' ? (
        <View style={styles.stack}>
          {totalCard}
          {countCard}
        </View>
      ) : (
        <View style={styles.pairRow}>
          <View style={styles.pairCol}>{totalCard}</View>
          <View style={styles.pairCol}>{countCard}</View>
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
