import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useMfTheme } from '../ui/useMfTheme';
import { mfSpacing, mfTypography, type Theme } from '../../lib/theme';
import { getTechTokens } from '../../lib/techDesign';

type Props = {
  theme: Theme;
  pendingCount: number;
  isSuperadmin: boolean;
  loading?: boolean;
};

export function InvitesTabChrome({ theme, pendingCount, isSuperadmin, loading }: Props) {
  const { isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme, tokens), [theme, tokens]);

  const subtitle = isSuperadmin
    ? 'Gere links de cadastro por empresa e acompanhe convites pendentes.'
    : 'Gere links para a sua empresa e acompanhe convites pendentes.';

  const countLabel = loading
    ? '…'
    : pendingCount === 1
      ? '1 pendente'
      : `${pendingCount} pendentes`;

  return (
    <View style={styles.wrap}>
      <View style={styles.titleCol}>
        <View style={styles.eyebrowRow}>
          <View style={[styles.dot, { backgroundColor: tokens.accent }]} />
          <Text style={[styles.eyebrow, { color: tokens.accent }]}>Acessos</Text>
        </View>
        <Text style={styles.title}>Convites por link</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={[styles.statChip, { borderColor: tokens.insetBorder, backgroundColor: tokens.insetFill }]}>
        <Text style={[styles.statValue, { color: tokens.accent }]}>{countLabel}</Text>
        <Text style={styles.statLabel}>convites</Text>
      </View>
    </View>
  );
}

function createStyles(theme: Theme, _tokens: ReturnType<typeof getTechTokens>) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: mfSpacing.md,
      marginBottom: mfSpacing.md,
    },
    titleCol: {
      flex: 1,
      minWidth: 0,
    },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
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
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    title: {
      ...mfTypography.titleLarge,
      color: theme.text,
      letterSpacing: -0.4,
      fontSize: 20,
    },
    subtitle: {
      ...mfTypography.body,
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 4,
      lineHeight: 20,
    },
    statChip: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      minWidth: 88,
      flexShrink: 0,
    },
    statValue: {
      fontSize: 15,
      fontWeight: '700',
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: 2,
    },
  });
}
