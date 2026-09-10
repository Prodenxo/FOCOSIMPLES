import { env } from '../config/env.js'
import { query } from '../config/pg.js'
import { badRequest, serviceUnavailable, unauthorized } from '../utils/errors.js'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

const ensureGoogleConfigured = () => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw serviceUnavailable(
      'Google Calendar não configurado no servidor. Defina GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI no .env do backend e reinicie.',
    )
  }
}

const encodeOAuthState = (userId, returnTo) => {
  if (returnTo) {
    return Buffer.from(JSON.stringify({ u: userId, r: returnTo }), 'utf8').toString('base64url')
  }
  return Buffer.from(userId, 'utf8').toString('base64url')
}

const parseOAuthState = (state) => {
  if (!state) return null
  try {
    const raw = Buffer.from(String(state), 'base64url').toString('utf8')
    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw)
      if (parsed?.u) return { userId: String(parsed.u), returnTo: parsed.r ? String(parsed.r) : undefined }
    }
    if (raw) return { userId: raw }
  } catch {
    try {
      const legacy = Buffer.from(String(state), 'base64').toString('utf8')
      if (legacy.startsWith('{')) {
        const parsed = JSON.parse(legacy)
        if (parsed?.u) return { userId: String(parsed.u), returnTo: parsed.r ? String(parsed.r) : undefined }
      }
      if (legacy) return { userId: legacy }
    } catch {
      /* ignore */
    }
  }
  return null
}

const isAllowedReturnTo = (returnTo) => {
  try {
    const u = new URL(returnTo)
    if (u.protocol === 'financas-pessoais:') return true
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    if (
      host === 'localhost'
      || host === '127.0.0.1'
      || host.endsWith('.vercel.app')
      || host.includes('focosimples')
      || host.includes('meufinanceiro')
      || host.includes('focomei')
    ) {
      return true
    }
    const hints = String(env.FRONTEND_URL || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    return hints.some((hint) => {
      try {
        const hintHost = new URL(hint.includes('://') ? hint : `https://${hint}`).hostname.toLowerCase()
        return host === hintHost || host.endsWith(`.${hintHost}`)
      } catch {
        return host === hint || hint.includes(host)
      }
    })
  } catch {
    return false
  }
}

const getStoredTokens = async (userId) => {
  const { rows } = await query(
    `SELECT access_token, refresh_token, expires_at
     FROM public.google_tokens_id
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  )
  return rows[0] || null
}

const upsertTokens = async (userId, tokens) => {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  const existing = await getStoredTokens(userId)
  const refreshToken = tokens.refresh_token || existing?.refresh_token
  if (!refreshToken) {
    throw badRequest(
      'Google não enviou refresh_token. Remova o acesso do app em myaccount.google.com/permissions e tente de novo.',
    )
  }

  await query(
    `INSERT INTO public.google_tokens_id (user_id, access_token, refresh_token, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expires_at = EXCLUDED.expires_at,
       updated_at = now()`,
    [userId, tokens.access_token, refreshToken, expiresAt],
  )
}

const refreshAccessToken = async (userId, refreshToken) => {
  ensureGoogleConfigured()
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) return null
  const refreshed = await response.json()
  await upsertTokens(userId, {
    access_token: refreshed.access_token,
    expires_in: refreshed.expires_in,
    refresh_token: refreshed.refresh_token,
  })
  return refreshed.access_token
}

const hasValidSession = async (userId) => {
  const tokenData = await getStoredTokens(userId)
  if (!tokenData?.access_token) return false
  const expired = tokenData.expires_at && new Date(tokenData.expires_at) <= new Date()
  if (!expired) return true
  if (!tokenData.refresh_token) return false
  const renewed = await refreshAccessToken(userId, tokenData.refresh_token)
  return Boolean(renewed)
}

const resolveAccessToken = async (userId) => {
  const tokenData = await getStoredTokens(userId)
  if (!tokenData?.access_token) {
    throw unauthorized('Tokens não encontrados. Autorize o Google Calendar primeiro.')
  }
  const expired = tokenData.expires_at && new Date(tokenData.expires_at) <= new Date()
  if (!expired) return tokenData.access_token
  if (!tokenData.refresh_token) {
    throw unauthorized('Token expirado. Reconecte o Google Calendar em Configurações.')
  }
  const renewed = await refreshAccessToken(userId, tokenData.refresh_token)
  if (!renewed) {
    throw unauthorized('Não foi possível renovar o token do Google. Reconecte em Configurações.')
  }
  return renewed
}

const exchangeCodeForTokens = async (code) => {
  ensureGoogleConfigured()
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })
  if (!response.ok) {
    const err = await response.text()
    throw badRequest(`Erro ao obter tokens do Google: ${err}`)
  }
  return response.json()
}

/**
 * Handlers nativos (AUTH_MODE=local + Postgres).
 * @returns {{ status: number, contentType: string, body: string, redirectUrl?: string }}
 */
export const handleLocalGoogleCalendar = async ({
  path,
  method,
  userId,
  query: queryParams,
  body,
}) => {
  const cleanPath = String(path || '').trim()
  const normalizedMethod = String(method || 'GET').toUpperCase()

  if (cleanPath === 'auth' && normalizedMethod === 'GET') {
    if (!userId) throw unauthorized('Usuário não autenticado')
    ensureGoogleConfigured()

    const returnToParam = String(queryParams?.returnTo || '').trim()
    const returnTo = returnToParam && isAllowedReturnTo(returnToParam) ? returnToParam : undefined
    const state = encodeOAuthState(userId, returnTo)
    const existing = await getStoredTokens(userId)
    const needsConsent = !existing?.refresh_token

    const authUrl = new URL(GOOGLE_AUTH_URL)
    authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', env.GOOGLE_REDIRECT_URI)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', CALENDAR_SCOPE)
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', needsConsent ? 'consent' : 'select_account')
    authUrl.searchParams.set('state', state)

    return {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authUrl: authUrl.toString(),
        redirectUri: env.GOOGLE_REDIRECT_URI,
      }),
    }
  }

  if (cleanPath === 'check-auth' && normalizedMethod === 'GET') {
    if (!userId) throw unauthorized('Usuário não autenticado')
    const authenticated = await hasValidSession(userId)
    return {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated }),
    }
  }

  if (cleanPath === 'callback' && normalizedMethod === 'POST') {
    const code = body?.code
    if (!code) throw badRequest('Código de autorização não fornecido')

    let targetUserId = userId
    if (body?.state) {
      const parsed = parseOAuthState(body.state)
      if (!parsed?.userId) throw badRequest('State inválido')
      targetUserId = parsed.userId
    }
    if (!targetUserId) throw unauthorized('Usuário não autenticado')

    const tokens = await exchangeCodeForTokens(code)
    await upsertTokens(targetUserId, tokens)
    return {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    }
  }

  if ((cleanPath === 'disconnect' || cleanPath === 'oauth-disconnect')
    && (normalizedMethod === 'DELETE' || normalizedMethod === 'POST')) {
    if (!userId) throw unauthorized('Usuário não autenticado')
    await query(`DELETE FROM public.google_tokens_id WHERE user_id = $1`, [userId])
    return {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    }
  }

  if (cleanPath === 'events' && normalizedMethod === 'GET') {
    if (!userId) throw unauthorized('Usuário não autenticado')
    const accessToken = await resolveAccessToken(userId)
    const calendarUrl = new URL(GOOGLE_EVENTS_URL)
    calendarUrl.searchParams.set('singleEvents', 'true')
    calendarUrl.searchParams.set('orderBy', 'startTime')
    calendarUrl.searchParams.set('conferenceDataVersion', '1')
    if (queryParams?.timeMin) calendarUrl.searchParams.set('timeMin', String(queryParams.timeMin))
    if (queryParams?.timeMax) calendarUrl.searchParams.set('timeMax', String(queryParams.timeMax))

    const response = await fetch(calendarUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
      const err = await response.text()
      throw badRequest(`Erro ao listar eventos: ${err}`)
    }
    const data = await response.json()
    return {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ events: data.items || [] }),
    }
  }

  if (cleanPath === 'create-event' && normalizedMethod === 'POST') {
    throw serviceUnavailable(
      'Criação automática de eventos via transação ainda não está disponível no modo local.',
    )
  }

  throw badRequest('Rota de integração inválida')
}

/**
 * Callback público do Google OAuth (GET) — troca code e redireciona ao frontend.
 */
export const handleLocalOAuthRedirect = async ({ code, state, error }) => {
  const parsed = parseOAuthState(state)
  const returnTo = parsed?.returnTo && isAllowedReturnTo(parsed.returnTo)
    ? parsed.returnTo
    : String(env.FRONTEND_URL || 'http://localhost:8081').split(',')[0].trim()

  const finish = (ok) => {
    try {
      const target = new URL(returnTo)
      target.searchParams.set('googleCalendar', ok ? 'connected' : 'error')
      return target.toString()
    } catch {
      return `${returnTo}${returnTo.includes('?') ? '&' : '?'}googleCalendar=${ok ? 'connected' : 'error'}`
    }
  }

  if (error || !code || !parsed?.userId) {
    return { redirectUrl: finish(false) }
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    await upsertTokens(parsed.userId, tokens)
    return { redirectUrl: finish(true) }
  } catch (err) {
    console.warn('[google-calendar] oauth redirect failed:', err?.message || err)
    return { redirectUrl: finish(false) }
  }
}
