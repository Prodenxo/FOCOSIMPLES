import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native';
import { MfDonutChart, MfPeriodNav, MfTechKpiCard } from '../../components/ui';
import type { MfDonutSegment } from '../../components/ui';
import { useMfTheme } from '../../components/ui/useMfTheme';
import { formatCurrencyBR } from '../../lib/numberFormat';
import { mfSpacing } from '../../lib/theme';
import { getTechTokens } from '../../lib/techDesign';

type Props = {
  totalMonth: number;
  subtitle: string;
  monthLabel: string;
  segments: MfDonutSegment[];
  onPrevious: () => void;
  onNext: () => void;
};

const monoFont = Platform.select({
  web: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  ios: 'Menlo',
  android: 'monospace',
  default: undefined,
}) as ViewStyle['fontFamily'];

export function CategoriasSummary({
  totalMonth,
  subtitle,
  monthLabel,
  segments,
  onPrevious,
  onNext,
}: Props) {
  const { theme, isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme, tokens), [theme, tokens]);

  return (
    <MfTechKpiCard level="featured" style={styles.shell} innerStyle={styles.inner}>
      <View style={styles.topRow}>
        <View style={styles.left}>
          <Text style={styles.eyebrow}>
            {totalMonth >= 0 ? 'Total do mês' : 'Movimento'}
          </Text>
          <Text
            style={styles.amount}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
          >
            {formatCurrencyBR(totalMonth)}
          </Text>
          <Text style={styles.hint}>{subtitle}</Text>
        </View>
        <View style={styles.ring}>
          <MfDonutChart size={88} segments={segments} strokeWidth={7} />
        </View>
      </View>
      <MfPeriodNav
        label={monthLabel}
        onPrevious={onPrevious}
        onNext={onNext}
        style={styles.periodNav}
      />
    </MfTechKpiCard>
  );
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  tokens: ReturnType<typeof getTechTokens>,
) {
  return StyleSheet.create({
    shell: {
      width: '100%',
      marginBottom: mfSpacing.md,
      borderLeftWidth: 3,
      borderLeftColor: tokens.accent,
    },
    inner: {
      padding: mfSpacing.md,
      gap: mfSpacing.sm,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: mfSpacing.md,
    },
    left: {
      flex: 1,
      minWidth: 0,
    },
    eyebrow: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: theme.textSecondary,
      marginBottom: 4,
    },
    amount: {
      fontSize: Platform.OS === 'web' ? 32 : 28,
      fontWeight: '800',
      lineHeight: Platform.OS === 'web' ? 38 : 34,
      letterSpacing: -1,
      color: theme.text,
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
    },
    hint: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 6,
      lineHeight: 17,
    },
    ring: {
      width: 88,
      height: 88,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    periodNav: {
      marginTop: mfSpacing.xs,
    },
  });
}
