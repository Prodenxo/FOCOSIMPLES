import React, { useEffect, useMemo, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getSiteTokens } from '../../lib/siteDesign'
import { mfRadius, mfSpacing } from '../../lib/theme'
import { useMfTheme } from '../ui/useMfTheme'
import {
  fetchOpenaiUsage,
  type OpenaiUsageDashboard,
  type OpenaiUsagePeriod,
} from '../../services/openaiUsageService'

type Props = {
  visible: boolean
  onClose: () => void
}

const PERIODS: { id: OpenaiUsagePeriod; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: '7d', label: '7 dias' },
  { id: 'month', label: 'Este mês' },
]

const formatBrl = (value: number) =>
  (Number(value) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const formatTokens = (value: number) =>
  (Number(value) || 0).toLocaleString('pt-BR')

const formatPhone = (phone: string) => {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) {
    return `+55 ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`
  }
  return digits || phone
}

const sourceLabel = (source: string) => {
  if (source === 'preview') return 'Teste na tela'
  if (source === 'transcription') return 'Áudio (OpenAI)'
  if (source === 'openclaw') return 'OpenClaw (clientes)'
  return 'Robô site (DeepSeek)'
}

const providerLabel = (provider: string) => {
  if (provider === 'deepseek') return 'DeepSeek'
  if (provider === 'openclaw') return 'OpenClaw'
  return 'OpenAI'
}

const formatWhen = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function OpenaiUsageModal ({ visible, onClose }: Props) {
  const { isDarkMode } = useMfTheme()
  const tokens = useMemo(() => getSiteTokens(isDarkMode), [isDarkMode])
  const styles = useMemo(() => createStyles(tokens, isDarkMode), [tokens, isDarkMode])
  const [period, setPeriod] = useState<OpenaiUsagePeriod>('month')
  const [data, setData] = useState<OpenaiUsageDashboard | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) {
      setError('')
      return
    }
    let cancelled = false
    setLoading(true)
    void fetchOpenaiUsage(period)
      .then((dashboard) => {
        if (!cancelled) setData(dashboard)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Não deu para carregar o gasto.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [visible, period])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Gasto do robô (IA)</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar">
              <Ionicons name="close" size={22} color={tokens.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            DeepSeek (robô do site), OpenAI (áudio) e OpenClaw (demais clientes). Só você vê isso.
          </Text>

          <View style={styles.periods}>
            {PERIODS.map((item) => {
              const active = period === item.id
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.chip, active ? styles.chipActive : null]}
                  onPress={() => setPeriod(item.id)}
                >
                  <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {loading && !data ? <Text style={styles.hint}>Carregando…</Text> : null}

          {data ? (
            <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
              <View style={styles.hero}>
                <Text style={styles.heroLabel}>Estimativa em real</Text>
                <Text style={styles.heroValue}>{formatBrl(data.totals.costBrl)}</Text>
                <Text style={styles.heroMeta}>
                  {formatTokens(data.totals.totalTokens)} tokens · {data.totals.calls} chamadas
                </Text>
                <Text style={styles.heroMeta}>
                  US$ {data.totals.costUsd.toFixed(4)} · 1 dólar ≈ {formatBrl(data.usdBrl)}
                </Text>
              </View>

              {(data.byProvider?.length ?? 0) > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Por provedor</Text>
                  {(data.byProvider ?? []).map((row) => (
                    <View key={row.provider} style={styles.row}>
                      <Text style={styles.rowTitle}>{providerLabel(row.provider)}</Text>
                      <Text style={styles.rowMeta}>
                        {formatTokens(row.tokens)} tokens · {formatBrl(row.costBrl)}
                      </Text>
                    </View>
                  ))}
                </>
              ) : null}

              {data.bySource.length > 0 ? (
                <Text style={styles.sectionTitle}>Por tipo</Text>
              ) : null}
              {data.bySource.map((row) => (
                <View key={row.source} style={styles.row}>
                  <Text style={styles.rowTitle}>{sourceLabel(row.source)}</Text>
                  <Text style={styles.rowMeta}>
                    {formatTokens(row.tokens)} tokens · {formatBrl(row.costBrl)}
                  </Text>
                </View>
              ))}

              <Text style={styles.sectionTitle}>Por pessoa</Text>
              {data.byUser.length === 0 ? (
                <Text style={styles.hint}>
                  Nenhuma conversa do robô do site neste período.
                </Text>
              ) : (
                data.byUser.map((row) => (
                  <View key={`${row.phone}-${row.userId || 'x'}`} style={styles.row}>
                    <Text style={styles.rowTitle}>{row.label}</Text>
                    <Text style={styles.rowMeta}>
                      {formatPhone(row.phone)} · {formatTokens(row.tokens)} tokens · {formatBrl(row.costBrl)}
                    </Text>
                  </View>
                ))
              )}

              {(data.recentLogs?.length ?? 0) > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Chamadas recentes</Text>
                  {(data.recentLogs ?? []).map((row, index) => (
                    <View key={`${row.createdAt}-${row.source}-${index}`} style={styles.row}>
                      <Text style={styles.rowTitle}>
                        {formatWhen(row.createdAt)} · {sourceLabel(row.source)}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {row.phone ? `${formatPhone(row.phone)} · ` : ''}
                        {formatTokens(row.tokens)} tokens · {formatBrl(row.costBrl)}
                      </Text>
                    </View>
                  ))}
                </>
              ) : null}

              <Text style={styles.note}>{data.note}</Text>
            </ScrollView>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function createStyles (
  tokens: ReturnType<typeof getSiteTokens>,
  isDarkMode: boolean,
) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: isDarkMode ? 'rgba(0,0,0,0.72)' : 'rgba(15,23,42,0.45)',
      justifyContent: 'center',
      padding: mfSpacing.lg,
    },
    sheet: {
      width: '100%',
      maxWidth: 520,
      maxHeight: '86%',
      alignSelf: 'center',
      backgroundColor: tokens.panelBg,
      borderRadius: mfRadius.xl,
      borderWidth: 1,
      borderColor: tokens.panelBorder,
      padding: mfSpacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: tokens.textPrimary,
    },
    hint: {
      fontSize: 13,
      lineHeight: 18,
      color: tokens.textSecondary,
      marginBottom: 10,
    },
    periods: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: mfRadius.md,
      borderWidth: 1,
      borderColor: tokens.inputBorder,
      backgroundColor: tokens.inputBg,
    },
    chipActive: {
      borderColor: tokens.textPrimary,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: tokens.textSecondary,
    },
    chipTextActive: {
      color: tokens.textPrimary,
    },
    error: {
      marginBottom: 8,
      color: '#DC2626',
      fontSize: 13,
    },
    body: {
      maxHeight: 420,
    },
    hero: {
      padding: 14,
      borderRadius: mfRadius.md,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : tokens.inputBg,
      marginBottom: 14,
    },
    heroLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: tokens.textSecondary,
    },
    heroValue: {
      fontSize: 28,
      fontWeight: '700',
      color: tokens.textPrimary,
      marginTop: 4,
    },
    heroMeta: {
      fontSize: 13,
      color: tokens.textSecondary,
      marginTop: 4,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: tokens.textPrimary,
      marginBottom: 8,
      marginTop: 4,
    },
    row: {
      marginBottom: 10,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.divider,
    },
    rowTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: tokens.textPrimary,
    },
    rowMeta: {
      fontSize: 12,
      color: tokens.textSecondary,
      marginTop: 2,
    },
    note: {
      fontSize: 12,
      lineHeight: 17,
      color: tokens.textSecondary,
      marginTop: 8,
      marginBottom: 4,
    },
  })
}
