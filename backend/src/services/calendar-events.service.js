import {
  buildCalendarEventKey,
  loadManualCompletionKeys,
  markCalendarEventCompleted,
  resolveCalendarEventFromPayload,
  resolveCompletionDateIso,
} from './calendar-checklist-completion.service.js';
import { badRequest } from '../utils/errors.js';

const isHttpError = (err) =>
  Boolean(err && typeof err.status === 'number' && err.status >= 400 && err.status < 600);
import * as transactionsService from './transactions.service.js';
import { getCertificateValidity } from './mei-certificate-store.js';
import {
  getGoogleCalendarAccessTokenForUser,
  getGoogleCalendarConnectionStatus,
} from './google-calendar-token.service.js';
import {
  buildCalendarAskEndTimeMessage,
  buildCalendarAskStartEndTimeMessage,
  buildCalendarEndBeforeStartMessage,
  buildCalendarTimeSlotInvalidMessage,
  formatCalendarTimeLabel,
} from './calendar-time-slots.js';

const SAO_PAULO_TZ = 'America/Sao_Paulo';
const CERT_EXPIRATION_TITLE = 'Vencimento do certificado digital';

/**
 * Data de hoje no fuso America/Sao_Paulo (YYYY-MM-DD).
 * @returns {string}
 */
export const calendarDateTodayInSaoPaulo = () => {
  return calendarDateAddDaysInSaoPaulo(0);
};

/**
 * Soma dias ao “hoje” em America/Sao_Paulo (YYYY-MM-DD).
 * @param {number} days
 * @returns {string}
 */
export const calendarDateAddDaysInSaoPaulo = (days) => {
  const offset = Number(days) || 0;
  const anchor = new Date();
  if (offset !== 0) {
    anchor.setTime(anchor.getTime() + offset * 24 * 60 * 60 * 1000);
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(anchor);
};

/**
 * Normaliza data de consulta do calendário.
 * Aceita `YYYY-MM-DD` ou `DD/MM/YYYY`.
 * @param {string} raw
 * @returns {{ iso: string, display: string } | null}
 */
const normalizeCalendarDateWords = (raw) => {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!s) return s;
  if (s === 'hoje') return calendarDateTodayInSaoPaulo();
  if (s === 'amanha' || s === 'amanhã') return calendarDateAddDaysInSaoPaulo(1);
  if (s === 'depois de amanha' || s === 'depois de amanhã') {
    return calendarDateAddDaysInSaoPaulo(2);
  }
  return String(raw ?? '').trim();
};

export const parseCalendarQueryDate = (raw) => {
  const normalized = normalizeCalendarDateWords(raw);
  const s = String(normalized ?? '').trim();
  if (!s) return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (!isValidYmd(year, month, day)) return null;
    const iso = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    return { iso, display: `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}` };
  }

  const brMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (brMatch) {
    const day = Number(brMatch[1]);
    const month = Number(brMatch[2]);
    const year = Number(brMatch[3]);
    if (!isValidYmd(year, month, day)) return null;
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { iso, display: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}` };
  }

  return null;
};

/**
 * @param {string} iso YYYY-MM-DD
 * @returns {string} DD/MM/YYYY
 */
export const formatCalendarDateDisplayPtBr = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

const isValidYmd = (year, month, day) => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
};

const isoDatePart = (value) => {
  if (!value) return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const transactionStatusLabel = (status) => {
  switch (status) {
    case 'recebido':
      return 'Recebido';
    case 'pago':
      return 'Pago';
    case 'a_receber':
      return 'A Receber';
    case 'a_pagar':
      return 'A Pagar';
    default:
      return status || 'Lançamento';
  }
};

/**
 * @param {string} dateIso YYYY-MM-DD
 * @param {number} [addDays]
 * @returns {string}
 */
export const calendarDateAddDaysFromIso = (dateIso, addDays = 1) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateIso || '').trim());
  if (!m) return dateIso;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + addDays));
  return dt.toISOString().slice(0, 10);
};

/**
 * Intervalo do dia civil em São Paulo para a API Google (timeMax exclusivo = 00:00 do dia seguinte).
 * @param {string} dateIso YYYY-MM-DD
 * @returns {{ timeMin: string, timeMax: string }}
 */
export const dayBoundsIsoInSaoPaulo = (dateIso) => {
  const nextIso = calendarDateAddDaysFromIso(dateIso, 1);
  return {
    timeMin: `${dateIso}T00:00:00-03:00`,
    timeMax: `${nextIso}T00:00:00-03:00`,
  };
};

/**
 * Verifica se um evento Google intersecta o dia civil em São Paulo.
 * @param {object} item
 * @param {string} dateIso
 */
/**
 * Eventos excluídos no Google ficam com status "cancelled" e ainda podem vir na API.
 * @param {object} item
 */
export const isGoogleCalendarItemActive = (item) => {
  const status = String(item?.status || 'confirmed').trim().toLowerCase();
  return status !== 'cancelled' && status !== 'canceled';
};

export const googleEventOverlapsDate = (item, dateIso) => {
  const startRaw = item?.start?.dateTime || item?.start?.date;
  if (!startRaw) return false;
  const endRaw = item?.end?.dateTime || item?.end?.date || startRaw;
  const allDay = !!item?.start?.date && !item?.start?.dateTime;

  const { timeMin, timeMax } = dayBoundsIsoInSaoPaulo(dateIso);
  const dayStart = new Date(timeMin);
  const dayEndExclusive = new Date(timeMax);

  let start;
  let end;

  if (allDay) {
    start = new Date(`${item.start.date}T00:00:00-03:00`);
    const endDateExclusive = item?.end?.date || calendarDateAddDaysFromIso(item.start.date, 1);
    end = new Date(`${endDateExclusive}T00:00:00-03:00`);
  } else {
    start = parseGoogleCalendarDateTimeToInstant(
      String(startRaw),
      item?.start?.timeZone || SAO_PAULO_TZ,
    );
    end = parseGoogleCalendarDateTimeToInstant(
      String(endRaw),
      item?.end?.timeZone || item?.start?.timeZone || SAO_PAULO_TZ,
    );
    if (!end && start) end = start;
  }

  if (!start || !end) return false;
  return start < dayEndExclusive && end > dayStart;
};

export { getGoogleCalendarAccessTokenForUser, getGoogleCalendarConnectionStatus };

/**
 * Lista eventos brutos do Google Calendar num intervalo.
 * @param {string} userId
 * @param {{ timeMin: string, timeMax: string }} range
 */
export const fetchGoogleCalendarItems = async (userId, range) => {
  const tokenResult = await getGoogleCalendarAccessTokenForUser(userId);
  if (tokenResult.error) {
    return {
      items: [],
      error: tokenResult.error,
      notLinked: !!tokenResult.notLinked,
    };
  }

  const calendarUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  calendarUrl.searchParams.set('singleEvents', 'true');
  calendarUrl.searchParams.set('orderBy', 'startTime');
  calendarUrl.searchParams.set('showDeleted', 'false');
  calendarUrl.searchParams.set('timeMin', range.timeMin);
  calendarUrl.searchParams.set('timeMax', range.timeMax);
  calendarUrl.searchParams.set(
    'fields',
    'items(id,summary,description,location,start(date,dateTime,timeZone),end(date,dateTime,timeZone),hangoutLink,conferenceData,reminders,htmlLink,status),nextPageToken',
  );

  const calendarResponse = await fetch(calendarUrl.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${tokenResult.accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!calendarResponse.ok) {
    const errText = await calendarResponse.text();
    return {
      items: [],
      error: `Erro ao listar eventos do Google: ${errText.slice(0, 200)}`,
    };
  }

  const data = await calendarResponse.json();
  return { items: data.items || [], error: null, notLinked: false };
};

export const mapGoogleItemToCalendarEvent = (item, dateIso) => {
  const startTz = item.start?.timeZone || SAO_PAULO_TZ;
  const endTz = item.end?.timeZone || startTz;
  const allDay = !!item.start?.date && !item.start?.dateTime;
  const time = !allDay && item.start?.dateTime
    ? formatGoogleDateTimeLocalPtBr(item.start.dateTime, startTz)
    : null;
  const endTime = !allDay && item.end?.dateTime
    ? formatGoogleDateTimeLocalPtBr(item.end.dateTime, endTz)
    : null;
  const durationMinutes = computeGoogleEventDurationMinutes(item);
  const durationLabel = formatDurationLabelPtBr(durationMinutes);
  const meetLink = pickMeetUriFromGoogleEvent(item);
  const reminders = extractGoogleEventReminders(item);
  const reminderLabels = reminders.map((r) => r.label).filter(Boolean);

  const startAtIso = item.start?.dateTime
    ? String(item.start.dateTime)
    : (allDay ? `${dateIso}T00:00:00-03:00` : null);
  const endAtIso = item.end?.dateTime ? String(item.end.dateTime) : null;

  return {
    id: item.id || null,
    title: (item.summary || 'Evento do Google').trim(),
    date: dateIso,
    time,
    endTime,
    startTimeZone: startTz,
    endTimeZone: endTz,
    startAtIso,
    endAtIso,
    durationMinutes,
    durationLabel,
    allDay,
    source: 'google',
    description: item.description || null,
    status: item.status || null,
    location: item.location ? String(item.location).trim() : null,
    meetLink,
    hangoutLink: meetLink,
    reminders,
    reminderSummary: reminderLabels.length ? reminderLabels.join('; ') : null,
    htmlLink: item.htmlLink ? String(item.htmlLink).trim() : null,
  };
};

const mapTransactionToCalendarEvent = (t, dateIso) => {
  const statusLabel = transactionStatusLabel(t.status);
  return {
    id: t.id || null,
    title: `${statusLabel}: ${t.classificacao} - R$ ${Number(t.valor).toFixed(2)}`,
    date: dateIso,
    time: null,
    endTime: null,
    startAtIso: `${dateIso}T00:00:00-03:00`,
    endAtIso: null,
    allDay: true,
    source: 'transaction',
    tipo: t.tipo,
    status: t.status,
    valor: Number(t.valor),
    classificacao: t.classificacao,
  };
};

/**
 * @param {object} event
 * @returns {Date | null}
 */
export const eventStartsAtInstant = (event) => {
  if (event?.startAtIso) {
    const d = parseGoogleCalendarDateTimeToInstant(
      event.startAtIso,
      event.startTimeZone || SAO_PAULO_TZ,
    );
    if (d) return d;
  }
  if (event?.date && event?.time) {
    const [h, m] = String(event.time).split(':').map((x) => Number(x));
    if (Number.isFinite(h) && Number.isFinite(m)) {
      return new Date(
        `${event.date}T${pad2(h)}:${pad2(m)}:00-03:00`,
      );
    }
  }
  if (event?.allDay && event?.date) {
    return new Date(`${event.date}T00:00:00-03:00`);
  }
  return null;
};

/**
 * @param {object} event
 * @returns {Date | null}
 */
export const eventEndsAtInstant = (event) => {
  if (event?.endAtIso) {
    const d = parseGoogleCalendarDateTimeToInstant(
      event.endAtIso,
      event.endTimeZone || event.startTimeZone || SAO_PAULO_TZ,
    );
    if (d) return d;
  }
  const start = eventStartsAtInstant(event);
  if (start && event?.durationMinutes) {
    return new Date(start.getTime() + event.durationMinutes * 60_000);
  }
  if (event?.date && event?.endTime) {
    const [h, m] = String(event.endTime).split(':').map((x) => Number(x));
    if (Number.isFinite(h) && Number.isFinite(m)) {
      return new Date(
        `${event.date}T${pad2(h)}:${pad2(m)}:00-03:00`,
      );
    }
  }
  return null;
};

/**
 * Linha única: hora de INÍCIO (time), não confundir com endTime.
 * @param {object} e
 * @param {{ includeDate?: boolean, dateDisplay?: string }} [opts]
 */
export const formatCalendarEventDisplayLine = (e, opts = {}) => {
  const title = String(e?.title || 'Compromisso').trim();
  const dateLabel = opts.dateDisplay || e?.dateDisplay || '';
  const prefix = opts.includeDate && dateLabel ? `${dateLabel} — ` : '';

  if (e?.allDay || !e?.time) {
    return `${prefix}${title} (dia inteiro)`;
  }

  let line = `${prefix}${String(e.time).slice(0, 5)}`;
  if (e.endTime) line += `–${String(e.endTime).slice(0, 5)}`;
  if (e.durationLabel) line += ` (${e.durationLabel})`;
  line += ` — ${title}`;
  if (e.source === 'transaction') line += ' [lançamento financeiro]';
  return line;
};

/**
 * @param {object} e
 * @returns {string}
 */
export const formatCalendarEventWhatsappDetail = (e) => {
  const title = String(e?.title || 'Compromisso').trim();
  const lines = [title];
  const dateLabel =
    String(e?.dateDisplay || '').trim()
    || (e?.date ? formatCalendarDateDisplayPtBr(String(e.date)) : '');
  if (dateLabel) {
    lines.push(`Data: ${dateLabel}`);
  }
  if (e?.allDay || !e?.time) {
    lines.push('Horário: dia inteiro');
  } else {
    lines.push(`Início: ${String(e.time).slice(0, 5)}`);
    if (e.endTime) lines.push(`Fim: ${String(e.endTime).slice(0, 5)}`);
    if (e.durationLabel) lines.push(`Duração: ${e.durationLabel}`);
  }
  if (e?.meetLink) lines.push(`Meet: ${e.meetLink}`);
  else if (e?.source === 'google' && e?.time && !e?.allDay) {
    lines.push('Sem Google Meet (pedir "gera o link da reunião" para criar).');
  }
  if (e?.reminderSummary) lines.push(`Lembrete: ${e.reminderSummary}`);
  if (e?.htmlLink) lines.push(`Ver no Google Calendar: ${e.htmlLink}`);
  return lines.join('\n');
};

/**
 * @param {object} event
 * @param {Date} now
 */
export const isCalendarEventStillRelevant = (event, now = new Date()) => {
  const end = eventEndsAtInstant(event);
  if (end && end > now) return true;
  const start = eventStartsAtInstant(event);
  if (start && start >= now) return true;
  if (event?.allDay && event?.date) {
    const today = calendarDateTodayInSaoPaulo();
    return String(event.date) >= today;
  }
  return false;
};

/**
 * Próximo compromisso único: exclui reuniões já terminadas (ex.: 10h–11h quando já são 17h).
 * @param {object} event
 * @param {Date} [now]
 */
export const isCalendarEventUpcomingStrict = (event, now = new Date()) => {
  const nowMs = now.getTime();
  if (event?.allDay && event?.date) {
    const today = calendarDateTodayInSaoPaulo();
    return String(event.date) >= today;
  }
  const start = eventStartsAtInstant(event);
  const end = eventEndsAtInstant(event);
  if (!start) return false;
  if (end) return end.getTime() > nowMs;
  return start.getTime() > nowMs;
};

/**
 * @param {object} event
 * @param {{ dateDisplay?: string }} [meta]
 */
export const enrichCalendarEventForDisplay = (event, meta = {}) => {
  const dateDisplay = meta.dateDisplay || event.dateDisplay || '';
  return {
    ...event,
    dateDisplay,
    displayLine: formatCalendarEventDisplayLine(event, { dateDisplay }),
    whatsappDetail: formatCalendarEventWhatsappDetail({
      ...event,
      dateDisplay,
    }),
  };
};

const buildDayAgendaMessage = (dateDisplay, events, meta = {}) => {
  if (!events.length) {
    let msg = `Nenhum compromisso programado para ${dateDisplay}.`;
    if (!meta.googleCalendarLinked && meta.googleCalendarNote) {
      msg += `\n\n${meta.googleCalendarNote}`;
    } else if (meta.googleCalendarLinked) {
      msg += '\n\n(Sua agenda Google está conectada; não há eventos neste dia.)';
    }
    return msg;
  }
  const blocks = events.map((e, i) => `${i + 1}. ${e.whatsappDetail}`);
  return `Compromissos em ${dateDisplay}:\n\n${blocks.join('\n\n')}`;
};

const buildUpcomingDayAgendaMessage = (dateDisplay, events, meta = {}) => {
  if (!events.length) {
    let msg = `Não há mais compromissos a partir de agora para ${dateDisplay}.`;
    if (!meta.googleCalendarLinked && meta.googleCalendarNote) {
      msg += `\n\n${meta.googleCalendarNote}`;
    }
    return msg;
  }
  const blocks = events.map((e, i) => `${i + 1}. ${e.whatsappDetail}`);
  return `Próximos compromissos (${dateDisplay}):\n\n${blocks.join('\n\n')}`;
};

/**
 * Linha estilo checklist WhatsApp: ☐ pendente / ✅ já realizada.
 * @param {object} e
 * @param {{ completed?: boolean }} [opts]
 */
export const formatCalendarEventChecklistLine = (e, opts = {}) => {
  const icon = opts.completed ? '✅' : '☐';
  const title = String(e?.title || 'Compromisso').trim();
  if (e?.allDay || !e?.time) {
    return `${icon} ${title} (dia inteiro)`;
  }
  const time = String(e.time).slice(0, 5);
  let line = `${icon} ${time} · ${title}`;
  if (e?.meetLink) line += '\n   🔗 Meet disponível';
  return line;
};

/**
 * @param {string} dateDisplay
 * @param {object[]} events
 * @param {{ googleCalendarLinked?: boolean, googleCalendarNote?: string|null, now?: Date, manualKeys?: Set<string>, numbered?: boolean }} [meta]
 */
export const buildDayAgendaChecklistMessage = (dateDisplay, events, meta = {}) => {
  const now = meta.now ?? new Date();
  const manualKeys = meta.manualKeys ?? new Set();
  const numbered = meta.numbered !== false;
  if (!events.length) {
    let msg = `📋 Nenhuma atividade para ${dateDisplay}.`;
    if (!meta.googleCalendarLinked && meta.googleCalendarNote) {
      msg += `\n\n${meta.googleCalendarNote}`;
    } else if (meta.googleCalendarLinked) {
      msg += '\n\n(Sua agenda Google está conectada; não há eventos neste dia.)';
    }
    return msg;
  }

  const pending = [];
  const done = [];
  events.forEach((e, idx) => {
    const completed =
      manualKeys.has(buildCalendarEventKey(e)) || !isCalendarEventStillRelevant(e, now);
    const prefix = numbered ? `${idx + 1}. ` : '';
    const line = prefix + formatCalendarEventChecklistLine(e, { completed });
    if (completed) done.push(line);
    else pending.push(line);
  });

  const body = [...pending, ...done].join('\n');
  const doneCount = done.length;
  const pendingCount = pending.length;
  const footer = [
    '━━━━━━━━━━━━━━━━━━━━',
    `${doneCount} concluída${doneCount === 1 ? '' : 's'} · ${pendingCount} pendente${pendingCount === 1 ? '' : 's'}`,
  ].join('\n');

  let msg = `📋 Suas atividades — ${dateDisplay}\n\n${body}\n${footer}`;
  if (pendingCount > 0) {
    const firstPendingIdx = events.findIndex((e) => {
      const completed =
        manualKeys.has(buildCalendarEventKey(e)) || !isCalendarEventStillRelevant(e, now);
      return !completed;
    });
    const n = firstPendingIdx + 1;
    const firstPending = events[firstPendingIdx];
    const timeHint = firstPending?.time ? String(firstPending.time).slice(0, 5) : null;
    const titleWords = String(firstPending?.title || 'compromisso')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .join(' ')
      .toLowerCase();
    if (timeHint) {
      msg += `\n\n_Para concluir: «feito ${n}» ou «concluí ${titleWords} ${timeHint}»._`;
    } else {
      msg += `\n\n_Para concluir: «feito ${n}»._`;
    }
  }
  return msg;
};

/**
 * Checklist de um dia (com conclusões manuais).
 * @param {string} userId
 * @param {{ date?: string, data?: string }} [options]
 */
export const listAgendaChecklistForUser = async (userId, options = {}) => {
  const day = await listCalendarEventsForUser(userId, options);
  const events = day.events || [];
  const now = new Date();
  const manualKeys = await loadManualCompletionKeys(userId, day.date);
  const isDone = (e) =>
    manualKeys.has(buildCalendarEventKey(e)) || !isCalendarEventStillRelevant(e, now);
  const pending = events.filter((e) => !isDone(e));
  const completed = events.filter((e) => isDone(e));

  const message = buildDayAgendaChecklistMessage(day.dateDisplay, events, {
    googleCalendarLinked: day.googleCalendarLinked,
    googleCalendarNote: day.googleCalendarNote,
    now,
    manualKeys,
  });

  return {
    ...day,
    events,
    pending,
    completed,
    count: events.length,
    pendingCount: pending.length,
    completedCount: completed.length,
    message,
    empty: events.length === 0,
    scope: 'checklist',
    format: 'checklist',
  };
};

/**
 * Agenda de hoje em formato checklist (Fase 1).
 * @param {string} userId
 */
export const listTodayAgendaChecklistForUser = async (userId) => {
  const checklist = await listAgendaChecklistForUser(userId, { date: 'hoje', data: 'hoje' });
  return { ...checklist, scope: 'checklist_hoje' };
};

/**
 * Marca compromisso como concluído manualmente (Fase 2) e devolve checklist atualizado.
 * @param {string} userId
 * @param {Record<string, unknown>} payload
 */
export const completeCalendarEventForUser = async (userId, payload = {}) => {
  try {
    const dateIso = resolveCompletionDateIso(payload);
    const day = await listCalendarEventsForUser(userId, { date: dateIso, data: dateIso });
    const events = day.events || [];
    if (!events.length) {
      return {
        ok: false,
        message: `Não há compromissos em ${day.dateDisplay} para marcar como concluído.`,
        empty: true,
      };
    }

    const resolved = resolveCalendarEventFromPayload(events, payload);
    if (resolved.invalidIndex) {
      return {
        ok: false,
        invalidIndex: true,
        message:
          `Só há ${resolved.maxIndex} item${resolved.maxIndex === 1 ? '' : 'ns'} na agenda de ${day.dateDisplay}. `
          + `Use «feito 1»${resolved.maxIndex > 1 ? ` a «feito ${resolved.maxIndex}»` : ''}.`,
      };
    }
    if (resolved.ambiguous) {
      const lines = resolved.candidates.map(
        (c) => `${c.index}. ${c.title}${c.time ? ` (${String(c.time).slice(0, 5)})` : ''}`,
      );
      return {
        ok: false,
        ambiguous: true,
        message: `Qual compromisso?\n${lines.join('\n')}\n\nResponda com o número (ex.: «feito 2»).`,
        candidates: resolved.candidates,
      };
    }
    if (resolved.notFound || !resolved.event) {
      return {
        ok: false,
        message:
          'Não encontrei esse compromisso na agenda. Peça «minha agenda hoje» e use o número do item.',
      };
    }

    await markCalendarEventCompleted(userId, resolved.event, dateIso);
    const checklist = await listAgendaChecklistForUser(userId, { date: dateIso, data: dateIso });
    const title = String(resolved.event.title || 'Compromisso').trim();
    return {
      ok: true,
      message: `✅ «${title}» marcado como concluído.\n\n${checklist.message}`,
      matchedBy: resolved.matchedBy,
      data: checklist,
    };
  } catch (err) {
    if (isHttpError(err)) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[calendar-complete] failed', { userId, msg });
    throw badRequest(msg || 'Falha ao marcar compromisso como concluído');
  }
};

/**
 * Hora/minuto atuais em America/Sao_Paulo.
 * @param {Date} [now]
 */
export const getSaoPauloHourMinute = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SAO_PAULO_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return { hour: 0, minute: 0 };
  }
  return { hour, minute };
};

/**
 * "8h" à noite no mesmo dia: se o horário já passou e ainda é manhã/tarde no relógio,
 * assume período da tarde/noite (+12h) para horas 1–11.
 * @param {{ dateIso: string, startHour: number, startMinute: number, now?: Date }} input
 */
export const disambiguatePastAmbiguousHourForToday = ({
  dateIso,
  startHour,
  startMinute,
  now = new Date(),
}) => {
  const todayIso = calendarDateTodayInSaoPaulo();
  if (dateIso !== todayIso) {
    return { hour: startHour, minute: startMinute, adjusted: false };
  }
  if (startHour < 1 || startHour > 11) {
    return { hour: startHour, minute: startMinute, adjusted: false };
  }

  const { hour: nowHour, minute: nowMinute } = getSaoPauloHourMinute(now);
  const startTotal = startHour * 60 + startMinute;
  const nowTotal = nowHour * 60 + nowMinute;
  if (startTotal >= nowTotal) {
    return { hour: startHour, minute: startMinute, adjusted: false };
  }
  if (nowHour < 13) {
    return { hour: startHour, minute: startMinute, adjusted: false };
  }

  const eveningHour = startHour + 12;
  if (eveningHour > 23) {
    return { hour: startHour, minute: startMinute, adjusted: false };
  }
  return { hour: eveningHour, minute: startMinute, adjusted: true };
};

/**
 * Compromissos do utilizador numa data (Google Calendar, certificado MEI; transações só se pedido).
 * @param {string} userId
 * @param {{ date?: string, data?: string, includeTransactions?: boolean }} [options]
 */
export const listCalendarEventsForUser = async (userId, options = {}) => {
  const rawDate = options.date ?? options.data;
  const parsed = rawDate
    ? parseCalendarQueryDate(rawDate)
    : parseCalendarQueryDate(calendarDateTodayInSaoPaulo());

  if (!parsed) {
    throw badRequest(
      'data inválida; use YYYY-MM-DD (ex.: 2026-05-16) ou DD/MM/YYYY (ex.: 16/05/2026)',
    );
  }

  const { iso: dateIso, display: dateDisplay } = parsed;
  const events = [];
  const includeTransactions = options.includeTransactions === true;

  if (includeTransactions) {
    const transactions = await transactionsService.listTransactions(userId);
    const dayTransactions = (transactions || []).filter((t) => t.data === dateIso);
    for (const t of dayTransactions) {
      events.push(mapTransactionToCalendarEvent(t, dateIso));
    }
  }

  try {
    const validity = await getCertificateValidity(userId);
    const certDay = isoDatePart(validity?.certValidTo);
    if (certDay === dateIso) {
      events.push({
        id: null,
        title: CERT_EXPIRATION_TITLE,
        date: dateIso,
        time: null,
        allDay: true,
        source: 'certificate',
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[calendar-events] certificado ignorado:', msg);
  }

  let googleCalendarLinked = false;
  let googleCalendarNote = null;

  const range = dayBoundsIsoInSaoPaulo(dateIso);
  const googleResult = await fetchGoogleCalendarItems(userId, range);

  if (googleResult.notLinked) {
    googleCalendarNote = googleResult.error;
  } else if (googleResult.error) {
    googleCalendarNote = googleResult.error;
  } else {
    googleCalendarLinked = true;
    for (const item of googleResult.items) {
      if (!isGoogleCalendarItemActive(item)) continue;
      if (!googleEventOverlapsDate(item, dateIso)) continue;
      events.push(mapGoogleItemToCalendarEvent(item, dateIso));
    }
  }

  events.sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return a.title.localeCompare(b.title, 'pt-BR');
  });

  const sources = {
    transactions: events.filter((e) => e.source === 'transaction').length,
    google: events.filter((e) => e.source === 'google').length,
    certificate: events.filter((e) => e.source === 'certificate').length,
  };

  const enriched = events.map((e) => enrichCalendarEventForDisplay(e, { dateDisplay }));
  const count = enriched.length;
  const message = buildDayAgendaMessage(dateDisplay, enriched, {
    googleCalendarLinked,
    googleCalendarNote,
  });

  return {
    date: dateIso,
    dateDisplay,
    events: enriched,
    count,
    sources,
    googleCalendarLinked,
    googleCalendarNote,
    message,
    empty: count === 0,
    fetchedAt: new Date().toISOString(),
    liveFromGoogle: googleCalendarLinked,
    includesPastEvents: true,
  };
};

/**
 * Compromissos **futuros** (ou em curso) num único dia — ex.: "próximos compromissos de hoje".
 * @param {string} userId
 * @param {{ date?: string, data?: string }} [options]
 */
export const listUpcomingCalendarEventsForUser = async (userId, options = {}) => {
  const day = await listCalendarEventsForUser(userId, options);
  const now = new Date();
  const todayIso = calendarDateTodayInSaoPaulo();
  const isFutureDay = String(day.date) > todayIso;

  const upcoming = (day.events || []).filter((e) => {
    if (isFutureDay) return true;
    return isCalendarEventStillRelevant(e, now);
  });

  const message = buildUpcomingDayAgendaMessage(day.dateDisplay, upcoming, {
    googleCalendarLinked: day.googleCalendarLinked,
    googleCalendarNote: day.googleCalendarNote,
  });

  return {
    ...day,
    events: upcoming,
    count: upcoming.length,
    message,
    empty: upcoming.length === 0,
    includesPastEvents: false,
    scope: 'proximos_dia',
  };
};

/**
 * Agenda resumida: hoje (inclui reuniões já realizadas) + próximos dias.
 * @param {string} userId
 * @param {{ daysAhead?: number }} [options]
 */
export const listCalendarEventsAgendaForUser = async (userId, options = {}) => {
  const daysAhead = Math.min(Math.max(Number(options.daysAhead) || 7, 1), 31);
  const startIso = calendarDateTodayInSaoPaulo();
  const endIso = calendarDateAddDaysFromIso(startIso, daysAhead);
  const range = {
    timeMin: `${startIso}T00:00:00-03:00`,
    timeMax: `${endIso}T00:00:00-03:00`,
  };

  /** @type {Map<string, { dateDisplay: string, events: object[] }>} */
  const byDay = new Map();
  for (let offset = 0; offset < daysAhead; offset += 1) {
    const iso = calendarDateAddDaysInSaoPaulo(offset);
    byDay.set(iso, {
      dateDisplay: formatCalendarDateDisplayPtBr(iso),
      events: [],
    });
  }

  let googleCalendarLinked = false;
  let googleCalendarNote = null;

  const googleResult = await fetchGoogleCalendarItems(userId, range);
  if (googleResult.notLinked) {
    googleCalendarNote = googleResult.error;
  } else if (googleResult.error) {
    googleCalendarNote = googleResult.error;
  } else {
    googleCalendarLinked = true;
    for (const item of googleResult.items) {
      if (!isGoogleCalendarItemActive(item)) continue;
      for (const [iso, bucket] of byDay) {
        if (!googleEventOverlapsDate(item, iso)) continue;
        bucket.events.push(mapGoogleItemToCalendarEvent(item, iso));
      }
    }
  }

  try {
    const validity = await getCertificateValidity(userId);
    const certDay = isoDatePart(validity?.certValidTo);
    if (certDay && byDay.has(certDay)) {
      byDay.get(certDay).events.push({
        id: null,
        title: CERT_EXPIRATION_TITLE,
        date: certDay,
        time: null,
        allDay: true,
        source: 'certificate',
      });
    }
  } catch {
    /* certificado opcional */
  }

  const sections = [];
  let totalCount = 0;

  for (const [iso, bucket] of byDay) {
    bucket.events.sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return a.title.localeCompare(b.title, 'pt-BR');
    });
    const enriched = bucket.events.map((e) =>
      enrichCalendarEventForDisplay(e, { dateDisplay: bucket.dateDisplay }),
    );
    totalCount += enriched.length;

    const label = iso === startIso ? 'Hoje' : bucket.dateDisplay;
    if (!enriched.length) {
      if (iso === startIso) {
        sections.push(`**${label} (${bucket.dateDisplay}):** nenhum compromisso.`);
      }
      continue;
    }
    const lines = enriched.map((e, i) => `${i + 1}. ${e.whatsappDetail}`);
    sections.push(`**${label} (${bucket.dateDisplay}):**\n${lines.join('\n')}`);
  }

  let message;
  if (!totalCount) {
    message = buildDayAgendaMessage(
      formatCalendarDateDisplayPtBr(startIso),
      [],
      { googleCalendarLinked, googleCalendarNote },
    );
    message = message.replace(
      /^Nenhum compromisso programado/,
      'Nenhum compromisso na sua agenda nos próximos dias',
    );
  } else {
    message = `Sua agenda (próximos ${daysAhead} dia(s)):\n\n${sections.filter(Boolean).join('\n\n')}`;
  }

  const todayBucket = byDay.get(startIso);
  const todayEvents = (todayBucket?.events || []).map((e) =>
    enrichCalendarEventForDisplay(e, { dateDisplay: todayBucket.dateDisplay }),
  );

  return {
    scope: 'agenda',
    date: startIso,
    dateDisplay: formatCalendarDateDisplayPtBr(startIso),
    daysAhead,
    events: todayEvents,
    eventsByDay: Object.fromEntries(
      [...byDay.entries()].map(([iso, b]) => [iso, b.events]),
    ),
    count: totalCount,
    googleCalendarLinked,
    googleCalendarNote,
    message,
    empty: totalCount === 0,
    fetchedAt: new Date().toISOString(),
    liveFromGoogle: googleCalendarLinked,
    includesPastEvents: true,
  };
};

/**
 * @param {Record<string, unknown>} payload
 * @returns {{ skipCount: number, afterStart: Date | null, afterEventId: string | null }}
 */
export const resolveFindNextCalendarOptionsFromPayload = (payload = {}) => {
  const skipRaw = payload.skipCount
    ?? payload.pular
    ?? payload.skip
    ?? payload.indice
    ?? null;
  let skipCount = skipRaw != null ? Number(skipRaw) : 0;
  if (!Number.isFinite(skipCount) || skipCount < 0) skipCount = 0;
  skipCount = Math.min(Math.floor(skipCount), 50);

  let afterStart = null;
  const afterRaw = payload.afterStart
    ?? payload.depoisDe
    ?? payload.depois_de
    ?? payload.after
    ?? null;
  if (afterRaw != null && String(afterRaw).trim() !== '') {
    const parsed = parseGoogleCalendarDateTimeToInstant(String(afterRaw), SAO_PAULO_TZ);
    if (parsed && Number.isFinite(parsed.getTime())) {
      afterStart = parsed;
    } else {
      const d = new Date(String(afterRaw));
      if (Number.isFinite(d.getTime())) afterStart = d;
    }
  }

  const afterEventId = String(
    payload.afterEventId ?? payload.depoisEventId ?? payload.excluirEventId ?? '',
  ).trim() || null;

  return { skipCount, afterStart, afterEventId };
};

/**
 * @param {Array<{ event: object, start: Date, day: object }>} candidates
 * @param {{ skipCount?: number, afterStart?: Date | null, afterEventId?: string | null }} filters
 */
export const pickNextCalendarCandidate = (candidates, filters = {}) => {
  const skipCount = filters.skipCount ?? 0;
  const afterEventId = filters.afterEventId ?? null;
  const afterStart = filters.afterStart ?? null;

  let filtered = [...candidates];
  if (afterEventId) {
    filtered = filtered.filter((c) => String(c.event?.id || '') !== afterEventId);
  }
  if (afterStart && Number.isFinite(afterStart.getTime())) {
    filtered = filtered.filter((c) => c.start.getTime() > afterStart.getTime());
  }
  return filtered[skipCount] || null;
};

/**
 * Próximo compromisso a partir de agora (fuso São Paulo), hoje → dias seguintes.
 * @param {string} userId
 * @param {{ maxDays?: number, skipCount?: number, afterStart?: string|Date, afterEventId?: string }} [options]
 */
export const findNextCalendarEventForUser = async (userId, options = {}) => {
  const maxDays = Math.min(Math.max(Number(options.maxDays) || 14, 1), 31);
  const findOpts = resolveFindNextCalendarOptionsFromPayload(options);
  const now = new Date();
  /** @type {Array<{ event: object, start: Date, day: object }>} */
  const candidates = [];

  for (let offset = 0; offset < maxDays; offset += 1) {
    const dateIso = calendarDateAddDaysInSaoPaulo(offset);
    const day = await listCalendarEventsForUser(userId, { date: dateIso });
    for (const event of day.events || []) {
      if (!isCalendarEventUpcomingStrict(event, now)) continue;
      const start = eventStartsAtInstant(event) || new Date(`${dateIso}T23:59:59-03:00`);
      candidates.push({ event, start, day });
    }
  }

  candidates.sort((a, b) => a.start.getTime() - b.start.getTime());

  const next = pickNextCalendarCandidate(candidates, findOpts);
  if (!next) {
    const hadAny = candidates.length > 0;
    const message = hadAny && (findOpts.skipCount > 0 || findOpts.afterEventId || findOpts.afterStart)
      ? 'Não há mais compromissos futuros após o que você já consultou.'
      : 'Não há compromissos futuros na agenda nos próximos dias consultados.';
    return {
      empty: true,
      message,
      nextEvent: null,
      searchedDays: maxDays,
      skipCount: findOpts.skipCount,
      totalCandidates: candidates.length,
    };
  }

  const e = enrichCalendarEventForDisplay(next.event, {
    dateDisplay: next.day.dateDisplay,
  });
  const ordinal = findOpts.skipCount > 0 ? ' (seguinte na agenda)' : '';
  const dateLabel = e.dateDisplay || next.day.dateDisplay || '';
  const message = [
    `Próximo compromisso${ordinal}:`,
    '',
    e.whatsappDetail,
    '',
    `Resumo: ${dateLabel}${e.time ? ` às ${String(e.time).slice(0, 5)}` : ' (dia inteiro)'}${
      e.endTime ? ` até ${String(e.endTime).slice(0, 5)}` : ''
    }.`,
  ].join('\n');

  return {
    empty: false,
    message,
    nextEvent: e,
    searchedDays: maxDays,
    skipCount: findOpts.skipCount,
    afterEventId: findOpts.afterEventId,
    eventId: e.id || null,
  };
};

/**
 * @param {string} raw HH:MM ou HH:MM:SS
 * @returns {{ hour: number, minute: number } | null}
 */
export const parseCalendarEventTimeHm = (raw) => {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!s) return null;

  if (
    s === 'meio dia'
    || s === 'meio-dia'
    || s === 'meiodia'
    || s === 'ao meio dia'
    || s === 'ao meio-dia'
    || s === '12h'
    || s === '12h00'
  ) {
    return { hour: 12, minute: 0 };
  }

  const periodMatch = /^(\d{1,2})\s*(?:h(?:\s*(\d{2}))?)?\s*(?:da\s+)?(manha|tarde|noite|madrugada)$/.exec(s);
  if (periodMatch) {
    let hour = Number(periodMatch[1]);
    const minute = periodMatch[2] != null ? Number(periodMatch[2]) : 0;
    const period = periodMatch[3];
    if (hour >= 1 && hour <= 12 && (period === 'tarde' || period === 'noite')) {
      if (hour < 12) hour += 12;
    }
    if (period === 'madrugada' && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  }

  const hOnly = /^(\d{1,2})h$/.exec(s);
  if (hOnly) {
    const hour = Number(hOnly[1]);
    if (hour >= 0 && hour <= 23) return { hour, minute: 0 };
  }

  const hMin = /^(\d{1,2})h(\d{2})$/.exec(s);
  if (hMin) {
    const hour = Number(hMin[1]);
    const minute = Number(hMin[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  }

  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
};

const pad2 = (n) => String(n).padStart(2, '0');

export const pickMeetUriFromGoogleEvent = (eventData) => {
  const hangout = typeof eventData?.hangoutLink === 'string' ? eventData.hangoutLink.trim() : '';
  if (hangout.includes('meet.google')) return hangout;
  const entryPoints = eventData?.conferenceData?.entryPoints || [];
  for (const ep of entryPoints) {
    const uri = String(ep?.uri || '').trim();
    if (uri.includes('meet.google')) return uri;
  }
  return null;
};

/** Offsets fixos para dateTime sem sufixo Z/± (Google manda timeZone à parte). */
const GOOGLE_TZ_OFFSET_SUFFIX = {
  'America/Sao_Paulo': '-03:00',
  'America/Fortaleza': '-03:00',
  'America/Belem': '-03:00',
  'America/Manaus': '-04:00',
  'America/Cuiaba': '-04:00',
  'America/Rio_Branco': '-05:00',
};

/**
 * Converte dateTime da API Google (com ou sem offset) para instante UTC.
 * @param {string} dateTimeIso
 * @param {string} [timeZone]
 * @returns {Date | null}
 */
export const parseGoogleCalendarDateTimeToInstant = (dateTimeIso, timeZone = SAO_PAULO_TZ) => {
  const raw = String(dateTimeIso || '').trim();
  if (!raw.includes('T')) return null;

  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  const normalized = raw.length === 16 ? `${raw}:00` : raw;
  const suffix = GOOGLE_TZ_OFFSET_SUFFIX[timeZone] || GOOGLE_TZ_OFFSET_SUFFIX[SAO_PAULO_TZ];
  const d = new Date(`${normalized}${suffix}`);
  return Number.isFinite(d.getTime()) ? d : null;
};

/**
 * @param {string} dateTimeIso
 * @param {string} [timeZone]
 * @returns {string | null} HH:MM
 */
export const formatGoogleDateTimeLocalPtBr = (dateTimeIso, timeZone = SAO_PAULO_TZ) => {
  const d = parseGoogleCalendarDateTimeToInstant(dateTimeIso, timeZone);
  if (!d) return null;
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: SAO_PAULO_TZ,
  });
};

/**
 * @param {object} item Evento Google Calendar API
 * @returns {number | null}
 */
export const computeGoogleEventDurationMinutes = (item) => {
  const allDay = !!item?.start?.date && !item?.start?.dateTime;
  if (allDay) return null;
  const startRaw = item?.start?.dateTime;
  const endRaw = item?.end?.dateTime;
  if (!startRaw || !endRaw) return null;
  const start = parseGoogleCalendarDateTimeToInstant(
    startRaw,
    item?.start?.timeZone || SAO_PAULO_TZ,
  );
  const end = parseGoogleCalendarDateTimeToInstant(
    endRaw,
    item?.end?.timeZone || item?.start?.timeZone || SAO_PAULO_TZ,
  );
  if (!start || !end) return null;
  const mins = Math.round((end.getTime() - start.getTime()) / 60_000);
  return mins > 0 ? mins : null;
};

/**
 * @param {number | null} minutes
 * @returns {string | null}
 */
export const formatDurationLabelPtBr = (minutes) => {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 1) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h${String(m).padStart(2, '0')}`;
  if (h > 0) return `${h}h`;
  return `${m} min`;
};

/**
 * @param {object} item
 * @returns {Array<{ method: string, minutes: number | null, label: string }>}
 */
export const extractGoogleEventReminders = (item) => {
  const reminders = item?.reminders;
  if (!reminders || typeof reminders !== 'object') return [];

  if (reminders.useDefault === true) {
    return [{
      method: 'default',
      minutes: null,
      label: 'Padrão do Google Calendar',
    }];
  }

  const overrides = Array.isArray(reminders.overrides) ? reminders.overrides : [];
  return overrides.map((o) => {
    const method = String(o?.method || 'popup');
    const minutes = o?.minutes != null ? Number(o.minutes) : null;
    const label = Number.isFinite(minutes)
      ? `${minutes} min antes (${method})`
      : `Lembrete (${method})`;
    return { method, minutes: Number.isFinite(minutes) ? minutes : null, label };
  });
};

/**
 * @param {Record<string, unknown>} payload
 */
/**
 * Título do compromisso — não usar `nome` (costuma ser o utilizador, não o assunto).
 * @param {Record<string, unknown>} payload
 */
export const resolveCalendarEventTitleFromPayload = (payload = {}) => {
  const pick = (...keys) => {
    for (const key of keys) {
      const v = String(payload[key] ?? '').trim();
      if (v) return v;
    }
    return '';
  };

  const explicit = pick('title', 'titulo', 'summary', 'assunto', 'evento', 'compromisso');
  if (explicit) return explicit;

  const person = pick(
    'com',
    'with',
    'convidado',
    'participante',
    'contato',
    'cliente',
    'pessoa',
  );
  if (person) return `Reunião com ${person}`;

  return '';
};

/**
 * @param {Record<string, unknown>} payload
 * @param {{ dateIso?: string, referenceNow?: Date }} [context]
 * @returns {{ startHour: number, startMinute: number, endHour: number, endMinute: number, allDay: boolean, timeAdjustedToEvening?: boolean }}
 */
export const resolveCreateCalendarTimesFromPayload = (payload = {}, context = {}) => {
  const hasExplicitTime = [
    'time',
    'hora',
    'horario',
    'startTime',
    'inicio',
    'horaInicio',
  ].some((k) => payload[k] != null && String(payload[k]).trim() !== '');

  const endFromPayload = payload.endTime
    ?? payload.horaFim
    ?? payload.fim
    ?? payload.end
    ?? null;

  const hasExplicitEnd = (endFromPayload != null && String(endFromPayload).trim() !== '')
    || payload.endHour != null
    || payload.endMinute != null
    || payload.durationMinutes != null
    || payload.duracaoMinutos != null
    || payload.duracao != null;

  const explicitNotAllDay = payload.allDay === false || payload.diaInteiro === false;
  const wantsTimedEvent = context.wantsMeet === true || explicitNotAllDay;

  if (wantsTimedEvent && !hasExplicitTime) {
    throw badRequest(buildCalendarAskStartEndTimeMessage(), {
      code: 'CALENDAR_TIME_SLOTS_REQUIRED',
      botHint:
        'Pergunte hora de início e término antes de create_calendar_event. '
        + 'Use payload.time e payload.endTime (qualquer duração, ex. 14:00–14:15 ou 14:00–16:00).',
    });
  }

  const allDay = payload.allDay === true
    || payload.diaInteiro === true
    || String(payload.allDay || payload.diaInteiro || '').toLowerCase() === 'true'
    || (!hasExplicitTime && payload.allDay !== false && payload.diaInteiro !== false);

  let startHour = Number(payload.startHour);
  let startMinute = Number(payload.startMinute);
  if (!Number.isFinite(startHour)) startHour = 9;
  if (!Number.isFinite(startMinute)) startMinute = 0;

  const startRaw = payload.time
    ?? payload.hora
    ?? payload.horario
    ?? payload.startTime
    ?? payload.inicio
    ?? payload.horaInicio;

  let timeAdjustedToEvening = false;

  if (startRaw != null && String(startRaw).trim() !== '') {
    const tm = parseCalendarEventTimeHm(startRaw);
    if (!tm) {
      throw badRequest(buildCalendarTimeSlotInvalidMessage(startRaw), {
        code: 'CALENDAR_TIME_INVALID',
      });
    }
    startHour = tm.hour;
    startMinute = tm.minute;
  }

  const dateIso = context.dateIso
    ? String(context.dateIso).trim()
    : null;
  if (dateIso && !allDay && hasExplicitTime) {
    const disambig = disambiguatePastAmbiguousHourForToday({
      dateIso,
      startHour,
      startMinute,
      now: context.referenceNow,
    });
    if (disambig.adjusted) {
      startHour = disambig.hour;
      startMinute = disambig.minute;
      timeAdjustedToEvening = true;
    }
  }

  if (!hasExplicitTime && endFromPayload != null && String(endFromPayload).trim() !== '') {
    throw badRequest(
      'payload.endTime/horaFim é hora de término, não de início. Informe payload.time (início), ex.: "18:30".',
    );
  }

  if (hasExplicitTime && !hasExplicitEnd && !allDay) {
    throw badRequest(buildCalendarAskEndTimeMessage(startHour, startMinute), {
      code: 'CALENDAR_END_TIME_REQUIRED',
      botHint: 'Peça hora de término e chame create_calendar_event com endTime (ex. 14:15 ou 16:00).',
    });
  }

  let endHour = Number(payload.endHour);
  let endMinute = Number(payload.endMinute);

  if (endFromPayload != null && String(endFromPayload).trim() !== '') {
    const endTm = parseCalendarEventTimeHm(endFromPayload);
    if (!endTm) {
      throw badRequest(buildCalendarTimeSlotInvalidMessage(endFromPayload), {
        code: 'CALENDAR_END_TIME_INVALID',
      });
    }
    endHour = endTm.hour;
    endMinute = endTm.minute;
  } else {
    const durRaw = payload.durationMinutes
      ?? payload.duracaoMinutos
      ?? payload.duracao
      ?? null;
    const dur = durRaw != null ? Number(durRaw) : NaN;
    if (Number.isFinite(dur) && dur > 0) {
      const totalStart = startHour * 60 + startMinute;
      const totalEnd = totalStart + Math.round(dur);
      endHour = Math.floor(totalEnd / 60);
      endMinute = totalEnd % 60;
    } else if (!Number.isFinite(endHour)) {
      endHour = startHour + 1;
      endMinute = startMinute;
    }
  }

  if (!Number.isFinite(endMinute)) endMinute = startMinute;

  if (!allDay && (hasExplicitEnd || hasExplicitTime)) {
    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;
    if (endTotal <= startTotal) {
      throw badRequest(
        buildCalendarEndBeforeStartMessage(startHour, startMinute, endHour, endMinute),
        { code: 'CALENDAR_END_BEFORE_START' },
      );
    }
  }

  if (endHour >= 24) {
    endHour = 23;
    endMinute = 59;
  }

  return {
    startHour,
    startMinute,
    endHour,
    endMinute,
    allDay,
    timeAdjustedToEvening,
  };
};

export const parseCreateMeetLinkFlag = (payload = {}) => {
  const raw = payload.createMeetLink
    ?? payload.createMeet
    ?? payload.meet
    ?? payload.meeting
    ?? payload.comMeet
    ?? payload.com_meet
    ?? payload.videoCall
    ?? payload.linkMeet
    ?? payload.comVideo;
  if (raw === true) return true;
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return false;
  return ['true', '1', 'yes', 'sim', 'on'].includes(s);
};

const fetchGoogleCalendarEventById = async (accessToken, eventId) => {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) return null;
  return res.json();
};

/**
 * Cria compromisso no Google Calendar (primary) do utilizador.
 * @param {string} userId
 * @param {Record<string, unknown>} payload
 */
export const createCalendarEventForUser = async (userId, payload = {}) => {
  const title = resolveCalendarEventTitleFromPayload(payload);
  if (!title) {
    throw badRequest(
      'Informe payload.title (ex.: "Reunião com Arthur") ou payload.com / participante.',
    );
  }

  const rawDate = payload.date ?? payload.data;
  const parsed = rawDate
    ? parseCalendarQueryDate(rawDate)
    : parseCalendarQueryDate(calendarDateTodayInSaoPaulo());
  if (!parsed) {
    throw badRequest(
      'data inválida; use YYYY-MM-DD ou DD/MM/YYYY (ex.: 2026-05-28 ou 28/05/2026).',
    );
  }

  const wantsMeet = parseCreateMeetLinkFlag(payload);

  const {
    startHour,
    startMinute,
    endHour,
    endMinute,
    allDay,
    timeAdjustedToEvening,
  } = resolveCreateCalendarTimesFromPayload(payload, {
    dateIso: parsed.iso,
    wantsMeet,
  });

  const endDateParsed = payload.endDate ?? payload.dataFim
    ? parseCalendarQueryDate(String(payload.endDate ?? payload.dataFim))
    : null;
  const endDateIso = endDateParsed?.iso ?? parsed.iso;

  let description = String(
    payload.description ?? payload.descricao ?? payload.obs ?? '',
  ).trim();

  if (wantsMeet && allDay) {
    throw badRequest(
      'Google Meet exige horário definido. Informe payload.time (ex.: 15:00) ou allDay: false.',
    );
  }

  const tokenResult = await getGoogleCalendarAccessTokenForUser(userId);
  if (tokenResult.error) {
    return {
      ok: false,
      notLinked: !!tokenResult.notLinked,
      refreshFailed: !!tokenResult.refreshFailed,
      message: tokenResult.error,
      date: parsed.iso,
      dateDisplay: parsed.display,
    };
  }

  if (wantsMeet) {
    description = description ? `${description}\n[MF_MEET]` : '[MF_MEET]';
  }

  const eventBody = {
    summary: title,
    ...(description ? { description } : {}),
  };

  if (wantsMeet) {
    eventBody.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
    eventBody.extendedProperties = { private: { mfMeet: '1' } };
  }

  const reminderRaw = payload.reminderMinutes
    ?? payload.lembreteMinutos
    ?? payload.reminder
    ?? null;
  const reminderMins = reminderRaw != null ? Number(reminderRaw) : NaN;
  if (Number.isFinite(reminderMins) && reminderMins >= 0) {
    eventBody.reminders = {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: reminderMins }],
    };
  }

  if (allDay) {
    eventBody.start = { date: parsed.iso };
    eventBody.end = { date: endDateIso };
  } else {
    eventBody.start = {
      dateTime: `${parsed.iso}T${pad2(startHour)}:${pad2(startMinute)}:00`,
      timeZone: SAO_PAULO_TZ,
    };
    eventBody.end = {
      dateTime: `${endDateIso}T${pad2(endHour)}:${pad2(endMinute)}:00`,
      timeZone: SAO_PAULO_TZ,
    };
  }

  const calendarQuery = wantsMeet ? '?conferenceDataVersion=1' : '';
  const calendarResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events${calendarQuery}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    },
  );

  if (!calendarResponse.ok) {
    const errText = await calendarResponse.text();
    return {
      ok: false,
      message: `Erro ao criar evento no Google Calendar: ${errText.slice(0, 200)}`,
      date: parsed.iso,
      dateDisplay: parsed.display,
    };
  }

  let eventData = await calendarResponse.json();
  let meetUri = pickMeetUriFromGoogleEvent(eventData);

  if (wantsMeet && eventData.id && !meetUri) {
    const refreshed = await fetchGoogleCalendarEventById(
      tokenResult.accessToken,
      eventData.id,
    );
    if (refreshed) {
      eventData = refreshed;
      meetUri = pickMeetUriFromGoogleEvent(eventData);
    }
  }

  const timeLabel = allDay
    ? 'dia inteiro'
    : formatCalendarTimeLabel(startHour, startMinute);
  const endLabel = allDay ? null : formatCalendarTimeLabel(endHour, endMinute);

  let message = allDay
    ? `Compromisso criado: "${title}" em ${parsed.display} (dia inteiro).`
    : `Compromisso criado: "${title}" em ${parsed.display} — início ${timeLabel}${endLabel ? `, fim ${endLabel}` : ''}.`;
  if (timeAdjustedToEvening) {
    message += ' (horário interpretado como período da tarde/noite, pois o horário da manhã já tinha passado).';
  }
  if (wantsMeet) {
    message += meetUri
      ? ` Link Google Meet: ${meetUri}`
      : ' Meet solicitado; o link pode demorar alguns segundos a aparecer no Google Calendar.';
  }

  const durationMinutes = computeGoogleEventDurationMinutes(eventData);
  const reminders = extractGoogleEventReminders(eventData);

  return {
    ok: true,
    message,
    eventId: eventData.id || null,
    hangoutLink: meetUri,
    meetLink: meetUri,
    createMeetLink: wantsMeet,
    date: parsed.iso,
    dateDisplay: parsed.display,
    title,
    allDay,
    time: allDay ? null : timeLabel,
    endTime: allDay ? null : formatGoogleDateTimeLocalPtBr(eventData.end?.dateTime),
    durationMinutes,
    durationLabel: formatDurationLabelPtBr(durationMinutes),
    reminders,
    reminderSummary: reminders.map((r) => r.label).join('; ') || null,
    source: 'google',
    timeAdjustedToEvening: !!timeAdjustedToEvening,
  };
};

/**
 * Localiza evento Google por eventId ou título+data (uso interno: excluir / Meet).
 * @param {string} userId
 * @param {Record<string, unknown>} payload
 * @returns {Promise<
 *   | { ok: true, eventId: string, item: object, matchedTitle: string, accessToken: string, parsed?: object }
 *   | { ok: false, message: string, notLinked?: boolean, ambiguous?: boolean, candidates?: object[] }
 * >}
 */
export const resolveGoogleCalendarEventTarget = async (userId, payload = {}) => {
  let eventId = String(payload.eventId ?? payload.id ?? '').trim();
  let matchedTitle = null;
  let item = null;
  /** @type {{ iso: string, display: string } | null} */
  let parsed = null;

  if (!eventId) {
    const titleQuery = String(
      payload.title ?? payload.titulo ?? payload.summary ?? payload.assunto ?? '',
    ).trim();
    const rawDate = payload.date ?? payload.data;
    parsed = rawDate
      ? parseCalendarQueryDate(rawDate)
      : parseCalendarQueryDate(calendarDateTodayInSaoPaulo());
    if (!titleQuery) {
      throw badRequest(
        'Informe payload.eventId (da última list_calendar_events) ou title + data.',
      );
    }
    if (!parsed) {
      throw badRequest('data inválida para localizar o compromisso.');
    }

    const range = dayBoundsIsoInSaoPaulo(parsed.iso);
    const googleResult = await fetchGoogleCalendarItems(userId, range);
    if (googleResult.error) {
      return {
        ok: false,
        notLinked: !!googleResult.notLinked,
        message: googleResult.error,
      };
    }

    const needle = titleQuery.toLowerCase();
    const matches = googleResult.items.filter((googleItem) => {
      if (!isGoogleCalendarItemActive(googleItem)) return false;
      if (!googleEventOverlapsDate(googleItem, parsed.iso)) return false;
      const sum = String(googleItem.summary || '').trim().toLowerCase();
      return sum.includes(needle) || needle.includes(sum);
    });

    if (!matches.length) {
      return {
        ok: false,
        message:
          `Nenhum compromisso ativo no Google Calendar com título parecido a "${titleQuery}" em ${parsed.display}.`,
        date: parsed.iso,
        dateDisplay: parsed.display,
      };
    }

    if (matches.length > 1) {
      const titles = matches.map((m) => String(m.summary || 'Evento').trim()).join('; ');
      return {
        ok: false,
        message:
          `Há ${matches.length} compromissos parecidos (${titles}). `
          + 'Use payload.eventId da listagem ou peça ao utilizador qual é.',
        ambiguous: true,
        candidates: matches.map((m) => ({
          eventId: m.id,
          title: m.summary,
          hasMeet: Boolean(pickMeetUriFromGoogleEvent(m)),
        })),
      };
    }

    item = matches[0];
    eventId = String(item.id);
    matchedTitle = String(item.summary || titleQuery).trim();
  }

  const tokenResult = await getGoogleCalendarAccessTokenForUser(userId);
  if (tokenResult.error) {
    return {
      ok: false,
      notLinked: !!tokenResult.notLinked,
      message: tokenResult.error,
    };
  }

  if (!item) {
    item = await fetchGoogleCalendarEventById(tokenResult.accessToken, eventId);
    if (!item) {
      return {
        ok: false,
        message: 'Compromisso não encontrado no Google Calendar.',
        eventId,
      };
    }
    if (!isGoogleCalendarItemActive(item)) {
      return {
        ok: false,
        message: 'Esse compromisso foi cancelado ou excluído no Google Calendar.',
        eventId,
      };
    }
    matchedTitle = String(item.summary || 'Compromisso').trim();
  }

  return {
    ok: true,
    eventId,
    item,
    matchedTitle,
    accessToken: tokenResult.accessToken,
    parsed: parsed || undefined,
  };
};

/**
 * Adiciona Google Meet a compromisso já existente (criado no Google sem link).
 * @param {string} userId
 * @param {Record<string, unknown>} payload — `eventId` ou `title`+`data`
 */
export const addMeetLinkToCalendarEventForUser = async (userId, payload = {}) => {
  const resolved = await resolveGoogleCalendarEventTarget(userId, payload);
  if (!resolved.ok) {
    return resolved;
  }

  const { eventId, item, matchedTitle, accessToken } = resolved;
  const allDay = !!item?.start?.date && !item?.start?.dateTime;
  if (allDay) {
    return {
      ok: false,
      message:
        'Compromisso de dia inteiro não aceita Google Meet. '
        + 'Defina um horário no Google Calendar e peça o link de novo.',
      eventId,
      title: matchedTitle,
    };
  }

  let current = item;
  const existing = pickMeetUriFromGoogleEvent(current);
  if (existing) {
    return {
      ok: true,
      alreadyHadMeet: true,
      eventId,
      title: matchedTitle,
      meetLink: existing,
      message: `O compromisso "${matchedTitle}" já tem Google Meet:\n${existing}`,
    };
  }

  const fresh = await fetchGoogleCalendarEventById(accessToken, eventId);
  if (fresh) {
    current = fresh;
    const freshMeet = pickMeetUriFromGoogleEvent(fresh);
    if (freshMeet) {
      return {
        ok: true,
        alreadyHadMeet: true,
        eventId,
        title: matchedTitle,
        meetLink: freshMeet,
        message: `O compromisso "${matchedTitle}" já tem Google Meet:\n${freshMeet}`,
      };
    }
  }

  let description = String(current?.description || '').trim();
  if (!description.includes('[MF_MEET]')) {
    description = description ? `${description}\n[MF_MEET]` : '[MF_MEET]';
  }

  const patchBody = {
    description,
    conferenceData: {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    extendedProperties: {
      private: {
        ...(current?.extendedProperties?.private || {}),
        mfMeet: '1',
      },
    },
  };

  const patchRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patchBody),
    },
  );

  if (!patchRes.ok) {
    const errText = await patchRes.text();
    return {
      ok: false,
      message: `Erro ao gerar Google Meet: ${errText.slice(0, 200)}`,
      eventId,
      title: matchedTitle,
    };
  }

  let eventData = await patchRes.json();
  let meetUri = pickMeetUriFromGoogleEvent(eventData);
  if (!meetUri) {
    const refreshed = await fetchGoogleCalendarEventById(accessToken, eventId);
    if (refreshed) {
      eventData = refreshed;
      meetUri = pickMeetUriFromGoogleEvent(refreshed);
    }
  }

  const title = matchedTitle || String(eventData?.summary || 'Compromisso').trim();
  if (!meetUri) {
    return {
      ok: true,
      eventId,
      title,
      meetLink: null,
      pendingMeet: true,
      message:
        `Pedido de Google Meet enviado para "${title}". `
        + 'O link pode demorar alguns segundos — chame list_calendar_events para confirmar.',
    };
  }

  return {
    ok: true,
    eventId,
    title,
    meetLink: meetUri,
    message: `Google Meet gerado para "${title}":\n${meetUri}`,
  };
};

/**
 * Remove compromisso no Google Calendar (não há cache local — só API Google).
 * @param {string} userId
 * @param {Record<string, unknown>} payload — `eventId` ou `title`+`data`
 */
export const deleteCalendarEventForUser = async (userId, payload = {}) => {
  const resolved = await resolveGoogleCalendarEventTarget(userId, payload);
  if (!resolved.ok) {
    return resolved;
  }

  const { eventId, matchedTitle } = resolved;

  const deleteResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${resolved.accessToken}` },
    },
  );

  if (deleteResponse.status === 404 || deleteResponse.status === 410) {
    return {
      ok: true,
      alreadyDeleted: true,
      eventId,
      message:
        'Esse compromisso já não existe no Google Calendar (já foi excluído). '
        + 'Use list_calendar_events para ver a agenda atual.',
    };
  }

  if (!deleteResponse.ok && deleteResponse.status !== 204) {
    const errText = await deleteResponse.text();
    return {
      ok: false,
      message: `Erro ao excluir no Google Calendar: ${errText.slice(0, 200)}`,
      eventId,
    };
  }

  const label = matchedTitle || String(payload.title || payload.titulo || 'Compromisso').trim();
  return {
    ok: true,
    eventId,
    title: label,
    message: `Compromisso excluído do Google Calendar: "${label}".`,
    agentHint:
      'Para confirmar ao utilizador, chame list_calendar_events de novo (agenda ao vivo, sem memória do chat).',
  };
};
