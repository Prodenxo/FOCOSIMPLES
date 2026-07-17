import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { MfPeriodNav } from '../../components/ui';
import { mfSpacing, mfTypography } from '../../lib/theme';
import { getTechTokens, mfTechPanelChrome } from '../../lib/techDesign';
import { useMfTheme } from '../../components/ui/useMfTheme';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  monthLabel: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  right?: ReactNode;
};

/** Barra de comando full-width — período, contexto e ações (estilo painel). */
export function DashboardTechCommandBar({
  title,
  subtitle,
  monthLabel,
  onPrevMonth,
  onNextMonth,
  right,
}: Props) {
  const { theme, isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const chrome = useMemo(() => mfTechPanelChrome(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme, tokens), [theme, tokens]);

  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, chrome]}>
        <View style={styles.topRow}>
          <View style={styles.titleBlock}>
            <View style={styles.eyebrowRow}>
              <View style={[styles.dot, { backgroundColor: tokens.accent }]} />
              <Text style={[styles.eyebrow, { color: tokens.accent }]}>Painel · visão geral</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <View style={styles.actions}>{right}</View>
        </View>
        <View style={styles.divider} />
        <View style={styles.periodRow}>
          <MfPeriodNav
            label={monthLabel}
            onPrevious={onPrevMonth}
            onNext={onNextMonth}
            variant="tech"
          />
          <View style={[styles.syncPill, { borderColor: tokens.accent, backgroundColor: tokens.accentSoft }]}>
            <View style={[styles.syncDot, { backgroundColor: tokens.accent }]} />
            <Text style={[styles.syncText, { color: tokens.accent }]}>Dados do período</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useMfTheme>['theme'], tokens: ReturnType<typeof getTechTokens>) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      marginBottom: mfSpacing.lg,
    },
    bar: {
      width: '100%',
      padding: mfSpacing.lg,
      gap: mfSpacing.md,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: mfSpacing.lg,
      flexWrap: 'wrap',
    },
    titleBlock: {
      flex: 1,
      minWidth: 200,
    },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    dot: {
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
      fontSize: 22,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: -0.5,
    },
    subtitle: {
      ...mfTypography.body,
      color: theme.textSecondary,
      marginTop: 4,
    },
    actions: {
      flexShrink: 0,
      paddingTop: 4,
    },
    divider: {
      height: 1,
      backgroundColor: tokens.divider,
    },
    periodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: mfSpacing.md,
    },
    syncPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
    },
    syncDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    syncText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
  });
}
