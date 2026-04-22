import { describe, test, expect } from '@jest/globals';
import { formatEvent, formatEventList } from '../src/formatters.js';

// Master VEVENT for a MWF recurring event created in January (EST = UTC-5).
// The server returns this master event even for April time-range queries.
const RECURRING_EST_ICAL = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VTIMEZONE
TZID:America/New_York
BEGIN:DAYLIGHT
TZNAME:EDT
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZNAME:EST
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:test-recurring-dst@example.com
SUMMARY:Lab Software: Discovery
DTSTART;TZID=America/New_York:20260121T060000
DTEND;TZID=America/New_York:20260121T063000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR
END:VEVENT
END:VCALENDAR`;

const makeEvent = (data) => ({ url: 'https://example.com/event.ics', etag: '"1"', data });

describe('recurring event DST display', () => {
  test('without timeRange: shows master DTSTART (January)', () => {
    const output = formatEvent(makeEvent(RECURRING_EST_ICAL), 'Test Calendar');
    expect(output).toContain('January 21, 2026');
  });

  test('with April timeRange: shows April occurrence, not January', () => {
    const timeRange = { start: '2026-04-22T00:00:00Z', end: '2026-04-29T00:00:00Z' };
    const output = formatEvent(makeEvent(RECURRING_EST_ICAL), 'Test Calendar', timeRange);
    expect(output).not.toContain('January');
    // First MWF occurrence in Apr 22–29 is Wednesday Apr 22
    expect(output).toContain('April 22, 2026');
  });

  test('with April timeRange: shows EDT offset (UTC-4), not EST (UTC-5)', () => {
    const timeRange = { start: '2026-04-22T00:00:00Z', end: '2026-04-29T00:00:00Z' };
    const output = formatEvent(makeEvent(RECURRING_EST_ICAL), 'Test Calendar', timeRange);
    // 6 AM EDT should display with EDT abbreviation
    expect(output).toContain('EDT');
    expect(output).not.toContain('EST');
  });

  test('with April timeRange: correct local time (6:00 AM)', () => {
    const timeRange = { start: '2026-04-22T00:00:00Z', end: '2026-04-29T00:00:00Z' };
    const output = formatEvent(makeEvent(RECURRING_EST_ICAL), 'Test Calendar', timeRange);
    expect(output).toContain('6:00 AM');
  });

  test('formatEventList passes timeRange to each event', () => {
    const timeRange = { start: '2026-04-22T00:00:00Z', end: '2026-04-29T00:00:00Z' };
    const result = formatEventList([makeEvent(RECURRING_EST_ICAL)], 'Test Calendar', timeRange);
    expect(result.content[0].text).toContain('April 22, 2026');
    expect(result.content[0].text).not.toContain('January');
  });
});

describe('formatDateTime timezone display', () => {
  test('UTC events still show UTC', () => {
    const UTC_ICAL = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:test-utc@example.com
SUMMARY:UTC Event
DTSTART:20260422T100000Z
DTEND:20260422T110000Z
END:VEVENT
END:VCALENDAR`;
    const output = formatEvent(makeEvent(UTC_ICAL), 'Test');
    expect(output).toContain('UTC');
  });

  test('named-timezone events show that timezone abbreviation', () => {
    const output = formatEvent(makeEvent(RECURRING_EST_ICAL), 'Test');
    // Without timeRange, master DTSTART is Jan (EST)
    expect(output).toMatch(/EST|EDT/);
  });
});
