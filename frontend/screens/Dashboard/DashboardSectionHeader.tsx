import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { mfSpacing, mfTypography } from '../../lib/theme';
import { getTechTokens } from '../../lib/techDesign';
import { useMfTheme } from '../../components/ui/useMfTheme';
import type { ReactNode } from 'react';

type Props = {
  eyebrow: string;
  title: string;
  right?: ReactNode;
};

/** Cabeçalho de seção — estilo painel técnico (eyebrow + título). */
export function DashboardSectionHeader({ eyebrow, title, right }: Props) {
  const { theme, isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme, tokens), [theme, tokens]);

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowDot} />
          <Text style={styles.eyebrow}>{eyebrow}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useMfTheme>['theme'], tokens: ReturnType<typeof getTechTokens>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginBottom: mfSpacing.md,
      gap: mfSpacing.md,
    },
    left: {
      flex: 1,
      minWidth: 0,
    },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    eyebrowDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: tokens.accent,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: tokens.accent,
    },
    title: {
      ...mfTypography.subtitle,
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.2,
    },
    right: {
      flexShrink: 0,
    },
  });
}
