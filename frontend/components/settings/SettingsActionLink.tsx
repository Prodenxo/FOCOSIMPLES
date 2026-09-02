import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getSiteTokens } from '../../lib/siteDesign'
import { mfRadius, mfSpacing } from '../../lib/theme'
import { useMfTheme } from '../ui/useMfTheme'

type IconName = React.ComponentProps<typeof Ionicons>['name']

export type SettingsActionLinkProps = {
  title: string
  description?: string
  icon: IconName
  iconColor?: string
  onPress: () => void
  accessibilityLabel?: string
}

export function SettingsActionLink ({
  title,
  description,
  icon,
  iconColor,
  onPress,
  accessibilityLabel,
}: SettingsActionLinkProps) {
  const { isDarkMode } = useMfTheme()
  const tokens = getSiteTokens(isDarkMode)
  const tint = iconColor ?? tokens.neon

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && {
          backgroundColor: tokens.neonDim,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      <Ionicons name={icon} size={18} color={tint} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: tokens.textPrimary }]}>{title}</Text>
        {description ? (
          <Text style={[styles.description, { color: tokens.textSecondary }]}>{description}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={tokens.textMuted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: mfSpacing.md,
    paddingVertical: 12,
    paddingHorizontal: mfSpacing.sm,
    marginHorizontal: -mfSpacing.sm,
    borderRadius: mfRadius.lg,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
  },
})
