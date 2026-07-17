import React, { useEffect, useRef } from 'react';
import { Animated, TouchableWithoutFeedback, StyleSheet } from 'react-native';

interface Props {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  activeColor?: string;
}

export function ToggleSwitch({ value, onValueChange, disabled = false, activeColor = '#3b82f6' }: Props) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const trackBg = anim.interpolate({ inputRange: [0, 1], outputRange: ['#2a2d3a', activeColor] });
  const thumbLeft = anim.interpolate({ inputRange: [0, 1], outputRange: [3, 23] });
  const thumbBg = anim.interpolate({ inputRange: [0, 1], outputRange: ['#64748b', '#ffffff'] });

  return (
    <TouchableWithoutFeedback
      onPress={() => !disabled && onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
    >
      <Animated.View style={[styles.track, { backgroundColor: trackBg }, disabled && styles.disabled]}>
        <Animated.View style={[styles.thumb, { left: thumbLeft, backgroundColor: thumbBg }]} />
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 24,
    borderRadius: 100,
  },
  thumb: {
    position: 'absolute',
    top: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 2,
  },
  disabled: {
    opacity: 0.5,
  },
});
