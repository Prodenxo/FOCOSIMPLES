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
  budgetCount: number;
  monthLabel: string;
  onNewBudget: () => void;
  onDuplicate: () => void;
  bare?: boolean;
};

export function OrcamentosPageChrome({
  theme,
  budgetCount,
  monthLabel,
  onNewBudget,
  onDuplicate,
  bare = false,
}: Props) {
  const { isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme, tokens, bare), [theme, tokens, bare]);

  const subtitle =
    budgetCount === 1
      ? `1 categoria com orçamento · ${monthLabel}`
      : `${budgetCount} categorias com orçamento · ${monthLabel}`;

  return (
    <View style={styles.wrap}>
      <View style={styles.commandRow}>
        <View style={styles.titleCol}>
          <View style={styles.eyebrowRow}>
            <View style={[styles.dot, { backgroundColor: tokens.accent }]} />
            <Text style={[styles.eyebrow, { color: tokens.accent }]}>Planejamento</Text>
          </View>
          <Text style={styles.title}>Orçamentos</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onDuplicate}
            accessibilityRole="button"
            accessibilityLabel="Duplicar mês anterior"
          >
            <Ionicons name="copy-outline" size={16} color={tokens.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onNewBudget}
            accessibilityRole="button"
            accessibilityLabel="Novo orçamento"
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Novo</Text>
          </TouchableOpacity>
        </View>
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
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      flexShrink: 0,
    },
    secondaryBtn: {
      width: 40,
      height: 40,
      borderRadius: mfRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.insetFill,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: mfRadius.sm,
      backgroundColor: tokens.accent,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    primaryBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });
}
