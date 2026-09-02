import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { mfSpacing, mfTypography } from '../../lib/theme';
import { getTechAccent } from '../../lib/glassStyles';
import { useMfTheme } from '../../components/ui/useMfTheme';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  /** Cabeçalho com eyebrow tech */
  variant?: 'default' | 'tech';
  eyebrow?: string;
};

export function DashboardPageHeader({
  title,
  subtitle,
  right,
  variant = 'tech',
  eyebrow = 'Painel financeiro',
}: Props) {
  const { theme, isDarkMode } = useMfTheme();
  const accent = getTechAccent(isDarkMode);
  const styles = useMemo(() => createStyles(theme, accent), [theme, accent]);

  if (variant === 'default') {
    return (
      <View style={styles.row}>
        <View style={styles.textCol}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <View style={styles.eyebrowRow}>
          <View style={[styles.eyebrowDot, { backgroundColor: accent }]} />
          <Text style={[styles.eyebrow, { color: accent }]}>{eyebrow}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useMfTheme>['theme'], accent: string) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: mfSpacing.md,
      marginBottom: mfSpacing.lg,
    },
    textCol: {
      flex: 1,
      minWidth: 0,
    },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    eyebrowDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    title: {
      ...mfTypography.titleLarge,
      color: theme.text,
      letterSpacing: -0.5,
      fontWeight: '800',
    },
    subtitle: {
      ...mfTypography.body,
      color: theme.textSecondary,
      marginTop: 4,
    },
    right: {
      flexShrink: 0,
      paddingTop: 4,
    },
  });
}
