import test from 'node:test';
import assert from 'node:assert/strict';

import {
  pickNextCalendarCandidate,
  resolveFindNextCalendarOptionsFromPayload,
} from '../src/services/calendar-events.service.js';

const mk = (id, title, hour) => ({
  event: { id, title, time: `${String(hour).padStart(2, '0')}:00` },
  start: new Date(`2026-05-28T${String(hour).padStart(2, '0')}:00:00-03:00`),
  day: { dateDisplay: '28/05/2026' },
});

test('pickNextCalendarCandidate: skipCount 0 1 2', () => {
  const list = [mk('a', 'Arthur', 11), mk('b', 'Leo', 12), mk('c', 'Abacate', 13)];
  assert.equal(pickNextCalendarCandidate(list, { skipCount: 0 })?.event.id, 'a');
  assert.equal(pickNextCalendarCandidate(list, { skipCount: 1 })?.event.id, 'b');
  assert.equal(pickNextCalendarCandidate(list, { skipCount: 2 })?.event.id, 'c');
  assert.equal(pickNextCalendarCandidate(list, { skipCount: 3 }), null);
});

test('pickNextCalendarCandidate: afterEventId remove o primeiro', () => {
  const list = [mk('a', 'Arthur', 11), mk('b', 'Leo', 12)];
  assert.equal(
    pickNextCalendarCandidate(list, { afterEventId: 'a', skipCount: 0 })?.event.id,
    'b',
  );
});

test('resolveFindNextCalendarOptionsFromPayload', () => {
  assert.deepEqual(
    resolveFindNextCalendarOptionsFromPayload({ skipCount: 2 }),
    { skipCount: 2, afterStart: null, afterEventId: null },
  );
  const o = resolveFindNextCalendarOptionsFromPayload({
    afterEventId: 'evt-1',
    afterStart: '2026-05-28T12:00:00-03:00',
  });
  assert.equal(o.afterEventId, 'evt-1');
  assert.ok(o.afterStart instanceof Date);
});
