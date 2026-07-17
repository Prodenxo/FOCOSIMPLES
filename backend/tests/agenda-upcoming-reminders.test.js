import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUpcomingReminderDedupKey,
  buildUpcomingReminderEventKey,
  dedupeUpcomingCalendarEvents,
  formatUpcomingAgendaWhatsappMessage,
  isEventInUpcomingReminderWindow,
} from '../src/services/agenda-upcoming-reminders.service.js';

test('isEventInUpcomingReminderWindow: dentro da janela', () => {
  const now = new Date('2099-06-16T13:45:00-03:00');
  const event = {
    title: 'Call',
    time: '14:00:00',
    date: '2099-06-16',
    allDay: false,
  };
  assert.equal(isEventInUpcomingReminderWindow(event, 30, now), true);
});

test('isEventInUpcomingReminderWindow: já passou ou muito longe', () => {
  const now = new Date('2099-06-16T14:05:00-03:00');
  const event = {
    title: 'Call',
    time: '14:00:00',
    date: '2099-06-16',
    allDay: false,
  };
  assert.equal(isEventInUpcomingReminderWindow(event, 30, now), false);

  const far = new Date('2099-06-16T10:00:00-03:00');
  assert.equal(isEventInUpcomingReminderWindow(event, 30, far), false);
});

test('isEventInUpcomingReminderWindow: ignora dia inteiro', () => {
  const now = new Date('2099-06-16T10:00:00-03:00');
  assert.equal(
    isEventInUpcomingReminderWindow({ title: 'X', allDay: true }, 30, now),
    false,
  );
});

test('formatUpcomingAgendaWhatsappMessage: inclui lembrete e dica de concluir', () => {
  const event = { title: 'Reunião', time: '14:00:00', date: '2099-06-16', allDay: false };
  const msg = formatUpcomingAgendaWhatsappMessage(event, 30);
  assert.ok(msg.includes('⏰'));
  assert.ok(msg.includes('Reunião'));
  assert.ok(msg.includes('concluí'));
});

test('buildUpcomingReminderDedupKey: estável', () => {
  assert.equal(
    buildUpcomingReminderDedupKey('u1', '2099-06-16', 'id:evt-1'),
    'u1:2099-06-16:id:evt-1',
  );
});

test('buildUpcomingReminderEventKey: ignora id Google — só data+hora+título', () => {
  const keyA = buildUpcomingReminderEventKey({
    id: 'google-a',
    title: 'Reunião com Dani',
    time: '18:15:00',
    date: '2099-06-25',
    allDay: false,
  });
  const keyB = buildUpcomingReminderEventKey({
    id: null,
    title: 'Reunião com Dani',
    time: '18:15:00',
    date: '2099-06-25',
    allDay: false,
  });
  assert.equal(keyA, keyB);
});

test('dedupeUpcomingCalendarEvents: um compromisso duplicado → prefere com Meet', () => {
  const merged = dedupeUpcomingCalendarEvents([
    {
      id: 'evt-1',
      title: 'Reunião com Dani da Espanha',
      time: '18:15:00',
      date: '2099-06-25',
      allDay: false,
    },
    {
      id: 'evt-2',
      title: 'Reunião com Dani da Espanha',
      time: '18:15:00',
      date: '2099-06-25',
      allDay: false,
      meetLink: 'https://meet.google.com/abc-def-ghi',
    },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].meetLink, 'https://meet.google.com/abc-def-ghi');
});
