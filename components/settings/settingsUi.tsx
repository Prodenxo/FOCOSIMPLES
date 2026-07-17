import React from 'react'
import { View, Text, StyleSheet, type ViewStyle } from 'react-native'
import {
  getSiteTokens,
  mfSitePanel,
  sitePanelTitleStyle,
  siteHintStyle,
} from '../../lib/siteDesign'
import { mfSpacing } from '../../lib/theme'
import { useMfTheme } from '../ui/useMfTheme'

export const SETTINGS_PAGE_MAX_WIDTH = 1280

type SectionProps = {
  title: string
  description?: string
  children: React.ReactNode
  style?: ViewStyle
}

export function SettingsSectionCard ({
  title,
  description,
  children,
  style,
}: SectionProps) {
  const { isDarkMode } = useMfTheme()
  const tokens = getSiteTokens(isDarkMode)

  return (
    <View style={[mfSitePanel(isDarkMode), styles.card, style]}>
      <Text style={[sitePanelTitleStyle, { color: tokens.textPrimary }]}>{title}</Text>
      {description ? (
        <Text style={[siteHintStyle, styles.desc, { color: tokens.textSecondary }]}>{description}</Text>
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    marginBottom: mfSpacing.md,
  },
  desc: {
    marginTop: 4,
    marginBottom: mfSpacing.md,
    lineHeight: 18,
    fontSize: 13,
  },
  body: {
    gap: 0,
  },
})
