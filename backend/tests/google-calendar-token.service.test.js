import test from 'node:test';
import assert from 'node:assert/strict';
import { probeGoogleCalendarAccess } from '../src/services/google-calendar-token.service.js';

test('probeGoogleCalendarAccess retorna false sem token', async () => {
  assert.equal(await probeGoogleCalendarAccess(''), false);
});
