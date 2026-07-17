import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LEGAL_PRIVACY_URL, LEGAL_TERMS_URL, openLegalUrl } from '@/lib/legalUrls';

type LegalLinksProps = {
  style?: object;
};

export function LegalLinks({ style }: LegalLinksProps) {
  return (
    <View style={[styles.row, style]}>
      <TouchableOpacity onPress={() => openLegalUrl(LEGAL_PRIVACY_URL)}>
        <Text style={styles.link}>Política de Privacidade</Text>
      </TouchableOpacity>
      <Text style={styles.sep}> · </Text>
      <TouchableOpacity onPress={() => openLegalUrl(LEGAL_TERMS_URL)}>
        <Text style={styles.link}>Termos de Uso</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 20,
  },
  link: { color: '#2563EB', fontSize: 12, fontWeight: '600' },
  sep: { color: '#9CA3AF', fontSize: 12 },
});
