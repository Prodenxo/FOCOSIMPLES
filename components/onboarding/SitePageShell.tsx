import React from 'react'
import { View, StyleSheet, Platform } from 'react-native'
import { getSiteCanvasStyle } from '../../lib/siteDesign'
import { mfSpacing } from '../../lib/theme'

type Props = {
  isDarkMode: boolean
  children: React.ReactNode
  maxWidth?: number
  noHorizontalPad?: boolean
}

/** Canvas premium do Site — grid sutil + glow neon azul (#3B82F6). */
export function SitePageShell ({
  isDarkMode,
  children,
  maxWidth = 720,
  noHorizontalPad = false,
}: Props) {
  return (
    <View style={[styles.root, getSiteCanvasStyle(isDarkMode)]}>
      <View
        style={[
          styles.column,
          { maxWidth },
          noHorizontalPad ? styles.columnFlush : null,
        ]}
      >
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    minHeight: Platform.OS === 'web' ? ('100vh' as unknown as number) : undefined,
    alignItems: 'center',
  },
  column: {
    width: '100%',
    flex: 1,
    paddingHorizontal: mfSpacing.md,
  },
  columnFlush: {
    paddingHorizontal: 0,
  },
})
