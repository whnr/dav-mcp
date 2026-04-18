import { tsdavManager } from '../../tsdav-client.js';
import { validateInput } from '../../validation.js';
import { formatSuccess } from '../../formatters.js';
import { z } from 'zod';
import { updateFields } from 'tsdav-utils';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const updateEventFieldsSchema = z.object({
  event_url: z.string().url('Event URL must be a valid URL'),
  event_etag: z.string().min(1, 'Event etag is required'),
  fields: z.record(z.string()).optional(),
  all_day: z.boolean().optional(),
}).refine((data) => {
  if (!data.all_day) return true;
  const fields = data.fields || {};
  if (fields.DTSTART && !dateOnlyPattern.test(fields.DTSTART)) return false;
  if (fields.DTEND && !dateOnlyPattern.test(fields.DTEND)) return false;
  return true;
}, {
  message: 'All-day events require DTSTART and DTEND in YYYY-MM-DD format (e.g. "2026-05-25", "2026-05-26")',
  path: ['fields'],
});

export const updateEventFields = {
  name: 'update_event',
  description: 'PREFERRED: Update event fields without iCal formatting. Supports: SUMMARY (title), DESCRIPTION (details), LOCATION (place), DTSTART (start time), DTEND (end time), STATUS (TENTATIVE/CONFIRMED/CANCELLED), all_day (convert to/from all-day), and any RFC 5545 property including custom X-* properties.',
  inputSchema: {
    type: 'object',
    properties: {
      event_url: {
        type: 'string',
        description: 'The URL of the event to update'
      },
      event_etag: {
        type: 'string',
        description: 'The etag of the event (required for conflict detection)'
      },
      all_day: {
        type: 'boolean',
        description: 'Set to true to convert the event to all-day. When true, DTSTART and DTEND in fields must be in YYYY-MM-DD format (e.g. "2026-05-25"). end_date is exclusive — for a single all-day event use start+1 day.',
      },
      fields: {
        type: 'object',
        description: 'Fields to update — use UPPERCASE property names. Any RFC 5545 property or custom X-* property is supported.',
        additionalProperties: {
          type: 'string'
        },
        properties: {
          SUMMARY: {
            type: 'string',
            description: 'Event title/summary'
          },
          DESCRIPTION: {
            type: 'string',
            description: 'Event description/details'
          },
          LOCATION: {
            type: 'string',
            description: 'Physical or virtual meeting location'
          },
          DTSTART: {
            type: 'string',
            description: 'Start date/time. For timed events use iCal datetime format (e.g. "20260525T100000Z"). For all-day events use YYYY-MM-DD (e.g. "2026-05-25") with all_day: true.',
          },
          DTEND: {
            type: 'string',
            description: 'End date/time. For timed events use iCal datetime format. For all-day events use YYYY-MM-DD with all_day: true. Exclusive end — set to the day after the last day of the event.',
          },
          STATUS: {
            type: 'string',
            description: 'Event status: TENTATIVE, CONFIRMED, or CANCELLED'
          }
        }
      }
    },
    required: ['event_url', 'event_etag']
  },
  handler: async (args) => {
    const validated = validateInput(updateEventFieldsSchema, args);
    const client = tsdavManager.getCalDavClient();

    const calendarUrl = validated.event_url.substring(0, validated.event_url.lastIndexOf('/') + 1);
    const currentEvents = await client.fetchCalendarObjects({
      calendar: { url: calendarUrl },
      objectUrls: [validated.event_url]
    });

    if (!currentEvents || currentEvents.length === 0) {
      throw new Error('Event not found');
    }

    const calendarObject = currentEvents[0];

    // When all_day is set, transform DTSTART/DTEND from YYYY-MM-DD to DTSTART;VALUE=DATE:YYYYMMDD
    // so tsdav-utils serialises them correctly as date-only properties.
    let fields = { ...(validated.fields || {}) };
    if (validated.all_day) {
      if (fields.DTSTART) {
        fields['DTSTART;VALUE=DATE'] = fields.DTSTART.replace(/-/g, '');
        delete fields.DTSTART;
      }
      if (fields.DTEND) {
        fields['DTEND;VALUE=DATE'] = fields.DTEND.replace(/-/g, '');
        delete fields.DTEND;
      }
    }

    const updatedData = updateFields(calendarObject, fields);

    const updateResponse = await client.updateCalendarObject({
      calendarObject: {
        url: validated.event_url,
        data: updatedData,
        etag: validated.event_etag
      }
    });

    return formatSuccess('Event updated successfully', {
      etag: updateResponse.etag,
      updated_fields: Object.keys(validated.fields || {}),
      message: `Updated ${Object.keys(validated.fields || {}).length} field(s): ${Object.keys(validated.fields || {}).join(', ')}`
    });
  }
};
