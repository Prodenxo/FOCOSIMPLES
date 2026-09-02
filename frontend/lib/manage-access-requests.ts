import { getLocalAccessToken } from './localAuthSession'
import { isLocalApiAuthMode } from './authMode'
import { apiClient } from './apiClient'
import { supabase } from './supabase'
import { getMeiApiBaseUrl } from './runtimeEnv'

type ManageAccessResponse = Record<string, unknown> & {
  error?: string
  requests?: unknown[]
  entries?: unknown[]
  ok?: boolean
}

async function resolveAccessToken(): Promise<string> {
  if (isLocalApiAuthMode()) {
    const local = await getLocalAccessToken()
    if (local) return local
    throw new Error('Não autenticado. Faça login novamente.')
  }

  const { data: initial } = await supabase.auth.getSession()
  let token = initial.session?.access_token
  if (token) return token

  const { data: refreshed, error } = await supabase.auth.refreshSession()
  if (error) {
    throw new Error('Sessão expirada. Saia e entre de novo na conta.')
  }
  token = refreshed.session?.access_token
  if (!token) {
    throw new Error('Não autenticado. Faça login novamente.')
  }
  return token
}

function parseInvokeError(
  error: { message?: string; context?: { json?: () => Promise<{ error?: string }> } },
  fallback: string,
): Promise<string> {
  return (async () => {
    let msg = error.message || fallback
    try {
      const ctx = error.context
      if (ctx?.json) {
        const body = await ctx.json()
        if (typeof body?.error === 'string') msg = body.error
      }
    } catch {
      /* mantém mensagem padrão */
    }
    return msg
  })()
}

/**
 * Solicitações de acesso: API do backend no modo local; Edge no modo Supabase.
 */
export async function invokeManageAccessRequests(
  body: Record<string, unknown>,
): Promise<ManageAccessResponse> {
  if (isLocalApiAuthMode() || getMeiApiBaseUrl()) {
    try {
      if (body.action === 'list') {
        const data = await apiClient.get<{ requests?: unknown[] }>(
          '/admin/access-requests/pending',
        )
        return { ok: true, requests: Array.isArray(data?.requests) ? data.requests : [] }
      }
      if (body.action === 'report') {
        const report = await apiClient.get<{ entries?: unknown[] }>(
          `/admin/access-requests/report?limit=${Number(body.limit) || 50}`,
        )
        return {
          ok: true,
          entries: Array.isArray(report?.entries) ? report.entries : [],
          requests: [],
        }
      }
      if (body.action === 'approve' || body.action === 'reject') {
        const result = await apiClient.post<ManageAccessResponse>(
          '/admin/access-requests/manage',
          {
            action: body.action,
            userId: body.userId,
          },
        )
        return { ok: true, ...(result || {}) }
      }
      return { ok: true, requests: [], entries: [] }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha nas solicitações de acesso'
      throw new Error(message)
    }
  }

  const accessToken = await resolveAccessToken()

  const { data, error } = await supabase.functions.invoke('manage-access-requests', {
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (error) {
    const msg = await parseInvokeError(
      error as { message?: string; context?: { json?: () => Promise<{ error?: string }> } },
      'Não foi possível concluir a operação. Tente novamente.',
    )
    throw new Error(msg)
  }

  if (data && typeof data === 'object' && typeof (data as ManageAccessResponse).error === 'string') {
    throw new Error((data as ManageAccessResponse).error)
  }

  return (data as ManageAccessResponse) ?? {}
}
