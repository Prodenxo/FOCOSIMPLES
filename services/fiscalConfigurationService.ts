import Constants from 'expo-constants'
import { getMeiApiAuthHeaders } from '@/lib/apiClient'
import { getMeiApiBaseUrl } from '@/lib/runtimeEnv'
import { accountantFiscalConfigBase } from '@/services/accountantClientsService'
import type {
  AccountantApprovedRule,
  CompanyFiscalProfile,
  FiscalProductGroup,
  FiscalProductGroupMembership,
  FiscalReadinessResponse,
  ProductFiscalProfile,
  RulePreviewResult,
} from '@/lib/fiscalConfiguration/types'
import { FiscalConfigurationApiError } from '@/lib/fiscalConfiguration/types'

const LEGACY_BASE = '/fiscal/configuration'

function resolveFiscalBase(clientEmpresaId?: string | null): string {
  if (clientEmpresaId) return accountantFiscalConfigBase(clientEmpresaId)
  return LEGACY_BASE
}

function resolveApiUrl(): string {
  return (getMeiApiBaseUrl() || Constants.expoConfig?.extra?.meiApiUrl || '').replace(/\/$/, '')
}

async function fiscalRequest<T>(
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
    const issues = Array.isArray(payload?.issues) ? payload.issues : undefined
    const firstIssueMessage = issues?.[0]?.message
    const message = String(
      firstIssueMessage
      ?? payload?.message
      ?? payload?.code
      ?? response.statusText
      ?? 'Falha na requisição fiscal.',
    )
    throw new FiscalConfigurationApiError(
      message,
      response.status,
      payload?.code ?? payload?.errors?.code,
      payload?.permission ?? payload?.errors?.permission,
      issues,
    )
  }

  return payload as T
}

export async function fetchCompanyFiscalProfile(
  clientEmpresaId?: string | null,
  establishmentId?: string | null,
): Promise<CompanyFiscalProfile | null> {
  const base = resolveFiscalBase(clientEmpresaId)
  if (clientEmpresaId && !establishmentId) {
    throw new Error('establishmentId obrigatório para perfil fiscal scoped')
  }
  const qs = establishmentId ? `?establishmentId=${encodeURIComponent(establishmentId)}` : ''
  const res = await fiscalRequest<{ profile: CompanyFiscalProfile | null }>(`${base}/company-profile${qs}`)
  return res.profile ?? null
}

export async function fetchProductFiscalProfile(
  productId: string,
  clientEmpresaId?: string | null,
): Promise<ProductFiscalProfile | null> {
  const base = resolveFiscalBase(clientEmpresaId)
  const res = await fiscalRequest<{ profile: ProductFiscalProfile | null }>(
    `${base}/products/${encodeURIComponent(productId)}/profile`,
  )
  return res.profile ?? null
}

export async function saveProductFiscalProfile(
  productId: string,
  profile: Partial<ProductFiscalProfile>,
  clientEmpresaId?: string | null,
): Promise<ProductFiscalProfile> {
  const base = resolveFiscalBase(clientEmpresaId)
  const res = await fiscalRequest<{ profile: ProductFiscalProfile }>(
    `${base}/products/${encodeURIComponent(productId)}/profile`,
    { method: 'PUT', body: JSON.stringify(profile) },
  )
  return res.profile
}

export async function listAccountantFiscalRules(
  clientEmpresaId?: string | null,
): Promise<AccountantApprovedRule[]> {
  const base = resolveFiscalBase(clientEmpresaId)
  const res = await fiscalRequest<{ rules: AccountantApprovedRule[] }>(`${base}/rules`)
  return res.rules ?? []
}

export async function createAccountantRuleDraft(
  rule: Partial<AccountantApprovedRule>,
  clientEmpresaId?: string | null,
): Promise<AccountantApprovedRule> {
  const base = resolveFiscalBase(clientEmpresaId)
  const res = await fiscalRequest<{ rule: AccountantApprovedRule }>(`${base}/rules`, {
    method: 'POST',
    body: JSON.stringify(rule),
  })
  return res.rule
}

export async function updateAccountantRuleDraft(
  ruleId: string,
  version: number,
  patch: Partial<AccountantApprovedRule>,
  clientEmpresaId?: string | null,
): Promise<AccountantApprovedRule> {
  const base = resolveFiscalBase(clientEmpresaId)
  const res = await fiscalRequest<{ rule: AccountantApprovedRule }>(
    `${base}/rules/${encodeURIComponent(ruleId)}`,
    { method: 'PATCH', body: JSON.stringify({ ...patch, version }) },
  )
  return res.rule
}

export async function approveAccountantRule(
  ruleId: string,
  justification?: string,
  clientEmpresaId?: string | null,
): Promise<AccountantApprovedRule> {
  const base = resolveFiscalBase(clientEmpresaId)
  const res = await fiscalRequest<{ rule: AccountantApprovedRule }>(
    `${base}/rules/${encodeURIComponent(ruleId)}/approve`,
    { method: 'POST', body: JSON.stringify({ justification: justification ?? undefined }) },
  )
  return res.rule
}

export async function createAccountantRuleNewVersion(
  ruleId: string,
  updates: Partial<AccountantApprovedRule>,
  clientEmpresaId?: string | null,
): Promise<AccountantApprovedRule> {
  const base = resolveFiscalBase(clientEmpresaId)
  const res = await fiscalRequest<{ rule: AccountantApprovedRule }>(
    `${base}/rules/${encodeURIComponent(ruleId)}/versions`,
    { method: 'POST', body: JSON.stringify(updates) },
  )
  return res.rule
}

export async function previewAccountantRuleDraft(
  rule: Partial<AccountantApprovedRule>,
  clientEmpresaId?: string | null,
): Promise<RulePreviewResult> {
  const base = resolveFiscalBase(clientEmpresaId)
  return fiscalRequest<RulePreviewResult>(`${base}/rules/preview`, {
    method: 'POST',
    body: JSON.stringify({ rule }),
  })
}

export async function fetchFiscalConfigurationReadiness(
  clientEmpresaId?: string | null,
): Promise<FiscalReadinessResponse> {
  const base = resolveFiscalBase(clientEmpresaId)
  return fiscalRequest<FiscalReadinessResponse>(`${base}/readiness`)
}

export async function listFiscalProductGroups(
  clientEmpresaId?: string | null,
): Promise<FiscalProductGroup[]> {
  const base = resolveFiscalBase(clientEmpresaId)
  const res = await fiscalRequest<{ groups: FiscalProductGroup[] }>(`${base}/product-groups`)
  return res.groups ?? []
}

export async function createFiscalProductGroup(
  input: { name: string; description?: string },
  clientEmpresaId?: string | null,
): Promise<FiscalProductGroup> {
  const base = resolveFiscalBase(clientEmpresaId)
  const res = await fiscalRequest<{ group: FiscalProductGroup }>(`${base}/product-groups`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.group
}

export async function updateFiscalProductGroup(
  groupId: string,
  input: { name?: string; description?: string | null; status?: 'ACTIVE' | 'SUSPENDED' },
  clientEmpresaId?: string | null,
): Promise<FiscalProductGroup> {
  const base = resolveFiscalBase(clientEmpresaId)
  const res = await fiscalRequest<{ group: FiscalProductGroup }>(
    `${base}/product-groups/${encodeURIComponent(groupId)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  )
  return res.group
}

export async function removeProductFromFiscalGroup(
  groupId: string,
  productId: string,
  clientEmpresaId?: string | null,
): Promise<void> {
  const base = resolveFiscalBase(clientEmpresaId)
  await fiscalRequest<{ ok?: boolean }>(
    `${base}/product-groups/${encodeURIComponent(groupId)}/products/${encodeURIComponent(productId)}`,
    { method: 'DELETE' },
  )
}

export async function listFiscalProductGroupProducts(
  groupId: string,
  clientEmpresaId?: string | null,
): Promise<FiscalProductGroupMembership[]> {
  const base = resolveFiscalBase(clientEmpresaId)
  const res = await fiscalRequest<{ products: FiscalProductGroupMembership[] }>(
    `${base}/product-groups/${encodeURIComponent(groupId)}/products`,
  )
  return res.products ?? []
}

export async function assignProductsToFiscalGroup(
  groupId: string,
  productIds: string[],
  replaceExisting = false,
  clientEmpresaId?: string | null,
): Promise<{ assigned: string[]; skipped: string[] }> {
  const base = resolveFiscalBase(clientEmpresaId)
  const res = await fiscalRequest<{ assigned: string[]; skipped: string[] }>(
    `${base}/product-groups/${encodeURIComponent(groupId)}/products/bulk-assign`,
    {
      method: 'POST',
      body: JSON.stringify({ productIds, replaceExisting }),
    },
  )
  return res
}

export function isFiscalForbiddenError(error: unknown): boolean {
  return error instanceof FiscalConfigurationApiError && error.status === 403
}
