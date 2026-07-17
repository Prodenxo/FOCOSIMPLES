import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  type LayoutChangeEvent,
} from 'react-native';
import { MfDateField, useMfTheme } from '../../components/ui';
import type { Theme } from '../../lib/theme';
import { mfRadius, mfSpacing } from '../../lib/theme';
import { getTechTokens, mfTechInsetSurface } from '../../lib/techDesign';
import { useLayoutProfile } from '../../lib/useLayoutProfile';
import type { TransactionDateRange, TransactionPeriodPreset } from '../../lib/transactionPeriodFilter';

type Props = {
  theme: Theme;
  period: TransactionPeriodPreset;
  dateRange: TransactionDateRange;
  useCustomRange: boolean;
  exporting?: boolean;
  onPeriodChange: (p: TransactionPeriodPreset) => void;
  onDateRangeChange: (range: TransactionDateRange) => void;
  onClearRange: () => void;
  compact?: boolean;
  /** Dentro de command well — sem inset próprio */
  embedded?: boolean;
  /** Oculta campos de intervalo (mobile — só presets até expandir filtros). */
  showDateRange?: boolean;
};

const PRESETS: TransactionPeriodPreset[] = ['Essa semana', 'Esse mês', 'Hoje'];

export function TransactionsPeriodToolbar({
  theme,
  period,
  dateRange,
  useCustomRange,
  onPeriodChange,
  onDateRangeChange,
  onClearRange,
  compact = false,
  embedded = false,
  showDateRange = true,
}: Props) {
  const { isDarkMode } = useMfTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const layout = useLayoutProfile(containerWidth);
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(
    () => createStyles(theme, tokens, compact, embedded, layout),
    [theme, tokens, compact, embedded, layout],
  );
  const inset = useMemo(() => (embedded ? {} : mfTechInsetSurface(isDarkMode, false)), [isDarkMode, embedded]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setContainerWidth((prev) => (prev === next ? prev : next));
  }, []);

  const setStart = (value: string) => onDateRangeChange({ ...dateRange, start: value });
  const setEnd = (value: string) => onDateRangeChange({ ...dateRange, end: value });

  const dateFieldsStacked = !layout.isInline;
  const dateFieldFullWidth = dateFieldsStacked || layout.isNative;

  return (
    <View style={[styles.wrap, inset]} onLayout={onLayout}>
      {layout.isNative ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.presetsScroll}
          contentContainerStyle={styles.presetsRow}
          keyboardShouldPersistTaps="handled"
        >
          {PRESETS.map((p) => {
            const active = period === p && !useCustomRange;
            return (
              <TouchableOpacity
                key={p}
                onPress={() => onPeriodChange(p)}
                style={[styles.presetChip, active && styles.presetChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.presetText, active && styles.presetTextActive]}>{p}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.presetsRow}>
          {PRESETS.map((p) => {
            const active = period === p && !useCustomRange;
            return (
              <TouchableOpacity
                key={p}
                onPress={() => onPeriodChange(p)}
                style={[styles.presetChip, active && styles.presetChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.presetText, active && styles.presetTextActive]}>{p}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {showDateRange && dateFieldsStacked ? (
        <View style={styles.rangeColumn}>
          <MfDateField
            value={dateRange.start}
            onChange={setStart}
            accessibilityLabel="Data inicial"
            fullWidth={dateFieldFullWidth}
          />
          <MfDateField
            value={dateRange.end}
            onChange={setEnd}
            accessibilityLabel="Data final"
            fullWidth={dateFieldFullWidth}
          />
          <TouchableOpacity
            onPress={onClearRange}
            style={styles.clearBtnStacked}
            accessibilityRole="button"
            accessibilityLabel="Limpar intervalo de datas"
          >
            <Text style={styles.clearBtnText}>Limpar intervalo</Text>
          </TouchableOpacity>
        </View>
      ) : showDateRange ? (
        <View style={styles.rangeRow}>
          <MfDateField
            value={dateRange.start}
            onChange={setStart}
            accessibilityLabel="Data inicial"
          />
          <Text style={styles.rangeSep}>até</Text>
          <MfDateField
            value={dateRange.end}
            onChange={setEnd}
            accessibilityLabel="Data final"
          />
          <TouchableOpacity
            onPress={onClearRange}
            style={styles.clearBtn}
            accessibilityRole="button"
            accessibilityLabel="Limpar intervalo de datas"
          >
            <Text style={styles.clearBtnText}>Limpar</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(
  theme: Theme,
  tokens: ReturnType<typeof getTechTokens>,
  compact: boolean,
  embedded: boolean,
  layout: ReturnType<typeof useLayoutProfile>,
) {
  const isNative = layout.isNative;

  return StyleSheet.create({
    wrap: {
      gap: mfSpacing.sm,
      padding: embedded ? 0 : compact ? mfSpacing.sm : mfSpacing.md,
      marginBottom: embedded ? 0 : mfSpacing.sm,
    },
    presetsScroll: {
      flexGrow: 0,
      ...(Platform.OS === 'web' ? { overflow: 'visible' as const } : {}),
    },
    presetsRow: {
      flexDirection: 'row',
      flexWrap: isNative ? 'nowrap' : 'wrap',
      gap: mfSpacing.xs,
      ...(isNative ? { paddingRight: mfSpacing.xs } : {}),
    },
    presetChip: {
      paddingHorizontal: isNative ? 16 : 14,
      paddingVertical: isNative ? 10 : 8,
      borderRadius: 999,
      backgroundColor: tokens.insetFill,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      minHeight: isNative ? 40 : undefined,
      justifyContent: 'center',
    },
    presetChipActive: {
      backgroundColor: tokens.accentSoft,
      borderColor: tokens.accent,
    },
    presetText: {
      fontSize: isNative ? 14 : 13,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    presetTextActive: {
      color: tokens.accent,
    },
    rangeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: mfSpacing.sm,
    },
    rangeColumn: {
      gap: mfSpacing.sm,
      width: '100%',
    },
    rangeSep: {
      fontSize: 13,
      lineHeight: isNative ? 44 : 36,
      color: theme.textSecondary,
      paddingHorizontal: 2,
    },
    clearBtn: {
      paddingHorizontal: 12,
      paddingVertical: isNative ? 10 : 8,
      borderRadius: mfRadius.sm,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: tokens.insetFill,
      alignSelf: 'center',
      minHeight: isNative ? 40 : undefined,
      justifyContent: 'center',
    },
    clearBtnStacked: {
      paddingHorizontal: 14,
      paddingVertical: isNative ? 12 : 10,
      borderRadius: mfRadius.sm,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: tokens.insetFill,
      alignSelf: isNative ? 'stretch' : 'flex-start',
      minHeight: isNative ? 44 : undefined,
      justifyContent: 'center',
      alignItems: 'center',
    },
    clearBtnText: {
      fontSize: isNative ? 14 : 13,
      fontWeight: '600',
      color: theme.textSecondary,
    },
  });
}
