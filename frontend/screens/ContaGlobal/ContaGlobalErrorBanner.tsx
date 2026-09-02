import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMfTheme } from '../../components/ui/useMfTheme'
import { mfSpacing } from '../../lib/theme'
import { mfTechInsetSurface } from '../../lib/techDesign'

type Props = {
  message: string
}

export function ContaGlobalErrorBanner({ message }: Props) {
  const { theme, isDarkMode } = useMfTheme()
  const inset = useMemo(() => mfTechInsetSurface(isDarkMode, false), [isDarkMode])
  const styles = useMemo(() => createStyles(theme), [theme])

  return (
    <View style={[styles.wrap, inset]} accessibilityRole="alert">
      <View style={styles.iconWrap}>
        <Ionicons name="alert-circle-outline" size={18} color={theme.error} />
      </View>
      <Text style={styles.text}>{message}</Text>
    </View>
  )
}

function createStyles(theme: ReturnType<typeof useMfTheme>['theme']) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: mfSpacing.sm,
      padding: mfSpacing.md,
      borderRadius: 12,
      borderColor: `${theme.error}44`,
    },
    iconWrap: { marginTop: 1 },
    text: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: theme.error,
    },
  })
}
