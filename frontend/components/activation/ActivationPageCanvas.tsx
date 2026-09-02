import React from 'react'
import { View, StyleSheet, Platform } from 'react-native'
import { AppCanvasBackground } from '../../components/shell/AppCanvasBackground'
import { getTechTokens, mfTechCanvasScrim, mfTechOpaqueShell } from '../../lib/techDesign'
import { mfSpacing } from '../../lib/theme'
import { ACTIVATION_PAGE_MAX_WIDTH } from './activationUi'

type Props = {
  isDarkMode: boolean
  children: React.ReactNode
  /** Largura máxima da coluna (ex.: 960 em Configurações). */
  maxWidth?: number
  /**
   * true (padrão): preenche viewport e scroll fica no filho (ScrollView).
   * false: altura pelo conteúdo — scroll no shell / página (web com top nav).
   */
  fillViewport?: boolean
  /** Véu escuro/claro sobre o grid (modais). */
  canvasScrim?: boolean
  /** Coluna com fundo sólido opaco (sem glass blur no web). */
  opaqueShell?: boolean
  /** Padding horizontal da página: `none` = coluna edge-to-edge no maxWidth. */
  pagePadding?: 'default' | 'none'
}

/** Canvas tech + coluna centralizada (web e app). */
export function ActivationPageCanvas ({
  isDarkMode,
  children,
  maxWidth = ACTIVATION_PAGE_MAX_WIDTH,
  fillViewport = true,
  canvasScrim = false,
  opaqueShell = false,
  pagePadding = 'default',
}: Props) {
  const tokens = getTechTokens(isDarkMode)
  const pagePadStyle = pagePadding === 'none' ? styles.pageNoPad : null

  return (
    <View
      style={[
        styles.root,
        fillViewport ? styles.rootFill : styles.rootFlow,
        { backgroundColor: tokens.canvasBase },
      ]}
    >
      <AppCanvasBackground isDarkMode={isDarkMode} />
      {canvasScrim ? <View style={mfTechCanvasScrim(isDarkMode)} pointerEvents="none" /> : null}
      <View style={[styles.page, fillViewport ? styles.pageFill : styles.pageFlow, pagePadStyle]}>
        <View
          style={[
            styles.column,
            fillViewport ? styles.columnFill : styles.columnFlow,
            { maxWidth },
            opaqueShell && mfTechOpaqueShell(isDarkMode),
          ]}
        >
          {children}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  rootFill: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? 0 : undefined,
  },
  rootFlow: {
    flexGrow: 1,
    width: '100%',
  },
  root: {},
  pageFill: {
    flex: 1,
  },
  pageFlow: {},
  page: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: mfSpacing.lg,
    paddingTop: mfSpacing.lg,
    paddingBottom: mfSpacing.xl,
  },
  pageNoPad: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  columnFill: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? 0 : undefined,
  },
  columnFlow: {},
  column: {
    width: '100%',
  },
})
