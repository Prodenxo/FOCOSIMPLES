import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { LegalWebLink } from './LegalWebLink';
import { brandColors } from '@/lib/brandTokens';

type Props = {
  /** Links sobre fundo escuro (hero). */
  variant?: 'dark' | 'light';
};

/**
 * Faixa visível na homepage para requisitos OAuth do Google (link à Política de Privacidade).
 */
export function LegalHomepageStrip({ variant = 'light' }: Props) {
  const linkColor =
    variant === 'dark' ? 'rgba(255,255,255,0.55)' : brandColors.secondary;
  const mutedColor =
    variant === 'dark' ? 'rgba(255,255,255,0.35)' : '#5C6670';

  if (Platform.OS === 'web') {
    return (
      <nav
        aria-label="Informações legais"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'flex-start',
          alignItems: 'center',
          gap: 8,
          marginTop: 20,
          fontSize: 13,
          color: mutedColor,
        }}
      >
        <LegalWebLink href="/privacidade" label="Política de Privacidade" textStyle={{ color: linkColor }} />
        <span aria-hidden="true">·</span>
        <LegalWebLink href="/termos" label="Termos de Uso" textStyle={{ color: linkColor }} />
      </nav>
    );
  }

  return (
    <View style={styles.nativeRow}>
      <LegalWebLink href="/privacidade" label="Política de Privacidade" textStyle={{ color: linkColor }} />
      <LegalWebLink href="/termos" label="Termos de Uso" textStyle={{ color: linkColor }} />
    </View>
  );
}

const styles = StyleSheet.create({
  nativeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20 },
});
