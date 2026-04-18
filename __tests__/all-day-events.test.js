import { describe, test, expect, jest } from '@jest/globals';
import { formatEvent } from '../src/formatters.js';

// --- Mock tsdavManager for create-event handler tests ---
const mockCreateCalendarObject = jest.fn().mockResolvedValue({ url: 'http://example.com/event.ics', etag: '"abc"' });
const mockFetchCalendars = jest.fn().mockResolvedValue([{ url: 'https://example.com/calendar/' }]);

jest.unstable_mockModule('../src/tsdav-client.js', () => ({
  tsdavManager: {
    getCalDavClient: () => ({
      fetchCalendars: mockFetchCalendars,
      createCalendarObject: mockCreateCalendarObject,
    }),
  },
}));

const { createEvent } = await import('../src/tools/calendar/create-event.js');

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

describe('create_event iCal generation', () => {
  const baseArgs = {
    calendar_url: 'https://example.com/calendar/',
    summary: 'Test Event',
  };

  beforeEach(() => mockCreateCalendarObject.mockClear());

  test('date-only start_date auto-detects all-day and emits VALUE=DATE with next-day DTEND', async () => {
    await createEvent.handler({ ...baseArgs, start_date: '2026-04-26', end_date: '2026-04-27' });
    const { iCalString } = mockCreateCalendarObject.mock.calls[0][0];
    expect(iCalString).toContain('DTSTART;VALUE=DATE:20260426');
    expect(iCalString).toContain('DTEND;VALUE=DATE:20260427');
    expect(iCalString).not.toMatch(/^DTSTART:\d{8}T/m);
    expect(iCalString).not.toMatch(/^DTEND:\d{8}T/m);
  });

  test('all_day:true with same-day datetimes advances DTEND to next day', async () => {
    await createEvent.handler({
      ...baseArgs,
      start_date: '2026-04-26T00:00:00Z',
      end_date: '2026-04-26T23:59:59',
      all_day: true,
    });
    const { iCalString } = mockCreateCalendarObject.mock.calls[0][0];
    expect(iCalString).toContain('DTSTART;VALUE=DATE:20260426');
    expect(iCalString).toContain('DTEND;VALUE=DATE:20260427');
  });

  test('all_day:true with multi-day datetime range preserves the end date', async () => {
    await createEvent.handler({
      ...baseArgs,
      start_date: '2026-04-26T00:00:00Z',
      end_date: '2026-04-28T00:00:00Z',
      all_day: true,
    });
    const { iCalString } = mockCreateCalendarObject.mock.calls[0][0];
    expect(iCalString).toContain('DTSTART;VALUE=DATE:20260426');
    expect(iCalString).toContain('DTEND;VALUE=DATE:20260428');
  });

  test('timed event emits plain DTSTART/DTEND without VALUE=DATE', async () => {
    await createEvent.handler({
      ...baseArgs,
      start_date: '2026-04-26T10:00:00Z',
      end_date: '2026-04-26T11:00:00Z',
    });
    const { iCalString } = mockCreateCalendarObject.mock.calls[0][0];
    expect(iCalString).toContain('DTSTART:20260426T100000Z');
    expect(iCalString).not.toContain('VALUE=DATE');
  });
});
