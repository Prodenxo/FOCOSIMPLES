import test from 'node:test';
import assert from 'node:assert/strict';

process.env.AUTH_MODE = process.env.AUTH_MODE || 'local';

const loadService = () => import('../src/services/googleCalendarLocal.service.js');

test('buildGoogleEventPeriod: compromisso com hora usa dateTime + fuso', async () => {
  const { buildGoogleEventPeriod } = await loadService();

  const period = buildGoogleEventPeriod({
    startDate: '2026-09-23',
    endDate: '2026-09-23',
    startHour: 15,
    startMinute: 0,
    endHour: 16,
    endMinute: 30,
  });

  assert.deepEqual(period, {
    start: { dateTime: '2026-09-23T15:00:00', timeZone: 'America/Sao_Paulo' },
    end: { dateTime: '2026-09-23T16:30:00', timeZone: 'America/Sao_Paulo' },
  });
});

test('buildGoogleEventPeriod: dia inteiro termina no dia seguinte (fim exclusivo)', async () => {
  const { buildGoogleEventPeriod } = await loadService();

  assert.deepEqual(
    buildGoogleEventPeriod({ isAllDay: true, startDate: '2026-09-23', endDate: '2026-09-23' }),
    { start: { date: '2026-09-23' }, end: { date: '2026-09-24' } },
  );

  assert.deepEqual(
    buildGoogleEventPeriod({ isAllDay: true, startDate: '2026-09-30', endDate: '2026-10-01' }),
    { start: { date: '2026-09-30' }, end: { date: '2026-10-02' } },
  );
});

test('buildGoogleEventPeriod: recusa término antes do início e data ausente', async () => {
  const { buildGoogleEventPeriod } = await loadService();

  assert.throws(
    () => buildGoogleEventPeriod({
      startDate: '2026-09-23',
      startHour: 16,
      startMinute: 0,
      endHour: 15,
      endMinute: 0,
    }),
    /término deve ser depois/i,
  );

  assert.throws(() => buildGoogleEventPeriod({ startDate: '' }), /Informe a data/i);
});

test('buildGoogleEventBody: campos vazios ficam fora do corpo', async () => {
  const { buildGoogleEventBody } = await loadService();

  const body = buildGoogleEventBody({
    title: '  Reunião  ',
    startDate: '2026-09-23',
    startHour: 9,
    startMinute: 0,
    endHour: 10,
    endMinute: 0,
    description: '   ',
    location: '',
    colorId: '',
    recurrence: null,
    reminderMinutes: null,
  });

  assert.equal(body.summary, 'Reunião');
  assert.equal('description' in body, false);
  assert.equal('location' in body, false);
  assert.equal('colorId' in body, false);
  assert.equal('recurrence' in body, false);
  assert.equal('extendedProperties' in body, false);
  assert.equal('conferenceData' in body, false);
  assert.deepEqual(body.reminders, { useDefault: true });
});

test('buildGoogleEventBody: lembrete, repetição e marca de Meet', async () => {
  const { buildGoogleEventBody } = await loadService();

  const body = buildGoogleEventBody({
    title: 'Consulta',
    startDate: '2026-09-23',
    startHour: 9,
    startMinute: 0,
    endHour: 10,
    endMinute: 0,
    recurrence: 'RRULE:FREQ=WEEKLY',
    reminderMinutes: 30,
    createMeetLink: true,
  }, { conferenceData: { createRequest: { requestId: 'abc' } } });

  assert.deepEqual(body.recurrence, ['RRULE:FREQ=WEEKLY']);
  assert.deepEqual(body.reminders, {
    useDefault: false,
    overrides: [{ method: 'popup', minutes: 30 }],
  });
  assert.equal(body.extendedProperties.private.mfMeet, '1');
  assert.deepEqual(body.conferenceData, { createRequest: { requestId: 'abc' } });
});

test('buildGoogleEventBody: exige título', async () => {
  const { buildGoogleEventBody } = await loadService();
  assert.throws(() => buildGoogleEventBody({ title: '   ', startDate: '2026-09-23' }), /título/i);
});
