import { apiClient } from './apiClient';

export const MF_MEET_DESC_MARKER = '[MF_MEET]';

const meetCache = new Map();

export function rememberAppMeetEvent(eventId, meetUrl) {
  if (eventId) meetCache.set(eventId, meetUrl || true);
}

export function forgetAppMeetEvent(eventId) {
  meetCache.delete(eventId);
}

export function isAppMeetEventSync(eventId) {
  return meetCache.has(eventId);
}

export function getCachedMeetLinkSync(eventId) {
  const v = meetCache.get(eventId);
  return typeof v === 'string' ? v : null;
}

export function isValidGoogleMeetUrl(url) {
  if (!url?.trim()) return false;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return host === 'meet.google.com' || host.endsWith('.meet.google.com');
  } catch {
    return false;
  }
}

export function eventHasAppMeetEnabled(event) {
  if (isAppMeetEventSync(event.id)) return true;
  if (event.extendedProperties?.private?.mfMeet === '1') return true;
  if (event.description?.includes(MF_MEET_DESC_MARKER)) return true;
  return false;
}

export function stripMeetMarkerFromDescription(desc) {
  if (!desc) return undefined;
  const cleaned = desc.replace(/\n?\[MF_MEET\]\s*/g, '').trim();
  return cleaned || undefined;
}

export function extractMeetLinkFromGoogleEvent(event) {
  const hangout = event.hangoutLink?.trim();
  if (isValidGoogleMeetUrl(hangout)) return hangout;
  for (const ep of event.conferenceData?.entryPoints || []) {
    const uri = ep.uri?.trim();
    if (uri && isValidGoogleMeetUrl(uri)) return uri;
  }
  return null;
}

export function getGoogleMeetLink(event) {
  if (!eventHasAppMeetEnabled(event)) return null;
  const cached = getCachedMeetLinkSync(event.id);
  if (isValidGoogleMeetUrl(cached)) return cached.trim();
  return extractMeetLinkFromGoogleEvent(event);
}

export function formatGoogleEventTimeRange(event) {
  const startRaw = event.start?.dateTime;
  if (!startRaw) return null;
  const start = new Date(startRaw);
  const endRaw = event.end?.dateTime;
  const end = endRaw ? new Date(endRaw) : null;
  const timeFmt = { hour: '2-digit', minute: '2-digit' };
  const startStr = start.toLocaleTimeString('pt-BR', timeFmt);
  if (!end) return startStr;
  const endStr = end.toLocaleTimeString('pt-BR', timeFmt);
  return `${startStr} – ${endStr}`;
}

export async function checkGoogleAuth() {
  try {
    const data = await apiClient.get('/google-calendar/check-auth');
    return Boolean(data?.authenticated);
  } catch {
    return false;
  }
}

export async function getGoogleAuthUrl(returnTo) {
  const qs = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
  const data = await apiClient.get(`/google-calendar/auth${qs}`);
  if (!data?.authUrl) throw new Error('URL de autorização do Google não retornada.');
  return { authUrl: data.authUrl, redirectUri: data.redirectUri || '' };
}

export async function disconnectGoogleAuth() {
  try {
    await apiClient.delete('/google-calendar/disconnect');
  } catch {
    await apiClient.post('/google-calendar/disconnect', {});
  }
  const still = await checkGoogleAuth();
  if (still) throw new Error('Não foi possível desconectar o Google Calendar.');
}

export async function getGoogleEvents({ timeMin, timeMax } = {}) {
  const params = new URLSearchParams();
  if (timeMin) params.set('timeMin', timeMin);
  if (timeMax) params.set('timeMax', timeMax);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const data = await apiClient.get(`/google-calendar/events${qs}`);
  return data?.events || [];
}

export async function createCustomGoogleEvent(payload) {
  const data = await apiClient.post('/google-calendar/create-custom-event', payload);
  const eventId = String(data?.eventId || '');
  const hangoutLink = typeof data?.hangoutLink === 'string' ? data.hangoutLink : null;
  const meetUrl = isValidGoogleMeetUrl(hangoutLink) ? hangoutLink.trim() : null;
  if (payload.createMeetLink && eventId) rememberAppMeetEvent(eventId, meetUrl);
  return { eventId, hangoutLink: meetUrl };
}

export async function updateCustomGoogleEvent(eventId, payload) {
  const data = await apiClient.post('/google-calendar/update-custom-event', { eventId, ...payload });
  const id = String(data?.eventId || eventId);
  const hangoutLink = typeof data?.hangoutLink === 'string' ? data.hangoutLink : null;
  const meetUrl = isValidGoogleMeetUrl(hangoutLink) ? hangoutLink.trim() : null;
  if (payload.createMeetLink) rememberAppMeetEvent(id, meetUrl);
  else forgetAppMeetEvent(id);
  return { eventId: id, hangoutLink: meetUrl };
}

export async function deleteGoogleCalendarEvent(eventId) {
  await apiClient.post('/google-calendar/delete-custom-event', { eventId });
  forgetAppMeetEvent(eventId);
}

export function parseGoogleEventForForm(event) {
  const isAllDay = !!event.start?.date;
  let startDate = '';
  let endDate = '';
  let startHour = 9;
  let startMinute = 0;
  let endHour = 10;
  let endMinute = 0;

  if (isAllDay) {
    startDate = event.start?.date || '';
    const endExclusive = event.end?.date || startDate;
    endDate = endExclusive ? addDaysYmdLocal(endExclusive, -1) : startDate;
    if (endDate < startDate) endDate = startDate;
  } else if (event.start?.dateTime) {
    const st = new Date(event.start.dateTime);
    const en = event.end?.dateTime ? new Date(event.end.dateTime) : st;
    startDate = ymdFromDate(st);
    endDate = ymdFromDate(en);
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

function ymdFromDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDaysYmdLocal(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return ymdFromDate(dt);
}

export function startGoogleAuthFlow(returnTo) {
  return getGoogleAuthUrl(returnTo).then(({ authUrl }) => {
    if (typeof window === 'undefined') return null;
    window.location.href = authUrl;
    return null;
  });
}

export function captureGoogleCalendarOAuthReturn() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const status = params.get('googleCalendar');
  if (status !== 'connected' && status !== 'error') return null;
  try {
    sessionStorage.setItem('mf_google_calendar_oauth_v1', status);
  } catch {
    /* ignore */
  }
  params.delete('googleCalendar');
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
  window.history.replaceState({}, document.title, nextUrl);
  return status;
}

export function consumeGoogleCalendarOAuthReturn() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('mf_google_calendar_oauth_v1');
    if (raw === 'connected' || raw === 'error') {
      sessionStorage.removeItem('mf_google_calendar_oauth_v1');
      return raw;
    }
  } catch {
    /* ignore */
  }
  return null;
}
