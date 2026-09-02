import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { mfTypography } from '../../lib/theme';
import { useMfTheme } from './useMfTheme';
import type { MfDonutChartProps } from './types';

const DEFAULT_SIZE = 120;
const DEFAULT_STROKE = 10;

export function MfDonutChart({
  size = DEFAULT_SIZE,
  segments,
  strokeWidth = DEFAULT_STROKE,
  centerLabel,
  centerSubLabel,
  style,
  testID,
}: MfDonutChartProps) {
  const { theme } = useMfTheme();
  const trackColor = theme.border;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const rotate = `rotate(-90 ${cx} ${cy})`;

  let offsetAcc = 0;

  return (
    <View style={[styles.wrap, style]} testID={testID} accessibilityRole="image">
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
          opacity={segments.length === 0 ? 0.35 : 0.2}
        />
        {segments.map((seg, index) => {
          const len = circumference * Math.min(1, Math.max(0, seg.ratio));
          if (len <= 0) return null;
          const gap = circumference - len;
          const offset = circumference - offsetAcc;
          offsetAcc += len;
          return (
            <Circle
              key={`mf-donut-${index}`}
              cx={cx}
              cy={cy}
              r={radius}
              stroke={seg.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${len} ${gap}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform={rotate}
            />
          );
        })}
      </Svg>
      {(centerLabel || centerSubLabel) && (
        <View style={styles.center} pointerEvents="none">
          {centerLabel ? (
            <Text style={styles.centerLabel} numberOfLines={1}>
              {centerLabel}
            </Text>
          ) : null}
          {centerSubLabel ? (
            <Text style={styles.centerSub} numberOfLines={1}>
              {centerSubLabel}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useMfTheme>['theme']) {
  return StyleSheet.create({
    wrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    center: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    centerLabel: {
      ...mfTypography.bodyStrong,
      color: theme.text,
      fontVariant: ['tabular-nums'],
    },
    centerSub: {
      ...mfTypography.caption,
      color: theme.textSecondary,
      marginTop: 2,
    },
  });
}
