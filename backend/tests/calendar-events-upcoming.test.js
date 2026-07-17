import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calendarDateTodayInSaoPaulo,
  isCalendarEventStillRelevant,
  isCalendarEventUpcomingStrict,
} from '../src/services/calendar-events.service.js';

test('isCalendarEventStillRelevant: reunião das 8h já passou hoje', () => {
  const today = calendarDateTodayInSaoPaulo();
  const noon = new Date(`${today}T12:00:00-03:00`);
  const morningMeeting = {
    date: today,
    time: '08:00:00',
    startAtIso: `${today}T08:00:00-03:00`,
    endAtIso: `${today}T09:00:00-03:00`,
    allDay: false,
    source: 'google',
  };
  assert.equal(isCalendarEventStillRelevant(morningMeeting, noon), false);
});

test('isCalendarEventStillRelevant: reunião das 15h ainda não passou ao meio-dia', () => {
  const today = calendarDateTodayInSaoPaulo();
  const noon = new Date(`${today}T12:00:00-03:00`);
  const afternoonMeeting = {
    date: today,
    time: '15:00:00',
    startAtIso: `${today}T15:00:00-03:00`,
    endAtIso: `${today}T16:00:00-03:00`,
    allDay: false,
    source: 'google',
  };
  assert.equal(isCalendarEventStillRelevant(afternoonMeeting, noon), true);
});

test('isCalendarEventUpcomingStrict: reunião 10h–11h já terminou à tarde', () => {
  const today = calendarDateTodayInSaoPaulo();
  const evening = new Date(`${today}T17:00:00-03:00`);
  const pastMeeting = {
    date: today,
    time: '10:00',
    endTime: '11:00',
    startAtIso: `${today}T10:00:00-03:00`,
    endAtIso: `${today}T11:00:00-03:00`,
    allDay: false,
    source: 'google',
  };
  assert.equal(isCalendarEventUpcomingStrict(pastMeeting, evening), false);
});

test('isCalendarEventUpcomingStrict: reunião às 19h ainda é futura às 17h', () => {
  const today = calendarDateTodayInSaoPaulo();
  const evening = new Date(`${today}T17:00:00-03:00`);
  const futureMeeting = {
    date: today,
    time: '19:00',
    endTime: '20:00',
    startAtIso: `${today}T19:00:00-03:00`,
    endAtIso: `${today}T20:00:00-03:00`,
    allDay: false,
    source: 'google',
  };
  assert.equal(isCalendarEventUpcomingStrict(futureMeeting, evening), true);
});
