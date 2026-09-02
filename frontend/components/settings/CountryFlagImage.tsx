import React, { useState } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { getCountryFlagImageUrl } from '../../lib/countryFlagImage'
import { mfRadius } from '../../lib/theme'
import { useMfTheme } from '../ui/useMfTheme'

type CountryFlagImageProps = {
  iso: string
  /** Altura da bandeira em px (largura segue proporção ~4:3). */
  height?: number
  label?: string
}

export function CountryFlagImage ({
  iso,
  height = 20,
  label,
}: CountryFlagImageProps) {
  const { isDarkMode } = useMfTheme()
  const [failed, setFailed] = useState(false)
  const code = iso.trim().toLowerCase()
  const width = Math.round(height * 1.34)

  if (!code || failed) {
    return (
      <View
        style={[
          styles.fallback,
          {
            width,
            height,
            backgroundColor: isDarkMode ? 'rgba(148, 163, 184, 0.18)' : 'rgba(100, 116, 139, 0.12)',
            borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.35)' : 'rgba(100, 116, 139, 0.25)',
          },
        ]}
        accessibilityLabel={label ?? code.toUpperCase()}
      >
        <Text
          style={[
            styles.fallbackText,
            { fontSize: Math.max(8, height * 0.42), color: isDarkMode ? '#e2e8f0' : '#334155' },
          ]}
        >
          {code.toUpperCase()}
        </Text>
      </View>
    )
  }

  return (
    <Image
      source={{ uri: getCountryFlagImageUrl(code, height) }}
      style={[styles.flag, { width, height }]}
      resizeMode="cover"
      accessibilityLabel={label ?? code.toUpperCase()}
      onError={() => setFailed(true)}
    />
  )
}

const styles = StyleSheet.create({
  flag: {
    borderRadius: mfRadius.sm,
    overflow: 'hidden',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: mfRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fallbackText: {
    fontWeight: '700',
    letterSpacing: 0.4,
  },
})
