import React, { useMemo, type ReactNode } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MfPeriodNav, MfTechKpiCard } from '../../components/ui';
import {
  getFinanceSemanticColor,
  mfSpacing,
  mfTypography,
  type Theme,
} from '../../lib/theme';
import {
  getTechTokens,
  mfTechInsetSurface,
  mfTechPanelChrome,
} from '../../lib/techDesign';
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

const monoFont = Platform.select({
  web: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  ios: 'Menlo',
  android: 'monospace',
  default: undefined,
}) as string | undefined;

type Props = {
  title: string;
  subtitle?: string;
  monthLabel: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  right?: ReactNode;
  balance: number;
  totalIncome: number;
  totalExpenses: number;
  balanceLabel?: string;
  balanceHint?: string;
  insights: DashboardInsight[];
  isDesktop?: boolean;
  chipsSlot?: ReactNode;
  /** Web com shell: título + período na mesma linha */
  compactHeader?: boolean;
  /** false quando MfAppHeader já mostra o título (mobile) */
  showCommandTitle?: boolean;
};

/**
 * Painel único: comando + saldo hero + telemetria — uma faixa de acento, densidade alta.
 */
export function DashboardMissionControl({
  title,
  subtitle,
  monthLabel,
  onPrevMonth,
  onNextMonth,
  right,
  balance,
  totalIncome,
  totalExpenses,
  balanceLabel = 'Saldo nas contas',
  balanceHint = 'Saldo de todas as contas',
  insights,
  isDesktop = false,
  chipsSlot,
  compactHeader = true,
  showCommandTitle = true,
}: Props) {
  const { theme, isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const chrome = useMemo(() => mfTechPanelChrome(isDarkMode, 'accent'), [isDarkMode]);
  const styles = useMemo(
    () => createStyles(theme, isDarkMode, tokens, isDesktop, compactHeader, showCommandTitle),
    [theme, isDarkMode, tokens, isDesktop, compactHeader, showCommandTitle],
  );

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const incomeColor = getFinanceSemanticColor(theme, 'received');
  const expenseColor = getFinanceSemanticColor(theme, 'overdue');

  return (
    <View style={styles.wrap}>
      <View style={[styles.panel, chrome]}>
        <View style={styles.commandRow}>
          {showCommandTitle ? (
            <View style={styles.commandLeft}>
              <View style={styles.eyebrowRow}>
                <View style={[styles.dot, { backgroundColor: tokens.accent }]} />
                <Text style={[styles.eyebrow, { color: tokens.accent }]}>Painel · visão geral</Text>
                <View style={[styles.livePill, { borderColor: tokens.accent, backgroundColor: tokens.accentSoft }]}>
                  <View style={[styles.liveDot, { backgroundColor: tokens.accent }]} />
                  <Text style={[styles.liveText, { color: tokens.accent }]}>Ao vivo</Text>
                </View>
              </View>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          ) : null}

          <View style={[styles.commandCenter, !showCommandTitle && styles.commandCenterFull]}>
            <MfPeriodNav
              label={monthLabel}
              onPrevious={onPrevMonth}
              onNext={onNextMonth}
              variant="tech"
            />
          </View>

          {right ? <View style={styles.commandRight}>{right}</View> : null}
        </View>

        {chipsSlot ? (
          <View style={[styles.chipsWell, mfTechInsetSurface(isDarkMode, false)]}>{chipsSlot}</View>
        ) : null}

        <View style={styles.heroBlock}>
          {isDesktop ? (
            <View style={styles.heroDesktop}>
              <MfTechKpiCard level="featured" style={styles.heroPrimaryShell}>
                <View style={[styles.heroBadge, { borderColor: tokens.panelBorder, backgroundColor: tokens.accentSoft }]}>
                  <Ionicons name="pulse" size={12} color={tokens.accent} />
                  <Text style={[styles.metricEyebrow, { color: tokens.accent }]}>{balanceLabel}</Text>
                </View>
                <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                  {formatCurrency(balance)}
                </Text>
                <Text style={styles.heroHint}>{balanceHint}</Text>
              </MfTechKpiCard>
              <View style={styles.heroMetrics}>
                <HeroMetric
                  label="Entradas"
                  value={formatCurrency(totalIncome)}
                  hint="Receitas no período"
                  color={incomeColor}
                  icon="trending-up-outline"
                  styles={styles}
                />
                <HeroMetric
                  label="Saídas"
                  value={formatCurrency(totalExpenses)}
                  hint="Despesas no período"
                  color={expenseColor}
                  icon="trending-down-outline"
                  styles={styles}
                />
              </View>
            </View>
          ) : (
            <View style={styles.heroMobile}>
              <MfTechKpiCard level="featured" style={styles.heroPrimaryShell}>
                <Text style={[styles.metricEyebrow, { color: tokens.accent }]}>{balanceLabel}</Text>
                <Text style={styles.heroValueMobile} numberOfLines={1} adjustsFontSizeToFit>
                  {formatCurrency(balance)}
                </Text>
                <Text style={styles.heroHint}>{balanceHint}</Text>
              </MfTechKpiCard>
              <View style={styles.heroMetricsMobile}>
                <HeroMetric
                  label="Entradas"
                  value={formatCurrency(totalIncome)}
                  hint="Receitas"
                  color={incomeColor}
                  icon="trending-up-outline"
                  styles={styles}
                  compact
                />
                <HeroMetric
                  label="Saídas"
                  value={formatCurrency(totalExpenses)}
                  hint="Despesas"
                  color={expenseColor}
                  icon="trending-down-outline"
                  styles={styles}
                  compact
                />
              </View>
            </View>
          )}
        </View>

        {insights.length > 0 ? (
          <>
            <View style={styles.telemetryDivider}>
              <View style={[styles.dot, { backgroundColor: tokens.accent }]} />
              <Text style={[styles.telemetryLabel, { color: tokens.accent }]}>Resumo</Text>
              <View style={[styles.telemetryLine, { backgroundColor: tokens.divider }]} />
            </View>
            {isDesktop ? (
              <View style={styles.telemetryGrid}>
                {insights.map((item) => (
                  <TelemetryCell key={item.id} item={item} theme={theme} tokens={tokens} styles={styles} />
                ))}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.telemetryScroll}>
                {insights.map((item) => (
                  <TelemetryCell key={item.id} item={item} theme={theme} tokens={tokens} styles={styles} narrow />
                ))}
              </ScrollView>
            )}
          </>
        ) : null}
      </View>
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
}: {
  label: string;
  value: string;
  hint: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  styles: ReturnType<typeof createStyles>;
  compact?: boolean;
}) {
  return (
    <MfTechKpiCard level="metric" style={styles.metricShell} innerStyle={compact ? styles.metricTileCompact : undefined}>
      <View style={styles.metricTileHead}>
        <View style={[styles.metricIcon, { backgroundColor: `${color}22` }]}>
          <Ionicons name={icon} size={14} color={color} />
        </View>
        <Text style={styles.metricEyebrow}>{label}</Text>
      </View>
      <Text style={[compact ? styles.metricValueCompact : styles.metricValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.metricHint}>{hint}</Text>
    </MfTechKpiCard>
  );
}

function TelemetryCell({
  item,
  theme,
  tokens,
  styles,
  narrow = false,
}: {
  item: DashboardInsight;
  theme: Theme;
  tokens: ReturnType<typeof getTechTokens>;
  styles: ReturnType<typeof createStyles>;
  narrow?: boolean;
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
    <View style={[styles.telCell, narrow && styles.telCellNarrow]}>
      <View style={styles.telCellTop}>
        <View style={[styles.telIcon, { backgroundColor: `${toneColor}18` }]}>
          <Ionicons name={iconMap[item.icon]} size={13} color={toneColor} />
        </View>
        <Text style={styles.telLabel} numberOfLines={1}>
          {item.label}
        </Text>
      </View>
      <Text style={[styles.telValue, { color: toneColor }]} numberOfLines={1}>
        {item.value}
      </Text>
      <Text style={styles.telHint} numberOfLines={2}>
        {item.hint}
      </Text>
    </View>
  );
}

function createStyles(
  theme: Theme,
  isDarkMode: boolean,
  tokens: ReturnType<typeof getTechTokens>,
  isDesktop: boolean,
  compactHeader: boolean,
  showCommandTitle: boolean,
) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      marginBottom: mfSpacing.md,
    },
    panel: {
      width: '100%',
      padding: isDesktop ? mfSpacing.md : mfSpacing.md,
      gap: mfSpacing.md,
    },
    commandRow: {
      flexDirection: 'row',
      alignItems: compactHeader && isDesktop ? 'center' : 'flex-start',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: mfSpacing.sm,
    },
    commandLeft: {
      flex: isDesktop ? 1 : undefined,
      minWidth: isDesktop ? 200 : undefined,
      width: isDesktop ? undefined : '100%',
    },
    commandCenter: {
      flexShrink: 0,
      alignItems: 'center',
      ...(isDesktop ? { paddingHorizontal: mfSpacing.sm } : { width: '100%', marginTop: mfSpacing.xs }),
    },
    commandCenterFull: {
      flex: 1,
      width: undefined,
      marginTop: 0,
    },
    commandRight: {
      flexShrink: 0,
      alignSelf: isDesktop ? 'center' : 'flex-end',
    },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 4,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.3,
      textTransform: 'uppercase',
    },
    livePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 999,
      borderWidth: 1,
      marginLeft: 4,
    },
    liveDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
    },
    liveText: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    title: {
      ...mfTypography.titleLarge,
      fontSize: isDesktop ? 20 : 22,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: -0.4,
      lineHeight: isDesktop ? 24 : 28,
    },
    subtitle: {
      ...mfTypography.body,
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    chipsWell: {
      paddingVertical: mfSpacing.sm,
      paddingHorizontal: mfSpacing.sm,
      borderRadius: 10,
    },
    heroBlock: {
      width: '100%',
      overflow: 'visible',
    },
    heroDesktop: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: mfSpacing.md,
      minHeight: 120,
      overflow: 'visible',
    },
    heroPrimaryShell: {
      flex: 1.35,
      minWidth: 0,
      overflow: 'visible',
      marginVertical: 4,
      marginHorizontal: 2,
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 999,
      borderWidth: 1,
      marginBottom: mfSpacing.sm,
    },
    heroValue: {
      fontSize: 38,
      fontWeight: '800',
      lineHeight: 42,
      letterSpacing: -1.4,
      color: theme.text,
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
    },
    heroValueMobile: {
      fontSize: 30,
      fontWeight: '800',
      lineHeight: 36,
      letterSpacing: -1,
      color: theme.text,
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
      marginVertical: 2,
    },
    heroHint: {
      fontSize: 11,
      color: theme.textTertiary,
      marginTop: 4,
    },
    heroMetrics: {
      flex: 1,
      minWidth: 200,
      gap: mfSpacing.md,
      justifyContent: 'center',
      paddingVertical: 4,
      paddingHorizontal: 4,
      overflow: 'visible',
    },
    heroMobile: {
      gap: mfSpacing.sm,
    },
    heroMetricsMobile: {
      flexDirection: 'row',
      gap: mfSpacing.md,
      paddingVertical: 4,
      paddingHorizontal: 2,
      overflow: 'visible',
    },
    metricShell: {
      overflow: 'visible',
      marginVertical: 2,
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
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.4,
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
    },
    metricHint: {
      fontSize: 10,
      color: theme.textTertiary,
    },
    telemetryDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    telemetryLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    telemetryLine: {
      flex: 1,
      height: 1,
    },
    telemetryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: mfSpacing.sm,
    },
    telemetryScroll: {
      gap: mfSpacing.sm,
      paddingRight: mfSpacing.sm,
    },
    telCell: {
      flexGrow: 1,
      flexBasis: isDesktop ? '15.5%' : undefined,
      minWidth: isDesktop ? 120 : 132,
      maxWidth: isDesktop ? undefined : 148,
      padding: mfSpacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: isDarkMode ? 'rgba(4, 8, 14, 0.5)' : 'rgba(248, 250, 252, 0.8)',
      gap: 4,
    },
    telCellNarrow: {
      width: 132,
      minWidth: 132,
    },
    telCellTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    telIcon: {
      width: 24,
      height: 24,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
    },
    telLabel: {
      flex: 1,
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: theme.textSecondary,
    },
    telValue: {
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: -0.4,
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
    },
    telHint: {
      fontSize: 10,
      lineHeight: 13,
      color: theme.textTertiary,
    },
  });
}
