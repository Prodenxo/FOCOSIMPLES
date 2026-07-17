import { supabase } from './supabase'

type ManageAccessResponse = Record<string, unknown> & {
  error?: string
  requests?: unknown[]
  entries?: unknown[]
  ok?: boolean
}

async function resolveAccessToken(): Promise<string> {
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
 * Chama a Edge `manage-access-requests` com JWT explícito (evita 401 no Expo web).
 */
export async function invokeManageAccessRequests(
  body: Record<string, unknown>,
): Promise<ManageAccessResponse> {
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
