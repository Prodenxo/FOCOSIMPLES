import React, { useCallback, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useMfTheme } from '../ui/useMfTheme'
import { fetchActivationProgress } from '../../services/activationService'
import { ACTIVATION_ROUTE } from '../../lib/settingsRoutes'
import { setSessionActivationSkipped } from '../../lib/activationSession'
import {
  getSiteTokens,
  mfSitePanel,
  mfSitePrimaryBtn,
  siteHintStyle,
  sitePanelTitleStyle,
} from '../../lib/siteDesign'
import { mfSpacing } from '../../lib/theme'

export function ActivationSettingsEntry () {
  const { isDarkMode } = useMfTheme()
  const tokens = getSiteTokens(isDarkMode)
  const router = useRouter()
  const [summary, setSummary] = useState<{
    completed: number
    total: number
    percentRequired: number
    percentAll: number
    completedAll: number
    totalAll: number
    coreDone: boolean
    pendingCount: number
  } | null>(null)

  const load = useCallback(async () => {
    const data = await fetchActivationProgress()
    const fullyDone = data?.progress.isFullyComplete ?? data?.progress.isComplete
    if (!data || fullyDone) {
      setSummary(null)
      return
    }
    const p = data.progress
    setSummary({
      completed: p.completed,
      total: p.totalRequired,
      percentRequired: p.percent,
      percentAll: p.percentAll ?? p.percent,
      completedAll: p.completedAll,
      totalAll: p.totalAll,
      coreDone: p.isCoreComplete ?? p.isComplete,
      pendingCount: p.pendingCount ?? Math.max(0, p.totalAll - p.completedAll),
    })
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  if (!summary) return null

  const openActivation = () => {
    setSessionActivationSkipped(false)
    router.push(ACTIVATION_ROUTE as any)
  }

  const progressCompleted = summary.coreDone ? summary.completedAll : summary.completed
  const progressTotal = summary.coreDone ? summary.totalAll : summary.total
  const progressPercent = summary.coreDone ? summary.percentAll : summary.percentRequired
  const barWidth = Math.min(100, Math.max(0, progressPercent))

  return (
    <View style={[mfSitePanel(isDarkMode), styles.card]}>
      <Text style={[sitePanelTitleStyle, { color: tokens.textPrimary }]}>Configuração da conta</Text>
      <Text style={[siteHintStyle, styles.desc, { color: tokens.textSecondary }]}>
        {summary.coreDone
          ? `Essencial completo (${summary.completed}/${summary.total}). Faltam ${summary.pendingCount} passo${summary.pendingCount === 1 ? '' : 's'} — MEI ou recomendados.`
          : 'Nome, WhatsApp, conta, lançamento e orçamento — o essencial para começar.'}
      </Text>

      <View style={styles.progressMeta}>
        <Text style={[styles.progressLabel, { color: tokens.textSecondary }]}>
          {summary.coreDone ? 'Progresso geral' : 'Passos obrigatórios'}
        </Text>
        <Text style={[styles.progressValue, { color: tokens.textPrimary }]}>
          {progressCompleted}/{progressTotal}
        </Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: tokens.divider }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${barWidth}%`, backgroundColor: tokens.neon },
          ]}
        />
      </View>

      <Pressable
        onPress={openActivation}
        style={({ pressed }) => [
          mfSitePrimaryBtn(isDarkMode, pressed),
          styles.cta,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Continuar configuração da conta"
      >
        <View style={styles.ctaInner}>
          <Ionicons name="rocket-outline" size={18} color="#FFFFFF" />
          <Text style={styles.ctaText} numberOfLines={1}>
            Continuar configuração
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </View>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 0,
  },
  desc: {
    marginTop: 4,
    marginBottom: mfSpacing.sm,
    lineHeight: 18,
    fontSize: 13,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: mfSpacing.xs,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: mfSpacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  cta: {
    marginTop: mfSpacing.sm,
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    maxWidth: '100%',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
})
