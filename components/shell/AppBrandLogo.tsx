import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { APP_BRAND_NAME } from '@/lib/appBrand';
import { brandColors } from '@/lib/brandTokens';

const WORDMARK_DARK_BG = require('../../assets/logo.png');
const WORDMARK_LIGHT_BG = require('../../assets/brand-wordmark-horizontal-light.jpg');
const LOGO_DARK_BG = require('../../assets/brand-logo-full-dark.jpg');
const LOGO_LIGHT_BG = require('../../assets/brand-logo-full-light.jpg');

/** Proporções reais dos assets oficiais (marcaa). */
const WORDMARK_ASPECT = {
  dark: 1584 / 396,
  light: 1600 / 640,
} as const;

const FULL_LOGO_ASPECT = 900 / 1600;

export type AppBrandLogoVariant = 'wordmark' | 'wordmarkCompact' | 'mark' | 'drawer';

type Props = {
  variant?: AppBrandLogoVariant;
  onDarkBackground?: boolean;
  /** Sobrescreve a altura padrão da variante (ex.: footer). */
  height?: number;
  /**
   * Wordmark nativa (texto + ícone) — sem retângulo do JPG.
   * Use em fundos com gradiente (login, app shell).
   */
  transparent?: boolean;
};

const WORDMARK_HEIGHT: Record<AppBrandLogoVariant, number> = {
  wordmark: 40,
  wordmarkCompact: 32,
  mark: 40,
  drawer: 36,
};

const FULL_LOGO_HEIGHT: Record<AppBrandLogoVariant, number> = {
  wordmark: 0,
  wordmarkCompact: 0,
  mark: 72,
  drawer: 64,
};

export function AppBrandLogo({
  variant = 'wordmark',
  onDarkBackground = false,
  height: heightOverride,
  transparent = false,
}: Props) {
  const isWordmark = variant === 'wordmark' || variant === 'wordmarkCompact';
  const styles = useMemo(
    () => createStyles(variant, onDarkBackground, heightOverride),
    [variant, onDarkBackground, heightOverride],
  );

  if (isWordmark && transparent) {
    return (
      <NativeWordmark
        variant={variant}
        onDarkBackground={onDarkBackground}
        height={heightOverride}
      />
    );
  }

  if (!isWordmark) {
    const fullLogo = onDarkBackground ? LOGO_LIGHT_BG : LOGO_DARK_BG;
    return (
      <Image
        source={fullLogo}
        style={styles.fullLogo}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel={APP_BRAND_NAME}
      />
    );
  }

  const source = onDarkBackground ? WORDMARK_DARK_BG : WORDMARK_LIGHT_BG;

  return (
    <Image
      source={source}
      style={styles.wordmark}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel={APP_BRAND_NAME}
    />
  );
}

/** Ícone alvo da marca — sem fundo (manual v1.0). */
function BrandMarkIcon({
  size,
  onDarkBackground,
}: {
  size: number;
  onDarkBackground: boolean;
}) {
  const ring = onDarkBackground ? brandColors.background : brandColors.primary;

  return (
    <View style={[markStyles.wrap, { width: size, height: size }]}>
      <View
        style={[
          markStyles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: ring,
          },
        ]}
      />
      <View
        style={[
          markStyles.ring,
          {
            width: size * 0.68,
            height: size * 0.68,
            borderRadius: (size * 0.68) / 2,
            borderColor: ring,
          },
        ]}
      />
      <View
        style={[
          markStyles.ring,
          {
            width: size * 0.38,
            height: size * 0.38,
            borderRadius: (size * 0.38) / 2,
            borderColor: ring,
          },
        ]}
      />
      <View
        style={{
          width: size * 0.16,
          height: size * 0.16,
          borderRadius: (size * 0.16) / 2,
          backgroundColor: brandColors.secondary,
        }}
      />
    </View>
  );
}

const markStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
});

function NativeWordmark({
  variant,
  onDarkBackground,
  height: heightOverride,
}: {
  variant: AppBrandLogoVariant;
  onDarkBackground: boolean;
  height?: number;
}) {
  const height = heightOverride ?? WORDMARK_HEIGHT[variant];
  const fontSize = variant === 'wordmarkCompact' ? 18 : 22;
  const iconSize = Math.round(height * 0.62);
  const color = onDarkBackground ? brandColors.background : brandColors.primary;

  return (
    <View
      style={[nativeStyles.row, { height }]}
      accessibilityRole="image"
      accessibilityLabel={APP_BRAND_NAME}
    >
      <Text style={[nativeStyles.word, { fontSize, color }]}>Foco</Text>
      <BrandMarkIcon size={iconSize} onDarkBackground={onDarkBackground} />
      <Text style={[nativeStyles.word, { fontSize, color }]}>MEI</Text>
    </View>
  );
}

const nativeStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  word: {
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: undefined,
  },
});

function createStyles(
  variant: AppBrandLogoVariant,
  onDarkBackground: boolean,
  heightOverride?: number,
) {
  const height = heightOverride ?? WORDMARK_HEIGHT[variant];
  const aspect = onDarkBackground ? WORDMARK_ASPECT.dark : WORDMARK_ASPECT.light;

  return StyleSheet.create({
    wordmark: {
      height,
      width: Math.round(height * aspect),
      maxWidth: '100%',
    },
    fullLogo: {
      height: FULL_LOGO_HEIGHT[variant],
      width: Math.round(FULL_LOGO_HEIGHT[variant] * FULL_LOGO_ASPECT),
      maxWidth: '100%',
    },
  });
}
