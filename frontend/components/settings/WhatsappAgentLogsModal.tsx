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
  fetchWhatsappAgentLogMessages,
  fetchWhatsappAgentLogThreads,
  type WhatsappAgentLogMessage,
  type WhatsappAgentLogThread,
} from '../../services/whatsappAgentPrefService'

type Props = {
  visible: boolean
  onClose: () => void
}

function formatWhatsappLogPhone (phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) {
    return `+55 ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`
  }
  return digits || phone
}

export function WhatsappAgentLogsModal ({ visible, onClose }: Props) {
  const { isDarkMode } = useMfTheme()
  const tokens = useMemo(() => getSiteTokens(isDarkMode), [isDarkMode])
  const styles = useMemo(() => createStyles(tokens, isDarkMode), [tokens, isDarkMode])
  const [threads, setThreads] = useState<WhatsappAgentLogThread[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [messages, setMessages] = useState<WhatsappAgentLogMessage[]>([])
  const [loadingThreads, setLoadingThreads] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) {
      setPickerOpen(false)
      setSelectedPhone(null)
      setMessages([])
      setError('')
      return
    }
    let cancelled = false
    setLoadingThreads(true)
    void fetchWhatsappAgentLogThreads()
      .then((data) => {
        if (!cancelled) setThreads(data.threads || [])
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Não deu para carregar os números.')
      })
      .finally(() => {
        if (!cancelled) setLoadingThreads(false)
      })
    return () => {
      cancelled = true
    }
  }, [visible])

  const selectPhone = async (phone: string) => {
    setSelectedPhone(phone)
    setPickerOpen(false)
    setLoadingMessages(true)
    setError('')
    try {
      const detail = await fetchWhatsappAgentLogMessages(phone)
      setMessages(detail.messages || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu para abrir a conversa.')
      setMessages([])
    } finally {
      setLoadingMessages(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Logs do robô</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Fechar">
              <Ionicons name="close" size={22} color={tokens.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            Escolha o número. Só entra conversa do robô do site.
          </Text>

          <TouchableOpacity
            style={styles.select}
            onPress={() => setPickerOpen((open) => !open)}
          >
            <Text style={styles.selectText}>
              {selectedPhone
                ? formatWhatsappLogPhone(selectedPhone)
                : loadingThreads
                  ? 'Carregando números…'
                  : threads.length
                    ? 'Selecionar número'
                    : 'Nenhuma conversa ainda'}
            </Text>
            <Ionicons
              name={pickerOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={tokens.textSecondary}
            />
          </TouchableOpacity>

          {pickerOpen ? (
            <ScrollView style={styles.dropdown} keyboardShouldPersistTaps="handled">
              {threads.map((thread) => (
                <TouchableOpacity
                  key={thread.phone}
                  style={styles.option}
                  onPress={() => void selectPhone(thread.phone)}
                >
                  <Text style={styles.optionTitle}>{formatWhatsappLogPhone(thread.phone)}</Text>
                  <Text style={styles.optionHint} numberOfLines={1}>
                    {thread.message_count} msgs
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {loadingMessages ? (
            <Text style={styles.hint}>Abrindo conversa…</Text>
          ) : null}

          {selectedPhone && !loadingMessages ? (
            <ScrollView style={styles.chat} keyboardShouldPersistTaps="handled">
              {messages.length === 0 ? (
                <Text style={styles.hint}>Sem mensagens neste número.</Text>
              ) : (
                messages.map((msg) => (
                  <View key={msg.id} style={styles.bubble}>
                    <Text style={styles.meta}>
                      {msg.role === 'user' ? 'Cliente' : 'Robô'}
                      {msg.source === 'preview' ? ' · teste na tela' : ''}
                    </Text>
                    <Text style={styles.body}>{msg.content}</Text>
                  </View>
                ))
              )}
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
    select: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: tokens.inputBorder,
      backgroundColor: tokens.inputBg,
      borderRadius: mfRadius.md,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    selectText: {
      fontSize: 14,
      fontWeight: '600',
      color: tokens.textPrimary,
    },
    dropdown: {
      maxHeight: 180,
      marginTop: 6,
      borderWidth: 1,
      borderColor: tokens.inputBorder,
      borderRadius: mfRadius.md,
      backgroundColor: tokens.inputBg,
    },
    option: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.divider,
    },
    optionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: tokens.textPrimary,
    },
    optionHint: {
      fontSize: 12,
      color: tokens.textSecondary,
      marginTop: 2,
    },
    error: {
      marginTop: 10,
      color: '#DC2626',
      fontSize: 13,
    },
    chat: {
      marginTop: 12,
      maxHeight: 360,
    },
    bubble: {
      marginBottom: 8,
      padding: 10,
      borderRadius: mfRadius.md,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : tokens.inputBg,
    },
    meta: {
      fontSize: 11,
      fontWeight: '600',
      color: tokens.textSecondary,
      marginBottom: 4,
    },
    body: {
      fontSize: 14,
      lineHeight: 20,
      color: tokens.textPrimary,
    },
  })
}
