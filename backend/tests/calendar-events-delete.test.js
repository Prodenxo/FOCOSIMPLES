import test from 'node:test';
import assert from 'node:assert/strict';
import { isGoogleCalendarItemActive } from '../src/services/calendar-events.service.js';

test('isGoogleCalendarItemActive ignora cancelados do Google', () => {
  assert.equal(isGoogleCalendarItemActive({ status: 'confirmed' }), true);
  assert.equal(isGoogleCalendarItemActive({ status: 'cancelled' }), false);
  assert.equal(isGoogleCalendarItemActive({ status: 'canceled' }), false);
  assert.equal(isGoogleCalendarItemActive({}), true);
});
