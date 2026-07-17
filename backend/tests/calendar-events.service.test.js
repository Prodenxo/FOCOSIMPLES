import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCalendarQueryDate,
  calendarDateTodayInSaoPaulo,
  dayBoundsIsoInSaoPaulo,
  googleEventOverlapsDate,
  formatCalendarDateDisplayPtBr,
} from '../src/services/calendar-events.service.js';

test('parseCalendarQueryDate aceita YYYY-MM-DD e DD/MM/YYYY', () => {
  assert.deepEqual(parseCalendarQueryDate('2026-05-16'), {
    iso: '2026-05-16',
    display: '16/05/2026',
  });
  assert.deepEqual(parseCalendarQueryDate('16/05/2026'), {
    iso: '2026-05-16',
    display: '16/05/2026',
  });
  assert.equal(parseCalendarQueryDate('2026-13-01'), null);
  assert.equal(parseCalendarQueryDate('32/05/2026'), null);
  assert.equal(parseCalendarQueryDate(''), null);
});

test('calendarDateTodayInSaoPaulo devolve YYYY-MM-DD', () => {
  assert.match(calendarDateTodayInSaoPaulo(), /^\d{4}-\d{2}-\d{2}$/);
});

test('dayBoundsIsoInSaoPaulo usa offset -03:00 e timeMax exclusivo no dia seguinte', () => {
  const b = dayBoundsIsoInSaoPaulo('2026-05-16');
  assert.equal(b.timeMin, '2026-05-16T00:00:00-03:00');
  assert.equal(b.timeMax, '2026-05-17T00:00:00-03:00');
});

test('formatCalendarDateDisplayPtBr', () => {
  assert.equal(formatCalendarDateDisplayPtBr('2026-05-16'), '16/05/2026');
});

test('googleEventOverlapsDate — evento no mesmo dia', () => {
  const item = {
    summary: 'Reunião',
    start: { dateTime: '2026-05-16T14:00:00-03:00' },
    end: { dateTime: '2026-05-16T15:00:00-03:00' },
  };
  assert.equal(googleEventOverlapsDate(item, '2026-05-16'), true);
});

test('googleEventOverlapsDate — evento noutro dia', () => {
  const item = {
    start: { date: '2026-05-17' },
    end: { date: '2026-05-18' },
  };
  assert.equal(googleEventOverlapsDate(item, '2026-05-16'), false);
});

test('googleEventOverlapsDate — reunião 8h com timeZone São Paulo', () => {
  const item = {
    summary: 'Meeting',
    start: { dateTime: '2026-05-28T08:00:00', timeZone: 'America/Sao_Paulo' },
    end: { dateTime: '2026-05-28T09:00:00', timeZone: 'America/Sao_Paulo' },
  };
  assert.equal(googleEventOverlapsDate(item, '2026-05-28'), true);
});
