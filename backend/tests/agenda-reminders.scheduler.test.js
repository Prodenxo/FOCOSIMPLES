import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getAgendaSchedulerClockInSaoPaulo,
  isAgendaSchedulerWindow,
  resolveAgendaSlotForSchedulerTick,
} from '../src/services/agenda-reminders.scheduler.js';

test('isAgendaSchedulerWindow: primeiros 5 min da hora alvo', () => {
  assert.equal(isAgendaSchedulerWindow(7, 0, 7), true);
  assert.equal(isAgendaSchedulerWindow(7, 4, 7), true);
  assert.equal(isAgendaSchedulerWindow(7, 5, 7), false);
  assert.equal(isAgendaSchedulerWindow(8, 0, 7), false);
});

test('resolveAgendaSlotForSchedulerTick', () => {
  assert.equal(resolveAgendaSlotForSchedulerTick(7, 2), 'manha');
  assert.equal(resolveAgendaSlotForSchedulerTick(21, 0), 'noite');
  assert.equal(resolveAgendaSlotForSchedulerTick(10, 0), null);
});

test('getAgendaSchedulerClockInSaoPaulo devolve hour/minute/dateIso', () => {
  const clock = getAgendaSchedulerClockInSaoPaulo(new Date('2026-05-27T12:00:00Z'));
  assert.ok(Number.isFinite(clock.hour));
  assert.ok(Number.isFinite(clock.minute));
  assert.match(clock.dateIso, /^\d{4}-\d{2}-\d{2}$/);
});
