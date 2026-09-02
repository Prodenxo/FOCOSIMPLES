import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { mfCardElevation, mfRadius, mfSpacing } from '../../lib/theme';
import { useMfTheme } from './useMfTheme';
import type { MfCardProps } from './types';

const paddingMap = {
  none: 0,
  sm: mfSpacing.sm,
  md: mfSpacing.md,
  lg: mfSpacing.lg,
} as const;

export function MfCard({
  children,
  variant = 'default',
  padding = 'md',
  style,
  testID,
}: MfCardProps) {
  const { theme, isDarkMode } = useMfTheme();
  const styles = useMemo(
    () => createStyles(theme, isDarkMode, variant, padding),
    [theme, isDarkMode, variant, padding]
  );

  return (
    <View style={[styles.card, style]} testID={testID} accessibilityRole="none">
      {children}
    </View>
  );
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  isDarkMode: boolean,
  variant: MfCardProps['variant'],
  padding: MfCardProps['padding']
) {
  const pad = paddingMap[padding ?? 'md'];
  const elevated = variant === 'elevated' ? mfCardElevation(theme, isDarkMode) : {};
  const outlineOnly = variant === 'outline';

  return StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: mfRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: pad,
      ...(outlineOnly ? {} : elevated),
      ...(variant === 'default' && !isDarkMode && !outlineOnly
        ? { borderColor: theme.border }
        : {}),
    },
  });
}
