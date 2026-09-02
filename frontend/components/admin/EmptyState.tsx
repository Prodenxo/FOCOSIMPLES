import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Theme } from '../../lib/theme';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'neutral' | 'error' | 'info';
  theme: Theme;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'neutral',
  theme,
}: Props) {
  const styles = useMemo(() => createStyles(theme, variant), [theme, variant]);
  const defaultIcon: keyof typeof Ionicons.glyphMap =
    variant === 'error' ? 'alert-circle-outline' : 'information-circle-outline';
  const iconColor =
    variant === 'error' ? theme.error : variant === 'info' ? theme.primary : theme.textSecondary;

  return (
    <View style={styles.container}>
      <Ionicons name={icon || defaultIcon} size={28} color={iconColor} />
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.action} onPress={onAction} accessibilityRole="button">
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const createStyles = (theme: Theme, variant: 'neutral' | 'error' | 'info') =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
      paddingHorizontal: 16,
      gap: 6,
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: variant === 'error' ? theme.error : theme.text,
      textAlign: 'center',
    },
    description: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
      maxWidth: 320,
      lineHeight: 18,
    },
    action: {
      marginTop: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.primary,
    },
    actionText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });
