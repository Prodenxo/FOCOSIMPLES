import { apiClient } from '../lib/apiClient'

export type WhatsappAgentPref = {
  openclawEnabled: boolean
  engine: 'openclaw' | 'backend'
  backendReady: boolean
  phoneLinked: boolean
}

export function fetchWhatsappAgentPref() {
  return apiClient.get<WhatsappAgentPref>('/admin/whatsapp-agent-pref')
}

export function saveWhatsappAgentPref(openclawEnabled: boolean) {
  return apiClient.patch<WhatsappAgentPref>('/admin/whatsapp-agent-pref', {
    openclawEnabled,
  })
}

export function previewWhatsappBackendAgent(text: string) {
  return apiClient.post<{ reply: string; ok: boolean }>(
    '/admin/whatsapp-agent-pref/preview',
    { text },
  )
}

export type WhatsappAgentLogThread = {
  phone: string
  message_count: number
  last_at: string
  last_content: string
}

export type WhatsappAgentLogMessage = {
  id: string
  phone: string
  role: 'user' | 'assistant'
  content: string
  source: 'whatsapp' | 'preview'
  created_at: string
}

export function fetchWhatsappAgentLogThreads() {
  return apiClient.get<{ threads: WhatsappAgentLogThread[] }>(
    '/admin/whatsapp-agent-logs',
  )
}

export function fetchWhatsappAgentLogMessages(phone: string) {
  return apiClient.get<{ phone: string; messages: WhatsappAgentLogMessage[] }>(
    `/admin/whatsapp-agent-logs/${encodeURIComponent(phone)}`,
  )
}
