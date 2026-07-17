import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface OAuthStatePayload {
  userId: string;
  returnTo?: string;
}

function encodeOAuthState(userId: string, returnTo?: string): string {
  if (returnTo) {
    return btoa(JSON.stringify({ u: userId, r: returnTo }));
  }
  return btoa(userId);
}

function parseOAuthState(state: string | null): OAuthStatePayload | null {
  if (!state) return null;
  try {
    const raw = atob(state);
    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw) as { u?: string; r?: string };
      if (parsed.u) return { userId: parsed.u, returnTo: parsed.r };
    }
    if (raw) return { userId: raw };
  } catch {
    /* legacy */
  }
  return null;
}

const FRONTEND_ORIGIN_HINTS = (Deno.env.get('FRONTEND_URL') || Deno.env.get('PUBLIC_APP_URL') || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isAllowedReturnTo(returnTo: string): boolean {
  try {
    const u = new URL(returnTo);
    if (u.protocol === 'financas-pessoais:') return true;
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.vercel.app') ||
      host.includes('meufinanceiro') ||
      host.includes('meiinfinito') ||
      host.includes('contabhub')
    ) {
      return true;
    }
    return FRONTEND_ORIGIN_HINTS.some((hint) => host === hint || host.endsWith(`.${hint}`) || hint.includes(host));
  } catch {
    return false;
  }
}

function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  );
}

async function resolveRefreshTokenForUpsert(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  incomingRefresh?: string,
): Promise<string | null> {
  if (incomingRefresh) return incomingRefresh;
  const { data } = await serviceClient
    .from('google_tokens_id')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.refresh_token ?? null;
}

async function saveGoogleTokens(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  tokens: GoogleTokenResponse,
): Promise<{ ok: boolean; error?: string }> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const refresh_token = await resolveRefreshTokenForUpsert(serviceClient, userId, tokens.refresh_token);
  const row: Record<string, string | null> = {
    user_id: userId,
    access_token: tokens.access_token,
    expires_at: expiresAt,
  };
  if (refresh_token) row.refresh_token = refresh_token;
  const { error } = await serviceClient.from('google_tokens_id').upsert(row, { onConflict: 'user_id' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function refreshGoogleAccessToken(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  refreshToken: string,
): Promise<{ accessToken: string } | { error: string }> {
  const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!refreshResponse.ok) {
    return { error: 'Não foi possível renovar o token do Google Calendar.' };
  }
  const refreshed: GoogleTokenResponse = await refreshResponse.json();
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await serviceClient
    .from('google_tokens_id')
    .update({ access_token: refreshed.access_token, expires_at: newExpiresAt })
    .eq('user_id', userId);
  return { accessToken: refreshed.access_token };
}

async function hasValidGoogleCalendarSession(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  const { data: tokenData } = await serviceClient
    .from('google_tokens_id')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!tokenData?.access_token) return false;

  const expired = tokenData.expires_at && new Date(tokenData.expires_at) <= new Date();
  if (!expired) return true;
  if (!tokenData.refresh_token) return false;

  const refreshed = await refreshGoogleAccessToken(serviceClient, userId, tokenData.refresh_token);
  return 'accessToken' in refreshed;
}

function oauthFinishResponse(
  ok: boolean,
  returnTo: string | undefined,
  deepLink: string,
  deepLinkSimple: string,
): Response {
  if (returnTo && isAllowedReturnTo(returnTo)) {
    const target = new URL(returnTo);
    target.searchParams.set('googleCalendar', ok ? 'connected' : 'error');
    return Response.redirect(target.toString(), 302);
  }

  const title = ok ? 'Autorização concluída' : 'Erro na autorização';
  const message = ok
    ? 'Voltando ao app…'
    : 'Não foi possível conectar. Feche esta janela e tente novamente.';
  const primaryLink = ok ? deepLinkSimple : deepLink;
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta http-equiv="refresh" content="0;url=${primaryLink}" />
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0;
      display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; padding: 24px; }
    p { margin: 0; font-size: 1rem; }
  </style>
</head>
<body>
  <p>${message}</p>
  <script>
    (function () {
      var links = ${JSON.stringify([primaryLink, deepLink, deepLinkSimple])};
      function go() {
        for (var i = 0; i < links.length; i++) {
          try { window.location.replace(links[i]); } catch (e) {}
        }
        try { window.close(); } catch (e) {}
      }
      go();
      setTimeout(go, 400);
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html; charset=UTF-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop() || '';

    // GET /callback — redirecionamento do Google OAuth (sem autenticação)
    if (path === 'callback' && req.method === 'GET') {
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      const stateRaw = url.searchParams.get('state');
      const statePayload = parseOAuthState(stateRaw);
      const returnTo = statePayload?.returnTo;

      const deepLink = 'financas-pessoais://google-callback?code=' + encodeURIComponent(code || '') + (stateRaw ? '&state=' + encodeURIComponent(stateRaw) : '') + '&success=true';
      const deepLinkSimple = 'financas-pessoais://google-callback?success=true';

      if (error) {
        return oauthFinishResponse(false, returnTo, deepLink, deepLinkSimple);
      }
      if (!code) {
        return oauthFinishResponse(false, returnTo, deepLink, deepLinkSimple);
      }

      let tokensSaved = false;
      if (code && stateRaw && statePayload?.userId) {
        try {
          const userId = statePayload.userId;
          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: GOOGLE_CLIENT_ID,
              client_secret: GOOGLE_CLIENT_SECRET,
              redirect_uri: GOOGLE_REDIRECT_URI,
              grant_type: 'authorization_code',
            }),
          });
          if (tokenResponse.ok) {
            const tokens: GoogleTokenResponse = await tokenResponse.json();
            const serviceClient = createServiceClient();
            const saved = await saveGoogleTokens(serviceClient, userId, tokens);
            tokensSaved = saved.ok;
          }
        } catch (_e) { tokensSaved = false; }
      }

      if (tokensSaved) {
        return oauthFinishResponse(true, returnTo, deepLink, deepLinkSimple);
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
      const functionUrl = `${supabaseUrl}/functions/v1/google-calendar/callback`;
      let fallbackRedirect = deepLinkSimple;
      if (returnTo && isAllowedReturnTo(returnTo)) {
        const target = new URL(returnTo);
        target.searchParams.set('googleCalendar', 'connected');
        fallbackRedirect = target.toString();
      }

      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Processando</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0;
      display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  </style>
</head>
<body>
  <p>Processando autorização…</p>
  <script>
    fetch(${JSON.stringify(functionUrl)}, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ${JSON.stringify(supabaseAnonKey)} },
      body: JSON.stringify({ code: ${JSON.stringify(code)}, state: ${JSON.stringify(stateRaw)} }),
    }).finally(function () {
      window.location.replace(${JSON.stringify(fallbackRedirect)});
    });
  </script>
</body>
</html>`;
      return new Response(html, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=UTF-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    // POST /callback — processar tokens OAuth
    if (path === 'callback' && req.method === 'POST') {
      try {
        const body = await req.json();
        const code = body.code;
        const state = body.state;

        if (!code) {
          return new Response(JSON.stringify({ error: 'Codigo de autorizacao nao fornecido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        let userId: string | null = null;
        let useServiceClient = false;

        if (state) {
          const parsed = parseOAuthState(state);
          if (!parsed?.userId) {
            return new Response(JSON.stringify({ error: 'State invalido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          userId = parsed.userId;
          useServiceClient = true;
        } else {
          const authHeader = req.headers.get('Authorization');
          if (!authHeader) return new Response(JSON.stringify({ error: 'Nao autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          const sc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
          const { data: { user } } = await sc.auth.getUser();
          if (!user) return new Response(JSON.stringify({ error: 'Nao autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          userId = user.id;
        }

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: GOOGLE_REDIRECT_URI, grant_type: 'authorization_code' }),
        });

        if (!tokenResponse.ok) {
          const err = await tokenResponse.text();
          return new Response(JSON.stringify({ error: 'Erro ao obter tokens: ' + err }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const tokens: GoogleTokenResponse = await tokenResponse.json();

        const dbClient = useServiceClient
          ? createServiceClient()
          : createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: req.headers.get('Authorization')! } } });

        const saved = await saveGoogleTokens(dbClient, userId, tokens);
        if (!saved.ok) {
          return new Response(JSON.stringify({ error: 'Erro ao salvar tokens: ' + (saved.error || 'desconhecido') }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Erro ao processar callback: ' + (e.message || 'desconhecido') }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // GET /test-callback
    if (path === 'test-callback' && req.method === 'GET') {
      return new Response(JSON.stringify({ accessible: true, redirectUri: GOOGLE_REDIRECT_URI }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /test-public
    if (path === 'test-public' && req.method === 'GET') {
      return new Response(JSON.stringify({ public: true, accessible: true, timestamp: new Date().toISOString() }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Rotas autenticadas — verificar JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Nao autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const userId = user.id;

    // GET /auth — iniciar fluxo OAuth
    if (path === 'auth' && req.method === 'GET') {
      const returnToParam = url.searchParams.get('returnTo')?.trim() || '';
      const returnTo = returnToParam && isAllowedReturnTo(returnToParam) ? returnToParam : undefined;
      const state = encodeOAuthState(userId, returnTo);
      const serviceClient = createServiceClient();
      const { data: existingToken } = await serviceClient
        .from('google_tokens_id')
        .select('refresh_token')
        .eq('user_id', userId)
        .maybeSingle();
      const needsConsent = !existingToken?.refresh_token;
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.events');
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', needsConsent ? 'consent' : 'select_account');
      authUrl.searchParams.set('state', state);
      return new Response(JSON.stringify({ authUrl: authUrl.toString(), redirectUri: GOOGLE_REDIRECT_URI }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /check-auth — verificar autenticação Google (renova access token se expirado)
    if (path === 'check-auth' && req.method === 'GET') {
      const serviceClient = createServiceClient();
      const isAuthenticated = await hasValidGoogleCalendarSession(serviceClient, userId);
      return new Response(JSON.stringify({ authenticated: isAuthenticated }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET /events — listar eventos do Google Calendar
    if (path === 'events' && req.method === 'GET') {
      const timeMin = url.searchParams.get('timeMin');
      const timeMax = url.searchParams.get('timeMax');

      const { data: tokenData, error: tokenError } = await supabaseClient
        .from('google_tokens_id')
        .select('access_token, refresh_token, expires_at')
        .eq('user_id', userId)
        .single();

      if (tokenError || !tokenData) {
        return new Response(
          JSON.stringify({ error: 'Tokens nao encontrados. Autorize o Google Calendar primeiro.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let accessToken = tokenData.access_token;

      // Refresh token se expirado
      if (tokenData.expires_at && new Date(tokenData.expires_at) <= new Date()) {
        if (!tokenData.refresh_token) {
          return new Response(JSON.stringify({ error: 'Token expirado e refresh token nao disponivel' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: tokenData.refresh_token, grant_type: 'refresh_token' }),
        });
        if (!refreshResponse.ok) {
          return new Response(JSON.stringify({ error: 'Erro ao renovar token' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const refreshedTokens: GoogleTokenResponse = await refreshResponse.json();
        accessToken = refreshedTokens.access_token;
        const newExpiresAt = new Date(Date.now() + refreshedTokens.expires_in * 1000).toISOString();
        await supabaseClient.from('google_tokens_id').update({ access_token: accessToken, expires_at: newExpiresAt }).eq('user_id', userId);
      }

      const calendarUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
      calendarUrl.searchParams.set('singleEvents', 'true');
      calendarUrl.searchParams.set('orderBy', 'startTime');
      calendarUrl.searchParams.set('conferenceDataVersion', '1');
      if (timeMin) calendarUrl.searchParams.set('timeMin', timeMin);
      if (timeMax) calendarUrl.searchParams.set('timeMax', timeMax);

      const calendarResponse = await fetch(calendarUrl.toString(), {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      });

      if (!calendarResponse.ok) {
        const errText = await calendarResponse.text();
        console.error('[EDGE] Erro ao listar eventos:', calendarResponse.status, errText);
        return new Response(JSON.stringify({ error: 'Erro ao listar eventos: ' + errText }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const data = await calendarResponse.json();
      return new Response(JSON.stringify({ events: data.items || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // POST /create-event — criar evento no Google Calendar
    if (path === 'create-event' && req.method === 'POST') {
      const { transaction } = await req.json();
      if (!transaction) return new Response(JSON.stringify({ error: 'Dados da transacao nao fornecidos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: tokenData, error: tokenError } = await supabaseClient
        .from('google_tokens_id')
        .select('access_token, refresh_token, expires_at')
        .eq('user_id', userId)
        .single();
      if (tokenError || !tokenData) return new Response(JSON.stringify({ error: 'Tokens nao encontrados.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      let accessToken = tokenData.access_token;
      if (tokenData.expires_at && new Date(tokenData.expires_at) <= new Date()) {
        if (!tokenData.refresh_token) return new Response(JSON.stringify({ error: 'Token expirado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: tokenData.refresh_token, grant_type: 'refresh_token' }),
        });
        if (!refreshResponse.ok) return new Response(JSON.stringify({ error: 'Erro ao renovar token' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const refreshedTokens: GoogleTokenResponse = await refreshResponse.json();
        accessToken = refreshedTokens.access_token;
        const newExpiresAt = new Date(Date.now() + refreshedTokens.expires_in * 1000).toISOString();
        await supabaseClient.from('google_tokens_id').update({ access_token: accessToken, expires_at: newExpiresAt }).eq('user_id', userId);
      }

      const eventDate = transaction.data || transaction.criado_em || new Date().toISOString().split('T')[0];
      const eventDateTime = new Date(eventDate + 'T09:00:00');
      const endDateTime = new Date(eventDateTime);
      endDateTime.setHours(endDateTime.getHours() + 1);
      const eventTitle = transaction.tipo === 'entrada'
        ? `Receber: ${formatCurrency(transaction.valor)}`
        : `Pagar: ${formatCurrency(transaction.valor)}`;
      let eventDescription = `Categoria: ${transaction.classificacao || 'Sem categoria'}\nValor: ${formatCurrency(transaction.valor)}\nStatus: ${transaction.status === 'a_receber' ? 'A Receber' : 'A Pagar'}`;
      if (transaction.obs && transaction.obs.trim()) eventDescription += `\nObservacoes: ${transaction.obs.trim()}`;

      const calendarResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: eventTitle, description: eventDescription, start: { dateTime: eventDateTime.toISOString(), timeZone: 'America/Sao_Paulo' }, end: { dateTime: endDateTime.toISOString(), timeZone: 'America/Sao_Paulo' } }),
      });

      if (!calendarResponse.ok) {
        const err = await calendarResponse.text();
        return new Response(JSON.stringify({ error: 'Erro ao criar evento: ' + err }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const eventData = await calendarResponse.json();
      return new Response(JSON.stringify({ success: true, eventId: eventData.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // POST /create-custom-event — criar evento personalizado no Google Calendar
    if (path === 'create-custom-event' && req.method === 'POST') {
      const body = await req.json();
      const {
        title,
        isAllDay,
        startDate,
        endDate,
        startHour,
        startMinute,
        endHour,
        endMinute,
        recurrence,
        location,
        description,
        colorId,
        reminderMinutes,
        createMeetLink,
      } = body;

      if (!title || !startDate) {
        return new Response(JSON.stringify({ error: 'Título e data de início são obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: tokenData, error: tokenError } = await supabaseClient
        .from('google_tokens_id')
        .select('access_token, refresh_token, expires_at')
        .eq('user_id', userId)
        .single();

      if (tokenError || !tokenData) {
        return new Response(JSON.stringify({ error: 'Tokens nao encontrados. Autorize o Google Calendar primeiro.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let accessToken = tokenData.access_token;
      if (tokenData.expires_at && new Date(tokenData.expires_at) <= new Date()) {
        if (!tokenData.refresh_token) return new Response(JSON.stringify({ error: 'Token expirado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: tokenData.refresh_token, grant_type: 'refresh_token' }),
        });
        if (!refreshResponse.ok) return new Response(JSON.stringify({ error: 'Erro ao renovar token' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const refreshedTokens: GoogleTokenResponse = await refreshResponse.json();
        accessToken = refreshedTokens.access_token;
        const newExpiresAt = new Date(Date.now() + refreshedTokens.expires_in * 1000).toISOString();
        await supabaseClient.from('google_tokens_id').update({ access_token: accessToken, expires_at: newExpiresAt }).eq('user_id', userId);
      }

      const pad = (n: number) => String(n).padStart(2, '0');
      const wantsMeet =
        createMeetLink === true || String(createMeetLink).toLowerCase() === 'true';
      let descText = description ? String(description).trim() : '';
      if (wantsMeet) {
        descText = descText ? `${descText}\n[MF_MEET]` : '[MF_MEET]';
      }

      const eventBody: Record<string, unknown> = {
        summary: title,
        ...(location ? { location } : {}),
        ...(descText ? { description: descText } : {}),
        ...(colorId != null && String(colorId).trim() !== ''
          ? { colorId: String(colorId) }
          : {}),
        ...(recurrence ? { recurrence: [recurrence] } : {}),
      };

      const reminderMins = reminderMinutes != null ? Number(reminderMinutes) : NaN;
      if (Number.isFinite(reminderMins) && reminderMins >= 0) {
        eventBody.reminders = {
          useDefault: false,
          overrides: [{ method: 'popup', minutes: reminderMins }],
        };
      }

      if (wantsMeet) {
        eventBody.conferenceData = {
          createRequest: {
            requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        };
        eventBody.extendedProperties = { private: { mfMeet: '1' } };
      }

      if (isAllDay) {
        eventBody.start = { date: startDate };
        eventBody.end = { date: endDate };
      } else {
        eventBody.start = { dateTime: `${startDate}T${pad(startHour)}:${pad(startMinute)}:00`, timeZone: 'America/Sao_Paulo' };
        eventBody.end   = { dateTime: `${endDate}T${pad(endHour)}:${pad(endMinute)}:00`,   timeZone: 'America/Sao_Paulo' };
      }

      const calendarQuery = wantsMeet ? '?conferenceDataVersion=1' : '';
      const calendarResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events${calendarQuery}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(eventBody),
        }
      );

      if (!calendarResponse.ok) {
        const err = await calendarResponse.text();
        return new Response(JSON.stringify({ error: 'Erro ao criar evento: ' + err }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let eventData = await calendarResponse.json();

      const pickMeetUri = (ev: Record<string, unknown>) => {
        const hangout = typeof ev.hangoutLink === 'string' ? ev.hangoutLink.trim() : '';
        if (hangout.includes('meet.google')) return hangout;
        const cdata = ev.conferenceData as { entryPoints?: Array<{ entryPointType?: string; uri?: string }> } | undefined;
        for (const ep of cdata?.entryPoints || []) {
          const uri = String(ep?.uri || '').trim();
          if (uri.includes('meet.google')) return uri;
        }
        return null;
      };

      let meetUri = pickMeetUri(eventData);

      if (wantsMeet && eventData.id && !meetUri) {
        const getRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventData.id)}?conferenceDataVersion=1`,
          { method: 'GET', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } },
        );
        if (getRes.ok) {
          eventData = await getRes.json();
          meetUri = pickMeetUri(eventData);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          eventId: eventData.id,
          hangoutLink: meetUri,
          htmlLink: eventData.htmlLink || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // POST /update-custom-event — atualizar evento no Google Calendar
    if (path === 'update-custom-event' && req.method === 'POST') {
      const body = await req.json();
      const eventId = String(body?.eventId || '').trim();
      if (!eventId) {
        return new Response(JSON.stringify({ error: 'eventId é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const {
        title,
        isAllDay,
        startDate,
        endDate,
        startHour,
        startMinute,
        endHour,
        endMinute,
        recurrence,
        location,
        description,
        colorId,
        reminderMinutes,
        createMeetLink,
      } = body;

      if (!title || !startDate) {
        return new Response(JSON.stringify({ error: 'Título e data de início são obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: tokenData, error: tokenError } = await supabaseClient
        .from('google_tokens_id')
        .select('access_token, refresh_token, expires_at')
        .eq('user_id', userId)
        .single();

      if (tokenError || !tokenData) {
        return new Response(JSON.stringify({ error: 'Tokens nao encontrados. Autorize o Google Calendar primeiro.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let accessToken = tokenData.access_token;
      if (tokenData.expires_at && new Date(tokenData.expires_at) <= new Date()) {
        if (!tokenData.refresh_token) return new Response(JSON.stringify({ error: 'Token expirado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: tokenData.refresh_token, grant_type: 'refresh_token' }),
        });
        if (!refreshResponse.ok) return new Response(JSON.stringify({ error: 'Erro ao renovar token' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const refreshedTokens: GoogleTokenResponse = await refreshResponse.json();
        accessToken = refreshedTokens.access_token;
        const newExpiresAt = new Date(Date.now() + refreshedTokens.expires_in * 1000).toISOString();
        await supabaseClient.from('google_tokens_id').update({ access_token: accessToken, expires_at: newExpiresAt }).eq('user_id', userId);
      }

      const pad = (n: number) => String(n).padStart(2, '0');
      const wantsMeet =
        createMeetLink === true || String(createMeetLink).toLowerCase() === 'true';
      let descText = description ? String(description).trim() : '';
      if (wantsMeet) {
        descText = descText ? `${descText}\n[MF_MEET]` : '[MF_MEET]';
      }

      const eventBody: Record<string, unknown> = {
        summary: title,
        ...(location ? { location } : {}),
        ...(descText ? { description: descText } : {}),
        ...(colorId != null && String(colorId).trim() !== ''
          ? { colorId: String(colorId) }
          : {}),
        ...(recurrence ? { recurrence: [recurrence] } : {}),
      };

      const reminderMins = reminderMinutes != null ? Number(reminderMinutes) : NaN;
      if (Number.isFinite(reminderMins) && reminderMins >= 0) {
        eventBody.reminders = {
          useDefault: false,
          overrides: [{ method: 'popup', minutes: reminderMins }],
        };
      }

      if (wantsMeet) {
        eventBody.conferenceData = {
          createRequest: {
            requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        };
        eventBody.extendedProperties = { private: { mfMeet: '1' } };
      }

      if (isAllDay) {
        eventBody.start = { date: startDate };
        eventBody.end = { date: endDate };
      } else {
        eventBody.start = { dateTime: `${startDate}T${pad(startHour)}:${pad(startMinute)}:00`, timeZone: 'America/Sao_Paulo' };
        eventBody.end = { dateTime: `${endDate}T${pad(endHour)}:${pad(endMinute)}:00`, timeZone: 'America/Sao_Paulo' };
      }

      const calendarQuery = wantsMeet ? '?conferenceDataVersion=1' : '';
      const calendarResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}${calendarQuery}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(eventBody),
        },
      );

      if (!calendarResponse.ok) {
        const err = await calendarResponse.text();
        return new Response(JSON.stringify({ error: 'Erro ao atualizar evento: ' + err }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let eventData = await calendarResponse.json();
      const pickMeetUri = (ev: Record<string, unknown>) => {
        const hangout = typeof ev.hangoutLink === 'string' ? ev.hangoutLink.trim() : '';
        if (hangout.includes('meet.google')) return hangout;
        const cdata = ev.conferenceData as { entryPoints?: Array<{ entryPointType?: string; uri?: string }> } | undefined;
        for (const ep of cdata?.entryPoints || []) {
          const uri = String(ep?.uri || '').trim();
          if (uri.includes('meet.google')) return uri;
        }
        return null;
      };

      let meetUri = pickMeetUri(eventData);
      if (wantsMeet && !meetUri) {
        const getRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1`,
          { method: 'GET', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } },
        );
        if (getRes.ok) {
          eventData = await getRes.json();
          meetUri = pickMeetUri(eventData);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          eventId: eventData.id || eventId,
          hangoutLink: meetUri,
          htmlLink: eventData.htmlLink || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // POST /delete-custom-event — excluir evento no Google Calendar
    if (path === 'delete-custom-event' && req.method === 'POST') {
      const body = await req.json();
      const eventId = String(body?.eventId || '').trim();
      if (!eventId) {
        return new Response(JSON.stringify({ error: 'eventId é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: tokenData, error: tokenError } = await supabaseClient
        .from('google_tokens_id')
        .select('access_token, refresh_token, expires_at')
        .eq('user_id', userId)
        .single();

      if (tokenError || !tokenData) {
        return new Response(JSON.stringify({ error: 'Tokens nao encontrados. Autorize o Google Calendar primeiro.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let accessToken = tokenData.access_token;
      if (tokenData.expires_at && new Date(tokenData.expires_at) <= new Date()) {
        if (!tokenData.refresh_token) return new Response(JSON.stringify({ error: 'Token expirado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: tokenData.refresh_token, grant_type: 'refresh_token' }),
        });
        if (!refreshResponse.ok) return new Response(JSON.stringify({ error: 'Erro ao renovar token' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const refreshedTokens: GoogleTokenResponse = await refreshResponse.json();
        accessToken = refreshedTokens.access_token;
        const newExpiresAt = new Date(Date.now() + refreshedTokens.expires_in * 1000).toISOString();
        await supabaseClient.from('google_tokens_id').update({ access_token: accessToken, expires_at: newExpiresAt }).eq('user_id', userId);
      }

      const calendarResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!calendarResponse.ok && calendarResponse.status !== 204) {
        const err = await calendarResponse.text();
        return new Response(JSON.stringify({ error: 'Erro ao excluir evento: ' + err }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ success: true, eventId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // DELETE|POST /disconnect — revogar tokens Google e remover do banco
    if (path === 'disconnect' && (req.method === 'DELETE' || req.method === 'POST')) {
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      );

      const { data: tokenData } = await serviceClient
        .from('google_tokens_id')
        .select('access_token, refresh_token')
        .eq('user_id', userId)
        .maybeSingle();

      const tokenToRevoke = tokenData?.refresh_token || tokenData?.access_token;
      if (tokenToRevoke) {
        try {
          await fetch('https://oauth2.googleapis.com/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token: tokenToRevoke }),
          });
        } catch {
          /* revogação opcional — segue removendo do banco */
        }
      }

      const { error: deleteError, count } = await serviceClient
        .from('google_tokens_id')
        .delete({ count: 'exact' })
        .eq('user_id', userId);

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: 'Erro ao remover tokens: ' + deleteError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if ((count ?? 0) === 0 && tokenData) {
        return new Response(
          JSON.stringify({ error: 'Não foi possível remover a integração do banco de dados.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, removed: count ?? 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ error: 'Rota nao encontrada' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Erro na Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
