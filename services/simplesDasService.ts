import { apiClient } from '../lib/apiClient'
import type { MeiPeriod } from './guidesMeiService'

export interface SimplesDasIntegrationStatus {
  product: string
  configured: boolean
  missing: string[]
  portalUrl: string
  message: string | null
}

export interface SimplesDasPeriodsResponse {
  cnpj: string
  integration: SimplesDasIntegrationStatus
  periods: MeiPeriod[]
  remoteError?: string | null
  portalUrl: string
}

export interface SimplesDasGuideResponse {
  id: string
  status: string
  competencia?: string
  periodoApuracao?: string
  pdfBase64?: string | null
  filename?: string | null
  numeroDocumento?: string | null
  valorTotal?: number | null
}

export async function fetchSimplesDasStatus (): Promise<SimplesDasIntegrationStatus> {
  return apiClient.get('/simples-das/status')
}

export async function fetchSimplesDasPeriods (options?: {
  cnpj?: string
  ano?: number
  refresh?: boolean
}): Promise<SimplesDasPeriodsResponse> {
  const params = new URLSearchParams()
  if (options?.cnpj) params.set('cnpj', options.cnpj)
  if (options?.ano) params.set('ano', String(options.ano))
  if (options?.refresh) params.set('refresh', 'true')
  const qs = params.toString()
  return apiClient.get(`/simples-das/periods${qs ? `?${qs}` : ''}`)
}

export async function gerarSimplesDas (input: {
  cnpj?: string
  periodoApuracao: string
  dataConsolidacao?: string
}): Promise<SimplesDasGuideResponse> {
  return apiClient.post('/simples-das/gerar', input)
}

export async function downloadSimplesDas (
  idOrPeriodo: string,
  options?: { regenerate?: boolean },
): Promise<SimplesDasGuideResponse> {
  const qs = options?.regenerate ? '?regenerate=true' : ''
  return apiClient.get(`/simples-das/${encodeURIComponent(idOrPeriodo)}/download${qs}`)
}

export async function fetchSimplesDasFaturamento (periodoApuracao: string) {
  const params = new URLSearchParams({ periodo: periodoApuracao })
  return apiClient.get(`/simples-das/faturamento?${params.toString()}`)
}

export async function declararSimplesDas (input: {
  confirm: true
  periodoApuracao: string
  cnpj?: string
  valorReceitaInterna?: number
  declaracao?: Record<string, unknown>
}) {
  return apiClient.post('/simples-das/declarar', input)
}

export const SIMPLES_DAS_PORTAL_FALLBACK =
  'https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATBHE/pgdasd.app/Identificacao'
