import React from 'react'
import { Platform, ScrollView, type ScrollViewProps } from 'react-native'
import { getWebScrollIndicatorProps, getWebScrollViewProps } from '../../lib/webScrollbar'
import { AppLegalFooter } from '../shell/AppLegalFooter'
import { useMfTheme } from './useMfTheme'

type Props = ScrollViewProps & {
  /** Esconde barra em scroll horizontal (tabs, chips) via CSS — não via prop RN. */
  hideHorizontalBar?: boolean
  /**
   * Oculta rodapé legal no fim do scroll.
   * Use em modais, pickers e scrolls aninhados (o scroll da página já tem o footer).
   */
  hideLegalFooter?: boolean
}

export function MfScrollView ({
  hideHorizontalBar,
  hideLegalFooter = false,
  horizontal,
  style,
  contentContainerStyle,
  children,
  showsVerticalScrollIndicator,
  showsHorizontalScrollIndicator,
  ...props
}: Props) {
  const { theme } = useMfTheme()
  const isHorizontal = Boolean(horizontal)
  const showLegalFooter =
    Platform.OS === 'web' && !isHorizontal && !hideLegalFooter
  const webProps =
    Platform.OS === 'web'
      ? getWebScrollViewProps(theme, { horizontal: isHorizontal, hideHorizontalBar })
      : {}

  const indicatorProps = getWebScrollIndicatorProps({
    horizontal: isHorizontal,
    hideHorizontalBar,
    showsVerticalScrollIndicator,
    showsHorizontalScrollIndicator,
  })

  return (
    <ScrollView
      {...props}
      {...webProps}
      {...indicatorProps}
      horizontal={horizontal}
      style={[style, webProps.style]}
      contentContainerStyle={contentContainerStyle}
    >
      {children}
      {showLegalFooter ? (
        <AppLegalFooter style={{ marginTop: 32 }} />
      ) : null}
    </ScrollView>
  )
}
