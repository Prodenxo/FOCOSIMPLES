import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { mfSpacing } from '../../lib/theme'

type AuthEyebrowProps = {
  label: string
  dotColor: string
  textColor: string
}

export function AuthEyebrow ({ label, dotColor, textColor }: AuthEyebrowProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: mfSpacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
})
