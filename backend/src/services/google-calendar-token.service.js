import { createSupabaseClient } from '../config/supabase.js';
import { env } from '../config/env.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_PRIMARY_CALENDAR_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary';

/**
 * @param {string} accessToken
 * @returns {Promise<boolean>}
 */
export const probeGoogleCalendarAccess = async (accessToken) => {
  if (!accessToken) return false;
  try {
    const res = await fetch(GOOGLE_PRIMARY_CALENDAR_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.ok;
  } catch {
    return false;
  }
};

/**
 * @param {Response} response
 */
const parseGoogleOAuthError = async (response) => {
  try {
    const json = await response.json();
    return {
      error: String(json?.error || ''),
      description: String(json?.error_description || ''),
    };
  } catch {
    return { error: 'unknown', description: '' };
  }
};

const buildRefreshFailureMessage = (oauthError) => {
  if (oauthError.error === 'invalid_grant') {
    return 'Sessão Google expirou. Abra o Meu Financeiro → Configurações e reconecte o Google Calendar.';
  }
  if (oauthError.error === 'invalid_client') {
    return 'Integração Google Calendar indisponível no servidor. Contacte o suporte.';
  }
  return 'Não consegui acessar o Google Calendar agora. Se acabou de conectar, aguarde um minuto e tente de novo, ou reconecte em Configurações na app.';
};

/**
 * @param {string} userId
 * @returns {Promise<
 *   | { accessToken: string, refreshDeferred?: boolean }
 *   | { error: string, notLinked?: boolean, refreshFailed?: boolean, serverMisconfigured?: boolean }
 * >}
 */
export const getGoogleCalendarAccessTokenForUser = async (userId) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return {
      error: 'Integração Google Calendar não configurada no servidor.',
      serverMisconfigured: true,
    };
  }

  const admin = createSupabaseClient({ useServiceRole: true });
  const { data: tokenData, error: tokenError } = await admin
    .from('google_tokens_id')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (tokenError) return { error: tokenError.message };
  if (!tokenData?.access_token) {
    return {
      error: 'Google Calendar não conectado. Autorize em Configurações na app Meu Financeiro.',
      notLinked: true,
    };
  }

  let accessToken = tokenData.access_token;
  const expiresAtMs = tokenData.expires_at ? new Date(tokenData.expires_at).getTime() : null;
  const expired = expiresAtMs != null && expiresAtMs <= Date.now();

  if (!expired) return { accessToken };

  if (!tokenData.refresh_token) {
    if (await probeGoogleCalendarAccess(accessToken)) {
      return { accessToken, refreshDeferred: true };
    }
    return {
      error: 'Sessão Google expirou. Reconecte o Google Calendar em Configurações na app.',
      notLinked: true,
    };
  }

  const refreshResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!refreshResponse.ok) {
    const oauthErr = await parseGoogleOAuthError(refreshResponse);
    if (await probeGoogleCalendarAccess(accessToken)) {
      return { accessToken, refreshDeferred: true };
    }
    console.warn('[google-calendar] refresh failed', {
      userId,
      status: refreshResponse.status,
      oauthError: oauthErr.error,
    });
    return {
      error: buildRefreshFailureMessage(oauthErr),
      notLinked: oauthErr.error === 'invalid_grant',
      refreshFailed: true,
    };
  }

  const refreshed = await refreshResponse.json();
  accessToken = refreshed.access_token;
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await admin
    .from('google_tokens_id')
    .update({ access_token: accessToken, expires_at: newExpiresAt })
    .eq('user_id', userId);

  return { accessToken };
};

/**
 * @param {string} userId
 */
export const getGoogleCalendarConnectionStatus = async (userId) => {
  const admin = createSupabaseClient({ useServiceRole: true });
  const { data: tokenData } = await admin
    .from('google_tokens_id')
    .select('access_token, refresh_token, expires_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!tokenData?.access_token) {
    return {
      connected: false,
      ready: false,
      message: 'Google Calendar não conectado. Abra Configurações na app e autorize o Google.',
    };
  }

  const tokenResult = await getGoogleCalendarAccessTokenForUser(userId);
  if (tokenResult.error) {
    return {
      connected: true,
      ready: false,
      hasRefreshToken: Boolean(tokenData.refresh_token),
      expiresAt: tokenData.expires_at,
      updatedAt: tokenData.updated_at,
      message: tokenResult.error,
      serverMisconfigured: !!tokenResult.serverMisconfigured,
      refreshFailed: !!tokenResult.refreshFailed,
    };
  }

  const ready = await probeGoogleCalendarAccess(tokenResult.accessToken);
  return {
    connected: true,
    ready,
    hasRefreshToken: Boolean(tokenData.refresh_token),
    expiresAt: tokenData.expires_at,
    updatedAt: tokenData.updated_at,
    refreshDeferred: !!tokenResult.refreshDeferred,
    message: ready
      ? 'Google Calendar conectado e pronto para criar compromissos.'
      : 'Google Calendar conectado, mas a API não respondeu. Tente reconectar na app.',
  };
};
