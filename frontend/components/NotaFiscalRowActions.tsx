import React from 'react'
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { NfseRecord } from '../services/meiNotasService'
import { notaFiscalPodeSincronizarEstadoEmissor } from '../services/meiNotasService'
import {
  getNfseStatusKey,
  notaFiscalExibeMotivoFalha,
} from '../lib/meiFormatters'
import { showNfseFailureAlert } from './NotaFiscalFailureBanner'

export type NotaFiscalRowActionsProps = {
  nota: NfseRecord
  notaActionId: string | null
  theme: {
    primary: string
    error: string
    textSecondary: string
    border?: string
  }
  layout: 'table' | 'card'
  onSync: () => void
  onEdit: () => void
  onPdf: () => void
  onXml: () => void
  onCancel: () => void
  onArchive: () => void
}

type ActionDef = {
  key: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  hint: string
  color: string
  onPress: () => void
  disabled: boolean
  loading?: boolean
  destructive?: boolean
}

export function NotaFiscalRowActions ({
  nota,
  notaActionId,
  theme,
  layout,
  onSync,
  onEdit,
  onPdf,
  onXml,
  onCancel,
  onArchive,
}: NotaFiscalRowActionsProps) {
  const busy = notaActionId === nota.id
  const podeSync = notaFiscalPodeSincronizarEstadoEmissor(nota)
  const statusKey = getNfseStatusKey(nota.status)
  const processando = statusKey === 'processando' || statusKey === 'aguardando'
  const cancelDisabled = busy || statusKey === 'cancelado'
  const showFailureReason = notaFiscalExibeMotivoFalha(nota.status)

  const actions: ActionDef[] = [
    ...(showFailureReason
      ? [{
          key: 'reason',
          icon: 'alert-circle-outline' as const,
          label: 'Ver motivo',
          hint: 'Por que a prefeitura rejeitou ou interrompeu esta nota',
          color: theme.error,
          onPress: () => showNfseFailureAlert(nota),
          disabled: busy,
          destructive: true,
        }]
      : []),
    {
      key: 'sync',
      icon: 'refresh-outline',
      label: busy && podeSync ? 'Atualizando…' : 'Atualizar status',
      hint: podeSync
        ? 'Consultar situação da nota na Receita / emissor'
        : 'Não dá para atualizar: falta identificador no emissor',
      color: podeSync ? theme.primary : theme.textSecondary,
      onPress: onSync,
      disabled: !podeSync || busy,
      loading: busy && podeSync,
    },
    {
      key: 'pdf',
      icon: 'document-text-outline',
      label: busy ? 'Baixando…' : 'Baixar PDF',
      hint: 'Salvar o PDF da nota no dispositivo',
      color: theme.primary,
      onPress: onPdf,
      disabled: busy || processando,
      loading: busy,
    },
    {
      key: 'xml',
      icon: 'code-slash-outline',
      label: 'Baixar XML',
      hint: 'Salvar o arquivo XML da nota',
      color: '#059669',
      onPress: onXml,
      disabled: busy || processando,
    },
    {
      key: 'edit',
      icon: 'pencil-outline',
      label: 'Editar nota',
      hint: 'Alterar observação interna da nota',
      color: theme.primary,
      onPress: onEdit,
      disabled: busy,
    },
    {
      key: 'cancel',
      icon: 'close-circle-outline',
      label: statusKey === 'cancelamento_pendente' ? 'Reenviar cancelamento' : 'Cancelar nota',
      hint:
        statusKey === 'cancelamento_pendente'
          ? 'Tentar cancelar de novo no emissor'
          : 'Pedir cancelamento da nota no emissor',
      color: theme.error,
      onPress: onCancel,
      disabled: cancelDisabled,
      destructive: true,
    },
    {
      key: 'archive',
      icon: 'archive-outline',
      label: 'Arquivar',
      hint: 'Tirar da lista principal (não apaga a nota)',
      color: theme.textSecondary,
      onPress: onArchive,
      disabled: busy,
    },
  ]

  return (
    <View style={[styles.wrap, layout === 'card' && styles.wrapCard]}>
      {layout === 'card' ? (
        <Text style={styles.sectionLabel}>O que fazer com esta nota</Text>
      ) : null}
      <View style={styles.pillRow}>
        {actions.map((action) => (
          <LabeledAction key={action.key} action={action} layout={layout} />
        ))}
      </View>
    </View>
  )
}

function LabeledAction ({
  action,
  layout,
}: {
  action: ActionDef
  layout: 'table' | 'card'
}) {
  return (
    <Pressable
      onPress={action.onPress}
      disabled={action.disabled || action.loading}
      style={({ pressed }) => [
        styles.pill,
        layout === 'card' && styles.pillCard,
        action.destructive && styles.pillDestructive,
        (action.disabled || action.loading) && styles.pillDisabled,
        pressed && !action.disabled && styles.pillPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${action.label}. ${action.hint}`}
      accessibilityState={{ disabled: action.disabled || action.loading }}
    >
      {action.loading ? (
        <ActivityIndicator size="small" color={action.color} />
      ) : (
        <Ionicons name={action.icon} size={15} color={action.color} />
      )}
      <Text
        style={[
          styles.pillLabel,
          { color: action.color },
          action.disabled && styles.pillLabelDisabled,
        ]}
        numberOfLines={1}
      >
        {action.label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  wrapCard: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.35)',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(148, 163, 184, 0.95)',
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.45)',
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    minHeight: 34,
  },
  pillCard: {
    flexGrow: 0,
    flexShrink: 1,
  },
  pillDestructive: {
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
  },
  pillDisabled: {
    opacity: 0.45,
  },
  pillPressed: {
    opacity: 0.88,
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  pillLabelDisabled: {
    opacity: 0.8,
  },
})
