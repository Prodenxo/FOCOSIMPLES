import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCalendarEventWhatsappDetail,
  pickMeetUriFromGoogleEvent,
} from '../src/services/calendar-events.service.js';

test('formatCalendarEventWhatsappDetail indica quando falta Meet (Google)', () => {
  const detail = formatCalendarEventWhatsappDetail({
    title: 'Reunião cliente',
    source: 'google',
    time: '15:00',
    endTime: '16:00',
  });
  assert.match(detail, /Sem Google Meet/);
  assert.doesNotMatch(detail, /meet\.google/);
});

test('formatCalendarEventWhatsappDetail mostra Meet quando existe', () => {
  const detail = formatCalendarEventWhatsappDetail({
    title: 'Call',
    source: 'google',
    time: '10:00',
    meetLink: 'https://meet.google.com/abc-defg-hij',
  });
  assert.match(detail, /meet\.google\.com/);
  assert.doesNotMatch(detail, /Sem Google Meet/);
});

test('pickMeetUriFromGoogleEvent lê hangoutLink', () => {
  const uri = pickMeetUriFromGoogleEvent({
    hangoutLink: 'https://meet.google.com/xyz-abcd-efg',
  });
  assert.equal(uri, 'https://meet.google.com/xyz-abcd-efg');
});
