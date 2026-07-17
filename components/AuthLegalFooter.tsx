import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LEGAL_PRIVACY_URL, LEGAL_TERMS_URL, openLegalUrl } from '@/lib/legalUrls';
import { useThemeStore } from '@/store/themeStore';
import { getAuthPalette } from '@/components/auth/authTokens';

/** Rodapé legal no login — texto centralizado, links inline. */
export function AuthLegalFooter() {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const palette = getAuthPalette(isDarkMode);
  const linkColor = palette.linkText;
  const textColor = palette.footerText;

  return (
    <View style={styles.wrap} accessibilityRole="text">
      <Text style={[styles.text, { color: textColor }]}>
        Ao clicar em Entrar, você concorda com nossa{' '}
        <Text
          style={[styles.link, { color: linkColor }]}
          onPress={() => openLegalUrl(LEGAL_PRIVACY_URL)}
          accessibilityRole="link"
        >
          Política de Privacidade
        </Text>
        {' e os '}
        <Text
          style={[styles.link, { color: linkColor }]}
          onPress={() => openLegalUrl(LEGAL_TERMS_URL)}
          accessibilityRole="link"
        >
          Termos de Uso
        </Text>
        .
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'center',
    marginTop: 8,
    ...(Platform.OS === 'web' ? ({ className: 'auth-legal-footer' } as object) : {}),
  },
  text: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '400',
  },
  link: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
