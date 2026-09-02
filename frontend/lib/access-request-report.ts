import { getMeiApiAuthHeaders, getMeiApiUrl } from './apiClient'
import { getMeiApiBaseUrl } from './runtimeEnv'
import { invokeManageAccessRequests } from './manage-access-requests'

export type AccessReportEntry = {
  id: string
  eventType: 'submitted' | 'approved'
  email: string | null
  fullName: string | null
  empresaNome: string | null
  cnpj: string | null
  observacao: string | null
  actorEmail: string | null
  occurredAt: string | null
  requestedAt: string | null
  approvedAt: string | null
}

type ReportResponse = {
  entries: AccessReportEntry[]
}

const REPORT_TIMEOUT_MS = 45_000

function isReportRouteMissing(message: string): boolean {
  return /cannot get.*access-requests\/report/i.test(message) || /\b404\b/.test(message)
}

async function fetchAccessReportViaApi(limit: number): Promise<AccessReportEntry[]> {
  const base = getMeiApiBaseUrl()
  if (!base) {
    throw new Error('API não configurada (EXPO_PUBLIC_MEI_API_URL).')
  }

  const url = getMeiApiUrl(`/admin/access-requests/report?limit=${limit}`)
  const headers = await getMeiApiAuthHeaders()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS)

  try {
    const response = await fetch(url, { method: 'GET', headers, signal: controller.signal })
    const contentType = response.headers.get('content-type') || ''

    if (!contentType.includes('application/json')) {
      const text = await response.text()
      throw new Error(text?.slice(0, 120) || `Erro HTTP ${response.status}`)
    }

    const payload = await response.json()
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || `Erro HTTP ${response.status}`)
    }

    const entries = (payload?.data as ReportResponse)?.entries
    return Array.isArray(entries) ? entries : []
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        'O histórico demorou demais. Reinicie o backend (`npm run dev` em Site/backend) e tente de novo.',
      )
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchAccessReportViaEdge(limit: number): Promise<AccessReportEntry[]> {
  const data = await invokeManageAccessRequests({ action: 'report', limit })
  const entries = (data as ReportResponse)?.entries
  return Array.isArray(entries) ? entries : []
}

/**
 * Histórico via API do backend (service role). Fallback: Edge.
 */
export async function fetchAccessReport(limit = 100): Promise<AccessReportEntry[]> {
  try {
    return await fetchAccessReportViaApi(limit)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!isReportRouteMissing(msg)) {
      throw err
    }
    try {
      return await fetchAccessReportViaEdge(limit)
    } catch (edgeErr) {
      const edgeMsg = edgeErr instanceof Error ? edgeErr.message : String(edgeErr)
      throw new Error(
        'Histórico indisponível. Confirme backend local (porta 3333) ou deploy da API. ' +
          `Detalhe: ${edgeMsg}`,
      )
    }
  }
}

export function isUnknownReportActionError(message: string): boolean {
  return /desconhecida:\s*report/i.test(message) || /cannot get.*report/i.test(message)
}
