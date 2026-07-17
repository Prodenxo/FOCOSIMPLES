import React, { useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Platform,
  useWindowDimensions,
  ScrollView,
} from 'react-native'
import { useThemeStore } from '../../store/themeStore'
import { AppCanvasBackground } from '../shell/AppCanvasBackground'
import { getTechTokens, mfTechPanelChrome } from '../../lib/techDesign'
import { mfRadius, mfSpacing } from '../../lib/theme'
import {
  applyMfWebDocumentTheme,
  getWebScrollIndicatorProps,
  getWebScrollViewProps,
  WEB_SCROLL_Y_CLASS,
} from '../../lib/webScrollbar'
import {
  AUTH_BREAKPOINT_MD,
  AUTH_BREAKPOINT_LG,
  AUTH_FORM_PANEL_MAX_WIDTH,
  AUTH_PAGE_MAX_WIDTH,
  AUTH_ILLUSTRATION_HEADLINE,
  AUTH_ILLUSTRATION_SUBHEADLINE,
  authSpacing,
  authTypography,
  getAuthPalette,
} from './authTokens'
import { AuthThemeToggle } from './AuthThemeToggle'
import { AuthHeroPreview } from './AuthHeroPreview'
import { AuthEyebrow } from './AuthEyebrow'
import { AuthBrandNav } from './AuthBrandNav'
import { HeroMockupShell, RevealSoft } from '../landing/LandingMotion'

export type AuthLayoutWebProps = {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  showIllustration?: boolean
  illustrationHeadline?: string
  illustrationSubheadline?: string
  /** Largura máxima do painel do formulário (padrão 440). */
  formMaxWidth?: number
}

export function AuthLayoutWeb ({
  title,
  subtitle,
  children,
  footer,
  showIllustration = true,
  illustrationHeadline = AUTH_ILLUSTRATION_HEADLINE,
  illustrationSubheadline = AUTH_ILLUSTRATION_SUBHEADLINE,
  formMaxWidth,
}: AuthLayoutWebProps) {
  if (Platform.OS !== 'web') {
    return <>{children}</>
  }
  return (
    <WebLayoutContent
      title={title}
      subtitle={subtitle}
      footer={footer}
      showIllustration={showIllustration}
      illustrationHeadline={illustrationHeadline}
      illustrationSubheadline={illustrationSubheadline}
      formMaxWidth={formMaxWidth}
    >
      {children}
    </WebLayoutContent>
  )
}

function WebLayoutContent ({
  title,
  subtitle,
  children,
  footer,
  showIllustration,
  illustrationHeadline,
  illustrationSubheadline,
  formMaxWidth,
}: AuthLayoutWebProps) {
  const { width, height } = useWindowDimensions()
  const isDarkMode = useThemeStore((s) => s.isDarkMode)
  const palette = getAuthPalette(isDarkMode)
  const tokens = getTechTokens(isDarkMode)
  const isDesktop = width >= AUTH_BREAKPOINT_MD
  const isWide = width >= AUTH_BREAKPOINT_LG
  const isCompact = width < AUTH_BREAKPOINT_MD
  const formPanelChrome = mfTechPanelChrome(isDarkMode, 'surface')
  const resolvedFormMaxWidth = formMaxWidth ?? AUTH_FORM_PANEL_MAX_WIDTH

  useEffect(() => {
    applyMfWebDocumentTheme(isDarkMode)
  }, [isDarkMode])

  return (
    <View style={[styles.outer, { backgroundColor: palette.bgCanvas }]}>
      <AppCanvasBackground isDarkMode={isDarkMode} />
      <AuthBrandNav />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'web' && height > 0
            ? ({ minHeight: height } as object)
            : null,
        ]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        {...(Platform.OS === 'web'
          ? {
              className: WEB_SCROLL_Y_CLASS,
              ...getWebScrollViewProps(isDarkMode),
              ...getWebScrollIndicatorProps({ showsVerticalScrollIndicator: true }),
            }
          : { showsVerticalScrollIndicator: true })}
      >
        <View style={[styles.page, { maxWidth: AUTH_PAGE_MAX_WIDTH }]}>
          <View
            style={[
              styles.main,
              showIllustration
                ? isDesktop
                  ? styles.mainDesktop
                  : styles.mainMobile
                : styles.mainCentered,
            ]}
          >
            {showIllustration ? (
              <View
                style={[
                  styles.heroZone,
                  isDesktop ? styles.heroZoneDesktop : styles.heroZoneMobile,
                ]}
              >
                <View
                  pointerEvents="none"
                  style={[
                    styles.heroGlow,
                    Platform.OS === 'web'
                      ? ({
                          backgroundImage: `radial-gradient(ellipse 65% 55% at 35% 45%, ${tokens.accentGlow}, transparent 72%)`,
                        } as object)
                      : { backgroundColor: tokens.accentSoft },
                  ]}
                />

                <RevealSoft delay={120} offset={16}>
                  <View style={styles.heroCopy}>
                    <AuthEyebrow
                      label="PAINEL MEI"
                      dotColor={palette.eyebrowDot}
                      textColor={palette.eyebrowText}
                    />
                    <Text
                      style={[
                        styles.heroTitle,
                        {
                          color: palette.titleText,
                          fontSize: isWide ? 42 : isDesktop ? 36 : 28,
                          lineHeight: isWide ? 48 : isDesktop ? 42 : 34,
                        },
                      ]}
                    >
                      {illustrationHeadline}
                    </Text>
                    <Text style={[styles.heroSubtitle, { color: palette.subtitleText }]}>
                      {illustrationSubheadline}
                    </Text>
                  </View>
                </RevealSoft>

                <HeroMockupShell>
                  <AuthHeroPreview compact={!isDesktop} />
                </HeroMockupShell>
              </View>
            ) : null}

            <RevealSoft
              delay={isDesktop ? 200 : 160}
              offset={12}
              offsetX={isDesktop && showIllustration ? 20 : 0}
              style={[
                styles.formShell,
                { maxWidth: resolvedFormMaxWidth },
                isDesktop && showIllustration ? styles.formShellDesktop : null,
                !showIllustration ? styles.formShellCentered : null,
              ]}
            >
              <View
                style={[
                  styles.formPanel,
                  formPanelChrome,
                  {
                    borderColor: palette.cardBorder,
                    backgroundColor: palette.cardBg,
                    paddingHorizontal: isCompact
                      ? authSpacing.cardPaddingHMobile
                      : authSpacing.cardPaddingHDesktop,
                    paddingVertical: isCompact
                      ? authSpacing.cardPaddingVMobile
                      : authSpacing.cardPaddingVDesktop,
                  },
                  Platform.OS === 'web'
                    ? ({ boxShadow: palette.cardShadow } as object)
                    : null,
                ]}
              >
                <AuthEyebrow
                  label="ACESSO À CONTA"
                  dotColor={palette.eyebrowDot}
                  textColor={palette.eyebrowText}
                />

                <View style={styles.formHeader}>
                  <Text style={[styles.title, { color: palette.titleText }]}>{title}</Text>
                  {subtitle ? (
                    <Text style={[styles.subtitle, { color: palette.subtitleText }]}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.formContent}>{children}</View>

                {footer ? <View style={styles.footer}>{footer}</View> : null}
              </View>
            </RevealSoft>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    width: '100%',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? ({
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'hidden',
        } as object)
      : {}),
  },
  scrollView: {
    flex: 1,
    width: '100%',
    ...(Platform.OS === 'web'
      ? ({ overflowY: 'auto', overflowX: 'hidden' } as object)
      : {}),
  },
  scrollContent: {
    paddingHorizontal: mfSpacing.lg,
    paddingTop: mfSpacing.md,
    paddingBottom: mfSpacing.xxl,
  },
  page: {
    width: '100%',
    alignSelf: 'center',
  },
  main: {
    width: '100%',
  },
  mainDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: mfSpacing.xxl,
  },
  mainMobile: {
    flexDirection: 'column',
    gap: mfSpacing.lg,
  },
  mainCentered: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: mfSpacing.lg,
  },
  heroZone: {
    position: 'relative',
    minWidth: 0,
  },
  heroZoneDesktop: {
    flex: 1.2,
    justifyContent: 'center',
    paddingVertical: mfSpacing.md,
  },
  heroZoneMobile: {
    alignItems: 'stretch',
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: mfRadius.xl,
  },
  heroCopy: {
    zIndex: 1,
    maxWidth: 520,
    gap: mfSpacing.sm,
    marginBottom: mfSpacing.sm,
  },
  heroTitle: {
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: mfSpacing.sm,
  },
  heroSubtitle: {
    fontSize: authTypography.heroSubtitleSize,
    fontWeight: '500',
    lineHeight: 24,
    marginTop: mfSpacing.xs,
    maxWidth: 460,
  },
  formShell: {
    width: '100%',
    alignSelf: 'center',
  },
  formShellDesktop: {
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  formShellCentered: {
    width: '100%',
  },
  formPanel: {
    width: '100%',
    borderRadius: mfRadius.xl,
    gap: authSpacing.fieldGap,
  },
  formHeader: {
    marginTop: mfSpacing.xs,
    marginBottom: mfSpacing.xs,
  },
  formContent: {
    gap: authSpacing.fieldGap,
    width: '100%',
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
  footer: {
    marginTop: mfSpacing.sm,
    alignItems: 'center',
    width: '100%',
  },
})
