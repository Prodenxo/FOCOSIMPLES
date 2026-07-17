import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { MfGlassCard } from '../ui/MfGlassCard'
import { useMfTheme } from '../ui/useMfTheme'
import { getTechTokens, mfTechInsetSurface } from '../../lib/techDesign'
import { mfRadius, mfSpacing, mfTypography } from '../../lib/theme'

const MONO = Platform.select({
  web: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  ios: 'Menlo',
  android: 'monospace',
  default: undefined,
}) as string | undefined

type MiniKpiProps = {
  label: string
  value: string
  tone: 'accent' | 'success' | 'expense'
}

function MiniKpi ({ label, value, tone }: MiniKpiProps) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = getTechTokens(isDarkMode)
  const color =
    tone === 'success'
      ? theme.success
      : tone === 'expense'
        ? theme.error
        : tokens.accent

  return (
    <View style={[styles.kpi, mfTechInsetSurface(isDarkMode)]}>
      <Text style={[styles.kpiLabel, { color: theme.textTertiary }]}>{label}</Text>
      <Text style={[styles.kpiValue, { color, fontFamily: MONO }]}>{value}</Text>
    </View>
  )
}

function FeaturePill ({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = getTechTokens(isDarkMode)

  return (
    <View style={[styles.pill, mfTechInsetSurface(isDarkMode)]}>
      <Ionicons name={icon} size={14} color={tokens.accent} />
      <Text style={[styles.pillText, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  )
}

function MiniBars () {
  const { isDarkMode } = useMfTheme()
  const tokens = getTechTokens(isDarkMode)
  const heights = [0.45, 0.72, 0.55, 0.88, 0.62, 0.78]

  const barMax = 52

  return (
    <View style={styles.barsRow}>
      {heights.map((h, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            {
              height: Math.max(8, Math.round(barMax * h)),
              backgroundColor: i === 3 ? tokens.accent : tokens.accentSoft,
              opacity: i === 3 ? 1 : 0.85,
            },
          ]}
        />
      ))}
    </View>
  )
}

/** Preview estático do produto — substitui ilustração stock com texto duplicado. */
export function AuthHeroPreview ({ compact = false }: { compact?: boolean }) {
  const { theme, isDarkMode } = useMfTheme()
  const tokens = getTechTokens(isDarkMode)
  const stylesLocal = useMemo(() => createLocalStyles(compact), [compact])

  return (
    <View style={stylesLocal.wrap}>
      <MfGlassCard
        padding="md"
        intensity="strong"
        techVariant="accent"
        style={[
          stylesLocal.card,
          Platform.OS === 'web'
            ? ({ boxShadow: tokens.panelShadow } as object)
            : null,
        ]}
      >
        <View style={stylesLocal.cardHeader}>
          <View style={stylesLocal.liveDot}>
            <View style={[stylesLocal.livePing, { backgroundColor: tokens.accent }]} />
          </View>
          <Text style={[stylesLocal.cardEyebrow, { color: theme.textSecondary }]}>
            MEU MEI · RESUMO
          </Text>
        </View>

        <View style={[stylesLocal.heroKpi, mfTechInsetSurface(isDarkMode, true)]}>
          <Text style={[stylesLocal.heroKpiLabel, { color: theme.textTertiary }]}>FATURAMENTO</Text>
          <Text style={[stylesLocal.heroKpiValue, { color: theme.text, fontFamily: MONO }]}>
            R$ 48.200,00
          </Text>
          <Text style={[stylesLocal.heroKpiHint, { color: theme.success }]}>Dentro do limite MEI</Text>
        </View>

        <View style={stylesLocal.kpiRow}>
          <MiniKpi label="NOTAS" value="12" tone="success" />
          <MiniKpi label="DAS" value="Em dia" tone="accent" />
        </View>

        {!compact ? (
          <View style={[stylesLocal.chartWell, mfTechInsetSurface(isDarkMode)]}>
            <Text style={[stylesLocal.chartLabel, { color: theme.textTertiary }]}>
              EMISSÕES DO MÊS
            </Text>
            <MiniBars />
          </View>
        ) : null}

        <View style={stylesLocal.pillRow}>
          <FeaturePill icon="document-text-outline" label="NFSe" />
          <FeaturePill icon="receipt-outline" label="DAS" />
          <FeaturePill icon="shield-checkmark-outline" label="Certificado" />
        </View>
      </MfGlassCard>
    </View>
  )
}

function createLocalStyles (compact: boolean) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      maxWidth: compact ? 320 : 440,
      marginTop: compact ? mfSpacing.md : mfSpacing.lg,
    },
    card: {
      width: '100%',
      borderRadius: mfRadius.lg,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      marginBottom: mfSpacing.md,
    },
    liveDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    livePing: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    cardEyebrow: {
      ...mfTypography.caption,
      fontWeight: '700',
      letterSpacing: 1,
    },
    heroKpi: {
      padding: mfSpacing.md,
      borderRadius: mfRadius.md,
      marginBottom: mfSpacing.sm,
    },
    heroKpiLabel: {
      ...mfTypography.caption,
      fontWeight: '700',
      letterSpacing: 0.8,
      marginBottom: mfSpacing.xs,
    },
    heroKpiValue: {
      fontSize: compact ? 22 : 28,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    heroKpiHint: {
      ...mfTypography.caption,
      marginTop: mfSpacing.xs,
      fontWeight: '600',
    },
    kpiRow: {
      flexDirection: 'row',
      gap: mfSpacing.sm,
      marginBottom: compact ? mfSpacing.sm : mfSpacing.md,
    },
    chartWell: {
      padding: mfSpacing.md,
      borderRadius: mfRadius.md,
      marginBottom: mfSpacing.md,
      minHeight: compact ? 72 : 96,
    },
    chartLabel: {
      ...mfTypography.caption,
      fontWeight: '700',
      letterSpacing: 0.8,
      marginBottom: mfSpacing.sm,
    },
    pillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: mfSpacing.sm,
    },
  })
}

const styles = StyleSheet.create({
  kpi: {
    flex: 1,
    padding: mfSpacing.sm,
    borderRadius: mfRadius.md,
    minWidth: 0,
  },
  kpiLabel: {
    ...mfTypography.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: mfSpacing.sm,
    paddingVertical: 6,
    borderRadius: mfRadius.pill,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 56,
  },
  bar: {
    flex: 1,
    borderRadius: 4,
    minHeight: 8,
  },
})
