import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mfRadius, mfSpacing, mfTypography, type Theme } from '../../lib/theme';
import { getTechTokens } from '../../lib/techDesign';
import { useMfTheme } from '../../components/ui/useMfTheme';

type Props = {
  theme: Theme;
  accountCount: number;
  onAddAccount: () => void;
  /** Sem padding próprio — dentro do painel unificado */
  bare?: boolean;
};

export function ContasPageChrome({
  theme,
  accountCount,
  onAddAccount,
  bare = false,
}: Props) {
  const { isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme, tokens, bare), [theme, tokens, bare]);

  const subtitle =
    accountCount === 1 ? '1 conta cadastrada' : `${accountCount} contas cadastradas`;

  return (
    <View style={styles.wrap}>
      <View style={styles.commandRow}>
        <View style={styles.titleCol}>
          <View style={styles.eyebrowRow}>
            <View style={[styles.dot, { backgroundColor: tokens.accent }]} />
            <Text style={[styles.eyebrow, { color: tokens.accent }]}>Patrimônio</Text>
          </View>
          <Text style={styles.title}>Contas e cartões</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={onAddAccount}
          accessibilityRole="button"
          accessibilityLabel="Nova conta"
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Nova conta</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(
  theme: Theme,
  tokens: ReturnType<typeof getTechTokens>,
  bare: boolean,
) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      paddingHorizontal: bare ? 0 : mfSpacing.md,
      paddingTop: bare ? 0 : mfSpacing.md,
      paddingBottom: mfSpacing.sm,
    },
    commandRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: mfSpacing.md,
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
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: mfRadius.sm,
      backgroundColor: tokens.accent,
      flexShrink: 0,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    primaryBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });
}
