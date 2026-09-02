import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { mfSpacing } from '../../lib/theme';
import {
  getGlassBlurIntensity,
  getGlassFill,
  mfGlassChrome,
  type GlassIntensity,
} from '../../lib/glassStyles';
import type { TechPanelVariant } from '../../lib/techDesign';
import { useMfTheme } from './useMfTheme';
import type { MfBaseProps } from './types';

type Props = MfBaseProps & {
  children: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  intensity?: GlassIntensity;
  /** Painel tech (legado: equivale a `surface`) */
  tech?: boolean;
  /** Variante de profundidade tech — só `accent` usa faixa superior ciano */
  techVariant?: TechPanelVariant;
};

const paddingMap = {
  none: 0,
  sm: mfSpacing.sm,
  md: mfSpacing.md,
  lg: mfSpacing.lg,
} as const;

/**
 * Card com efeito glass (blur + véu semitransparente). Web usa backdrop-filter quando suportado.
 */
export function MfGlassCard({
  children,
  padding = 'md',
  intensity = 'medium',
  tech = false,
  techVariant,
  style,
  testID,
}: Props) {
  const { theme, isDarkMode } = useMfTheme();
  const pad = paddingMap[padding];
  const techChrome = techVariant ?? (tech ? 'surface' : false);
  const chrome = useMemo(
    () => mfGlassChrome(theme, isDarkMode, intensity, techChrome),
    [theme, isDarkMode, intensity, techChrome],
  );
  const fill = getGlassFill(theme, isDarkMode, intensity);
  const blurIntensity = getGlassBlurIntensity(isDarkMode);

  if (Platform.OS === 'web') {
    return (
      <View style={[chrome, { padding: pad }, style]} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <View style={[chrome, style]} testID={testID}>
      <BlurView
        intensity={blurIntensity}
        tint={isDarkMode ? 'dark' : 'light'}
        {...(Platform.OS === 'android'
          ? { blurMethod: 'dimezisBlurViewSdk31Plus' as const }
          : {})}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.veil, { backgroundColor: fill }]} pointerEvents="none" />
      <View style={{ padding: pad }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  veil: {
    ...StyleSheet.absoluteFillObject,
  },
});
