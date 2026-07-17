import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mfSpacing } from '../../lib/theme';
import { getTechTokens, mfTechPanelChrome } from '../../lib/techDesign';
import { useMfTheme } from '../../components/ui/useMfTheme';
import type { DashboardInsight } from './dashboardInsights';

const iconMap = {
  analytics: 'stats-chart-outline',
  swap: 'swap-vertical-outline',
  receipt: 'list-outline',
  time: 'time-outline',
  wallet: 'wallet-outline',
  alert: 'alert-circle-outline',
} as const;

type Props = {
  insights: DashboardInsight[];
  isDesktop?: boolean;
};

export function DashboardInsightsStrip({ insights, isDesktop = false }: Props) {
  const { theme, isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const chrome = useMemo(() => mfTechPanelChrome(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme, tokens, isDesktop), [theme, tokens, isDesktop]);

  if (insights.length === 0) return null;

  const cells = insights.map((item) => (
    <InsightCell key={item.id} item={item} tokens={tokens} styles={styles} theme={theme} />
  ));

  return (
    <View style={styles.wrap}>
      <View style={[styles.panel, chrome]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.dot, { backgroundColor: tokens.accent }]} />
            <Text style={[styles.headerEyebrow, { color: tokens.accent }]}>Resumo</Text>
          </View>
          <Text style={styles.headerTitle}>Números do mês</Text>
        </View>
        {isDesktop ? (
          <View style={styles.grid}>{cells}</View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollRow}
          >
            {cells}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

function InsightCell({
  item,
  tokens,
  styles,
  theme,
}: {
  item: DashboardInsight;
  tokens: ReturnType<typeof getTechTokens>;
  styles: ReturnType<typeof createStyles>;
  theme: ReturnType<typeof useMfTheme>['theme'];
}) {
  const toneColor =
    item.tone === 'positive'
      ? theme.success
      : item.tone === 'negative'
        ? theme.error
        : item.tone === 'accent'
          ? tokens.accent
          : theme.text;

  return (
    <View style={styles.cell}>
      <View style={styles.cellTop}>
        <View style={[styles.iconWrap, { backgroundColor: `${toneColor}18` }]}>
          <Ionicons name={iconMap[item.icon]} size={14} color={toneColor} />
        </View>
        <Text style={styles.cellLabel}>{item.label}</Text>
      </View>
      <Text style={[styles.cellValue, { color: toneColor }]} numberOfLines={1}>
        {item.value}
      </Text>
      <Text style={styles.cellHint} numberOfLines={2}>
        {item.hint}
      </Text>
    </View>
  );
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  tokens: ReturnType<typeof getTechTokens>,
  isDesktop: boolean,
) {
  const mono = Platform.select({
    web: 'ui-monospace, Menlo, Consolas, monospace',
    ios: 'Menlo',
    android: 'monospace',
    default: undefined,
  });

  return StyleSheet.create({
    wrap: {
      width: '100%',
      marginBottom: mfSpacing.lg,
    },
    panel: {
      padding: mfSpacing.lg,
      gap: mfSpacing.md,
    },
    header: {
      gap: 4,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    headerEyebrow: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.3,
      textTransform: 'uppercase',
    },
    headerTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.2,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: mfSpacing.sm,
    },
    scrollRow: {
      gap: mfSpacing.sm,
      paddingRight: mfSpacing.sm,
    },
    cell: {
      width: isDesktop ? '31.5%' : 148,
      minWidth: isDesktop ? 160 : 148,
      padding: mfSpacing.md,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: tokens.insetFill,
      gap: 6,
    },
    cellTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconWrap: {
      width: 26,
      height: 26,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellLabel: {
      flex: 1,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: theme.textSecondary,
    },
    cellValue: {
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.5,
      fontFamily: mono,
      fontVariant: ['tabular-nums'],
    },
    cellHint: {
      fontSize: 11,
      lineHeight: 14,
      color: theme.textTertiary,
    },
  });
}
