import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppCanvasBackground } from '../shell/AppCanvasBackground'
import { mfTechPanelChrome } from '../../lib/techDesign'
import { mfRadius, mfSpacing } from '../../lib/theme'
import { MfScrollView } from '../ui/MfScrollView'
import {
  authSpacing,
  authTypography,
  getAuthPalette,
} from './authTokens'
import { AuthEyebrow } from './AuthEyebrow'
import { AuthBrandNav } from './AuthBrandNav'
import { useThemeStore } from '../../store/themeStore'
import { RevealSoft } from '../landing/LandingMotion'

export type AuthLayoutMobileProps = {
  title: string
  subtitle?: string
  eyebrowLabel?: string
  children: React.ReactNode
}

export function AuthLayoutMobile ({
  title,
  subtitle,
  eyebrowLabel = 'ACESSO À CONTA',
  children,
}: AuthLayoutMobileProps) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode)
  const palette = getAuthPalette(isDarkMode)
  const panelChrome = mfTechPanelChrome(isDarkMode, 'surface')

  return (
    <View style={[styles.root, { backgroundColor: palette.bgCanvas }]}>
      <AppCanvasBackground isDarkMode={isDarkMode} />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <AuthBrandNav />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <MfScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            hideLegalFooter
          >
            <RevealSoft delay={120} offset={14}>
            <View
              style={[
                styles.panel,
                panelChrome,
                {
                  borderColor: palette.cardBorder,
                  backgroundColor: palette.cardBg,
                },
                Platform.OS === 'web'
                  ? ({ boxShadow: palette.cardShadow } as object)
                  : {
                      shadowColor: '#0f172a',
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: isDarkMode ? 0.35 : 0.12,
                      shadowRadius: 24,
                      elevation: 6,
                    },
              ]}
            >
              <AuthEyebrow
                label={eyebrowLabel}
                dotColor={palette.eyebrowDot}
                textColor={palette.eyebrowText}
              />
              <View style={styles.header}>
                <Text style={[styles.title, { color: palette.titleText }]}>{title}</Text>
                {subtitle ? (
                  <Text style={[styles.subtitle, { color: palette.subtitleText }]}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <View style={styles.content}>{children}</View>
            </View>
            </RevealSoft>
          </MfScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: mfSpacing.md,
    paddingTop: mfSpacing.sm,
    paddingBottom: mfSpacing.xl,
  },
  panel: {
    width: '100%',
    borderRadius: mfRadius.xl,
    paddingHorizontal: authSpacing.cardPaddingHMobile,
    paddingVertical: authSpacing.cardPaddingVMobile,
    gap: authSpacing.fieldGap,
  },
  header: {
    marginTop: mfSpacing.xs,
  },
  title: {
    fontSize: authTypography.titleSize,
    fontWeight: authTypography.titleWeight,
    lineHeight: authTypography.titleLineHeight,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: authTypography.subtitleSize,
    fontWeight: authTypography.subtitleWeight,
    lineHeight: authTypography.subtitleLineHeight,
    marginTop: mfSpacing.xs,
  },
  content: {
    width: '100%',
    gap: authSpacing.fieldGap,
  },
})
