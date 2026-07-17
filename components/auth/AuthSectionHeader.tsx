import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { AuthPalette } from './authTokens'
import { mfSpacing } from '../../lib/theme'

type AuthSectionHeaderProps = {
  title: string
  palette: AuthPalette
}

export function AuthSectionHeader ({ title, palette }: AuthSectionHeaderProps) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: palette.titleText }]}>{title}</Text>
      <View style={[styles.rule, { backgroundColor: palette.inputBorder }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: mfSpacing.sm,
    marginTop: mfSpacing.xs,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  rule: {
    height: 1,
    width: '100%',
    opacity: 0.65,
  },
})
