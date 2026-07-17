import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDayAgendaChecklistMessage,
  formatCalendarEventChecklistLine,
  isCalendarEventStillRelevant,
} from '../src/services/calendar-events.service.js';

test('formatCalendarEventChecklistLine: pendente e concluída', () => {
  assert.match(
    formatCalendarEventChecklistLine({ title: 'Reunião', time: '09:00:00' }, { completed: false }),
    /^☐ 09:00 · Reunião$/,
  );
  assert.match(
    formatCalendarEventChecklistLine({ title: 'Reunião', time: '09:00:00' }, { completed: true }),
    /^✅ 09:00 · Reunião$/,
  );
});

test('buildDayAgendaChecklistMessage: separa pendentes e concluídas', () => {
  const past = {
    title: 'Stand-up',
    time: '08:00:00',
    date: '2099-06-16',
    endTime: '08:30:00',
  };
  const future = {
    title: 'Reunião',
    time: '23:59:00',
    date: '2099-06-16',
    endTime: '23:59:59',
  };
  const now = new Date('2099-06-16T12:00:00-03:00');
  assert.equal(isCalendarEventStillRelevant(past, now), false);
  assert.equal(isCalendarEventStillRelevant(future, now), true);

  const msg = buildDayAgendaChecklistMessage('16/06/2099', [past, future], { now });
  assert.ok(msg.includes('📋 Suas atividades'));
  assert.ok(msg.indexOf('☐ 23:59') < msg.indexOf('✅ 08:00'));
  assert.ok(msg.includes('1 concluída · 1 pendente'));
});

test('buildDayAgendaChecklistMessage: dia vazio', () => {
  const msg = buildDayAgendaChecklistMessage('16/06/2099', [], { googleCalendarLinked: true });
  assert.ok(msg.includes('Nenhuma atividade'));
});

test('buildDayAgendaChecklistMessage: conclusão manual via manualKeys', () => {
  const future = {
    id: 'evt-x',
    title: 'Reunião',
    time: '23:59:00',
    date: '2099-06-16',
    endTime: '23:59:59',
  };
  const now = new Date('2099-06-16T12:00:00-03:00');
  const manualKeys = new Set(['id:evt-x']);
  const msg = buildDayAgendaChecklistMessage('16/06/2099', [future], { now, manualKeys });
  assert.ok(msg.includes('✅ 23:59 · Reunião'));
  assert.ok(msg.includes('1 concluída · 0 pendente'));
});
