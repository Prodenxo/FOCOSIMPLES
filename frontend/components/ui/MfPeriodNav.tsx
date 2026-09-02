import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mfRadius, mfSpacing, mfTypography } from '../../lib/theme';
import { getTechTokens } from '../../lib/techDesign';
import { useMfTheme } from './useMfTheme';
import type { MfPeriodNavProps } from './types';

const monoFont = Platform.select({
  web: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  ios: 'Menlo',
  android: 'monospace',
  default: undefined,
}) as string | undefined;

export function MfPeriodNav({
  label,
  onPrevious,
  onNext,
  disablePrevious = false,
  disableNext = false,
  variant = 'default',
  size = 'default',
  style,
  testID,
}: MfPeriodNavProps) {
  const { theme, isDarkMode } = useMfTheme();
  const isTech = variant === 'tech';
  const isLarge = size === 'large';
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(
    () => createStyles(theme, isDarkMode, isTech, isLarge),
    [theme, isDarkMode, isTech, isLarge],
  );
  const iconColor = isTech ? tokens.accent : theme.text;
  const iconSize = isLarge ? 22 : 18;
  const btnSize = isLarge ? 48 : 38;

  return (
    <View style={[styles.row, style]} testID={testID} accessibilityRole="toolbar">
      <Pressable
        onPress={onPrevious}
        disabled={disablePrevious || !onPrevious}
        style={({ pressed }) => [
          styles.btn,
          { width: btnSize, height: btnSize },
          pressed && styles.btnPressed,
          disablePrevious && styles.btnDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Mês anterior"
      >
        <Ionicons name="chevron-back" size={iconSize} color={iconColor} />
      </Pressable>
      <View style={styles.labelWrap}>
        <Text style={styles.label} accessibilityRole="header">
          {label}
        </Text>
      </View>
      <Pressable
        onPress={onNext}
        disabled={disableNext || !onNext}
        style={({ pressed }) => [
          styles.btn,
          { width: btnSize, height: btnSize },
          pressed && styles.btnPressed,
          disableNext && styles.btnDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Próximo mês"
      >
        <Ionicons name="chevron-forward" size={iconSize} color={iconColor} />
      </Pressable>
    </View>
  );
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  isDarkMode: boolean,
  isTech: boolean,
  isLarge: boolean,
) {
  const t = getTechTokens(isDarkMode);

  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: isLarge ? mfSpacing.md : mfSpacing.sm,
    },
    btn: {
      borderRadius: isLarge ? mfRadius.md : isTech ? mfRadius.sm : mfRadius.md,
      borderWidth: 1,
      borderColor: isTech ? t.insetBorder : theme.border,
      backgroundColor: isTech ? t.insetFill : theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPressed: {
      opacity: 0.85,
    },
    btnDisabled: {
      opacity: 0.35,
    },
    labelWrap: isTech
      ? {
          paddingVertical: isLarge ? 14 : 8,
          paddingHorizontal: isLarge ? 24 : 20,
          borderRadius: isLarge ? mfRadius.md : mfRadius.sm,
          borderWidth: 1,
          borderColor: t.panelBorder,
          backgroundColor: t.insetFill,
          minWidth: isLarge ? 200 : 160,
          flex: isLarge ? 1 : undefined,
        }
      : {
          paddingVertical: isLarge ? 12 : 0,
          paddingHorizontal: isLarge ? 16 : 0,
          borderRadius: isLarge ? mfRadius.md : 0,
          borderWidth: isLarge ? 1 : 0,
          borderColor: theme.border,
          backgroundColor: isLarge ? theme.surface : 'transparent',
          minWidth: isLarge ? 200 : 140,
          flex: isLarge ? 1 : undefined,
        },
    label: {
      ...(isTech
        ? {
            fontSize: isLarge ? 18 : 15,
            fontWeight: '700',
            letterSpacing: -0.3,
            fontFamily: isLarge ? undefined : monoFont,
          }
        : {
            ...mfTypography.subtitle,
            fontSize: isLarge ? 18 : mfTypography.subtitle.fontSize,
            fontWeight: isLarge ? '700' : mfTypography.subtitle.fontWeight,
          }),
      color: theme.text,
      textAlign: 'center',
    },
  });
}
