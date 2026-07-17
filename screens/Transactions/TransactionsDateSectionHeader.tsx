import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { mfSpacing } from '../../lib/theme';
import { getTechTokens } from '../../lib/techDesign';
import { useMfTheme } from '../../components/ui/useMfTheme';

type Props = {
  label: string;
};

/** Separador de dia na lista — dot + rótulo + linha (mesmo padrão telemetria do dashboard). */
export function TransactionsDateSectionHeader({ label }: Props) {
  const { isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: tokens.accent }]} />
      <Text style={[styles.label, { color: tokens.accent }]}>{label}</Text>
      <View style={[styles.line, { backgroundColor: tokens.divider }]} />
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof getTechTokens>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      marginTop: mfSpacing.md,
      marginBottom: mfSpacing.xs,
      paddingHorizontal: mfSpacing.xs,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      flexShrink: 0,
    },
    label: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      flexShrink: 0,
    },
    line: {
      flex: 1,
      height: 1,
    },
  });
}
