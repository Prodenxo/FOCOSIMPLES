import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MfPeriodNav, MfSegmented } from '../../components/ui';
import { useMfTheme } from '../../components/ui/useMfTheme';
import { mfRadius, mfSpacing, mfTypography, type Theme } from '../../lib/theme';
import { getTechTokens, mfTechInsetSurface } from '../../lib/techDesign';

type ViewMode = 'month' | 'week' | 'day';

type Props = {
  theme: Theme;
  periodLabel: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onNewEvent: () => void;
  googleIntegrated: boolean;
  eventCount: number;
  bare?: boolean;
  /** Oculta título/eyebrow — quando MfAppHeader já está visível no mobile */
  compact?: boolean;
};

export function AgendaPageChrome({
  theme,
  periodLabel,
  viewMode,
  onViewModeChange,
  onPrevious,
  onNext,
  onToday,
  onNewEvent,
  googleIntegrated,
  eventCount,
  bare = false,
  compact = false,
}: Props) {
  const { isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const todayInset = useMemo(() => mfTechInsetSurface(isDarkMode, false), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme, tokens, bare), [theme, tokens, bare]);

  const subtitle = googleIntegrated
    ? `${eventCount} ${eventCount === 1 ? 'compromisso' : 'compromissos'} · Google conectado`
    : `${eventCount} ${eventCount === 1 ? 'lançamento' : 'lançamentos'} · Google não conectado`;

  return (
    <View style={styles.wrap}>
      {!compact ? (
        <View style={styles.commandRow}>
          <View style={styles.titleCol}>
            <View style={styles.eyebrowRow}>
              <View style={[styles.dot, { backgroundColor: tokens.accent }]} />
              <Text style={[styles.eyebrow, { color: tokens.accent }]}>Cronograma</Text>
            </View>
            <Text style={styles.title}>Agenda</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={onToday}
              style={({ pressed }) => [
                styles.todayBtn,
                todayInset,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Ir para hoje"
            >
              <Ionicons name="today-outline" size={16} color={tokens.accent} />
              <Text style={[styles.todayBtnText, { color: tokens.accent }]}>Hoje</Text>
            </Pressable>
            <Pressable
              onPress={onNewEvent}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.9 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Novo compromisso"
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Novo</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.compactRow}>
          <Pressable
            onPress={onNewEvent}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Novo compromisso"
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Novo</Text>
          </Pressable>
          <Pressable
            onPress={onToday}
            style={({ pressed }) => [
              styles.todayBtn,
              todayInset,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Ir para hoje"
          >
            <Ionicons name="today-outline" size={16} color={tokens.accent} />
            <Text style={[styles.todayBtnText, { color: tokens.accent }]}>Hoje</Text>
          </Pressable>
        </View>
      )}

      <MfPeriodNav
        label={periodLabel}
        onPrevious={onPrevious}
        onNext={onNext}
        style={styles.periodNav}
      />

      <MfSegmented
        options={[
          { key: 'month', label: 'Mês' },
          { key: 'week', label: 'Semana' },
          { key: 'day', label: 'Dia' },
        ]}
        value={viewMode}
        onChange={onViewModeChange}
        style={styles.segmented}
      />
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
      gap: mfSpacing.md,
      flexShrink: 0,
    },
    commandRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: mfSpacing.md,
    },
    compactRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: mfSpacing.sm,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      flexShrink: 0,
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
    todayBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: mfSpacing.md,
      paddingVertical: mfSpacing.sm,
      borderRadius: mfRadius.sm,
      flexShrink: 0,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    todayBtnText: {
      fontSize: 13,
      fontWeight: '700',
    },
    periodNav: {
      marginBottom: 0,
    },
    segmented: {
      alignSelf: 'stretch',
    },
  });
}
