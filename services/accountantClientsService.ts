import Constants from 'expo-constants'
import { getMeiApiAuthHeaders } from '@/lib/apiClient'
import { getMeiApiBaseUrl } from '@/lib/runtimeEnv'
import type { NfseCatalogProduto } from '@/services/meiNotasService'

export type AccountantClient = {
  empresaId: string
  establishmentId?: string
  clientKey?: string
  emitterUserId?: string | null
  label?: string | null
  razaoSocial: string | null
  nomeFantasia: string | null
  cpfCnpj: string | null
  crt?: number | null
  status: string | null
}

export type AccountantEstablishment = {
  establishmentId: string
  label: string
  issuerUf: string | null
  source: 'company_fiscal_profile'
}

export type AccountantEstablishmentsResponse = {
  establishments: AccountantEstablishment[]
  status: 'OK' | 'NO_FISCAL_ESTABLISHMENT'
}

function resolveApiUrl(): string {
  return (getMeiApiBaseUrl() || Constants.expoConfig?.extra?.meiApiUrl || '').replace(/\/$/, '')
}

async function accountantRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const apiUrl = resolveApiUrl()
  if (!apiUrl) throw new Error('MEI API não configurada.')

  const headers = await getMeiApiAuthHeaders(
    options.body && !(options.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : undefined,
  )

  const response = await fetch(`${apiUrl}/api${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    cache: 'no-store',
    headers: { ...headers, ...(options.headers ?? {}) },
  })

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : null

  if (!response.ok) {
    const message = String(payload?.message ?? payload?.code ?? response.statusText ?? 'Falha na requisição.')
    throw new Error(message)
  }

  return payload as T
}

export async function listAccountantClients(): Promise<AccountantClient[]> {
  const res = await accountantRequest<{ clients: AccountantClient[] }>('/accountant/clients')
  return res.clients ?? []
}

export async function listAccountantClientProducts(
  empresaId: string,
  query: { q?: string; limit?: number; documentType?: string; emitterUserId?: string | null } = {},
): Promise<NfseCatalogProduto[]> {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.limit) params.set('limit', String(query.limit))
  if (query.documentType) params.set('documentType', query.documentType)
  if (query.emitterUserId) params.set('emitterUserId', query.emitterUserId)
  const qs = params.toString()
  const res = await accountantRequest<{ products: NfseCatalogProduto[] }>(
    `/accountant/clients/${encodeURIComponent(empresaId)}/products${qs ? `?${qs}` : ''}`,
  )
  return res.products ?? []
}

export async function createAccountantClientProduct(
  empresaId: string,
  body: {
    discriminacao: string
    codigo?: string
    documentType?: string
    valor_sugerido?: number | null
    metadata_json?: Record<string, unknown> | null
  },
  options: { emitterUserId?: string | null } = {},
): Promise<NfseCatalogProduto> {
  const params = new URLSearchParams()
  if (options.emitterUserId) params.set('emitterUserId', options.emitterUserId)
  const qs = params.toString()
  const res = await accountantRequest<{ product: NfseCatalogProduto }>(
    `/accountant/clients/${encodeURIComponent(empresaId)}/products${qs ? `?${qs}` : ''}`,
    { method: 'POST', body: JSON.stringify(body) },
  )
  return res.product
}

export async function updateAccountantClientProduct(
  empresaId: string,
  productId: string,
  body: Partial<{
    discriminacao: string
    codigo: string
    valor_sugerido: number | null
    metadata_json: Record<string, unknown> | null
  }>,
): Promise<NfseCatalogProduto> {
  const res = await accountantRequest<{ product: NfseCatalogProduto }>(
    `/accountant/clients/${encodeURIComponent(empresaId)}/products/${encodeURIComponent(productId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  )
  return res.product
}

export async function listAccountantClientEstablishments(
  empresaId: string,
): Promise<AccountantEstablishmentsResponse> {
  return accountantRequest<AccountantEstablishmentsResponse>(
    `/accountant/clients/${encodeURIComponent(empresaId)}/establishments`,
  )
}

export function accountantFiscalConfigBase(empresaId: string): string {
  return `/accountant/clients/${encodeURIComponent(empresaId)}/fiscal-configuration`
}
