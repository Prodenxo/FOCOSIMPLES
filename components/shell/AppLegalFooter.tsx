import React from 'react'
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { APP_BRAND_NAME } from '@/lib/appBrand'
import { brandColors } from '@/lib/brandTokens'
import { AppBrandLogo } from '@/components/shell/AppBrandLogo'
import { LegalWebLink } from '@/components/LegalWebLink'

type Props = {
  /** Estilo extra no container (ex.: marginTop no fim do scroll). */
  style?: StyleProp<ViewStyle>
}

/**
 * Rodapé legal estilo landing (azul marca + wordmark + links + ©).
 * Só web. Fica no fim do conteúdo (fluxo do scroll) — não fixed/sticky.
 */
export function AppLegalFooter ({ style }: Props) {
  if (Platform.OS !== 'web') return null

  return (
    <View
      accessibilityRole="contentinfo"
      style={[styles.root, style]}
    >
      <View style={styles.inner}>
        <AppBrandLogo variant="wordmark" onDarkBackground height={44} />
        <View style={styles.links}>
          <LegalWebLink
            href="/privacidade"
            label="Política de Privacidade"
            textStyle={styles.link}
          />
          <Text style={styles.sep}>·</Text>
          <LegalWebLink
            href="/termos"
            label="Termos de Uso"
            textStyle={styles.link}
          />
        </View>
      </View>
      <View style={styles.bottom}>
        <Text style={styles.copyright}>
          © 2026 {APP_BRAND_NAME}. Todos os direitos reservados.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    backgroundColor: brandColors.primary,
    paddingTop: 48,
    paddingBottom: 28,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  inner: {
    alignItems: 'center',
    gap: 24,
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  link: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.62)',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  sep: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.28)',
    fontWeight: '400',
  },
  bottom: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
  copyright: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    fontWeight: '400',
  },
})
