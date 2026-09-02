import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { mfRadius, mfSpacing, mfTypography } from '../../lib/theme';
import { useMfTheme } from './useMfTheme';
import type { MfSegmentedProps, MfSegmentOption } from './types';

function segmentActiveStyle(
  styles: ReturnType<typeof createStyles>,
  tone: MfSegmentOption<string>['tone'],
  active: boolean,
) {
  if (!active) return undefined;
  switch (tone) {
    case 'income':
      return styles.segmentActiveIncome;
    case 'expense':
      return styles.segmentActiveExpense;
    case 'pending':
      return styles.segmentActivePending;
    default:
      return styles.segmentActive;
  }
}

function segmentTextActiveStyle(
  styles: ReturnType<typeof createStyles>,
  theme: ReturnType<typeof useMfTheme>['theme'],
  tone: MfSegmentOption<string>['tone'],
  active: boolean,
) {
  if (!active) return undefined;
  switch (tone) {
    case 'income':
      return { color: theme.success };
    case 'expense':
      return { color: theme.error };
    case 'pending':
      return { color: theme.warning };
    default:
      return styles.segmentTextActive;
  }
}

export function MfSegmented<T extends string>({
  options,
  value,
  onChange,
  style,
  testID,
}: MfSegmentedProps<T>) {
  const { theme, isDarkMode } = useMfTheme();
  const styles = useMemo(() => createStyles(theme, isDarkMode), [theme, isDarkMode]);

  return (
    <View style={[styles.track, style]} testID={testID} accessibilityRole="tablist">
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[styles.segment, segmentActiveStyle(styles, opt.tone, active)]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.segmentText,
                active && segmentTextActiveStyle(styles, theme, opt.tone, active),
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useMfTheme>['theme'], isDarkMode: boolean) {
  return StyleSheet.create({
    track: {
      flexDirection: 'row',
      padding: 3,
      borderRadius: mfRadius.pill,
      backgroundColor: isDarkMode ? theme.backgroundMuted : theme.backgroundMuted,
      borderWidth: 1,
      borderColor: theme.border,
    },
    segment: {
      flex: 1,
      paddingVertical: mfSpacing.sm,
      paddingHorizontal: mfSpacing.md,
      borderRadius: mfRadius.pill,
      alignItems: 'center',
    },
    segmentActive: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    segmentActiveIncome: {
      backgroundColor: theme.successLight,
      borderWidth: 1,
      borderColor: theme.success + '55',
    },
    segmentActiveExpense: {
      backgroundColor: theme.errorLight,
      borderWidth: 1,
      borderColor: theme.error + '55',
    },
    segmentActivePending: {
      backgroundColor: theme.warning + '22',
      borderWidth: 1,
      borderColor: theme.warning + '55',
    },
    segmentText: {
      ...mfTypography.bodyStrong,
      fontSize: 13,
      color: theme.textSecondary,
    },
    segmentTextActive: {
      color: theme.text,
      fontWeight: '700',
    },
  });
}
