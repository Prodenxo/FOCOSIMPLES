import { env } from '../config/env.js'
import { query } from '../config/pg.js'
import { badRequest, serviceUnavailable, unauthorized } from '../utils/errors.js'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const SAO_PAULO_TZ = 'America/Sao_Paulo'

const pad2 = (value) => String(value).padStart(2, '0')

const pickMeetUriFromGoogleEvent = (eventData) => {
  const hangout = eventData?.hangoutLink?.trim?.()
  if (hangout?.includes('meet.google.com')) return hangout
  for (const ep of eventData?.conferenceData?.entryPoints || []) {
    const uri = ep?.uri?.trim?.()
    if (uri?.includes('meet.google.com')) return uri
  }
  return null
}

const addDaysYmd = (ymd, days) => {
  const [y, m, d] = String(ymd).split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`
}

const buildCustomEventBody = (payload = {}) => {
  const {
    title,
    isAllDay,
    startDate,
    endDate,
    startHour = 9,
    startMinute = 0,
    endHour = 10,
    endMinute = 0,
    recurrence,
    location,
    description,
    colorId,
    reminderMinutes,
    createMeetLink,
  } = payload

  if (!title?.trim()) throw badRequest('Título do compromisso é obrigatório')

  const body = {
    summary: String(title).trim(),
    ...(location?.trim() ? { location: String(location).trim() } : {}),
    ...(description?.trim() ? { description: String(description).trim() } : {}),
    ...(colorId != null && colorId !== '' ? { colorId: String(colorId) } : {}),
  }

  if (recurrence) body.recurrence = [String(recurrence)]

  if (reminderMinutes != null && Number(reminderMinutes) >= 0) {
    body.reminders = {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: Number(reminderMinutes) }],
    }
  }

  if (createMeetLink && !isAllDay) {
    body.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
    body.extendedProperties = { private: { mfMeet: '1' } }
    body.description = body.description ? `${body.description}\n[MF_MEET]` : '[MF_MEET]'
  }

  if (isAllDay) {
    const start = String(startDate)
    const endInclusive = String(endDate || startDate)
    body.start = { date: start }
    body.end = { date: addDaysYmd(endInclusive, 1) }
  } else {
    const sd = String(startDate)
    const ed = String(endDate || startDate)
    body.start = {
      dateTime: `${sd}T${pad2(startHour)}:${pad2(startMinute)}:00`,
      timeZone: SAO_PAULO_TZ,
    }
    body.end = {
      dateTime: `${ed}T${pad2(endHour)}:${pad2(endMinute)}:00`,
      timeZone: SAO_PAULO_TZ,
    }
  }

  return body
}

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

  if (cleanPath === 'create-custom-event' && normalizedMethod === 'POST') {
    if (!userId) throw unauthorized('Usuário não autenticado')
    const accessToken = await resolveAccessToken(userId)
    const eventBody = buildCustomEventBody(body || {})
    const wantsMeet = Boolean(body?.createMeetLink && !body?.isAllDay)
    const calendarQuery = wantsMeet ? '?conferenceDataVersion=1' : ''
    const response = await fetch(`${GOOGLE_EVENTS_URL}${calendarQuery}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    })
    if (!response.ok) {
      const err = await response.text()
      throw badRequest(`Erro ao criar compromisso: ${err.slice(0, 240)}`)
    }
    const eventData = await response.json()
    return {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        eventId: eventData.id,
        hangoutLink: pickMeetUriFromGoogleEvent(eventData),
      }),
    }
  }

  if (cleanPath === 'update-custom-event' && normalizedMethod === 'POST') {
    if (!userId) throw unauthorized('Usuário não autenticado')
    const eventId = body?.eventId
    if (!eventId) throw badRequest('eventId é obrigatório')
    const accessToken = await resolveAccessToken(userId)
    const eventBody = buildCustomEventBody(body || {})
    const wantsMeet = Boolean(body?.createMeetLink && !body?.isAllDay)
    const calendarQuery = wantsMeet ? '?conferenceDataVersion=1' : ''
    const response = await fetch(
      `${GOOGLE_EVENTS_URL}/${encodeURIComponent(eventId)}${calendarQuery}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      },
    )
    if (!response.ok) {
      const err = await response.text()
      throw badRequest(`Erro ao atualizar compromisso: ${err.slice(0, 240)}`)
    }
    const eventData = await response.json()
    return {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        eventId: eventData.id || eventId,
        hangoutLink: pickMeetUriFromGoogleEvent(eventData),
      }),
    }
  }

  if (cleanPath === 'delete-custom-event' && normalizedMethod === 'POST') {
    if (!userId) throw unauthorized('Usuário não autenticado')
    const eventId = body?.eventId
    if (!eventId) throw badRequest('eventId é obrigatório')
    const accessToken = await resolveAccessToken(userId)
    const response = await fetch(
      `${GOOGLE_EVENTS_URL}/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!response.ok && response.status !== 404 && response.status !== 410) {
      const err = await response.text()
      throw badRequest(`Erro ao excluir compromisso: ${err.slice(0, 240)}`)
    }
    return {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    }
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
