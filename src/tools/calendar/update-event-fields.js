import { tsdavManager } from '../../tsdav-client.js';
import { validateInput, updateEventFieldsSchema, sanitizeICalString } from '../../validation.js';
import { formatSuccess } from '../../formatters.js';
import { updateFields } from 'tsdav-utils';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

export const updateEventFields = {
  name: 'update_event',
  description: 'PREFERRED: Update specific fields of a calendar event. All parameters are optional except event_url and event_etag — only provided fields are changed. Use extra_fields for any RFC 5545 (https://www.rfc-editor.org/rfc/rfc5545) property not covered by named params (e.g. RRULE, ATTENDEE, X-* custom properties).',
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
      summary: {
        type: 'string',
        description: 'Event title'
      },
      description: {
        type: 'string',
        description: 'Event description/details'
      },
      location: {
        type: 'string',
        description: 'Physical or virtual meeting location'
      },
      start_date: {
        type: 'string',
        description: 'Start date. ISO 8601 datetime (e.g. "2026-05-25T10:00:00Z") for timed events, or YYYY-MM-DD (e.g. "2026-05-25") for all-day events.'
      },
      end_date: {
        type: 'string',
        description: 'End date. ISO 8601 datetime for timed events, or YYYY-MM-DD for all-day events. Exclusive end — for a single all-day event set end_date to the next day.'
      },
      all_day: {
        type: 'boolean',
        description: 'Convert to/from all-day event. When true, start_date and end_date must be in YYYY-MM-DD format. Can be omitted when the date format is unambiguous.'
      },
      status: {
        type: 'string',
        enum: ['TENTATIVE', 'CONFIRMED', 'CANCELLED'],
        description: 'Event status'
      },
      extra_fields: {
        type: 'object',
        description: 'Additional RFC 5545 properties (https://www.rfc-editor.org/rfc/rfc5545) to set, keyed by UPPERCASE property name. Use for RRULE, ATTENDEE, X-* custom properties, etc.',
        additionalProperties: { type: 'string' }
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

    const isAllDay = validated.all_day || (validated.start_date && dateOnlyPattern.test(validated.start_date));

    const fields = {};

    if (validated.summary !== undefined) fields.SUMMARY = sanitizeICalString(validated.summary);
    if (validated.description !== undefined) fields.DESCRIPTION = sanitizeICalString(validated.description);
    if (validated.location !== undefined) fields.LOCATION = sanitizeICalString(validated.location);
    if (validated.status !== undefined) fields.STATUS = validated.status;

    if (validated.start_date !== undefined) {
      if (isAllDay) {
        fields['DTSTART;VALUE=DATE'] = validated.start_date.replace(/-/g, '');
      } else {
        fields.DTSTART = validated.start_date;
      }
    }
    if (validated.end_date !== undefined) {
      if (isAllDay) {
        fields['DTEND;VALUE=DATE'] = validated.end_date.replace(/-/g, '');
      } else {
        fields.DTEND = validated.end_date;
      }
    }

    if (validated.extra_fields) {
      Object.assign(fields, validated.extra_fields);
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
      updated_fields: Object.keys(fields),
      message: `Updated ${Object.keys(fields).length} field(s): ${Object.keys(fields).join(', ')}`
    });
  }
};
