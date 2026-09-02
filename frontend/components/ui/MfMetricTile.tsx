import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform, type ViewStyle } from 'react-native';
import {
  getFinanceSemanticColor,
  getFinanceSemanticTint,
  mfRadius,
  mfSpacing,
  mfTypography,
} from '../../lib/theme';
import { useMfTheme } from './useMfTheme';
import type { MfMetricTileProps } from './types';

export function MfMetricTile({
  label,
  value,
  semantic = 'open',
  icon,
  hint,
  shrinkValue = false,
  variant = 'default',
  featured = false,
  style,
  testID,
}: MfMetricTileProps) {
  const { theme } = useMfTheme();
  const accent = getFinanceSemanticColor(theme, semantic);
  const tint = getFinanceSemanticTint(theme, semantic);
  const isTech = variant === 'tech';
  const styles = useMemo(
    () => createStyles(theme, accent, tint, shrinkValue, isTech, featured),
    [theme, accent, tint, shrinkValue, isTech, featured],
  );

  return (
    <View
      style={[styles.tile, style]}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ''}`}
    >
      <View style={styles.header}>
        {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
        <Text style={styles.label} numberOfLines={1}>
          {label.toUpperCase()}
        </Text>
      </View>
      <View style={styles.valueWrap}>
        <Text
          style={[styles.value, { color: accent }]}
          numberOfLines={1}
          adjustsFontSizeToFit={shrinkValue}
          minimumFontScale={shrinkValue ? 0.42 : 1}
        >
          {value}
        </Text>
      </View>
      {hint ? (
        <Text style={styles.hint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  accent: string,
  tint: string,
  shrinkValue: boolean,
  isTech: boolean,
  featured: boolean,
) {
  const monoFont = Platform.select({
    web: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    ios: 'Menlo',
    android: 'monospace',
    default: undefined,
  }) as ViewStyle['fontFamily'];

  return StyleSheet.create({
    tile: {
      minWidth: 0,
      padding: isTech ? (featured ? 20 : 16) : mfSpacing.md,
      backgroundColor: isTech ? 'transparent' : theme.card,
      borderRadius: isTech ? mfRadius.sm : mfRadius.md,
      borderWidth: isTech ? 0 : 1,
      borderColor: theme.border,
      gap: mfSpacing.xs,
      justifyContent: 'flex-start',
      ...(shrinkValue
        ? { flexGrow: 1, flexShrink: 1, flexBasis: 0 }
        : {}),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
    },
    iconSlot: {
      width: isTech ? 24 : 28,
      height: isTech ? 24 : 28,
      borderRadius: mfRadius.sm,
      backgroundColor: tint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      flex: 1,
      ...mfTypography.caption,
      fontSize: isTech ? 10 : 11,
      color: theme.textSecondary,
      letterSpacing: isTech ? 1.2 : 0.4,
    },
    valueWrap: {
      minWidth: 0,
      alignSelf: 'stretch',
      ...(shrinkValue ? { minHeight: featured ? 32 : 26, justifyContent: 'center' } : {}),
    },
    value: {
      ...mfTypography.subtitle,
      fontSize: featured ? 26 : shrinkValue ? 18 : isTech ? 22 : 20,
      fontWeight: '700',
      lineHeight: featured ? 32 : shrinkValue ? 24 : isTech ? 28 : 26,
      letterSpacing: isTech ? -0.8 : -0.3,
      ...(isTech && monoFont ? { fontFamily: monoFont } : {}),
      fontVariant: ['tabular-nums'] as const,
    },
    hint: {
      ...mfTypography.caption,
      fontSize: isTech ? 11 : 11,
      color: theme.textTertiary,
    },
  });
}
