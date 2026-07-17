import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCalendarAskStartEndTimeMessage,
  buildGoogleStyleTimeSlots,
  formatCalendarTimeLabel,
  isCalendarTimeOnSlot,
  snapCalendarTimeToSlot,
} from '../src/services/calendar-time-slots.js';
import { resolveCreateCalendarTimesFromPayload } from '../src/services/calendar-events.service.js';

test('snapCalendarTimeToSlot — paridade Google 15 min', () => {
  assert.deepEqual(snapCalendarTimeToSlot(14, 37), { hour: 14, minute: 30, wasSnapped: true });
  assert.deepEqual(snapCalendarTimeToSlot(15, 0), { hour: 15, minute: 0, wasSnapped: false });
  assert.deepEqual(snapCalendarTimeToSlot(8, 8), { hour: 8, minute: 15, wasSnapped: true });
});

test('buildGoogleStyleTimeSlots — 96 slots por dia', () => {
  const slots = buildGoogleStyleTimeSlots();
  assert.equal(slots.length, 96);
  assert.equal(slots[0].label, '00:00');
  assert.equal(slots[slots.length - 1].label, '23:45');
});

test('isCalendarTimeOnSlot', () => {
  assert.equal(isCalendarTimeOnSlot(10, 30), true);
  assert.equal(isCalendarTimeOnSlot(10, 20), false);
});

test('buildCalendarAskStartEndTimeMessage menciona início, término e exemplos', () => {
  const msg = buildCalendarAskStartEndTimeMessage();
  assert.match(msg, /início/i);
  assert.match(msg, /término/i);
  assert.match(msg, /14:15/);
  assert.match(msg, /16:00/);
});

test('resolveCreateCalendarTimesFromPayload preserva minutos exatos', () => {
  const t = resolveCreateCalendarTimesFromPayload({
    time: '14:37',
    endTime: '16:12',
  });
  assert.equal(formatCalendarTimeLabel(t.startHour, t.startMinute), '14:37');
  assert.equal(formatCalendarTimeLabel(t.endHour, t.endMinute), '16:12');
});

test('resolveCreateCalendarTimesFromPayload aceita reunião 14h–14h15', () => {
  const t = resolveCreateCalendarTimesFromPayload({
    time: '14:00',
    endTime: '14:15',
  });
  assert.equal(formatCalendarTimeLabel(t.startHour, t.startMinute), '14:00');
  assert.equal(formatCalendarTimeLabel(t.endHour, t.endMinute), '14:15');
});

test('resolveCreateCalendarTimesFromPayload exige fim quando só início', () => {
  assert.throws(
    () => resolveCreateCalendarTimesFromPayload({
      time: '14:00',
    }),
    (err) => err?.errors?.code === 'CALENDAR_END_TIME_REQUIRED',
  );
});

test('resolveCreateCalendarTimesFromPayload exige início e fim com Meet', () => {
  assert.throws(
    () => resolveCreateCalendarTimesFromPayload(
      { title: 'Call' },
      { wantsMeet: true },
    ),
    (err) => err?.errors?.code === 'CALENDAR_TIME_SLOTS_REQUIRED',
  );
});

test('resolveCreateCalendarTimesFromPayload separa início e fim em slots', () => {
  const t = resolveCreateCalendarTimesFromPayload({
    time: '18:30',
    endTime: '19:30',
  });
  assert.equal(t.startHour, 18);
  assert.equal(t.startMinute, 30);
  assert.equal(t.endHour, 19);
  assert.equal(t.endMinute, 30);
});
