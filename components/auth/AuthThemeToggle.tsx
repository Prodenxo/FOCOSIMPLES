import React, { useState } from 'react'
import { Pressable, StyleSheet, Platform, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useThemeStore, type ThemePreference } from '../../store/themeStore'
import { getTechTokens } from '../../lib/techDesign'
import { getAuthPalette } from './authTokens'

type AuthThemeToggleProps = {
  variant?: 'absolute' | 'inline'
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

type SegmentDef = {
  value: ThemePreference
  icon: IoniconName
  label: string
}

const SEGMENTS: SegmentDef[] = [
  { value: 'light', icon: 'sunny-outline', label: 'Tema claro' },
  { value: 'system', icon: 'contrast-outline', label: 'Tema automático' },
  { value: 'dark', icon: 'moon-outline', label: 'Tema escuro' },
]

export function AuthThemeToggle ({ variant = 'inline' }: AuthThemeToggleProps) {
  const preference = useThemeStore((s) => s.preference)
  const isDarkMode = useThemeStore((s) => s.isDarkMode)
  const setPreference = useThemeStore((s) => s.setPreference)
  const tokens = getTechTokens(isDarkMode)
  const palette = getAuthPalette(isDarkMode)

  return (
    <View
      style={[
        styles.track,
        variant === 'absolute' ? styles.absolute : styles.inline,
        {
          backgroundColor: palette.cardBg,
          borderColor: palette.cardBorder,
        },
        Platform.OS === 'web'
          ? ({
              boxShadow: palette.cardShadow,
              backdropFilter: 'blur(16px) saturate(1.2)',
              WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
            } as object)
          : null,
      ]}
    >
      {SEGMENTS.map((seg) => {
        const selected = preference === seg.value
        return (
          <Segment
            key={seg.value}
            seg={seg}
            selected={selected}
            accent={tokens.accent}
            isDarkMode={isDarkMode}
            onPress={() => {
              void setPreference(seg.value)
            }}
          />
        )
      })}
    </View>
  )
}

function Segment ({
  seg,
  selected,
  accent,
  isDarkMode,
  onPress,
}: {
  seg: SegmentDef
  selected: boolean
  accent: string
  isDarkMode: boolean
  onPress: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const idleIcon = isDarkMode ? '#64748b' : '#94a3b8'
  const selectedBg = isDarkMode ? 'rgba(34, 211, 238, 0.18)' : 'rgba(29, 78, 216, 0.12)'

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={seg.label}
      accessibilityState={{ selected }}
      style={[
        styles.segment,
        selected ? { backgroundColor: selectedBg } : null,
        Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null,
      ]}
    >
      <Ionicons
        name={seg.icon}
        size={18}
        color={selected || hovered ? accent : idleIcon}
      />
    </Pressable>
  )
}

const SEGMENT_SIZE = 36
const TRACK_PADDING = 4

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: TRACK_PADDING,
    borderRadius: 9999,
    borderWidth: 1,
    zIndex: 100,
  },
  absolute: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  inline: {
    alignSelf: 'flex-end',
  },
  segment: {
    width: SEGMENT_SIZE,
    height: SEGMENT_SIZE,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
