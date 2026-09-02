import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Theme } from '../../lib/theme';

type KpiIntent = 'positive' | 'negative' | 'neutral' | 'warning';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  hint?: string | null;
  intent?: KpiIntent;
  theme: Theme;
}

const getIntentColor = (theme: Theme, intent: KpiIntent): string => {
  switch (intent) {
    case 'positive':
      return theme.success;
    case 'negative':
      return theme.error;
    case 'warning':
      return theme.warning;
    case 'neutral':
    default:
      return theme.primary;
  }
};

export function KpiCard({ icon, label, value, hint, intent = 'neutral', theme }: Props) {
  const accent = getIntentColor(theme, intent);
  const styles = useMemo(() => createStyles(theme, accent), [theme, accent]);

  return (
    <View
      style={styles.card}
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ''}`}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconWrapper, { backgroundColor: `${accent}1A` }]}>
          <Ionicons name={icon} size={16} color={accent} />
        </View>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[styles.value, intent === 'negative' && { color: theme.error }]} numberOfLines={1}>
        {value}
      </Text>
      {hint ? (
        <Text style={styles.hint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const createStyles = (theme: Theme, accent: string) =>
  StyleSheet.create({
    card: {
      flex: 1,
      minWidth: 140,
      padding: 14,
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      borderLeftWidth: 4,
      borderLeftColor: accent,
      gap: 6,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconWrapper: {
      width: 26,
      height: 26,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      flex: 1,
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    value: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
    },
    hint: {
      fontSize: 11,
      color: theme.textTertiary,
    },
  });
