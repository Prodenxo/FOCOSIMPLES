import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MfScrollView } from '../ui/MfScrollView';
import { Ionicons } from '@expo/vector-icons';
import { useMfTheme } from '../ui/useMfTheme';
import { mfSpacing, mfTypography, type Theme } from '../../lib/theme';
import { getTechTokens, mfTechPanelChrome } from '../../lib/techDesign';

type StatItem = {
  label: string;
  value: string | number;
};

type Props = {
  theme: Theme;
  onBack: () => void;
  isDesktop: boolean;
  role: string | null;
  stats: StatItem[];
  loading?: boolean;
  subtitle?: string;
  rightAction?: {
    label: string;
    onPress: () => void;
  } | null;
};

export function ManageUsersPageChrome({
  theme,
  onBack,
  isDesktop,
  role,
  stats,
  loading,
  subtitle,
  rightAction,
}: Props) {
  const { isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const panelStyle = useMemo(() => mfTechPanelChrome(isDarkMode, 'accent'), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme, tokens, isDesktop), [theme, tokens, isDesktop]);

  const resolvedSubtitle =
    subtitle
    ?? (role === 'superadmin'
      ? 'Empresas, pessoas e convites em escopo global.'
      : 'Membros, convites e lista da sua empresa.');

  return (
    <View style={[styles.hero, panelStyle]}>
      <View style={styles.topRow}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.titleCol}>
          <View style={styles.eyebrowRow}>
            <View style={[styles.dot, { backgroundColor: tokens.accent }]} />
            <Text style={[styles.eyebrow, { color: tokens.accent }]}>Administração</Text>
          </View>
          <Text style={styles.title}>Gerenciar acessos</Text>
          <Text style={styles.subtitle}>{resolvedSubtitle}</Text>
        </View>
        {rightAction && isDesktop ? (
          <TouchableOpacity style={styles.actionBtn} onPress={rightAction.onPress}>
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>{rightAction.label}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {stats.length > 0 ? (
        <MfScrollView
          horizontal
          hideHorizontalBar
          contentContainerStyle={styles.statRow}
        >
          {stats.map((stat) => (
            <View
              key={stat.label}
              style={[
                styles.statCard,
                { borderColor: tokens.insetBorder, backgroundColor: tokens.insetFill },
              ]}
            >
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={[styles.statValue, { color: tokens.accent }]}>
                {loading ? '…' : stat.value}
              </Text>
            </View>
          ))}
        </MfScrollView>
      ) : null}
    </View>
  );
}

function createStyles(
  theme: Theme,
  tokens: ReturnType<typeof getTechTokens>,
  isDesktop: boolean,
) {
  return StyleSheet.create({
    hero: {
      paddingHorizontal: isDesktop ? mfSpacing.md : mfSpacing.sm,
      paddingVertical: isDesktop ? mfSpacing.md : mfSpacing.sm,
      marginBottom: mfSpacing.sm,
      gap: mfSpacing.sm,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: mfSpacing.sm,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: tokens.insetFill,
      marginTop: 2,
      flexShrink: 0,
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
      fontSize: isDesktop ? 24 : 20,
      fontWeight: '800',
    },
    subtitle: {
      ...mfTypography.body,
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 4,
      lineHeight: 20,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: tokens.accent,
      flexShrink: 0,
      ...(Platform.OS === 'web'
        ? ({
            // @ts-expect-error web-only
            boxShadow: `0 8px 24px ${tokens.accent}44`,
          } as object)
        : {}),
    },
    actionBtnText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 13,
    },
    statRow: {
      flexDirection: 'row',
      gap: 8,
      paddingRight: 4,
    },
    statCard: {
      minWidth: 88,
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    statLabel: {
      fontSize: 9,
      fontWeight: '600',
      color: theme.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    statValue: {
      marginTop: 2,
      fontSize: isDesktop ? 17 : 16,
      fontWeight: '700',
      color: theme.text,
    },
  });
}
