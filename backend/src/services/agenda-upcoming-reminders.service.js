import { env } from '../config/env.js';
import { createSupabaseClient } from '../config/supabase.js';
import { listUsersWithWhatsappLink } from './agenda-reminders.service.js';
import {
  calendarDateTodayInSaoPaulo,
  eventStartsAtInstant,
  formatCalendarEventDisplayLine,
  listCalendarEventsForUser,
} from './calendar-events.service.js';
import {
  isWhatsappOutboundConfigured,
  sendWhatsappMessage,
} from './whatsapp-outbound.service.js';

const DEFAULT_MINUTES_BEFORE = 30;
const MIN_LEAD_MINUTES = 5;

/** Dedup em memória (fallback + cache após gravar no Supabase). */
const sentThisProcess = new Set();

export const isAgendaUpcomingWhatsappEnabled = () => {
  const explicit = String(env.AGENDA_UPCOMING_WHATSAPP_ENABLED || '').trim();
  if (explicit) return explicit.toLowerCase() === 'true';
  return String(env.AGENDA_WHATSAPP_REMINDERS_ENABLED || '').toLowerCase() === 'true';
};

export const getAgendaUpcomingMinutesBefore = () => {
  const n = Number.parseInt(env.AGENDA_UPCOMING_MINUTES_BEFORE || '', 10);
  if (Number.isFinite(n) && n >= MIN_LEAD_MINUTES && n <= 120) return n;
  return DEFAULT_MINUTES_BEFORE;
};

export const buildUpcomingReminderDedupKey = (userId, dateIso, eventKey) =>
  `${userId}:${dateIso}:${eventKey}`;

const normalizeUpcomingEventTitle = (title) =>
  String(title || 'Compromisso')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');

/**
 * Chave estável para dedup (~30 min): data + hora + título (ignora id Google variável).
 * Evita 2 lembretes quando o mesmo compromisso aparece com chaves diferentes (ex.: com/sem Meet).
 * @param {object} event
 */
export const buildUpcomingReminderEventKey = (event) => {
  const title = normalizeUpcomingEventTitle(event?.title);
  const time = event?.allDay || !event?.time ? 'allday' : String(event.time).slice(0, 5);
  const date = String(event?.date || '');
  return `slot:${date}|${time}|${title}`;
};

/**
 * Mesmo compromisso pode vir duplicado na listagem (ids distintos, Meet preenchido só num).
 * @param {object[]} events
 */
export const dedupeUpcomingCalendarEvents = (events) => {
  /** @type {Map<string, object>} */
  const byKey = new Map();
  for (const event of events || []) {
    const key = buildUpcomingReminderEventKey(event);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, event);
      continue;
    }
    const prevMeet = Boolean(prev?.meetLink);
    const nextMeet = Boolean(event?.meetLink);
    if (nextMeet && !prevMeet) {
      byKey.set(key, event);
      continue;
    }
    if (!prev?.id && event?.id) {
      byKey.set(key, event);
    }
  }
  return [...byKey.values()];
};

const isDuplicateKeyError = (error) =>
  String(error?.code || '') === '23505'
  || /duplicate|unique constraint|already exists/i.test(String(error?.message || ''));

const isMissingTableError = (msg) =>
  /does not exist|schema cache|42P01|relation.*calendar_upcoming/i.test(String(msg || ''));

/**
 * Garante 1 lembrete por compromisso/dia (persistido no Supabase).
 * @returns {Promise<boolean>} true = pode enviar agora
 */
export const tryAcquireUpcomingReminderSlot = async (userId, dateIso, eventKey) => {
  const localKey = buildUpcomingReminderDedupKey(userId, dateIso, eventKey);
  if (sentThisProcess.has(localKey)) return false;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    sentThisProcess.add(localKey);
    return true;
  }

  const admin = createSupabaseClient({ useServiceRole: true });
  const { error } = await admin.from('calendar_upcoming_reminder_sent').insert({
    user_id: userId,
    event_date: dateIso,
    event_key: eventKey,
    sent_at: new Date().toISOString(),
  });

  if (!error) {
    sentThisProcess.add(localKey);
    return true;
  }

  if (isDuplicateKeyError(error)) {
    sentThisProcess.add(localKey);
    return false;
  }

  if (isMissingTableError(error.message)) {
    console.warn(
      '[agenda-upcoming] tabela calendar_upcoming_reminder_sent em falta — '
      + 'execute create-calendar-agenda-whatsapp-tables.sql no Supabase',
    );
    return false;
  }

  console.warn('[agenda-upcoming] dedup falhou (não envia para evitar flood):', error.message);
  return false;
};

/**
 * Compromisso dentro da janela de ~30 min antes (primeiro tick que entrar envia 1x).
 * @param {object} event
 * @param {number} minutesBefore
 * @param {Date} [now]
 */
export const isEventInUpcomingReminderWindow = (event, minutesBefore, now = new Date()) => {
  if (event?.allDay || !event?.time) return false;
  const start = eventStartsAtInstant(event);
  if (!start) return false;
  const msUntil = start.getTime() - now.getTime();
  const maxMs = minutesBefore * 60_000;
  return msUntil > 0 && msUntil <= maxMs;
};

export const formatUpcomingAgendaWhatsappMessage = (event, minutesBefore) => {
  const start = eventStartsAtInstant(event);
  const mins = start
    ? Math.max(1, Math.round((start.getTime() - Date.now()) / 60_000))
    : minutesBefore;
  const line = formatCalendarEventDisplayLine(event);
  let msg = `⏰ Em ~${mins} min\n${line}`;
  if (event.meetLink) msg += `\n🔗 ${event.meetLink}`;
  msg += '\n\n_Digite «concluí» ou o número do item quando terminar._';
  return msg;
};

/**
 * Lembretes ~30 min antes — 1 envio por compromisso (dedup Supabase).
 */
export const runAgendaUpcomingWhatsappReminders = async () => {
  if (!isAgendaUpcomingWhatsappEnabled()) {
    return { ok: true, skipped: 'disabled', sent: 0 };
  }
  if (!isWhatsappOutboundConfigured()) {
    return { ok: true, skipped: 'no_whatsapp', sent: 0 };
  }

  const minutesBefore = getAgendaUpcomingMinutesBefore();
  const now = new Date();
  const dateIso = calendarDateTodayInSaoPaulo();
  const users = await listUsersWithWhatsappLink();
  let sent = 0;

  for (const { userId, phone } of users) {
    try {
      const calendar = await listCalendarEventsForUser(userId, { date: dateIso });
      const upcoming = dedupeUpcomingCalendarEvents(
        (calendar.events || []).filter((e) =>
          isEventInUpcomingReminderWindow(e, minutesBefore, now),
        ),
      );
      for (const event of upcoming) {
        const eventKey = buildUpcomingReminderEventKey(event);
        const canSend = await tryAcquireUpcomingReminderSlot(userId, dateIso, eventKey);
        if (!canSend) continue;

        const message = formatUpcomingAgendaWhatsappMessage(event, minutesBefore);
        await sendWhatsappMessage({
          userId,
          phone,
          message,
          source: 'agenda_reminder_upcoming',
          date: dateIso,
          eventId: event.id,
        });
        sent += 1;
        console.info('[agenda-upcoming] enviado', { userId, eventId: event.id, dateIso });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[agenda-upcoming] utilizador ignorado', { userId, msg });
    }
  }

  if (sent > 0) {
    console.info('[agenda-upcoming] lote', { dateIso, minutesBefore, sent });
  }

  return { ok: true, dateIso, minutesBefore, sent, users: users.length };
};

/** @deprecated use buildUpcomingReminderDedupKey */
export const buildUpcomingReminderRunKey = (userId, eventKey, dateIso) =>
  buildUpcomingReminderDedupKey(userId, dateIso, eventKey);

/** @deprecated dedup em ficheiro removido — usar tryAcquireUpcomingReminderSlot */
export const tryAcquireUpcomingReminderFile = () => false;
