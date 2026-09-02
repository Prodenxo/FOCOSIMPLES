import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MfPeriodNav } from '../../components/ui';
import { mfSpacing, mfTypography } from '../../lib/theme';
import type { Theme } from '../../lib/theme';
import { getTechTokens } from '../../lib/techDesign';
import { useMfTheme } from '../../components/ui/useMfTheme';
import { TransactionsHeaderActions } from './TransactionsHeaderActions';

type Props = {
  theme: Theme;
  monthLabel: string;
  movementCount: number;
  monthsAhead: number;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onGoToCurrentMonth: () => void;
  onAddTransaction: () => void;
  onExport: () => void;
  exporting?: boolean;
  /** Sem painel próprio — conteúdo dentro do shell unificado */
  bare?: boolean;
};

export function TransactionsPageChrome({
  theme,
  monthLabel,
  movementCount,
  monthsAhead,
  onPrevMonth,
  onNextMonth,
  onGoToCurrentMonth,
  onAddTransaction,
  onExport,
  exporting = false,
  bare = false,
}: Props) {
  const { isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme, bare), [theme, bare]);

  const movementLabel =
    movementCount === 1 ? '1 movimentação no período' : `${movementCount} movimentações no período`;

  return (
    <View style={styles.wrap}>
      <View style={styles.commandRow}>
        <View style={styles.titleCol}>
          <View style={styles.eyebrowRow}>
            <View style={[styles.dot, { backgroundColor: tokens.accent }]} />
            <Text style={[styles.eyebrow, { color: tokens.accent }]}>Extrato</Text>
          </View>
          <Text style={styles.title}>Transações</Text>
          <Text style={styles.subtitle}>{movementLabel}</Text>
        </View>
        <TransactionsHeaderActions
          theme={theme}
          exporting={exporting}
          onExport={onExport}
          onAddTransaction={onAddTransaction}
          variant="full"
        />
      </View>

      <View style={styles.periodRow}>
        <MfPeriodNav
          label={monthLabel}
          onPrevious={onPrevMonth}
          onNext={onNextMonth}
          variant="tech"
        />
        {onPrevMonth && monthsAhead !== 0 ? (
          <TouchableOpacity
            onPress={onGoToCurrentMonth}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: tokens.insetBorder,
              backgroundColor: tokens.accentSoft,
              ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
            }}
            accessibilityRole="button"
            accessibilityLabel="Voltar para o mês atual"
          >
            <Ionicons name="return-up-back-outline" size={14} color={tokens.accent} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: tokens.accent }}>Mês atual</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(theme: Theme, bare: boolean) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      paddingHorizontal: bare ? 0 : mfSpacing.md,
      paddingTop: bare ? 0 : mfSpacing.md,
      paddingBottom: mfSpacing.sm,
      gap: mfSpacing.sm,
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
    periodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: mfSpacing.sm,
    },
  });
}
