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
