import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFocusEffect } from 'expo-router'
import { MfScrollView } from '../components/ui/MfScrollView'
import { MfGlassCard } from '../components/ui/MfGlassCard'
import { useMfTheme } from '../components/ui/useMfTheme'
import { useThemeStore } from '../store/themeStore'
import { mfRadius, mfSpacing, mfTypography } from '../lib/theme'
import { getTechTokens } from '../lib/techDesign'
import { APP_BRAND_TAGLINE } from '../lib/appBrand'
import {
  fetchActivationProgress,
  type ActivationPayload,
  type ActivationStep,
} from '../services/activationService'
import { ActivationStepList } from '../components/activation/ActivationStepList'
import { activationRouteToScreen } from '../lib/activationStepRoutes'
import { setSessionActivationSkipped } from '../lib/activationSession'
import { isEmpresaCnpjOnboardingRequired } from '../lib/empresaCnpjGate'
import { EMPRESA_CNPJ_ONBOARDING_ROUTE } from '../lib/settingsRoutes'
import { SCREEN_TO_HREF } from '../lib/appNavConfig'
import type { AppScreenName } from '../lib/navigationContext'
import { ActivationPageCanvas } from '../components/activation/ActivationPageCanvas'
import {
  ActivationEyebrow,
  ActivationProgressBlock,
} from '../components/activation/activationUi'
import { useNavigationDrawer } from '../lib/navigationContext'
import { RevealSoft } from '../components/landing/LandingMotion'

function computeVisibleProgress(steps: ActivationStep[]) {
  const total = steps.length
  const completed = steps.filter((s) => s.status === 'completed').length
  const required = steps.filter((s) => s.required)
  const requiredCompleted = required.filter((s) => s.status === 'completed').length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  const coreComplete = required.length > 0 && requiredCompleted === required.length

  return {
    completed,
    total,
    percent,
    label: coreComplete ? 'Progresso geral' : 'Passos obrigatórios',
    isCoreComplete: coreComplete,
  }
}

export default function ActivationSetupScreen () {
  const { theme, isDarkMode } = useMfTheme()
  const { isDarkMode: storeDark } = useThemeStore()
  const dark = isDarkMode ?? storeDark
  const tokens = getTechTokens(dark)
  const insets = useSafeAreaInsets()
  const { hasGlobalNav } = useNavigationDrawer()
  const router = useRouter()
  const scrollBottomPad = Math.max(insets.bottom, mfSpacing.lg) + mfSpacing.xl
  const [payload, setPayload] = useState<ActivationPayload | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    if (await isEmpresaCnpjOnboardingRequired()) {
      setLoading(false)
      router.replace(EMPRESA_CNPJ_ONBOARDING_ROUTE as never)
      return
    }
    const data = await fetchActivationProgress()
    setPayload(data)
    setLoading(false)
    if (data?.progress.isFullyComplete) {
      router.replace(SCREEN_TO_HREF.MeuMei as any)
    }
  }, [router])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const handleStep = (step: ActivationStep) => {
    const screen = activationRouteToScreen(step.route)
    if (screen) {
      router.push(SCREEN_TO_HREF[screen as AppScreenName] as any)
    }
  }

  const handleSkip = () => {
    setSessionActivationSkipped(true)
    router.replace(SCREEN_TO_HREF.MeuMei as any)
  }

  const steps = useMemo(
    () =>
      (payload?.steps ?? []).filter((step) => activationRouteToScreen(step.route) !== null),
    [payload?.steps],
  )

  const visibleProgress = useMemo(() => computeVisibleProgress(steps), [steps])

  if (loading && !payload) {
    return (
      <ActivationPageCanvas isDarkMode={dark}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={tokens.accent} />
          </View>
        </SafeAreaView>
      </ActivationPageCanvas>
    )
  }

  if (!payload) {
    return (
      <ActivationPageCanvas isDarkMode={dark}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.centered}>
            <Text style={{ color: theme.textSecondary }}>
              Não foi possível carregar o checklist. Tente novamente mais tarde.
            </Text>
            <Pressable onPress={handleSkip} accessibilityRole="button">
              <Text style={[styles.skipGhost, { color: tokens.accent }]}>
                Ir para o painel
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </ActivationPageCanvas>
    )
  }

  return (
    <ActivationPageCanvas isDarkMode={dark}>
      <SafeAreaView
        style={styles.safe}
        edges={hasGlobalNav ? ['bottom'] : ['top', 'bottom']}
      >
        <MfScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: scrollBottomPad },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          nestedScrollEnabled
        >
          <RevealSoft delay={0} offset={12}>
            <MfGlassCard padding="none" intensity="strong" techVariant="surface">
              <View style={styles.hero}>
                <ActivationEyebrow label="Primeiros passos" isDarkMode={dark} />
                <Text style={[styles.heroTitle, { color: theme.text }]}>
                  Configure seu painel MEI
                </Text>
                <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
                  {APP_BRAND_TAGLINE} Complete o essencial para emitir notas, acompanhar
                  DAS e usar o WhatsApp — ou pule e volte em Configurações quando quiser.
                </Text>
                <ActivationProgressBlock
                  completed={visibleProgress.completed}
                  total={visibleProgress.total}
                  percent={visibleProgress.percent}
                  isDarkMode={dark}
                  label={visibleProgress.label}
                />
              </View>

              <ActivationStepList
                steps={steps}
                theme={theme}
                isDarkMode={dark}
                onStepPress={handleStep}
                embedded
              />
            </MfGlassCard>
          </RevealSoft>

          <RevealSoft delay={120} offset={10}>
            <Pressable
              onPress={handleSkip}
              style={({ pressed }) => [
                styles.skipButton,
                {
                  borderColor: tokens.panelBorder,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Pular e ir ao painel"
            >
              <Text style={[styles.skipButtonText, { color: theme.textSecondary }]}>
                Pular e ir ao painel
              </Text>
            </Pressable>
          </RevealSoft>
        </MfScrollView>
      </SafeAreaView>
    </ActivationPageCanvas>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? 0 : undefined,
  },
  scrollView: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? 0 : undefined,
  },
  scrollContent: {
    flexGrow: 1,
    gap: mfSpacing.lg,
    paddingTop: mfSpacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: mfSpacing.lg,
    gap: mfSpacing.md,
    minHeight: 280,
  },
  hero: {
    padding: mfSpacing.lg,
    borderTopLeftRadius: mfRadius.lg,
    borderTopRightRadius: mfRadius.lg,
    borderBottomWidth: 0,
  },
  heroTitle: {
    ...mfTypography.titleLarge,
    marginBottom: mfSpacing.sm,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    ...mfTypography.body,
    lineHeight: 22,
    maxWidth: 520,
  },
  skipButton: {
    alignSelf: 'center',
    paddingVertical: mfSpacing.md,
    paddingHorizontal: mfSpacing.xl,
    borderRadius: mfRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 240,
  },
  skipButtonText: {
    ...mfTypography.bodyStrong,
    fontSize: 14,
  },
  skipGhost: {
    ...mfTypography.bodyStrong,
    padding: mfSpacing.md,
  },
})
