import React from 'react'
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { NfseRecord } from '../services/meiNotasService'
import {
  extractNfseFailureMessage,
  formatNfseFailureAlertTitle,
  notaFiscalExibeMotivoFalha,
} from '../lib/meiFormatters'

type Props = {
  nota: NfseRecord
  errorColor: string
}

export function showNfseFailureAlert(nota: Pick<NfseRecord, 'status' | 'response_json' | 'metadata_json'>) {
  const failureMessage = extractNfseFailureMessage(nota.response_json, nota.metadata_json)
  Alert.alert(
    formatNfseFailureAlertTitle(nota.status),
    failureMessage
      || 'O motivo não foi salvo nesta nota. Use «Atualizar status» para consultar o emissor.',
    [{ text: 'OK' }],
  )
}

export function NotaFiscalFailureBanner({ nota, errorColor }: Props) {
  if (!notaFiscalExibeMotivoFalha(nota.status)) return null

  const preview = extractNfseFailureMessage(nota.response_json, nota.metadata_json)

  return (
    <Pressable
      onPress={() => showNfseFailureAlert(nota)}
      style={({ pressed }) => [styles.banner, pressed && styles.bannerPressed]}
      accessibilityRole="button"
      accessibilityLabel="Ver motivo da rejeição"
    >
      <Ionicons name="alert-circle" size={18} color={errorColor} />
      <View style={styles.textCol}>
        <Text style={[styles.title, { color: errorColor }]}>Ver motivo da rejeição</Text>
        {preview ? (
          <Text style={styles.preview} numberOfLines={2}>
            {preview}
          </Text>
        ) : (
          <Text style={styles.preview} numberOfLines={1}>
            Toque para ver o detalhe retornado pela prefeitura
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={errorColor} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  bannerPressed: {
    opacity: 0.9,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
  },
  preview: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(148, 163, 184, 0.95)',
  },
})
