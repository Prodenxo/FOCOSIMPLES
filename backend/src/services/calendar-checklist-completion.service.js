import { createSupabaseClient } from '../config/supabase.js';
import { ensureCalendarChecklistTable } from './db-bootstrap.service.js';
import { badRequest } from '../utils/errors.js';

const isHttpError = (err) =>
  Boolean(err && typeof err.status === 'number' && err.status >= 400 && err.status < 600);

const isMissingTableError = (msg) =>
  /does not exist|schema cache|42P01|relation.*calendar_checklist/i.test(String(msg || ''));

const isUniqueViolation = (err) =>
  String(err?.code || '') === '23505' || /duplicate key|unique constraint/i.test(String(err?.message || ''));

const todayIsoSaoPaulo = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

/**
 * Chave estável para marcar conclusão (Google event id ou sintético).
 * @param {object} event
 */
export const buildCalendarEventKey = (event) => {
  const id = String(event?.id || '').trim();
  if (id) return `id:${id}`;
  const title = String(event?.title || 'Compromisso').trim().toLowerCase();
  const time = event?.allDay || !event?.time ? 'allday' : String(event.time).slice(0, 5);
  const date = String(event?.date || '');
  const source = String(event?.source || 'unknown');
  return `syn:${date}|${source}|${time}|${title}`;
};

/**
 * @param {string} userId
 * @param {string} dateIso YYYY-MM-DD
 */
export const loadManualCompletionKeys = async (userId, dateIso) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return new Set();
  const admin = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await admin
    .from('calendar_checklist_completions')
    .select('event_key')
    .eq('user_id', userId)
    .eq('event_date', dateIso);
  if (error) {
    console.warn('[calendar-checklist] load completions:', error.message);
    return new Set();
  }
  return new Set((data || []).map((r) => String(r.event_key)));
};

/**
 * Grava conclusão manual (insert ou update se já existir).
 * @returns {Promise<{ message?: string, code?: string }|null>}
 */
const persistCalendarCompletion = async (admin, row) => {
  const { error: insertError } = await admin.from('calendar_checklist_completions').insert(row);
  if (!insertError) return null;

  if (isUniqueViolation(insertError)) {
    const { error: updateError } = await admin
      .from('calendar_checklist_completions')
      .update({
        title: row.title,
        event_id: row.event_id,
        completed_at: row.completed_at,
      })
      .eq('user_id', row.user_id)
      .eq('event_date', row.event_date)
      .eq('event_key', row.event_key);
    if (!updateError) return null;
    throw badRequest(updateError.message || 'Falha ao atualizar conclusão');
  }

  return insertError;
};

export const markCalendarEventCompleted = async (userId, event, dateIso) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw badRequest('Conclusão manual indisponível (SUPABASE_SERVICE_ROLE_KEY).');
  }
  try {
    const eventKey = buildCalendarEventKey(event);
    const row = {
      user_id: userId,
      event_date: dateIso,
      event_id: event.id ? String(event.id) : null,
      event_key: eventKey,
      title: String(event.title || 'Compromisso').trim(),
      completed_at: new Date().toISOString(),
    };
    const admin = createSupabaseClient({ useServiceRole: true });

    let persistErr = await persistCalendarCompletion(admin, row);
    if (persistErr && isMissingTableError(persistErr.message)) {
      const ensured = await ensureCalendarChecklistTable({ force: true });
      if (!ensured.ok) {
        throw badRequest(
          (ensured.reason || ensured.error || 'Tabela calendar_checklist_completions em falta.')
          + ' Execute create-calendar-checklist-completions.sql no Supabase SQL Editor.',
        );
      }
      persistErr = await persistCalendarCompletion(admin, row);
    }

    if (persistErr) {
      throw badRequest(persistErr.message || 'Falha ao gravar conclusão');
    }

    return { eventKey, title: event.title };
  } catch (err) {
    if (isHttpError(err)) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[calendar-checklist] mark failed', { userId, dateIso, msg, err });
    throw badRequest(msg || 'Falha ao marcar compromisso como concluído');
  }
};

const normalizeTitle = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

const parseTimeHint = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^\d{1,2}:\d{2}/.test(s)) return s.slice(0, 5);
  const m = s.match(/(\d{1,2})[:hH](\d{0,2})/);
  if (!m) return '';
  const h = m[1].padStart(2, '0');
  const min = (m[2] || '00').padStart(2, '0');
  return `${h}:${min}`;
};

/**
 * Extrai índice, hora e título de payload + texto livre (ex.: «feito 2», «concluí reunião 14h»).
 * @param {Record<string, unknown>} payload
 */
export const enrichCompletionPayload = (payload = {}) => {
  const merged = { ...payload };
  const rawText = [payload.text, payload.query, payload.message, payload.pedido]
    .filter(Boolean)
    .map(String)
    .join(' ')
    .trim();

  if (!merged.index && !merged.indice && !merged.numero && !merged.item && rawText) {
    const m = rawText.match(/\b(?:feito|item|conclu[ií]?)\s*(\d+)\b/i);
    if (m) merged.index = Number(m[1]);
  }

  if (!merged.time && !merged.hora) {
    const fromFields = parseTimeHint(payload.time ?? payload.hora);
    const fromText = rawText ? parseTimeHint(rawText) : '';
    if (fromFields) merged.time = fromFields;
    else if (fromText) merged.time = fromText;
  }

  if (!merged.title && !merged.titulo && !merged.nome && rawText) {
    const cleaned = rawText
      .replace(/\b(?:feito|conclu[ií]?r?|marcar|item)\s*\d*\b/gi, '')
      .replace(/\d{1,2}[:hH]\d{0,2}/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length >= 3) merged.title = cleaned;
  }

  return merged;
};

/**
 * @param {object[]} events sorted
 * @param {Record<string, unknown>} payload
 */
export const resolveCalendarEventFromPayload = (events, payload = {}) => {
  const enriched = enrichCompletionPayload(payload);
  const index = Number(
    enriched.index ?? enriched.indice ?? enriched.numero ?? enriched.item,
  );
  if (Number.isFinite(index) && index >= 1) {
    if (index > events.length) {
      return { invalidIndex: true, index, maxIndex: events.length };
    }
    return { event: events[index - 1], matchedBy: 'index', index };
  }

  const eventId = String(enriched.eventId ?? enriched.id ?? '').trim();
  if (eventId) {
    const found = events.find((e) => String(e.id || '') === eventId);
    if (found) return { event: found, matchedBy: 'eventId' };
  }

  const titleNeedle = normalizeTitle(enriched.title ?? enriched.titulo ?? enriched.nome);
  const timeHint = parseTimeHint(enriched.time ?? enriched.hora);
  if (titleNeedle) {
    const candidates = events.filter((e) => normalizeTitle(e.title).includes(titleNeedle));
    if (timeHint) {
      const withTime = candidates.filter(
        (e) => String(e.time || '').slice(0, 5) === timeHint,
      );
      if (withTime.length === 1) return { event: withTime[0], matchedBy: 'title_time' };
      if (withTime.length > 1) {
        return {
          ambiguous: true,
          candidates: withTime.map((e) => ({
            index: events.indexOf(e) + 1,
            title: e.title,
            time: e.time,
          })),
        };
      }
    }
    if (candidates.length === 1) return { event: candidates[0], matchedBy: 'title' };
    if (candidates.length > 1) {
      return {
        ambiguous: true,
        candidates: candidates.map((e) => ({
          index: events.indexOf(e) + 1,
          title: e.title,
          time: e.time,
        })),
      };
    }
  }

  if (timeHint) {
    const byTime = events.filter((e) => String(e.time || '').slice(0, 5) === timeHint);
    if (byTime.length === 1) return { event: byTime[0], matchedBy: 'time' };
    if (byTime.length > 1) {
      return {
        ambiguous: true,
        candidates: byTime.map((e) => ({
          index: events.indexOf(e) + 1,
          title: e.title,
          time: e.time,
        })),
      };
    }
  }

  if (events.length === 1) {
    return { event: events[0], matchedBy: 'single_event' };
  }

  return { notFound: true };
};

export const resolveCompletionDateIso = (payload = {}) => {
  const raw = payload.date ?? payload.data;
  if (!raw || String(raw).toLowerCase() === 'hoje') {
    return todayIsoSaoPaulo();
  }
  return String(raw).trim();
};
