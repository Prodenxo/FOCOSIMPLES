import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calendarDateTodayInSaoPaulo,
  disambiguatePastAmbiguousHourForToday,
  parseCalendarEventTimeHm,
  parseCalendarQueryDate,
  parseCreateMeetLinkFlag,
  resolveCalendarEventTitleFromPayload,
  resolveCreateCalendarTimesFromPayload,
} from '../src/services/calendar-events.service.js';
import { buildAccessRequestApprovedApplicantMessage } from '../src/services/access-request-whatsapp.service.js';

test('parseCalendarEventTimeHm aceita HH:MM', () => {
  assert.deepEqual(parseCalendarEventTimeHm('9:05'), { hour: 9, minute: 5 });
  assert.deepEqual(parseCalendarEventTimeHm('14:30:00'), { hour: 14, minute: 30 });
  assert.equal(parseCalendarEventTimeHm('25:00'), null);
});

test('parseCalendarQueryDate para create_calendar_event', () => {
  const br = parseCalendarQueryDate('28/05/2026');
  assert.equal(br?.iso, '2026-05-28');
  const iso = parseCalendarQueryDate('2026-05-28');
  assert.equal(iso?.display, '28/05/2026');
});

test('parseCalendarQueryDate aceita hoje e amanhã', () => {
  const tomorrow = parseCalendarQueryDate('amanhã');
  const today = parseCalendarQueryDate('hoje');
  assert.ok(tomorrow?.iso);
  assert.ok(today?.iso);
  assert.notEqual(tomorrow?.iso, today?.iso);
});

test('parseCalendarEventTimeHm aceita meio dia', () => {
  assert.deepEqual(parseCalendarEventTimeHm('meio dia'), { hour: 12, minute: 0 });
  assert.deepEqual(parseCalendarEventTimeHm('12h'), { hour: 12, minute: 0 });
});

test('parseCalendarEventTimeHm aceita da tarde e da noite', () => {
  assert.deepEqual(parseCalendarEventTimeHm('8 da noite'), { hour: 20, minute: 0 });
  assert.deepEqual(parseCalendarEventTimeHm('3h da tarde'), { hour: 15, minute: 0 });
  assert.deepEqual(parseCalendarEventTimeHm('8h30 da noite'), { hour: 20, minute: 30 });
});

test('disambiguatePastAmbiguousHourForToday: 8h à noite vira 20h', () => {
  const today = calendarDateTodayInSaoPaulo();
  const evening = new Date(`${today}T22:30:00-03:00`);
  const result = disambiguatePastAmbiguousHourForToday({
    dateIso: today,
    startHour: 8,
    startMinute: 0,
    now: evening,
  });
  assert.equal(result.adjusted, true);
  assert.equal(result.hour, 20);
});

test('resolveCreateCalendarTimesFromPayload ajusta 8h passado no mesmo dia', () => {
  const today = calendarDateTodayInSaoPaulo();
  const evening = new Date(`${today}T22:00:00-03:00`);
  const t = resolveCreateCalendarTimesFromPayload(
    { time: '8h', endTime: '21:00' },
    { dateIso: today, referenceNow: evening },
  );
  assert.equal(t.startHour, 20);
  assert.equal(t.timeAdjustedToEvening, true);
});

test('resolveCalendarEventTitleFromPayload ignora nome do utilizador', () => {
  assert.equal(
    resolveCalendarEventTitleFromPayload({ nome: 'Rosiele', com: 'Arthur' }),
    'Reunião com Arthur',
  );
  assert.equal(
    resolveCalendarEventTitleFromPayload({ title: 'Call cliente' }),
    'Call cliente',
  );
  assert.equal(resolveCalendarEventTitleFromPayload({ nome: 'Rosiele' }), '');
});

test('resolveCreateCalendarTimesFromPayload separa início e fim', () => {
  const t = resolveCreateCalendarTimesFromPayload({
    time: '18:30',
    endTime: '19:30',
  });
  assert.equal(t.startHour, 18);
  assert.equal(t.startMinute, 30);
  assert.equal(t.endHour, 19);
  assert.equal(t.endMinute, 30);
});

test('parseCreateMeetLinkFlag aceita variantes', () => {
  assert.equal(parseCreateMeetLinkFlag({ createMeetLink: true }), true);
  assert.equal(parseCreateMeetLinkFlag({ meet: 'sim' }), true);
  assert.equal(parseCreateMeetLinkFlag({ meeting: 'true' }), true);
  assert.equal(parseCreateMeetLinkFlag({}), false);
});

test('mensagem aprovacao inclui link grupo suporte', () => {
  const msg = buildAccessRequestApprovedApplicantMessage({
    fullName: 'Ana',
    email: 'ana@test.com',
  });
  assert.match(msg, /G0F3SaEFfvNI066k5MYKDT/);
});
