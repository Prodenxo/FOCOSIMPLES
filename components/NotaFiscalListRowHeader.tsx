import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import {
  formatDateTime,
  formatNfseStatus,
  getNfseStatusBadgeBackground,
  getNfseStatusBadgeColor,
  getNfseStatusKey,
  meiFiscalDocumentTypeShortLabel,
  resolveNfseDisplayStatus,
} from '../lib/meiFormatters'
import type { NfseRecord } from '../services/meiNotasService'

interface NotaFiscalListRowHeaderProps {
  nota: Pick<
    NfseRecord,
    'id' | 'status' | 'response_json' | 'document_type' | 'created_at' | 'protocol' | 'plugnotas_id' | 'id_integracao'
  >
  textColor: string
  textSecondary: string
}

function AdminBadge ({
  label,
  color,
  backgroundColor,
}: {
  label: string
  color: string
  backgroundColor: string
}) {
  return (
    <View style={[styles.badge, { backgroundColor, borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  )
}

export function NotaFiscalListRowHeader ({ nota, textColor, textSecondary }: NotaFiscalListRowHeaderProps) {
  const resolvedStatus = resolveNfseDisplayStatus(nota)
  const statusLabel = formatNfseStatus(resolvedStatus)
  const statusColor = getNfseStatusBadgeColor(resolvedStatus)
  const statusBg = getNfseStatusBadgeBackground(resolvedStatus)
  const isPending = nota.id === '__emit_pending__'
  const title = isPending
    ? 'Enviando nota…'
    : (nota.id_integracao || nota.plugnotas_id || nota.protocol || nota.id)
  const docLabel = meiFiscalDocumentTypeShortLabel(nota.document_type)

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.meta, { color: textSecondary }]}>
          Emitida em {formatDateTime(nota.created_at)}
          {nota.protocol ? ` • Protocolo ${nota.protocol}` : ''}
        </Text>
      </View>
      <View style={styles.badges}>
        <AdminBadge
          label={docLabel}
          color="#475569"
          backgroundColor="rgba(100, 116, 139, 0.16)"
        />
        <AdminBadge
          label={statusLabel}
          color={statusColor}
          backgroundColor={statusBg}
        />
      </View>
    </View>
  )
}

export function getNotaCardAccentColor (nota: Pick<NfseRecord, 'status' | 'response_json'>) {
  return getNfseStatusBadgeColor(resolveNfseDisplayStatus(nota))
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  left: {
    flex: 1,
    minWidth: 0,
    flexBasis: '58%',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    flexShrink: 0,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
})
