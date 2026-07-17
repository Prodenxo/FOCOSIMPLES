import React from 'react'
import { View, Pressable, StyleSheet, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppBrandLogo } from '../shell/AppBrandLogo'
import { brandColors } from '@/lib/brandTokens'
import { AUTH_PAGE_MAX_WIDTH } from './authTokens'
import { AuthThemeToggle } from './AuthThemeToggle'

/** Barra superior idêntica à landing — fundo sólido + logo.png oficial. */
export function AuthBrandNav() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.shell, { paddingTop: Math.max(insets.top, 0) + 14 }]}>
      <View style={styles.inner}>
        <Pressable
          onPress={() => router.push('/')}
          style={({ pressed }) => [styles.logoBtn, pressed && styles.pressed]}
          accessibilityRole="link"
          accessibilityLabel="FocoSimples — início"
        >
          <AppBrandLogo variant="wordmark" onDarkBackground />
        </Pressable>
        <AuthThemeToggle variant="inline" />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    backgroundColor: brandColors.primary,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 14,
    zIndex: 20,
    ...(Platform.OS === 'web'
      ? ({
          position: 'sticky',
          top: 0,
        } as object)
      : {}),
  },
  inner: {
    width: '100%',
    maxWidth: AUTH_PAGE_MAX_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    gap: 16,
  },
  logoBtn: {
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.88,
  },
})
