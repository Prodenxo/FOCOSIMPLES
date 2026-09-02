import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useMfTheme } from '@/components/ui/useMfTheme'
import { mfRadius, mfSpacing, mfTypography } from '@/lib/theme'
import { fiscalStatusTone, labelFiscalUiStatus } from '@/lib/fiscalConfiguration/labels'
import type { ProductFiscalUiStatus } from '@/lib/fiscalConfiguration/types'

type Props = {
  status: ProductFiscalUiStatus
}

const TONE_COLORS = {
  success: { bg: 'rgba(16, 185, 129, 0.14)', text: '#059669', border: 'rgba(16, 185, 129, 0.35)' },
  warning: { bg: 'rgba(245, 158, 11, 0.14)', text: '#D97706', border: 'rgba(245, 158, 11, 0.35)' },
  danger: { bg: 'rgba(239, 68, 68, 0.12)', text: '#DC2626', border: 'rgba(239, 68, 68, 0.35)' },
  neutral: { bg: 'rgba(100, 116, 139, 0.12)', text: '#64748B', border: 'rgba(100, 116, 139, 0.28)' },
}

export function FiscalStatusBadge({ status }: Props) {
  const { theme } = useMfTheme()
  const tone = fiscalStatusTone(status)
  const colors = TONE_COLORS[tone]
  const styles = useMemo(
    () =>
      StyleSheet.create({
        badge: {
          alignSelf: 'flex-start',
          paddingHorizontal: mfSpacing.sm,
          paddingVertical: 4,
          borderRadius: mfRadius.pill,
          borderWidth: 1,
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
        text: {
          ...mfTypography.caption,
          fontWeight: '600',
          color: colors.text,
        },
      }),
    [colors, theme],
  )

  return (
    <View style={styles.badge} accessibilityRole="text">
      <Text style={styles.text}>{labelFiscalUiStatus(status).toUpperCase()}</Text>
    </View>
  )
}
