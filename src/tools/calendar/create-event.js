import { tsdavManager } from '../../tsdav-client.js';
import { validateInput, createEventSchema, sanitizeICalString } from '../../validation.js';
import { formatSuccess } from '../../formatters.js';
import { formatICalDate, generateUID, findCalendarOrThrow } from '../shared/helpers.js';

/**
 * Create a new calendar event
 */
export const createEvent = {
  name: 'create_event',
  description: 'Create a new calendar event with title, date, time, optional description and location',
  inputSchema: {
    type: 'object',
    properties: {
      calendar_url: {
        type: 'string',
        description: 'The URL of the calendar to create the event in',
      },
      summary: {
        type: 'string',
        description: 'Event title/summary',
      },
      start_date: {
        type: 'string',
        description: 'Start date. Use ISO 8601 datetime (e.g., "2026-05-25T10:00:00Z") for timed events, or YYYY-MM-DD (e.g., "2026-05-25") for all-day events.',
      },
      end_date: {
        type: 'string',
        description: 'End date. Use ISO 8601 datetime for timed events, or YYYY-MM-DD for all-day events. For a single all-day event, set end_date to the next day (e.g., start "2026-05-25", end "2026-05-26").',
      },
      all_day: {
        type: 'boolean',
        description: 'Set to true to create an all-day event. Can be omitted when start_date/end_date are in YYYY-MM-DD format — the format is auto-detected.',
      },
      description: {
        type: 'string',
        description: 'Event description (optional)',
      },
      location: {
        type: 'string',
        description: 'Event location (optional)',
      },
    },
    required: ['calendar_url', 'summary', 'start_date', 'end_date'],
  },
  handler: async (args) => {
    const validated = validateInput(createEventSchema, args);
    const client = tsdavManager.getCalDavClient();
    const calendars = await client.fetchCalendars();
    const calendar = findCalendarOrThrow(calendars, validated.calendar_url);

    const now = new Date();
    const uid = generateUID('event');

    const summary = sanitizeICalString(validated.summary);
    const description = validated.description ? sanitizeICalString(validated.description) : '';
    const location = validated.location ? sanitizeICalString(validated.location) : '';

    const isAllDay = validated.all_day || /^\d{4}-\d{2}-\d{2}$/.test(validated.start_date);
    let dtstart, dtend;
    if (isAllDay) {
      dtstart = `DTSTART;VALUE=DATE:${validated.start_date.replace(/-/g, '')}`;
      dtend = `DTEND;VALUE=DATE:${validated.end_date.replace(/-/g, '')}`;
    } else {
      dtstart = `DTSTART:${formatICalDate(new Date(validated.start_date))}`;
      dtend = `DTEND:${formatICalDate(new Date(validated.end_date))}`;
    }

    const iCalString = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//tsdav-mcp-server//EN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatICalDate(now)}
${dtstart}
${dtend}
SUMMARY:${summary}${description ? `\nDESCRIPTION:${description}` : ''}${location ? `\nLOCATION:${location}` : ''}
END:VEVENT
END:VCALENDAR`;

    const response = await client.createCalendarObject({
      calendar,
      filename: `${uid}.ics`,
      iCalString,
    });

    return formatSuccess('Event created successfully', {
      url: response.url,
      etag: response.etag,
      summary: validated.summary,
    });
  },
};
