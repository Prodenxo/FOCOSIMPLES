import { getCategorySliceColorForId } from '@/lib/categoryColors';
import {
  formatGoogleEventTimeRange,
  getGoogleMeetLink,
  stripMeetMarkerFromDescription,
} from '@/lib/googleCalendarService';
import { getGoogleEventColorHex } from '@/lib/googleCalendarColors';
import {
  addDaysYmd,
  compareEvents,
  localDateStr,
  parseLocalYmd,
} from '@/lib/agendaUtils';

const TRANSACTION_STATUS_LABEL = {
  recebido: 'Recebido',
  pago: 'Pago',
  a_receber: 'A receber',
  a_pagar: 'A pagar',
};

export function getGoogleEventDates(event) {
  if (event.start?.date) {
    const startKey = event.start.date;
    const endExclusive = event.end?.date || addDaysYmd(startKey, 1);
    const keys = [];
    let cursor = startKey;
    while (cursor < endExclusive) {
      keys.push(cursor);
      cursor = addDaysYmd(cursor, 1);
    }
    return {
      startDate: parseLocalYmd(startKey),
      endDate: parseLocalYmd(addDaysYmd(endExclusive, -1)),
      dateKeys: keys,
      isAllDay: true,
    };
  }
  const raw = event.start?.dateTime;
  if (!raw) return null;
  const startDate = new Date(raw);
  const endDate = event.end?.dateTime ? new Date(event.end.dateTime) : startDate;
  const startKey = localDateStr(startDate);
  const endKey = localDateStr(endDate);
  const keys = startKey === endKey ? [startKey] : [startKey, endKey];
  return { startDate, endDate, dateKeys: keys, isAllDay: false };
}

export function buildTransactionEvent(tx, accentFallback) {
  const eventDate = tx.data
    ? parseLocalYmd(tx.data.slice(0, 10))
    : new Date(tx.criado_em);
  const dateKey = localDateStr(eventDate);
  const isIncome = tx.tipo === 'entrada' || tx.tipo === 'Entrada';
  const cor = tx.categoria
    ? getCategorySliceColorForId(tx.categoria, false)
    : accentFallback;

  return {
    id: String(tx.id),
    source: 'transaction',
    dateKey,
    startDate: eventDate,
    endDate: eventDate,
    dateKeys: [dateKey],
    title: tx.classificacao || 'Sem descrição',
    subtitle: tx.obs || undefined,
    isAllDay: true,
    timeLabel: null,
    color: cor,
    amount: tx.valor,
    isIncome,
    status: tx.status,
    statusLabel: TRANSACTION_STATUS_LABEL[tx.status] || tx.status,
    rawTransaction: tx,
  };
}

export function buildGoogleCombinedEvent(event, accentFallback) {
  const parsed = getGoogleEventDates(event);
  if (!parsed) return null;
  const meetLink = getGoogleMeetLink(event);
  return {
    id: event.id,
    source: 'google',
    dateKey: parsed.dateKeys[0],
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    dateKeys: parsed.dateKeys,
    title: event.summary || 'Evento Google',
    subtitle: stripMeetMarkerFromDescription(event.description),
    isAllDay: parsed.isAllDay,
    timeLabel: parsed.isAllDay ? 'Dia inteiro' : formatGoogleEventTimeRange(event),
    color: getGoogleEventColorHex(event.colorId, accentFallback),
    colorId: event.colorId,
    meetLink: meetLink || undefined,
    htmlLink: event.htmlLink,
    location: event.location,
    rawGoogleEvent: event,
  };
}

export function buildCombinedEvents(transactions, googleEvents, accentFallback = '#168D72') {
  const items = [];
  for (const tx of transactions) {
    items.push(buildTransactionEvent(tx, accentFallback));
  }
  for (const ev of googleEvents) {
    const built = buildGoogleCombinedEvent(ev, accentFallback);
    if (built) items.push(built);
  }
  items.sort(compareEvents);
  return items;
}

export function eventsForDateKey(events, dateKey) {
  return events.filter((e) => e.dateKeys.includes(dateKey)).sort(compareEvents);
}

export function uniqueEventsInRange(events, startYmd, endYmd) {
  const seen = new Set();
  const result = [];
  for (const e of events) {
    const inRange = e.dateKeys.some((k) => k >= startYmd && k <= endYmd);
    if (!inRange) continue;
    const key = `${e.source}:${e.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(e);
  }
  return result.sort(compareEvents);
}

export function upcomingEventsAfter(events, afterYmd, limit = 10) {
  return events
    .filter((e) => e.dateKeys.some((k) => k > afterYmd))
    .sort((a, b) => {
      const da = a.dateKeys.find((k) => k > afterYmd) || a.dateKey;
      const db = b.dateKeys.find((k) => k > afterYmd) || b.dateKey;
      if (da !== db) return da.localeCompare(db);
      return compareEvents(a, b);
    })
    .slice(0, limit);
}

export function cellPreviewLabel(event) {
  if (event.isAllDay || !event.timeLabel) return event.title;
  const time = event.timeLabel.split('–')[0]?.trim() || '';
  const shortTime = time.replace(':00', 'h').replace(':', 'h');
  return `${shortTime} ${event.title}`;
}
