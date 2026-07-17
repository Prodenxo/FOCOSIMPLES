import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MfPeriodNav } from '../../components/ui';
import { getFinanceSemanticColor, mfSpacing, mfTypography, type Theme } from '../../lib/theme';
import {
  getTechTokens,
  mfTechHeroPrimaryWash,
  mfTechInsetSurface,
  mfTechPanelChrome,
} from '../../lib/techDesign';
import { useMfTheme } from '../../components/ui/useMfTheme';

type Props = {
  balance: number;
  totalIncome: number;
  totalExpenses: number;
  theme: Theme;
  isDesktop?: boolean;
  balanceLabel?: string;
  balanceHint?: string;
  monthLabel?: string;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  hidePeriod?: boolean;
};

const monoFont = Platform.select({
  web: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  ios: 'Menlo',
  android: 'monospace',
  default: undefined,
}) as string | undefined;

export function DashboardHeroDeck({
  balance,
  totalIncome,
  totalExpenses,
  theme,
  isDesktop = false,
  balanceLabel = 'Saldo nas contas',
  balanceHint = 'Consolidado do período',
  monthLabel,
  onPrevMonth,
  onNextMonth,
  hidePeriod = false,
}: Props) {
  const { isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const chrome = useMemo(() => mfTechPanelChrome(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme, isDarkMode, tokens), [theme, isDarkMode, tokens]);

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const showPeriod = !hidePeriod && monthLabel && onPrevMonth && onNextMonth;

  return (
    <View style={styles.wrap}>
      <View style={[styles.deck, chrome]}>
        {showPeriod ? (
          <>
            <View style={styles.periodRow}>
              <MfPeriodNav
                label={monthLabel}
                onPrevious={onPrevMonth}
                onNext={onNextMonth}
                variant="tech"
              />
            </View>
            <View style={styles.hRule} />
          </>
        ) : null}

        {isDesktop ? (
          <View style={styles.desktopRow}>
            <View style={[styles.primaryCol, mfTechHeroPrimaryWash(isDarkMode)]}>
              <View style={styles.primaryInner}>
                <View style={[styles.badge, { backgroundColor: tokens.accentSoft, borderColor: tokens.panelBorder }]}>
                  <Ionicons name="pulse" size={12} color={tokens.accent} />
                  <Text style={[styles.kpiEyebrow, { color: tokens.accent }]}>{balanceLabel}</Text>
                </View>
                <Text
                  style={styles.heroValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.45}
                >
                  {formatCurrency(balance)}
                </Text>
                <Text style={styles.heroHint}>{balanceHint}</Text>
              </View>
            </View>

            <View style={styles.vDivider} />

            <View style={styles.secondaryCol}>
              <MetricCard
                label="Entradas"
                value={formatCurrency(totalIncome)}
                hint="Receitas no período"
                color={getFinanceSemanticColor(theme, 'received')}
                icon="trending-up-outline"
                tokens={tokens}
                styles={styles}
              />
              <MetricCard
                label="Saídas"
                value={formatCurrency(totalExpenses)}
                hint="Despesas no período"
                color={getFinanceSemanticColor(theme, 'overdue')}
                icon="trending-down-outline"
                tokens={tokens}
                styles={styles}
              />
            </View>
          </View>
        ) : (
          <View style={styles.mobileStack}>
            <View style={[styles.mobileHero, mfTechInsetSurface(isDarkMode, true), mfTechHeroPrimaryWash(isDarkMode)]}>
              <Text style={[styles.kpiEyebrow, { color: tokens.accent }]}>{balanceLabel}</Text>
              <Text style={styles.heroValueMobile} numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrency(balance)}
              </Text>
              <Text style={styles.heroHint}>{balanceHint}</Text>
            </View>
            <View style={styles.mobileMetricsRow}>
              <MetricCard
                label="Entradas"
                value={formatCurrency(totalIncome)}
                hint="Receitas"
                color={getFinanceSemanticColor(theme, 'received')}
                icon="trending-up-outline"
                tokens={tokens}
                styles={styles}
                compact
              />
              <MetricCard
                label="Saídas"
                value={formatCurrency(totalExpenses)}
                hint="Despesas"
                color={getFinanceSemanticColor(theme, 'overdue')}
                icon="trending-down-outline"
                tokens={tokens}
                styles={styles}
                compact
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function MetricCard({
  label,
  value,
  hint,
  color,
  icon,
  tokens,
  styles,
  compact = false,
}: {
  label: string;
  value: string;
  hint: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  tokens: ReturnType<typeof getTechTokens>;
  styles: ReturnType<typeof createStyles>;
  compact?: boolean;
}) {
  return (
    <View style={[styles.metricCard, compact && styles.metricCardCompact]}>
      <View style={styles.metricCardHeader}>
        <View style={[styles.iconBadge, { backgroundColor: `${color}22` }]}>
          <Ionicons name={icon} size={14} color={color} />
        </View>
        <Text style={styles.stripLabel}>{label}</Text>
      </View>
      <Text style={[compact ? styles.stripValueCompact : styles.stripValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.stripHint}>{hint}</Text>
    </View>
  );
}

function createStyles(
  theme: Theme,
  isDarkMode: boolean,
  tokens: ReturnType<typeof getTechTokens>,
) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      marginBottom: mfSpacing.lg,
    },
    deck: {
      width: '100%',
      padding: mfSpacing.lg,
      gap: mfSpacing.md,
    },
    periodRow: {
      alignItems: 'center',
    },
    hRule: {
      height: 1,
      backgroundColor: tokens.divider,
    },
    desktopRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      minHeight: 148,
    },
    primaryCol: {
      flex: 1.4,
      minWidth: 0,
      borderRadius: mfSpacing.sm,
      overflow: 'hidden',
    },
    primaryInner: {
      flex: 1,
      justifyContent: 'center',
      padding: mfSpacing.lg,
      paddingRight: mfSpacing.md,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      marginBottom: mfSpacing.md,
    },
    kpiEyebrow: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.3,
      textTransform: 'uppercase',
    },
    heroValue: {
      fontSize: 42,
      fontWeight: '800',
      lineHeight: 48,
      letterSpacing: -1.6,
      color: theme.text,
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
    },
    heroValueMobile: {
      fontSize: 32,
      fontWeight: '800',
      lineHeight: 38,
      letterSpacing: -1,
      color: theme.text,
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
      marginVertical: 4,
    },
    heroHint: {
      ...mfTypography.caption,
      color: theme.textTertiary,
      marginTop: 8,
    },
    vDivider: {
      width: 1,
      marginHorizontal: mfSpacing.lg,
      backgroundColor: tokens.divider,
    },
    secondaryCol: {
      flex: 1,
      minWidth: 220,
      justifyContent: 'center',
      gap: mfSpacing.md,
    },
    metricCard: {
      padding: mfSpacing.md,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: tokens.insetFill,
      gap: 6,
    },
    metricCardCompact: {
      flex: 1,
      minWidth: 0,
    },
    metricCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconBadge: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stripLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      color: theme.textSecondary,
      flex: 1,
    },
    stripValue: {
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: -0.8,
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
    },
    stripValueCompact: {
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.5,
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
    },
    stripHint: {
      fontSize: 11,
      color: theme.textTertiary,
    },
    mobileStack: {
      gap: mfSpacing.md,
    },
    mobileHero: {
      padding: mfSpacing.lg,
      borderRadius: 10,
      gap: 4,
    },
    mobileMetricsRow: {
      flexDirection: 'row',
      gap: mfSpacing.sm,
    },
  });
}
