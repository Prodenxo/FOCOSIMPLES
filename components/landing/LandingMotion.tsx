import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';
import { brandColors } from '@/lib/brandTokens';
const NAV_BTN_HEIGHT = 40;

type RevealProps = {
  children: React.ReactNode;
  delay?: number;
  offset?: number;
  style?: ViewStyle;
};

export function Reveal({ children, delay = 0, offset = 22, style }: RevealProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(offset)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 650,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        speed: 14,
        bounciness: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY, offset]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

/** Entrada suave — sem bounce (auth, painéis). */
export function RevealSoft({
  children,
  delay = 0,
  offset = 14,
  offsetX = 0,
  style,
}: RevealProps & { offsetX?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(offset)).current;
  const translateX = useRef(new Animated.Value(offsetX)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 700,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 700,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 700,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, offset, offsetX, opacity, translateX, translateY]);

  return (
    <Animated.View
      style={[style, { opacity, transform: [{ translateY }, { translateX }] }]}
    >
      {children}
    </Animated.View>
  );
}

type HeroMockupProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

/** Entrada única do mockup — sem loop, sem bounce. */
export function HeroMockupShell({ children, style }: HeroMockupProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;
  const translateX = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 850,
        delay: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 850,
        delay: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 850,
        delay: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale, translateX]);

  return (
    <Animated.View
      style={[style, { opacity, transform: [{ translateX }, { scale }] }]}
    >
      {children}
    </Animated.View>
  );
}

export function PulseDot({ color = brandColors.secondary, size = 6, style }: {
  color?: string;
  size?: number;
  style?: ViewStyle;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.45, duration: 900, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.55, duration: 900, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, scale]);

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity,
          transform: [{ scale }],
        },
        style,
      ]}
    />
  );
}

type LandingButtonProps = {
  label: string;
  onPress: () => void;
  variant: 'ghost' | 'primary' | 'ghostLight' | 'primaryLight';
  compact?: boolean;
  entranceDelay?: number;
};

export function LandingButton({
  label,
  onPress,
  variant,
  compact = false,
  entranceDelay = 0,
}: LandingButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const isPrimary = variant === 'primary' || variant === 'primaryLight';

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 500,
      delay: entranceDelay,
      useNativeDriver: true,
    }).start();
  }, [entrance, entranceDelay]);

  useEffect(() => {
    if (!isPrimary) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1300, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1300, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isPrimary, pulse]);

  const animateScale = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      speed: 24,
      bounciness: isPrimary ? 5 : 3,
      useNativeDriver: true,
    }).start();
  };

  const entranceY = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.018],
  });

  const combinedScale = Animated.multiply(scale, isPrimary ? pulseScale : 1);

  const webHoverProps =
    Platform.OS === 'web'
      ? {
          onHoverIn: () => animateScale(1.04),
          onHoverOut: () => animateScale(1),
        }
      : {};

  const styles = getButtonStyles(variant, compact);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateScale(0.96)}
      onPressOut={() => animateScale(1)}
      accessibilityRole="button"
      {...webHoverProps}
    >
      <Animated.View
        style={[
          styles.base,
          variant === 'ghost' || variant === 'ghostLight' ? styles.ghost : styles.primary,
          {
            opacity: entrance,
            transform: [{ translateY: entranceY }, { scale: combinedScale }],
          },
        ]}
      >
        <Text style={styles.text} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function getButtonStyles(variant: LandingButtonProps['variant'], compact: boolean) {
  const isDark = variant === 'ghost' || variant === 'primary';
  const isPrimary = variant === 'primary' || variant === 'primaryLight';

  return StyleSheet.create({
    base: {
      height: NAV_BTN_HEIGHT,
      minWidth: compact ? 76 : 96,
      paddingHorizontal: compact ? 14 : 18,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    ghost: {
      borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(13,43,94,0.18)',
      backgroundColor: 'transparent',
    },
    primary: {
      borderColor: isPrimary && isDark ? 'rgba(0,168,107,0.45)' : brandColors.secondary,
      backgroundColor: brandColors.secondary,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 6px 20px rgba(0, 168, 107, 0.28)',
          } as object)
        : {
            shadowColor: brandColors.secondary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.28,
            shadowRadius: 10,
            elevation: 4,
          }),
    },
    text: {
      fontSize: compact ? 13 : 14,
      fontWeight: '800',
      color: isPrimary || isDark ? brandColors.background : brandColors.primary,
      letterSpacing: -0.1,
    },
  });
}
