import { describe, test, expect } from '@jest/globals';
import { formatEvent } from '../src/formatters.js';

const makeAllDayICal = (dtstart, dtend, summary = 'My Birthday') => [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//test//EN',
  'BEGIN:VEVENT',
  'UID:test-allday@example.com',
  `DTSTART;VALUE=DATE:${dtstart}`,
  `DTEND;VALUE=DATE:${dtend}`,
  `SUMMARY:${summary}`,
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('All-day event formatting', () => {
  test('formatEvent should show date only (no time) for VALUE=DATE events', () => {
    const icalData = makeAllDayICal('20260525', '20260526');
    const result = formatEvent({ data: icalData, url: 'https://example.com/event.ics' });
    expect(result).toContain('May 25, 2026');
    expect(result).not.toMatch(/\d{1,2}:\d{2}/);
  });

  test('formatEvent should not contain AM/PM for all-day events', () => {
    const icalData = makeAllDayICal('20260101', '20260102');
    const result = formatEvent({ data: icalData, url: 'https://example.com/event.ics' });
    expect(result).not.toMatch(/AM|PM/);
  });

  test('formatEvent should not contain UTC timezone label for all-day events', () => {
    const icalData = makeAllDayICal('20261225', '20261226', 'Christmas');
    const result = formatEvent({ data: icalData, url: 'https://example.com/event.ics' });
    expect(result).toContain('December 25, 2026');
    expect(result).not.toContain('UTC');
  });
});
