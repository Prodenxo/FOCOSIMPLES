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
  type OpenaiUsageByProvider,
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

const CHANNELS: {
  id: 'deepseek' | 'openai' | 'openclaw'
  title: string
  subtitle: string
}[] = [
  { id: 'deepseek', title: 'DeepSeek', subtitle: 'Robô do site' },
  { id: 'openai', title: 'OpenAI', subtitle: 'Transcrição de áudio' },
  { id: 'openclaw', title: 'OpenClaw', subtitle: 'Demais clientes' },
]

const formatBrl = (value: number) =>
  (Number(value) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const formatCompact = (value: number) => {
  const n = Number(value) || 0
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (n >= 10_000) return `${Math.round(n / 1000)} mil`
  return n.toLocaleString('pt-BR')
}

const formatPhone = (phone: string) => {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  }
  return digits || phone
}

const emptyProvider = (id: string): OpenaiUsageByProvider => ({
  provider: id,
  calls: 0,
  tokens: 0,
  audioSeconds: 0,
  costUsd: 0,
  costBrl: 0,
})

const channelDetail = (row: OpenaiUsageByProvider) => {
  if (row.calls <= 0) return 'Sem uso neste período'
  if (row.provider === 'openai' && row.audioSeconds > 0) {
    const mins = Math.max(1, Math.round(row.audioSeconds / 60))
    return `${mins} min de áudio · ${row.calls} ${row.calls === 1 ? 'chamada' : 'chamadas'}`
  }
  return `${formatCompact(row.tokens)} tokens · ${row.calls} ${row.calls === 1 ? 'chamada' : 'chamadas'}`
}

const buildChannels = (rows: OpenaiUsageByProvider[] | undefined) => {
  const map = new Map((rows ?? []).map((row) => [row.provider, row]))
  return CHANNELS.map(({ id }) => map.get(id) ?? emptyProvider(id))
}

export function OpenaiUsageModal ({ visible, onClose }: Props) {
  const { isDarkMode } = useMfTheme()
  const tokens = useMemo(() => getSiteTokens(isDarkMode), [isDarkMode])
  const styles = useMemo(() => createStyles(tokens, isDarkMode), [tokens, isDarkMode])
  const [period, setPeriod] = useState<OpenaiUsagePeriod>('month')
  const [data, setData] = useState<OpenaiUsageDashboard | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showUsers, setShowUsers] = useState(false)

  useEffect(() => {
    if (!visible) {
      setError('')
      setShowUsers(false)
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

  const channels = useMemo(() => buildChannels(data?.byProvider), [data?.byProvider])
  const topUsers = useMemo(() => (data?.byUser ?? []).slice(0, 8), [data?.byUser])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Gasto do robô</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar">
              <Ionicons name="close" size={22} color={tokens.textSecondary} />
            </TouchableOpacity>
          </View>

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
          {loading && !data ? <Text style={styles.muted}>Carregando…</Text> : null}

          {data ? (
            <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
              <View style={styles.hero}>
                <Text style={styles.heroValue}>{formatBrl(data.totals.costBrl)}</Text>
                <Text style={styles.heroMeta}>
                  {data.totals.calls} chamadas · câmbio {formatBrl(data.usdBrl)}/US$
                </Text>
              </View>

              <Text style={styles.sectionTitle}>Onde foi o gasto</Text>
              {channels.map((row) => {
                const meta = CHANNELS.find((c) => c.id === row.provider)
                const active = row.costBrl > 0 || row.calls > 0
                return (
                  <View
                    key={row.provider}
                    style={[styles.channelCard, !active ? styles.channelCardMuted : null]}
                  >
                    <View style={styles.channelTop}>
                      <View style={styles.channelText}>
                        <Text style={styles.channelTitle}>{meta?.title ?? row.provider}</Text>
                        <Text style={styles.channelSubtitle}>{meta?.subtitle}</Text>
                      </View>
                      <Text style={[styles.channelCost, !active ? styles.channelCostMuted : null]}>
                        {formatBrl(row.costBrl)}
                      </Text>
                    </View>
                    <Text style={styles.channelDetail}>{channelDetail(row)}</Text>
                  </View>
                )
              })}

              {topUsers.length > 0 ? (
                <>
                  <TouchableOpacity
                    style={styles.expandRow}
                    onPress={() => setShowUsers((v) => !v)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.sectionTitleInline}>
                      Quem mais usou ({topUsers.length})
                    </Text>
                    <Ionicons
                      name={showUsers ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={tokens.textSecondary}
                    />
                  </TouchableOpacity>
                  {showUsers ? topUsers.map((row) => (
                    <View key={`${row.phone}-${row.userId || 'x'}`} style={styles.userRow}>
                      <View style={styles.userText}>
                        <Text style={styles.userName} numberOfLines={1}>{row.label}</Text>
                        <Text style={styles.userPhone} numberOfLines={1}>
                          {formatPhone(row.phone)}
                        </Text>
                      </View>
                      <Text style={styles.userCost}>{formatBrl(row.costBrl)}</Text>
                    </View>
                  )) : null}
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
      maxWidth: 480,
      maxHeight: '88%',
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
      marginBottom: 12,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: tokens.textPrimary,
    },
    periods: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    chip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 9,
      borderRadius: mfRadius.md,
      borderWidth: 1,
      borderColor: tokens.inputBorder,
      backgroundColor: tokens.inputBg,
    },
    chipActive: {
      borderColor: tokens.textPrimary,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
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
    muted: {
      fontSize: 13,
      color: tokens.textSecondary,
    },
    body: {
      maxHeight: 480,
    },
    hero: {
      alignItems: 'center',
      paddingVertical: 18,
      marginBottom: 16,
      borderRadius: mfRadius.lg,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
      borderWidth: 1,
      borderColor: tokens.divider,
    },
    heroValue: {
      fontSize: 34,
      fontWeight: '800',
      color: tokens.textPrimary,
      letterSpacing: -0.5,
    },
    heroMeta: {
      fontSize: 13,
      color: tokens.textSecondary,
      marginTop: 6,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: tokens.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 10,
    },
    sectionTitleInline: {
      fontSize: 14,
      fontWeight: '700',
      color: tokens.textPrimary,
    },
    channelCard: {
      padding: 14,
      borderRadius: mfRadius.md,
      borderWidth: 1,
      borderColor: tokens.divider,
      backgroundColor: tokens.inputBg,
      marginBottom: 8,
    },
    channelCardMuted: {
      opacity: 0.72,
    },
    channelTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    channelText: {
      flex: 1,
    },
    channelTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: tokens.textPrimary,
    },
    channelSubtitle: {
      fontSize: 12,
      color: tokens.textSecondary,
      marginTop: 2,
    },
    channelCost: {
      fontSize: 15,
      fontWeight: '700',
      color: tokens.textPrimary,
    },
    channelCostMuted: {
      color: tokens.textSecondary,
    },
    channelDetail: {
      fontSize: 12,
      color: tokens.textSecondary,
      marginTop: 8,
    },
    expandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
      marginBottom: 8,
      paddingVertical: 4,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.divider,
    },
    userText: {
      flex: 1,
    },
    userName: {
      fontSize: 14,
      fontWeight: '600',
      color: tokens.textPrimary,
    },
    userPhone: {
      fontSize: 12,
      color: tokens.textSecondary,
      marginTop: 2,
    },
    userCost: {
      fontSize: 14,
      fontWeight: '600',
      color: tokens.textPrimary,
    },
    note: {
      fontSize: 11,
      lineHeight: 16,
      color: tokens.textSecondary,
      marginTop: 14,
      textAlign: 'center',
    },
  })
}
