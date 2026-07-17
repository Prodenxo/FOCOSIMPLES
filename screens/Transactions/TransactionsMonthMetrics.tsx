import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MfTechKpiCard } from '../../components/ui';
import { useMfTheme } from '../../components/ui/useMfTheme';
import { formatCurrencyBR } from '../../lib/numberFormat';
import { getFinanceSemanticColor, mfSpacing, type Theme } from '../../lib/theme';
import { useLayoutProfile } from '../../lib/useLayoutProfile';

type Props = {
  entradas: number;
  saidas: number;
  saldo: number;
  countEntradas: number;
  countSaidas: number;
};

const monoFont = Platform.select({
  web: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  ios: 'Menlo',
  android: 'monospace',
  default: undefined,
}) as ViewStyle['fontFamily'];

type MetricsLayout = 'stack' | 'heroMobile' | 'heroDesktop';

export function TransactionsMonthMetrics({
  entradas,
  saidas,
  saldo,
  countEntradas,
  countSaidas,
}: Props) {
  const { theme } = useMfTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const layout = useLayoutProfile(containerWidth);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setContainerWidth((prev) => (prev === next ? prev : next));
  }, []);

  const metricsLayout: MetricsLayout = useMemo(() => {
    if (layout.isWide) return 'heroDesktop';
    return 'heroMobile';
  }, [layout.isWide]);

  const styles = useMemo(
    () => createStyles(theme, metricsLayout === 'heroDesktop'),
    [theme, metricsLayout],
  );

  const saldoColor = getFinanceSemanticColor(theme, saldo >= 0 ? 'received' : 'overdue');
  const incomeColor = getFinanceSemanticColor(theme, 'received');
  const expenseColor = getFinanceSemanticColor(theme, 'overdue');

  const entradasHint = countEntradas === 1 ? '1 lançamento' : `${countEntradas} lançamentos`;
  const saidasHint = countSaidas === 1 ? '1 lançamento' : `${countSaidas} lançamentos`;
  const saldoHint = saldo >= 0 ? 'Positivo' : 'Negativo';

  const useHeroDesktop = metricsLayout === 'heroDesktop';
  const useCompactMetrics = metricsLayout !== 'heroDesktop';

  const saldoValueStyle = useHeroDesktop ? styles.heroValue : styles.heroValueMobile;

  const saldoCard = (
    <MfTechKpiCard level="featured" style={styles.heroPrimaryShell}>
      <Text style={styles.metricEyebrow}>Saldo do período</Text>
      <View style={styles.heroValueWrap}>
        <Text
          style={[saldoValueStyle, { color: saldoColor }]}
          numberOfLines={1}
          {...(Platform.OS === 'web'
            ? { adjustsFontSizeToFit: true, minimumFontScale: 0.75 }
            : { allowFontScaling: false })}
        >
          {formatCurrencyBR(saldo)}
        </Text>
      </View>
      <Text style={styles.metricHint}>{saldoHint}</Text>
    </MfTechKpiCard>
  );

  const entradasCard = (
    <HeroMetric
      label="Entradas"
      value={formatCurrencyBR(entradas)}
      hint={entradasHint}
      color={incomeColor}
      icon="trending-up-outline"
      styles={styles}
      compact={useCompactMetrics}
      noFlex={useHeroDesktop}
    />
  );

  const saidasCard = (
    <HeroMetric
      label="Saídas"
      value={formatCurrencyBR(saidas)}
      hint={saidasHint}
      color={expenseColor}
      icon="trending-down-outline"
      styles={styles}
      compact={useCompactMetrics}
      noFlex={useHeroDesktop}
    />
  );

  return (
    <View style={styles.root} onLayout={onLayout}>
      {metricsLayout === 'stack' ? (
        <View style={styles.stack}>
          {saldoCard}
          {entradasCard}
          {saidasCard}
        </View>
      ) : metricsLayout === 'heroDesktop' ? (
        <View style={styles.heroDesktop}>
          {saldoCard}
          <View style={styles.heroMetrics}>
            {entradasCard}
            {saidasCard}
          </View>
        </View>
      ) : (
        <View style={styles.heroMobile}>
          {saldoCard}
          <View style={styles.heroMetricsMobile}>
            {entradasCard}
            {saidasCard}
          </View>
        </View>
      )}
    </View>
  );
}

function HeroMetric({
  label,
  value,
  hint,
  color,
  icon,
  styles,
  compact = false,
  noFlex = false,
}: {
  label: string;
  value: string;
  hint: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  styles: ReturnType<typeof createStyles>;
  compact?: boolean;
  noFlex?: boolean;
}) {
  return (
    <MfTechKpiCard
      level="metric"
      style={[styles.metricShell, noFlex && styles.metricShellNatural]}
      innerStyle={compact ? styles.metricTileCompact : undefined}
    >
      <View style={styles.metricTileHead}>
        <View style={[styles.metricIcon, { backgroundColor: `${color}22` }]}>
          <Ionicons name={icon} size={14} color={color} />
        </View>
        <Text style={styles.metricEyebrow}>{label}</Text>
      </View>
      <Text
        style={[compact ? styles.metricValueCompact : styles.metricValue, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
      >
        {value}
      </Text>
      <Text style={styles.metricHint}>{hint}</Text>
    </MfTechKpiCard>
  );
}

function createStyles(theme: Theme, isDesktop: boolean) {
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
    heroDesktop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: mfSpacing.md,
      overflow: 'visible',
    },
    heroMobile: {
      gap: mfSpacing.sm,
      overflow: 'visible',
    },
    heroPrimaryShell: {
      flex: isDesktop ? 1.35 : undefined,
      width: isDesktop ? undefined : '100%',
      minWidth: 0,
      overflow: 'visible',
      marginVertical: 4,
      marginHorizontal: 2,
    },
    heroValue: {
      fontSize: 34,
      fontWeight: '800',
      lineHeight: 40,
      letterSpacing: -1.2,
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
    },
    heroValueWrap: {
      width: '100%',
      alignSelf: 'stretch',
      minWidth: 0,
    },
    heroValueMobile: {
      fontSize: 28,
      fontWeight: '800',
      lineHeight: 34,
      letterSpacing: -0.8,
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
      flexShrink: 0,
    },
    heroMetrics: {
      flex: 1,
      minWidth: 200,
      gap: mfSpacing.md,
      paddingVertical: 4,
      paddingHorizontal: 4,
      overflow: 'visible',
    },
    heroMetricsMobile: {
      flexDirection: 'row',
      gap: mfSpacing.sm,
      paddingVertical: 4,
      paddingHorizontal: 2,
      overflow: 'visible',
    },
    metricShell: {
      overflow: 'visible',
      marginVertical: 2,
      minWidth: 0,
      flex: 1,
    },
    metricShellNatural: {
      flex: 0,
      flexGrow: 0,
      flexShrink: 0,
      alignSelf: 'stretch',
    },
    metricTileCompact: {
      minWidth: 0,
    },
    metricTileHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    metricIcon: {
      width: 26,
      height: 26,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    metricEyebrow: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: theme.textSecondary,
      flex: 1,
    },
    metricValue: {
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.6,
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
    },
    metricValueCompact: {
      fontSize: isNative ? 15 : 16,
      fontWeight: '700',
      letterSpacing: -0.4,
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
    },
    metricHint: {
      fontSize: 10,
      color: theme.textTertiary,
    },
  });
}
