import React from 'react'
import { View, Text, StyleSheet, type ViewStyle } from 'react-native'
import { mfRadius, mfSpacing, mfTypography } from '../../lib/theme'
import { getTechTokens, mfTechInsetSurface } from '../../lib/techDesign'

export const ACTIVATION_PAGE_MAX_WIDTH = 720

export function ActivationEyebrow ({
  label,
  isDarkMode,
  style,
}: {
  label: string
  isDarkMode: boolean
  style?: ViewStyle
}) {
  const tokens = getTechTokens(isDarkMode)
  return (
    <View style={[styles.eyebrowRow, style]}>
      <View style={[styles.eyebrowDot, { backgroundColor: tokens.accent }]} />
      <Text style={[styles.eyebrow, { color: tokens.accent }]}>{label}</Text>
    </View>
  )
}

export function ActivationProgressBlock ({
  completed,
  total,
  percent,
  isDarkMode,
  label = 'Passos obrigatórios',
}: {
  completed: number
  total: number
  percent: number
  isDarkMode: boolean
  label?: string
}) {
  const tokens = getTechTokens(isDarkMode)
  const barWidth = Math.min(100, Math.max(0, percent))

  return (
    <View style={[mfTechInsetSurface(isDarkMode), styles.progressWell]}>
      <View style={styles.progressMeta}>
        <Text style={[styles.progressLabel, { color: tokens.accent }]}>
          {label}
        </Text>
        <Text style={[styles.progressValue, { color: tokens.accent }]}>
          {completed}/{total}
        </Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: tokens.divider }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${barWidth}%`, backgroundColor: tokens.accent },
          ]}
        />
      </View>
      <Text style={[styles.progressPct, { color: tokens.accent }]}>
        {percent}% concluído
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: mfSpacing.sm,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  progressWell: {
    marginTop: mfSpacing.md,
    padding: mfSpacing.md,
  },
  progressMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: mfSpacing.sm,
  },
  progressLabel: {
    ...mfTypography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressValue: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 8,
    borderRadius: mfRadius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: mfRadius.pill,
  },
  progressPct: {
    ...mfTypography.caption,
    marginTop: mfSpacing.sm,
    fontWeight: '600',
  },
})
