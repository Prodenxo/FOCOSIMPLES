import React, { useMemo } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native'
import { useMfTheme } from '../ui/useMfTheme'
import { getTechTokens } from '../../lib/techDesign'
import { mfRadius, mfSpacing } from '../../lib/theme'

export type MeiTabKey = 'overview' | 'das' | 'parcelamentos' | 'notas' | 'certificado'

type TabItem = {
  key: MeiTabKey
  label: string
  badge?: number
}

type Props = {
  tabs: TabItem[]
  active: MeiTabKey
  onChange: (key: MeiTabKey) => void
  style?: ViewStyle
}

export function MeiTabBar ({ tabs, active, onChange, style }: Props) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode])
  const styles = useMemo(() => createStyles(theme, tokens, isDarkMode), [theme, tokens, isDarkMode])

  return (
    <View style={[styles.wrap, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.row}
      >
        {tabs.map((tab) => {
          const isActive = active === tab.key
          return (
            <Pressable
              key={tab.key}
              onPress={() => onChange(tab.key)}
              style={({ pressed }) => [
                styles.tab,
                isActive && styles.tabActive,
                pressed && !isActive && styles.tabPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
              {typeof tab.badge === 'number' && tab.badge > 0 ? (
                <View style={[styles.badge, isActive && styles.badgeActive]}>
                  <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>{tab.badge}</Text>
                </View>
              ) : null}
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

function createStyles (
  theme: ReturnType<typeof useMfTheme>['theme'],
  tokens: ReturnType<typeof getTechTokens>,
  isDarkMode: boolean,
) {
  return StyleSheet.create({
    wrap: {
      paddingVertical: mfSpacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.xs,
      paddingHorizontal: mfSpacing.md,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === 'web' ? 9 : 11,
      minHeight: 44,
      borderRadius: mfRadius.pill,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: tokens.insetFill,
      ...(Platform.OS === 'android' ? { elevation: 0, overflow: 'hidden' as const } : {}),
    },
    tabActive: {
      backgroundColor: tokens.accent,
      borderColor: tokens.accent,
    },
    tabPressed: {
      opacity: 0.88,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    tabTextActive: {
      color: isDarkMode ? '#030508' : '#fff',
    },
    badge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 5,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    },
    badgeActive: {
      backgroundColor: isDarkMode ? 'rgba(3,5,8,0.25)' : 'rgba(255,255,255,0.28)',
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    badgeTextActive: {
      color: isDarkMode ? '#030508' : '#fff',
    },
  })
}
