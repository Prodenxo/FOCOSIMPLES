import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { mfCardElevation, mfRadius, mfSpacing } from '../../lib/theme';
import { useMfTheme } from './useMfTheme';
import type { MfBaseProps } from './types';

type Props = MfBaseProps & {
  children: React.ReactNode;
  padding?: 'none' | 'md' | 'lg';
  /** transparent = conteúdo direto no canvas (cards glass filhos). */
  variant?: 'default' | 'transparent';
};

const paddingMap = {
  none: 0,
  md: mfSpacing.lg,
  lg: mfSpacing.xl,
} as const;

/**
 * Card principal da página sobre o canvas do shell (referência Assessor).
 * Light: branco; dark: surface elevada.
 */
export function MfContentPanel({ children, padding = 'lg', variant = 'default', style, testID }: Props) {
  const { theme, isDarkMode } = useMfTheme();
  const styles = useMemo(
    () => createStyles(theme, isDarkMode, padding, variant),
    [theme, isDarkMode, padding, variant]
  );

  return (
    <View style={[styles.panel, style]} testID={testID}>
      {children}
    </View>
  );
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  isDarkMode: boolean,
  padding: Props['padding'],
  variant: Props['variant'],
) {
  const pad = paddingMap[padding ?? 'lg'];
  const transparent = variant === 'transparent';
  return StyleSheet.create({
    panel: {
      backgroundColor: transparent ? 'transparent' : theme.card,
      borderRadius: transparent ? 0 : mfRadius.xl,
      borderWidth: transparent ? 0 : 1,
      borderColor: transparent ? 'transparent' : theme.border,
      padding: pad,
      overflow: transparent ? 'visible' : 'hidden',
      ...(transparent ? {} : mfCardElevation(theme, isDarkMode)),
    },
  });
}
