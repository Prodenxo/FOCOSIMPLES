import { supabase } from './supabase';
import Constants from 'expo-constants';
import { getPublicEnv } from './runtimeEnv';
import {
  forgetAppMeetEvent,
  getCachedMeetLinkSync,
  isAppMeetEventSync,
  rememberAppMeetEvent,
} from './google-meet-events';

// Obter URL base do Supabase
const getSupabaseUrl = () =>
  getPublicEnv('EXPO_PUBLIC_SUPABASE_URL') ||
  Constants.expoConfig?.extra?.supabaseUrl ||
  '';

const getSupabaseAnonKey = () =>
  getPublicEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY') ||
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  '';

async function googleCalendarFetchHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Usuário não autenticado');
  }
  const anonKey = getSupabaseAnonKey();
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
    ...(anonKey ? { apikey: anonKey } : {}),
  };
}

// Obter URL base da API de Google Calendar
const getGoogleCalendarApiUrl = () => {
  const supabaseUrl = getSupabaseUrl();
  if (!supabaseUrl) {
    throw new Error('Supabase URL não configurada');
  }
  const baseUrl = supabaseUrl.replace(/\/rest\/v1$/, '').replace(/\/$/, '');
  return `${baseUrl}/functions/v1/google-calendar`;
};

interface CreateEventResponse {
  success: boolean;
  eventId?: string;
  error?: string;
}

interface CheckAuthResponse {
  authenticated: boolean;
}

export interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  colorId?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType?: string;
      uri?: string;
    }>;
  };
  extendedProperties?: {
    private?: Record<string, string>;
  };
  start: {
    date?: string;
    dateTime?: string;
  };
  end: {
    date?: string;
    dateTime?: string;
  };
  location?: string;
  recurrence?: string[];
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{ method?: string; minutes?: number }>;
  };
}

/** Marcador na descrição quando o utilizador activou Meet no modal (fallback se extendedProperties não vier na listagem). */
export const MF_MEET_DESC_MARKER = '[MF_MEET]';

/** Evento criado no app com opção "Gerar link do Meet" activada. */
export function eventHasAppMeetEnabled(event: GoogleCalendarEvent): boolean {
  if (isAppMeetEventSync(event.id)) return true;
  if (event.extendedProperties?.private?.mfMeet === '1') return true;
  if (event.description?.includes(MF_MEET_DESC_MARKER)) return true;
  return false;
}

export function stripMeetMarkerFromDescription(desc?: string | null): string | undefined {
  if (!desc) return undefined;
  const cleaned = desc.replace(/\n?\[MF_MEET\]\s*/g, '').trim();
  return cleaned || undefined;
}

/** URL real do Google Meet (não confundir com htmlLink do Calendar). */
export function isValidGoogleMeetUrl(url?: string | null): boolean {
  if (!url?.trim()) return false;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return host === 'meet.google.com' || host.endsWith('.meet.google.com');
  } catch {
    return false;
  }
}

/** Extrai link Meet da resposta Google (sem filtro de “criado no app”). */
export function extractMeetLinkFromGoogleEvent(event: GoogleCalendarEvent): string | null {
  const hangout = event.hangoutLink?.trim();
  if (isValidGoogleMeetUrl(hangout)) return hangout!;
  const points = event.conferenceData?.entryPoints ?? [];
  for (const ep of points) {
    const uri = ep.uri?.trim();
    if (!uri) continue;
    if (isValidGoogleMeetUrl(uri)) return uri;
  }
  return null;
}

/** Link do Meet só se o utilizador activou a opção ao criar no Meu Financeiro. */
export function getGoogleMeetLink(event: GoogleCalendarEvent): string | null {
  if (!eventHasAppMeetEnabled(event)) return null;
  const cached = getCachedMeetLinkSync(event.id);
  if (isValidGoogleMeetUrl(cached)) return cached!.trim();
  return extractMeetLinkFromGoogleEvent(event);
}

/** Horário legível para eventos com dateTime (America/Sao_Paulo no payload). */
export function formatGoogleEventTimeRange(event: GoogleCalendarEvent): string | null {
  const startRaw = event.start?.dateTime;
  if (!startRaw) return null;
  const start = new Date(startRaw);
  const endRaw = event.end?.dateTime;
  const end = endRaw ? new Date(endRaw) : null;
  const timeFmt: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  const startStr = start.toLocaleTimeString('pt-BR', timeFmt);
  if (!end) return startStr;
  const endStr = end.toLocaleTimeString('pt-BR', timeFmt);
  return `${startStr} – ${endStr}`;
}

interface GoogleEventsParams {
  timeMin?: string;
  timeMax?: string;
}

/**
 * Verifica se o usuário está autenticado no Google Calendar
 */
export async function checkGoogleAuth(): Promise<boolean> {
  console.log('[GOOGLE] checkGoogleAuth: Iniciando...');
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log('[GOOGLE] checkGoogleAuth: Sem sessão do Supabase');
      return false;
    }

    const edgeFunctionUrl = `${getGoogleCalendarApiUrl()}/check-auth`;
    console.log('[GOOGLE] checkGoogleAuth: Chamando:', edgeFunctionUrl);
    const response = await fetch(edgeFunctionUrl, {
      method: 'GET',
      headers: await googleCalendarFetchHeaders(),
    });

    console.log('[GOOGLE] checkGoogleAuth: Status:', response.status);
    if (!response.ok) {
      console.log('[GOOGLE] checkGoogleAuth: Response não OK');
      return false;
    }

    const data: CheckAuthResponse = await response.json();
    console.log('[GOOGLE] checkGoogleAuth: Resultado:', data.authenticated ? 'AUTENTICADO' : 'NÃO AUTENTICADO');
    return data.authenticated;
  } catch (error) {
    console.error('[GOOGLE] checkGoogleAuth: Erro:', error);
    return false;
  }
}

/**
 * Obtém a URL de autorização do Google OAuth
 */
export async function getGoogleAuthUrl(
  returnTo?: string,
): Promise<{ authUrl: string; redirectUri: string }> {
  console.log('[GOOGLE] getGoogleAuthUrl: Iniciando...');
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log('[GOOGLE] getGoogleAuthUrl: Sem sessão do Supabase');
      throw new Error('Usuário não autenticado');
    }

    const returnQs =
      returnTo && returnTo.trim()
        ? `?returnTo=${encodeURIComponent(returnTo.trim())}`
        : '';
    const edgeFunctionUrl = `${getGoogleCalendarApiUrl()}/auth${returnQs}`;
    console.log('[GOOGLE] getGoogleAuthUrl: Chamando:', edgeFunctionUrl);
    const response = await fetch(edgeFunctionUrl, {
      method: 'GET',
      headers: await googleCalendarFetchHeaders(),
    });

    console.log('[GOOGLE] getGoogleAuthUrl: Status:', response.status);
    if (!response.ok) {
      const error = await response.json();
      console.error('[GOOGLE] getGoogleAuthUrl: Erro na resposta:', error);
      throw new Error(error.error || 'Erro ao obter URL de autorização');
    }

    const data = await response.json();
    console.log('[GOOGLE] getGoogleAuthUrl: URL obtida:', data.authUrl ? 'SIM' : 'NÃO');
    console.log('[GOOGLE] getGoogleAuthUrl: Redirect URI:', data.redirectUri || 'NÃO DISPONÍVEL');
    return { 
      authUrl: data.authUrl,
      redirectUri: data.redirectUri || ''
    };
  } catch (error: any) {
    console.error('[GOOGLE] getGoogleAuthUrl: Erro:', error);
    throw error;
  }
}

/**
 * Processa o callback OAuth e salva os tokens
 */
export async function handleGoogleCallback(code: string, state?: string): Promise<void> {
  console.log('[GOOGLE] handleGoogleCallback: Iniciando com code:', code ? 'SIM' : 'NÃO', 'state:', state ? 'SIM' : 'NÃO');
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log('[GOOGLE] handleGoogleCallback: Sem sessão do Supabase');
      throw new Error('Usuário não autenticado');
    }

    const edgeFunctionUrl = `${getGoogleCalendarApiUrl()}/callback`;
    console.log('[GOOGLE] handleGoogleCallback: Chamando:', edgeFunctionUrl);
    
    const body: { code: string; state?: string } = { code };
    if (state) {
      body.state = state;
    }
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: await googleCalendarFetchHeaders(),
      body: JSON.stringify(body),
    });

    console.log('[GOOGLE] handleGoogleCallback: Status:', response.status);
    if (!response.ok) {
      const error = await response.json();
      console.error('[GOOGLE] handleGoogleCallback: Erro na resposta:', error);
      throw new Error(error.error || 'Erro ao processar callback');
    }
    console.log('[GOOGLE] handleGoogleCallback: Sucesso');
  } catch (error: any) {
    console.error('[GOOGLE] handleGoogleCallback: Erro:', error);
    throw error;
  }
}

/**
 * Desconecta o Google Calendar (revoga tokens no Google e apaga do banco)
 */
async function requestDisconnect(method: 'DELETE' | 'POST'): Promise<Response> {
  return fetch(`${getGoogleCalendarApiUrl()}/disconnect`, {
    method,
    headers: await googleCalendarFetchHeaders(),
  });
}

export async function disconnectGoogleAuth(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Usuário não autenticado');
  }

  let response = await requestDisconnect('DELETE');
  if (!response.ok && (response.status === 404 || response.status === 405)) {
    response = await requestDisconnect('POST');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      (error as { error?: string }).error || 'Erro ao desconectar Google Calendar',
    );
  }

  const stillConnected = await checkGoogleAuth();
  if (stillConnected) {
    throw new Error(
      'A desconexão não foi concluída no servidor. Faça o deploy da edge function google-calendar e tente novamente.',
    );
  }
}

/**
 * Cria um evento no Google Calendar baseado em uma transação
 */
export async function createCalendarEvent(transaction: {
  tipo: string;
  valor: number;
  classificacao: string;
  status: string;
  data?: string | null;
  criado_em?: string;
  obs?: string | null;
}): Promise<CreateEventResponse> {
  try {
    // Verificar se o status é "a_receber" ou "a_pagar"
    if (transaction.status !== 'a_receber' && transaction.status !== 'a_pagar') {
      return { success: false, error: 'Status da transação não requer evento no calendário' };
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'Usuário não autenticado' };
    }

    // Verificar se está autenticado no Google
    const isAuthenticated = await checkGoogleAuth();
    if (!isAuthenticated) {
      return { 
        success: false, 
        error: 'GOOGLE_AUTH_REQUIRED',
        // Retornar erro especial para indicar que precisa autenticar
      };
    }

    const response = await fetch(`${getGoogleCalendarApiUrl()}/create-event`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transaction }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Erro ao criar evento' };
    }

    const data = await response.json();
    return { success: true, eventId: data.eventId };
  } catch (error: any) {
    console.error('Erro ao criar evento no calendário:', error);
    return { success: false, error: error.message || 'Erro desconhecido ao criar evento' };
  }
}

export interface CustomEventPayload {
  title: string;
  isAllDay: boolean;
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  recurrence: string | null;
  location?: string;
  description?: string;
  colorId?: string;
  /** Minutos antes do início para popup (ex.: 30). Omitir = padrão do Google. */
  reminderMinutes?: number | null;
  /** Gera link do Google Meet no evento. */
  createMeetLink?: boolean;
}

export interface CreateCustomGoogleEventResult {
  eventId: string;
  hangoutLink: string | null;
}

/**
 * Cria um evento customizado no Google Calendar
 */
export async function createCustomGoogleEvent(
  payload: CustomEventPayload,
): Promise<CreateCustomGoogleEventResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Usuário não autenticado');

  const response = await fetch(`${getGoogleCalendarApiUrl()}/create-custom-event`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      ...(payload.colorId != null && payload.colorId !== ''
        ? { colorId: String(payload.colorId) }
        : {}),
      ...(payload.reminderMinutes != null && payload.reminderMinutes !== undefined
        ? { reminderMinutes: payload.reminderMinutes }
        : {}),
      ...(payload.createMeetLink ? { createMeetLink: true } : {}),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Erro ao criar evento');
  }

  const data = await response.json().catch(() => ({}));
  const eventId = String(data?.eventId || '');
  const hangoutLink =
    (typeof data?.hangoutLink === 'string' && data.hangoutLink) ||
    null;

  const meetUrl = isValidGoogleMeetUrl(hangoutLink) ? hangoutLink!.trim() : null;
  if (payload.createMeetLink && eventId) {
    await rememberAppMeetEvent(eventId, meetUrl);
  }

  return { eventId, hangoutLink: meetUrl };
}

/** Preenche o formulário do modal a partir de um evento Google. */
export function parseGoogleEventForForm(event: GoogleCalendarEvent) {
  const isAllDay = !!event.start?.date;
  let startDate = '';
  let endDate = '';
  let startHour = 9;
  let startMinute = 0;
  let endHour = 10;
  let endMinute = 0;

  if (isAllDay) {
    startDate = event.start?.date || '';
    endDate = event.end?.date || startDate;
  } else if (event.start?.dateTime) {
    const st = new Date(event.start.dateTime);
    const en = event.end?.dateTime ? new Date(event.end.dateTime) : st;
    startDate = `${st.getFullYear()}-${String(st.getMonth() + 1).padStart(2, '0')}-${String(st.getDate()).padStart(2, '0')}`;
    endDate = `${en.getFullYear()}-${String(en.getMonth() + 1).padStart(2, '0')}-${String(en.getDate()).padStart(2, '0')}`;
    startHour = st.getHours();
    startMinute = st.getMinutes();
    endHour = en.getHours();
    endMinute = en.getMinutes();
  }

  const recurrenceRule = event.recurrence?.[0] ?? null;
  const reminderOverride = event.reminders?.overrides?.[0]?.minutes;

  return {
    title: event.summary || '',
    description: stripMeetMarkerFromDescription(event.description) || '',
    location: event.location || '',
    isAllDay,
    startDate,
    endDate,
    startHour,
    startMinute,
    endHour,
    endMinute,
    colorId: event.colorId ? String(event.colorId) : null,
    createMeetLink: eventHasAppMeetEnabled(event),
    recurrence: recurrenceRule,
    repeatEnabled: !!recurrenceRule,
    reminderMinutes:
      reminderOverride !== undefined && reminderOverride !== null
        ? Number(reminderOverride)
        : null,
  };
}

export async function updateCustomGoogleEvent(
  eventId: string,
  payload: CustomEventPayload,
): Promise<CreateCustomGoogleEventResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Usuário não autenticado');
  if (!eventId) throw new Error('Evento inválido');

  const response = await fetch(`${getGoogleCalendarApiUrl()}/update-custom-event`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      eventId,
      ...payload,
      ...(payload.colorId != null && payload.colorId !== ''
        ? { colorId: String(payload.colorId) }
        : {}),
      ...(payload.reminderMinutes != null && payload.reminderMinutes !== undefined
        ? { reminderMinutes: payload.reminderMinutes }
        : {}),
      ...(payload.createMeetLink ? { createMeetLink: true } : {}),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Erro ao atualizar evento');
  }

  const data = await response.json().catch(() => ({}));
  const id = String(data?.eventId || eventId);
  const hangoutLink =
    typeof data?.hangoutLink === 'string' ? data.hangoutLink : null;
  const meetUrl = isValidGoogleMeetUrl(hangoutLink) ? hangoutLink.trim() : null;

  if (payload.createMeetLink) {
    await rememberAppMeetEvent(id, meetUrl);
  } else {
    await forgetAppMeetEvent(id);
  }

  return { eventId: id, hangoutLink: meetUrl };
}

export async function deleteGoogleCalendarEvent(eventId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Usuário não autenticado');
  if (!eventId) throw new Error('Evento inválido');

  const response = await fetch(`${getGoogleCalendarApiUrl()}/delete-custom-event`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ eventId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Erro ao excluir evento');
  }

  await forgetAppMeetEvent(eventId);
}

/**
 * Lista eventos do Google Calendar
 */
export async function getGoogleEvents(params?: GoogleEventsParams): Promise<GoogleCalendarEvent[]> {
  console.log('[GOOGLE] getGoogleEvents: Iniciando...');
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log('[GOOGLE] getGoogleEvents: Sem sessão do Supabase');
      throw new Error('Usuário não autenticado');
    }

    const edgeFunctionBase = `${getGoogleCalendarApiUrl()}/events`;
    const queryParams = new URLSearchParams();
    if (params?.timeMin) {
      queryParams.append('timeMin', params.timeMin);
    }
    if (params?.timeMax) {
      queryParams.append('timeMax', params.timeMax);
    }
    const edgeFunctionUrl = queryParams.toString()
      ? `${edgeFunctionBase}?${queryParams.toString()}`
      : edgeFunctionBase;
    console.log('[GOOGLE] getGoogleEvents: Chamando:', edgeFunctionUrl);
    const response = await fetch(edgeFunctionUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('[GOOGLE] getGoogleEvents: Status:', response.status);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[GOOGLE] getGoogleEvents: Erro na resposta:', error);
      throw new Error(error.error || 'Erro ao listar eventos do Google Calendar');
    }

    const data = await response.json();
    const events = (data?.events || data?.items || data || []) as GoogleCalendarEvent[];
    console.log('[GOOGLE] getGoogleEvents: Eventos recebidos:', Array.isArray(events) ? events.length : 0);

    if (Array.isArray(events)) {
      for (const ev of events) {
        const flagged =
          ev.extendedProperties?.private?.mfMeet === '1' ||
          ev.description?.includes(MF_MEET_DESC_MARKER);
        if (flagged && ev.id) {
          await rememberAppMeetEvent(ev.id, extractMeetLinkFromGoogleEvent(ev));
        }
      }
    }

    return Array.isArray(events) ? events : [];
  } catch (error: any) {
    console.error('[GOOGLE] getGoogleEvents: Erro:', error);
    throw error;
  }
}

