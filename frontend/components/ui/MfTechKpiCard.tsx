import React, { useId, useMemo } from 'react';
import { View, Platform, StyleSheet, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import {
  getTechTokens,
  mfTechHeroWashOverlay,
  mfTechKpiCardInnerStyle,
  mfTechKpiCardStyle,
  type TechKpiElevation,
} from '../../lib/techDesign';
import { mfRadius } from '../../lib/theme';
import { useMfTheme } from './useMfTheme';

type Props = {
  children: React.ReactNode;
  level?: TechKpiElevation;
  style?: ViewStyle;
  innerStyle?: ViewStyle;
};

type NativeHeroWashProps = {
  isDarkMode: boolean;
  gradientId: string;
};

/** Gradiente horizontal da faixa de acento — paridade com o hero wash do web. */
function NativeHeroWash({ isDarkMode, gradientId }: NativeHeroWashProps) {
  const tokens = getTechTokens(isDarkMode);
  const stops = isDarkMode
    ? [
        { offset: '0%', opacity: 0.16 },
        { offset: '14%', opacity: 0.05 },
        { offset: '28%', opacity: 0 },
      ]
    : [
        { offset: '0%', opacity: 0.12 },
        { offset: '12%', opacity: 0.04 },
        { offset: '26%', opacity: 0 },
      ];

  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          {stops.map((stop) => (
            <Stop
              key={stop.offset}
              offset={stop.offset}
              stopColor={tokens.accent}
              stopOpacity={stop.opacity}
            />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
    </Svg>
  );
}

/**
 * Card KPI com elevação idêntica (saldo, entradas, saídas).
 * Featured: faixa de glow só à esquerda; métricas sem wash.
 */
export function MfTechKpiCard({ children, level = 'metric', style, innerStyle }: Props) {
  const { isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const featured = level === 'featured';
  const washGradientId = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  const shellStyle = useMemo(
    () => mfTechKpiCardStyle(isDarkMode, level),
    [isDarkMode, level],
  );

  const webDepth = useMemo((): ViewStyle => {
    if (Platform.OS !== 'web') return {};
    const shadow = tokens.kpiFeaturedShadow;
    const drop = isDarkMode
      ? 'drop-shadow(0 16px 32px rgba(0, 0, 0, 0.7)) drop-shadow(0 6px 14px rgba(0, 0, 0, 0.5))'
      : 'drop-shadow(0 16px 36px rgba(15, 23, 42, 0.26)) drop-shadow(0 6px 16px rgba(15, 23, 42, 0.16))';
    return {
      boxShadow: shadow,
      WebkitBoxShadow: shadow,
      filter: drop,
    } as ViewStyle;
  }, [isDarkMode, tokens.kpiFeaturedShadow]);

  const inner = useMemo(() => mfTechKpiCardInnerStyle(level), [level]);
  const washOverlay = useMemo(
    () => (featured && Platform.OS === 'web' ? mfTechHeroWashOverlay(isDarkMode) : null),
    [featured, isDarkMode],
  );

  return (
    <View style={[shellStyle, webDepth, style, featured && styles.featuredShell]}>
      {featured ? (
        Platform.OS === 'web' && washOverlay ? (
          <View style={styles.washClip}>
            <View style={washOverlay} />
          </View>
        ) : (
          <View style={styles.washClipNative} pointerEvents="none">
            <NativeHeroWash isDarkMode={isDarkMode} gradientId={`heroWash-${washGradientId}`} />
          </View>
        )
      ) : null}
      <View style={[inner, innerStyle, featured && styles.featuredInner]}>{children}</View>
    </View>
  );
}

const styles = {
  featuredShell: {
    position: 'relative' as const,
  },
  washClip: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderRadius: mfRadius.sm,
  },
  washClipNative: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '32%',
    maxWidth: 140,
    overflow: 'hidden',
    borderTopLeftRadius: mfRadius.sm,
    borderBottomLeftRadius: mfRadius.sm,
  },
  featuredInner: {
    zIndex: 1,
  },
};
