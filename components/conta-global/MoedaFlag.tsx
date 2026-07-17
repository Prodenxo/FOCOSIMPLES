import React, { createElement, useEffect, useMemo, useState } from 'react'
import { View, Image, Text, StyleSheet, Platform } from 'react-native'
import { getMoedaCountryIso } from '../../lib/moedaCountryIso'
import {
  getMoedaCircleFlagSvgUrl,
  getMoedaFlagNativeUrls,
  getMoedaFlagPngUrl,
} from '../../lib/moedaFlagSources'
import { useMfTheme } from '../ui/useMfTheme'

type Props = {
  moeda: string
  size?: number
  label?: string
}

type WebFlagImgProps = {
  src: string
  size: number
  alt: string
  onError: () => void
}

function WebFlagImg({ src, size, alt, onError }: WebFlagImgProps) {
  return createElement('img', {
    src,
    alt,
    width: size,
    height: size,
    onError,
    style: {
      width: size,
      height: size,
      borderRadius: size / 2,
      objectFit: 'cover',
      display: 'block',
    },
  })
}

function FlagFallback({
  code,
  size,
  label,
  isDarkMode,
}: {
  code: string
  size: number
  label: string
  isDarkMode: boolean
}) {
  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.12)',
          borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.35)' : 'rgba(100, 116, 139, 0.2)',
        },
      ]}
      accessibilityLabel={label}
      accessibilityRole="image"
    >
      <Text style={[styles.fallbackText, { fontSize: Math.max(9, size * 0.28) }]}>
        {code.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  )
}

export function MoedaFlag({ moeda, size = 28, label }: Props) {
  const { isDarkMode } = useMfTheme()
  const countryIso = useMemo(() => getMoedaCountryIso(moeda), [moeda])
  const urls = useMemo(() => {
    if (!countryIso) return []
    if (Platform.OS === 'web') {
      return [getMoedaCircleFlagSvgUrl(countryIso), getMoedaFlagPngUrl(countryIso, size)]
    }
    return getMoedaFlagNativeUrls(countryIso, size)
  }, [countryIso, size])

  const [urlIndex, setUrlIndex] = useState(0)

  useEffect(() => {
    setUrlIndex(0)
  }, [moeda, countryIso])

  const currentUrl = urls[urlIndex] ?? null
  const alt = label ?? moeda
  const showFallback = !countryIso || urlIndex >= urls.length || !currentUrl

  const handleError = () => {
    setUrlIndex((i) => i + 1)
  }

  if (showFallback) {
    return (
      <FlagFallback
        code={countryIso ?? moeda}
        size={size}
        label={alt}
        isDarkMode={isDarkMode}
      />
    )
  }

  if (Platform.OS === 'web') {
    return (
      <View
        style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}
        accessibilityLabel={alt}
        accessibilityRole="image"
      >
        <WebFlagImg
          key={currentUrl}
          src={currentUrl}
          size={size}
          alt={alt}
          onError={handleError}
        />
      </View>
    )
  }

  return (
    <View
      style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityLabel={alt}
      accessibilityRole="image"
    >
      <Image
        key={currentUrl}
        source={{ uri: currentUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
        onError={handleError}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  ring: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  fallbackText: {
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#64748b',
  },
})
