import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useMfTheme } from '../ui/useMfTheme'
import { getTechTokens } from '../../lib/techDesign'
import { initialsFromDisplayName } from './settingsProfileUtils'
import { mfRadius } from '../../lib/theme'

export type SettingsProfileHeaderProps = {
  displayName: string
  email?: string
}

export function SettingsProfileHeader ({ displayName, email }: SettingsProfileHeaderProps) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = getTechTokens(isDarkMode)
  const initials = initialsFromDisplayName(displayName, email)
  const title = displayName.trim() || 'Sua conta'
  const subtitle = email?.trim()

  return (
    <View style={styles.wrap}>
      <View style={[styles.avatar, { borderColor: tokens.accent, backgroundColor: `${tokens.accent}18` }]}>
        <Text style={[styles.avatarText, { color: tokens.accent }]}>{initials}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.email, { color: theme.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.22)',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: mfRadius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
  },
  copy: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
  },
  email: {
    fontSize: 12,
  },
})
